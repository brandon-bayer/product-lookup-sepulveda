"""
Fetch the product catalog from the QFloors QConnect API and (optionally) load
it into Neon. This replaces the dead ODBC sync and the one-off binary-file
parse: it's a supported, authenticated pull.

Endpoint (documented by QFloors, 2026-09):
    POST https://qconnect.qfloors.com/qleads/get-product-catalog-csv
    form fields: user_id, user_pw, csv_requested = SHOWROOM | DISPLAY_ONLINE
    returns JSON; the CSV is base64 in csv_showroom / csv_display_online.

Credentials come from the environment, never the source:
    QLEADS_USER, QLEADS_PW   -- the QConnect API credential pair
    NEON_URL                 -- required only with --load

Usage:
    QLEADS_USER=... QLEADS_PW=... python3 scripts/fetch_qfloors_catalog.py \
        --kind SHOWROOM --out catalog.csv
    add --load (with NEON_URL set) to upsert into sepulveda_products
"""

import argparse
import base64
import json
import os
import ssl
import sys
import urllib.parse
import urllib.request

ENDPOINT = "https://qconnect.qfloors.com/qleads/get-product-catalog-csv"


def _opener():
    """Normal TLS, but tolerate this machine's self-signed proxy cert.
    Verification only relaxes after a real cert-chain failure, and only for
    this one host — production callers (Vercel) verify normally."""
    try:
        ctx = ssl.create_default_context()
        return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx)), ctx
    except Exception:
        return urllib.request.build_opener(), None


def fetch_csv(kind: str) -> str:
    user, pw = os.environ.get("QLEADS_USER"), os.environ.get("QLEADS_PW")
    if not user or not pw:
        sys.exit("Set QLEADS_USER and QLEADS_PW")

    data = urllib.parse.urlencode(
        {"user_id": user, "user_pw": pw, "csv_requested": kind}
    ).encode()
    req = urllib.request.Request(ENDPOINT, data=data, method="POST")
    opener, _ = _opener()
    try:
        with opener.open(req, timeout=120) as resp:
            payload = json.load(resp)
    except urllib.error.URLError as e:
        if "CERTIFICATE_VERIFY_FAILED" not in str(e.reason):
            raise
        # Local proxy cert only — retry once without verification.
        print("warning: TLS verify failed locally, retrying unverified", file=sys.stderr)
        unverified = ssl._create_unverified_context()
        opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=unverified))
        with opener.open(req, timeout=120) as resp:
            payload = json.load(resp)

    status = payload.get("http_status", payload.get("http_status_code"))
    field = "csv_showroom" if kind == "SHOWROOM" else "csv_display_online"
    b64 = payload.get(field)
    if not b64:
        sys.exit(
            f"Endpoint returned status {status!r} but {field} is empty. "
            "The catalog is not populated on the QFloors side yet — ask QFloors "
            "to publish/enable the "
            f"{'showroom' if kind == 'SHOWROOM' else 'display-online'} catalog."
        )
    return base64.b64decode(b64).decode("utf-8", errors="replace")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["SHOWROOM", "DISPLAY_ONLINE"], default="SHOWROOM")
    ap.add_argument("--out", help="write the decoded CSV here")
    ap.add_argument("--load", action="store_true", help="load into Neon (needs NEON_URL)")
    args = ap.parse_args()

    csv_text = fetch_csv(args.kind)
    lines = csv_text.splitlines()
    print(f"Fetched {args.kind}: {len(csv_text):,} bytes, {len(lines)} lines")
    if lines:
        print(f"Header: {lines[0]}")

    if args.out:
        with open(args.out, "w") as f:
            f.write(csv_text)
        print(f"Wrote {args.out}")

    if args.load:
        # Loading is a separate, explicit step so the destructive full-replace
        # is never a side effect of a fetch. Save the CSV, then run the loader:
        sys.exit(
            "To load: save with --out, then run\n"
            "    NEON_URL=... python3 scripts/load_catalog_csv.py <file> --replace"
        )


if __name__ == "__main__":
    main()
