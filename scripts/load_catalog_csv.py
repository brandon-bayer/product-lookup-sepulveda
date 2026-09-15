"""
Load the QFloors QConnect SHOWROOM catalog CSV into Neon, fully replacing
sepulveda_products. This is the live-data path: whatever is flagged
"Display Online"/"Display Tags" in QFloors and returned by
get-product-catalog-csv becomes the entire app catalog.

Safety: dry-run by default. Pass --replace to actually delete and reload.

Usage:
    # inspect what would load (no DB changes)
    python3 scripts/load_catalog_csv.py catalog.csv

    # do the full replace
    NEON_URL='postgresql://...' python3 scripts/load_catalog_csv.py catalog.csv --replace

Column mapping (QFloors CSV header -> sepulveda_products), confirmed 2026-09-15:
    ~~ManWebOneStyle  -> manufacturer   (authoritative, e.g. "STANTON (S1800)")
    Style Name        -> style_name
    Style Number      -> style_number
    Color Name        -> color_name
    Color Number      -> color_number
    SKU               -> sku
    Cut/Carton Costs  -> cost
    Group Price 45    -> price  (= Retail; verified against the Style screen)
    Width             -> width
    Dropped (0/1)     -> excluded unless --include-dropped
"""

import argparse
import csv
import os
import ssl
import sys
from urllib.parse import urlparse

# The manufacturer column has appeared under two header names across QFloors
# export modes; accept either.
MANUFACTURER_ALIASES = ("~~ManufacturerWeb", "~~ManWebOneStyle")
CSV_COLS = {
    "style_name": "Style Name",
    "style_number": "Style Number",
    "color_name": "Color Name",
    "color_number": "Color Number",
    "sku": "SKU",
    "cost": "Cut/Carton Costs",
    "retail": "Group Price 45",
    "width": "Width",
    "dropped": "Dropped",
}
DB_COLS = ["sku", "style_name", "style_number", "color_name", "color_number",
           "cost", "price", "manufacturer", "width", "backing"]
BATCH = 500


def money(v):
    v = (v or "").strip()
    if not v:
        return ""
    try:
        return f"{float(v):.2f}"
    except ValueError:
        return v


def parse(path, include_dropped):
    rows = list(csv.reader(open(path, newline="")))
    if not rows:
        sys.exit("empty CSV")
    header = [h.strip() for h in rows[0]]
    idx = {}
    for key, name in CSV_COLS.items():
        if name not in header:
            sys.exit(f"CSV missing expected column: {name!r}")
        idx[key] = header.index(name)
    man_col = next((c for c in MANUFACTURER_ALIASES if c in header), None)
    if man_col is None:
        sys.exit(f"CSV missing a manufacturer column (looked for {MANUFACTURER_ALIASES})")
    idx["manufacturer"] = header.index(man_col)

    def cell(row, key):
        j = idx[key]
        return row[j].strip() if j < len(row) else ""

    out, skipped_dropped, blank_sku = [], 0, 0
    seen = {}
    for row in rows[1:]:
        if not any(c.strip() for c in row):
            continue
        if cell(row, "dropped") == "1" and not include_dropped:
            skipped_dropped += 1
            continue
        sku = cell(row, "sku")
        if not sku:
            blank_sku += 1
        retail = money(cell(row, "retail"))
        rec = {
            "sku": sku or None,
            "style_name": cell(row, "style_name"),
            "style_number": cell(row, "style_number"),
            "color_name": cell(row, "color_name"),
            "color_number": cell(row, "color_number"),
            "cost": money(cell(row, "cost")),
            "price": f"${retail}" if retail else "",
            "manufacturer": cell(row, "manufacturer"),
            "width": cell(row, "width") or None,
            "backing": None,
        }
        # Dedupe by SKU (last wins); rows without a SKU are all kept.
        if rec["sku"]:
            seen[rec["sku"]] = rec
        else:
            out.append(rec)
    out.extend(seen.values())
    return out, skipped_dropped, blank_sku


def connect():
    url = os.environ.get("NEON_URL")
    if not url:
        sys.exit("Set NEON_URL for --replace")
    import pg8000.native
    u = urlparse(url)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        host=u.hostname, port=u.port or 5432, database=u.path.lstrip("/"),
        user=u.username, password=u.password, ssl_context=ctx,
    )


def replace(products):
    conn = connect()
    conn.run("DELETE FROM sepulveda_products")
    done = 0
    for i in range(0, len(products), BATCH):
        chunk = products[i:i + BATCH]
        vals, params = [], {}
        for j, r in enumerate(chunk):
            vals.append("(" + ",".join(f":p{j}_{k}" for k in range(len(DB_COLS))) + ")")
            for k, col in enumerate(DB_COLS):
                params[f"p{j}_{k}"] = r[col]
        conn.run(
            f"INSERT INTO sepulveda_products ({','.join(DB_COLS)}) VALUES "
            f"{','.join(vals)} ON CONFLICT (sku) DO NOTHING",
            **params,
        )
        done += len(chunk)
    count = conn.run("SELECT COUNT(*) FROM sepulveda_products")[0][0]
    conn.run("INSERT INTO sepulveda_sync_log (product_count) VALUES (:c)", c=count)
    conn.close()
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--replace", action="store_true", help="delete and reload (destructive)")
    ap.add_argument("--include-dropped", action="store_true")
    args = ap.parse_args()

    products, dropped, blank = parse(args.csv, args.include_dropped)
    print(f"Parsed {len(products)} products "
          f"(excluded {dropped} dropped, {blank} had blank SKU)")
    for r in products[:5]:
        print(f"  {r['sku']}  {r['manufacturer']}  {r['style_name']}/{r['color_name']}  "
              f"cost={r['cost']} price={r['price']}")

    if not args.replace:
        print("\nDRY RUN — no database changes. Re-run with --replace (and NEON_URL) to load.")
        return
    if not products:
        sys.exit("Refusing to replace the catalog with zero products.")
    count = replace(products)
    print(f"\nReplaced catalog — {count} products now live.")


if __name__ == "__main__":
    main()
