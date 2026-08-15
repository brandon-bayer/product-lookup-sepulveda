"""
Load extracted product JSON into the Neon sepulveda_products table.

Usage:
    NEON_URL='postgresql://user:pass@host/db' \
        python3 scripts/load_products.py <products.json>

Replaces the table contents and records a row in sepulveda_sync_log.
"""

import json
import os
import ssl
import sys
from urllib.parse import urlparse

import pg8000.native

COLUMNS = ["sku", "style_name", "style_number", "color_name", "color_number",
           "cost", "price", "manufacturer", "width", "backing"]
BATCH = 500


def connect():
    url = os.environ.get("NEON_URL")
    if not url:
        sys.exit("Set NEON_URL to the Neon connection string")
    u = urlparse(url)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        host=u.hostname, port=u.port or 5432, database=u.path.lstrip('/'),
        user=u.username, password=u.password, ssl_context=ctx,
    )


def main():
    products = json.load(open(sys.argv[1]))
    print(f"Loading {len(products):,} products")
    conn = connect()
    conn.run("DELETE FROM sepulveda_products")

    inserted = 0
    for i in range(0, len(products), BATCH):
        chunk = products[i:i + BATCH]
        values, params = [], {}
        for j, r in enumerate(chunk):
            values.append("(" + ",".join(f":p{j}_{k}" for k in range(len(COLUMNS))) + ")")
            for k, col in enumerate(COLUMNS):
                v = r.get(col)
                params[f"p{j}_{k}"] = v if v not in ("",) or col != "width" else None
        conn.run(
            f"INSERT INTO sepulveda_products ({','.join(COLUMNS)}) "
            f"VALUES {','.join(values)} ON CONFLICT (sku) DO NOTHING",
            **params,
        )
        inserted += len(chunk)
        if inserted % 5000 < BATCH:
            print(f"  {inserted:,}/{len(products):,}")

    count = conn.run("SELECT COUNT(*) FROM sepulveda_products")[0][0]
    conn.run("INSERT INTO sepulveda_sync_log (product_count) VALUES (:c)", c=count)
    print(f"Done -- {count:,} rows in sepulveda_products")
    conn.close()


if __name__ == "__main__":
    main()
