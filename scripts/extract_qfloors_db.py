"""
One-time recovery: parse a raw SQL Anywhere 9 QFloors database file and emit
product rows as JSON. Used when no SQL Anywhere engine is available to open
the file normally.

Usage:
    python3 scripts/extract_qfloors_db.py <path-to.db> <out.json>

Row layouts were recovered by inspecting the raw pages. Strings are
length-prefixed (one byte), numbers are little-endian.

ProductColor row (anchored on the SKU string):
    [len]ColorName [i32]StyleIndex [f64]Retail [f64]Cut [u16]tag [f64]Width
    [i32]flag [len]SKU [f64] [i32] 8x00 [len]Backing/date

ProductStyle row (anchored on the 0x60 tag byte):
    0x60 [i32]StyleIndex [len]StyleName [i32]VenderIndex [f64]Retail [f64]Cut
    [u16]tag [f64]Width [i32] [len]StyleNumber ...

Manufacturer names embed a mill code, e.g. "DIXIE HOME/TRUCOR (D418) **".
That same code appears inside the SKU (SEPD418HALSTED-...). We take the
manufacturer only from a string carrying such a code -- either embedded in the
SKU or found within the style row's byte span. Reading it positionally is
unreliable: the trailing fields hold dates and fiber content, and a positional
read walks into the next row, which is what produced wrong manufacturers on an
earlier pass. When no mill code is available the field is left blank rather
than guessed.
"""

import json
import re
import struct
import sys
from collections import Counter, defaultdict

TAG_MIN, TAG_MAX = 250, 600      # u16 discriminator observed on every real row
MAX_WIDTH = 100.0
MAX_MONEY = 100000.0

# "NAME (CODE)" optionally followed by asterisks; CODE is 1-3 letters + 2-4 digits
MFG_RE = re.compile(
    rb'([\x08-\x3c])([A-Za-z0-9][A-Za-z0-9 &/\.,\'\-]{3,40}\(([A-Za-z]{1,3}\d{2,4})\)[ \*]{0,6})'
)
MFG_STR_RE = re.compile(
    r'^[A-Za-z0-9][A-Za-z0-9 &/\.,\'\-]{2,40}\(([A-Za-z]{1,3}\d{2,4})\)[ \*]{0,6}$'
)
SKU_RE = re.compile(rb'[\x05-\x30][A-Z0-9][A-Z0-9\-\./ &+]{4,47}')
STYLE_RE = re.compile(rb'\x60(....)', re.DOTALL)


def printable(bs):
    return all(32 <= b < 127 for b in bs)


def read_lstr(data, pos, maxlen=60):
    """Read a length-prefixed ASCII string at pos. Returns (text, end) or None."""
    if pos < 0 or pos >= len(data):
        return None
    n = data[pos]
    if n == 0 or n > maxlen:
        return None
    s = data[pos + 1:pos + 1 + n]
    if len(s) < n or not printable(s):
        return None
    return s.decode('ascii'), pos + 1 + n


def parse_colors(data):
    """ProductColor rows, anchored on the SKU string."""
    out = []
    for m in SKU_RE.finditer(data):
        L = m.start()
        n = data[L]
        # The regex is greedy and can overrun the real string; the length byte
        # is authoritative, so accept a match that merely starts with the SKU.
        if n < 5 or L + 1 + n > m.end():
            continue
        sku = data[L + 1:L + 1 + n].decode('ascii')
        try:
            style_ix = struct.unpack('<i', data[L - 34:L - 30])[0]
            retail = struct.unpack('<d', data[L - 30:L - 22])[0]
            cut = struct.unpack('<d', data[L - 22:L - 14])[0]
            tag = struct.unpack('<H', data[L - 14:L - 12])[0]
            width = struct.unpack('<d', data[L - 12:L - 4])[0]
        except struct.error:
            continue
        if not (0 < style_ix < 100000):
            continue
        if not (0 <= retail < MAX_MONEY and 0 <= cut < MAX_MONEY):
            continue
        if not (TAG_MIN <= tag <= TAG_MAX) or not (0 <= width < MAX_WIDTH):
            continue

        # ColorName is the length-prefixed string ending right at L-34
        name_end = L - 34
        color = None
        for nl in range(1, 41):
            q = name_end - nl - 1
            if q < 0:
                break
            if data[q] == nl and printable(data[q + 1:q + 1 + nl]):
                color = data[q + 1:q + 1 + nl].decode('ascii')
                break
        if color is None:
            continue

        backing = None
        b = read_lstr(data, L + 1 + n + 20, 40)
        if b:
            backing = b[0]
        out.append((sku, color, style_ix, retail, cut, width, backing))
    return out


