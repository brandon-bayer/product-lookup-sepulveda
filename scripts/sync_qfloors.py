"""
Nightly sync: QFloors (SQL Anywhere 9 via ODBC) → Neon PostgreSQL
Run with 32-bit Python 3.11: py -3.11-32 sync_qfloors.py

Reads product data from the QFloors database on DC01 and upserts it into
the Neon cloud database used by the product-lookup-sepulveda app.
"""

import pyodbc
import psycopg2
import sys
from datetime import datetime

# ── QFloors connection (SQL Anywhere 9, internal network only) ────────────────
QFLOORS_DSN = (
    "Driver={Adaptive Server Anywhere 9.0};"
    "CommLinks=tcpip(Host=192.168.1.201;Port=2638);"
    "EngineName=QServer;"
    "UID=dba;"
    "PWD=sensar17"
)

# ── Neon PostgreSQL connection ────────────────────────────────────────────────
NEON_URL = (
    "postgresql://neondb_owner:npg_ArB3sMC6xkJN"
    "@ep-falling-credit-a6bcap4z.us-west-2.aws.neon.tech"
    "/neondb?sslmode=require"
)

SYNC_QUERY = """
SELECT
    pc.SKU,
    ps.StyleName,
    ps.StyleNumber,
    pc.ColorName,
    pc.ColorNumber,
    pc.Cut       AS cost,
    pc.Retail    AS price,
    pm.ManName   AS manufacturer,
    COALESCE(pc.Width,   ps.Width)   AS width,
    COALESCE(pc.Backing, ps.Backing) AS backing
FROM ProductColor pc
JOIN ProductStyle      ps ON pc.StyleIndex  = ps.StyleIndex
JOIN ProductManufacture pm ON ps.VenderIndex = pm.ManIndex
WHERE pc.Active = 1
  AND ps.Active = 1
  AND pm.Active = 1
"""


def run_sync():
    start = datetime.now()
    print(f"[{start:%Y-%m-%d %H:%M:%S}] Starting QFloors → Neon sync")

    # 1. Read from QFloors
    print("  Connecting to QFloors...")
    try:
        qconn = pyodbc.connect(QFLOORS_DSN)
    except Exception as e:
        print(f"  ERROR connecting to QFloors: {e}")
        sys.exit(1)

    cursor = qconn.cursor()
    cursor.execute(SYNC_QUERY)
    rows = cursor.fetchall()
    qconn.close()
    print(f"  Read {len(rows)} active products from QFloors")

    if not rows:
        print("  No products returned — aborting to avoid wiping the table.")
        sys.exit(1)

    # 2. Write to Neon
    print("  Connecting to Neon...")
    try:
        nconn = psycopg2.connect(NEON_URL)
    except Exception as e:
        print(f"  ERROR connecting to Neon: {e}")
        sys.exit(1)

    ncur = nconn.cursor()

    # Truncate then bulk-insert (fastest, avoids conflict handling)
    ncur.execute("TRUNCATE TABLE sepulveda_products RESTART IDENTITY")

    insert_sql = """
        INSERT INTO sepulveda_products
            (sku, style_name, style_number, color_name, color_number,
             cost, price, manufacturer, width, backing)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    data = [
        (
            str(r[0]).strip() if r[0] else None,   # sku
            str(r[1]).strip() if r[1] else "",      # style_name
            str(r[2]).strip() if r[2] else "",      # style_number
            str(r[3]).strip() if r[3] else "",      # color_name
            str(r[4]).strip() if r[4] else "",      # color_number
            str(r[5]).strip() if r[5] else "",      # cost
            str(r[6]).strip() if r[6] else "",      # price
            str(r[7]).strip() if r[7] else "",      # manufacturer
            str(r[8]).strip() if r[8] else None,    # width
            str(r[9]).strip() if r[9] else None,    # backing
        )
        for r in rows
    ]

    ncur.executemany(insert_sql, data)
    nconn.commit()
    ncur.close()
    nconn.close()

    elapsed = (datetime.now() - start).seconds
    print(f"  Inserted {len(data)} products into Neon")
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Sync complete in {elapsed}s")


if __name__ == "__main__":
    run_sync()
