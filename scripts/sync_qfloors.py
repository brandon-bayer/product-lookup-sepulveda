"""
Nightly sync: QFloors (SQL Anywhere 9) -> Neon PostgreSQL
Run with: py -3.11-32 C:\QFloors_Sync\2_sync_qfloors.py
Logs to:  C:\QFloors_Sync\sync_log.txt
"""

import pyodbc
import psycopg2
import psycopg2.extras
import sys
import os
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────

QFLOORS_CONN = (
    "Driver={Adaptive Server Anywhere 9.0};"
    "CommLinks=tcpip(Host=192.168.1.201;Port=2638);"
    "EngineName=QServer;"
    "UID=dba;"
    "PWD=sensar17"
)

NEON_URL = (
    "postgresql://neondb_owner:npg_ArB3sMC6xkJN"
    "@ep-falling-credit-a6bcap4z.us-west-2.aws.neon.tech"
    "/neondb?sslmode=require"
)

LOG_FILE = r"C:\QFloors_Sync\sync_log.txt"
BATCH_SIZE = 500

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
JOIN ProductStyle       ps ON pc.StyleIndex  = ps.StyleIndex
JOIN ProductManufacture pm ON ps.VenderIndex  = pm.ManIndex
WHERE pc.Active = 1
  AND ps.Active = 1
  AND pm.Active = 1
ORDER BY pm.ManName, ps.StyleName, pc.ColorName
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg):
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(line)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        print(f"  WARNING: could not write to log file: {e}")


def fmt_cost(val):
    """Raw decimal string, e.g. '32.50'"""
    if val is None:
        return ""
    try:
        return f"{float(val):.2f}"
    except (ValueError, TypeError):
        return str(val).strip()


def fmt_price(val):
    """Dollar-prefixed string, e.g. '$55.00'"""
    if val is None:
        return ""
    try:
        return f"${float(val):.2f}"
    except (ValueError, TypeError):
        return str(val).strip()


def chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

# ── Main ──────────────────────────────────────────────────────────────────────

def run_sync():
    log("=" * 60)
    log("QFloors -> Neon sync started")

    # 1. Read from QFloors ------------------------------------------------
    log("Connecting to QFloors...")
    try:
        qconn = pyodbc.connect(QFLOORS_CONN)
    except Exception as e:
        log(f"ERROR: QFloors connection failed: {e}")
        sys.exit(1)

    try:
        cursor = qconn.cursor()
        cursor.execute(SYNC_QUERY)
        rows = cursor.fetchall()
    except Exception as e:
        log(f"ERROR: QFloors query failed: {e}")
        qconn.close()
        sys.exit(1)
    finally:
        qconn.close()

    log(f"Read {len(rows)} active products from QFloors")

    if not rows:
        log("ERROR: Zero products returned — aborting to protect existing data")
        sys.exit(1)

    # 2. Build insert data ------------------------------------------------
    with_sku = []
    without_sku = []

    for r in rows:
        sku         = str(r[0]).strip() if r[0] else None
        style_name  = str(r[1]).strip() if r[1] else ""
        style_num   = str(r[2]).strip() if r[2] else ""
        color_name  = str(r[3]).strip() if r[3] else ""
        color_num   = str(r[4]).strip() if r[4] else ""
        cost        = fmt_cost(r[5])
        price       = fmt_price(r[6])
        manufacturer= str(r[7]).strip() if r[7] else ""
        width       = str(r[8]).strip() if r[8] else None
        backing     = str(r[9]).strip() if r[9] else None

        record = (sku, style_name, style_num, color_name, color_num,
                  cost, price, manufacturer, width, backing)

        if sku:
            with_sku.append(record)
        else:
            without_sku.append(record)

    log(f"  {len(with_sku)} records with SKU, {len(without_sku)} without SKU")

    # 3. Write to Neon ----------------------------------------------------
    log("Connecting to Neon...")
    try:
        nconn = psycopg2.connect(NEON_URL)
    except Exception as e:
        log(f"ERROR: Neon connection failed: {e}")
        sys.exit(1)

    try:
        ncur = nconn.cursor()

        # Clear existing data
        ncur.execute("DELETE FROM sepulveda_products")
        log(f"Cleared existing rows from sepulveda_products")

        inserted = 0

        # Insert rows WITH a SKU using ON CONFLICT upsert
        upsert_sql = """
            INSERT INTO sepulveda_products
                (sku, style_name, style_number, color_name, color_number,
                 cost, price, manufacturer, width, backing)
            VALUES %s
            ON CONFLICT (sku) DO UPDATE SET
                style_name   = EXCLUDED.style_name,
                style_number = EXCLUDED.style_number,
                color_name   = EXCLUDED.color_name,
                color_number = EXCLUDED.color_number,
                cost         = EXCLUDED.cost,
                price        = EXCLUDED.price,
                manufacturer = EXCLUDED.manufacturer,
                width        = EXCLUDED.width,
                backing      = EXCLUDED.backing
        """
        for batch in chunks(with_sku, BATCH_SIZE):
            psycopg2.extras.execute_values(ncur, upsert_sql, batch)
            inserted += len(batch)
            log(f"  Upserted {inserted}/{len(with_sku)} SKU rows...")

        # Insert rows WITHOUT a SKU (no conflict handling needed)
        insert_sql = """
            INSERT INTO sepulveda_products
                (sku, style_name, style_number, color_name, color_number,
                 cost, price, manufacturer, width, backing)
            VALUES %s
        """
        no_sku_inserted = 0
        for batch in chunks(without_sku, BATCH_SIZE):
            psycopg2.extras.execute_values(ncur, insert_sql, batch)
            no_sku_inserted += len(batch)

        if without_sku:
            log(f"  Inserted {no_sku_inserted} no-SKU rows")

        nconn.commit()
        total = len(with_sku) + len(without_sku)
        log(f"Sync complete — {total} products in Neon")
        log("=" * 60)

    except Exception as e:
        nconn.rollback()
        log(f"ERROR: Neon write failed: {e}")
        sys.exit(1)
    finally:
        ncur.close()
        nconn.close()


if __name__ == "__main__":
    run_sync()