def parse_styles(data):
    """ProductStyle rows, anchored on the 0x60 tag."""
    styles = {}
    for m in STYLE_RE.finditer(data):
        six = struct.unpack('<i', m.group(1))[0]
        if not (0 < six < 100000) or six in styles:
            continue
        r = read_lstr(data, m.end())
        if not r:
            continue
        sname, p2 = r
        if len(sname) < 2:
            continue
        try:
            vender = struct.unpack('<i', data[p2:p2 + 4])[0]
            tag = struct.unpack('<H', data[p2 + 20:p2 + 22])[0]
            width = struct.unpack('<d', data[p2 + 22:p2 + 30])[0]
        except struct.error:
            continue
        if not (TAG_MIN <= tag <= TAG_MAX) or not (0 <= width < MAX_WIDTH):
            continue
        if not (0 < vender < 100000):
            continue
        r2 = read_lstr(data, p2 + 34)
        stylenum = r2[0] if r2 else ""
        # Walk the rest of the row for a string carrying a mill code. Dates and
        # fiber content also live here, so only a mill code identifies the
        # manufacturer; anything else is ignored.
        row_mfg = ""
        q = p2 + 34
        end = q + 300
        while q < end:
            rt = read_lstr(data, q, 60)
            if not rt:
                q += 1
                continue
            text, q = rt
            if text in ('0', '`') or len(text.strip()) <= 1:
                break          # row terminator; past here is the next record
            if MFG_STR_RE.match(text.strip()):
                row_mfg = text.strip()
                break
        styles[six] = (sname, stylenum, width, vender, row_mfg)
    return styles


def harvest_mill_codes(data):
    """code -> manufacturer name, by majority vote across the whole file."""
    codes = defaultdict(Counter)
    for m in MFG_RE.finditer(data):
        n = m.group(1)[0]
        body = m.group(2)
        if len(body) != n:          # length byte must cover the name exactly
            continue
        code = m.group(3).decode('ascii').upper()
        codes[code][body.decode('ascii').strip()] += 1
    return {c: v.most_common(1)[0][0] for c, v in codes.items()}


def build_vender_map(styles, mill_codes):
    """VenderIndex -> mill code, voted across every style row sharing it."""
    votes = defaultdict(Counter)
    for sname, stylenum, width, vender, row_mfg in styles.values():
        if not row_mfg:
            continue
        m = re.search(r'\(([A-Za-z]{1,3}\d{2,4})\)', row_mfg)
        if m and m.group(1).upper() in mill_codes:
            votes[vender][m.group(1).upper()] += 1
    return {v: c.most_common(1)[0][0] for v, c in votes.items()}


def code_from_sku(sku, sorted_codes):
    """Longest mill code embedded in the SKU, if any."""
    up = sku.upper()
    for code in sorted_codes:          # pre-sorted longest-first
        if code in up:
            return code
    return None


def main():
    db_path, out_path = sys.argv[1], sys.argv[2]
    data = open(db_path, 'rb').read()
    print(f"Read {len(data):,} bytes")

    colors = parse_colors(data)
    print(f"ProductColor rows: {len(colors):,}")

    styles = parse_styles(data)
    print(f"ProductStyle rows: {len(styles):,}")

    mill_codes = harvest_mill_codes(data)
    print(f"Mill codes: {len(mill_codes):,}")

    vender_map = build_vender_map(styles, mill_codes)
    print(f"VenderIndex -> mill code entries: {len(vender_map):,}")

    # Only codes of 4+ chars are distinctive enough to substring-match a SKU
    sorted_codes = sorted((c for c in mill_codes if len(c) >= 4), key=len, reverse=True)

    # Collapse duplicate SKU copies by majority vote
    by_sku = defaultdict(list)
    for c in colors:
        by_sku[c[0]].append(c)

    products = []
    src = Counter()
    agree = Counter()
    for sku, lst in by_sku.items():
        sku_, color, six, retail, cut, width, backing = Counter(lst).most_common(1)[0][0]
        st = styles.get(six)
        sname = st[0] if st else ""
        stylenum = st[1] if st else ""
        w = width or (st[2] if st else 0)

        # Two independent signals: the code embedded in the SKU, and the
        # mill-code manufacturer carried on the style row.
        sku_code = code_from_sku(sku, sorted_codes)
        row_code = None
        if st and st[4]:
            m = re.search(r'\(([A-Za-z]{1,3}\d{2,4})\)', st[4])
            if m:
                row_code = m.group(1).upper()
        if st and not row_code and st[3] in vender_map:
            row_code = vender_map[st[3]]

        if sku_code and row_code:
            agree['same' if sku_code == row_code else 'differ'] += 1

        # The style row wins on disagreement: it is the record the
        # manufacturer actually hangs off of, whereas a SKU substring can
        # collide by chance.
        code = row_code or sku_code
        src['row' if row_code else ('sku' if sku_code else 'none')] += 1
        mfg = mill_codes.get(code, "") if code else ""

        if not w:
            wstr = ""
        elif abs(w - round(w)) < 0.005:
            wstr = f"{w:.0f}"
        else:
            wstr = f"{w:.2f}".rstrip('0').rstrip('.')

        products.append({
            "sku": sku.strip(),
            "style_name": sname.strip(),
            "style_number": stylenum.strip(),
            "color_name": color.strip(),
            "color_number": "",
            "cost": f"{cut:.2f}",
            "price": f"${retail:.2f}",
            "manufacturer": mfg.strip(),
            "width": wstr,
            "backing": (backing or "").strip() or None,
        })

    n = len(products)
    ws = sum(1 for r in products if r['style_name'])
    wm = sum(1 for r in products if r['manufacturer'])
    print(f"\nProducts: {n:,}")
    print(f"  with style name:   {ws:,} ({100*ws/n:.1f}%)")
    print(f"  with manufacturer: {wm:,} ({100*wm/n:.1f}%)")
    print(f"  mfg source: {dict(src)}")
    both = agree['same'] + agree['differ']
    if both:
        print(f"  cross-check: {agree['same']:,}/{both:,} "
              f"({100*agree['same']/both:.1f}%) agree where both signals exist")

    json.dump(products, open(out_path, 'w'))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
