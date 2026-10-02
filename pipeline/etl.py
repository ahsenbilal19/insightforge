"""ETL: raw CSV -> clean with Pandas -> load into Supabase Postgres.
Usage:  python etl.py            (clean + load)
        python etl.py --dry-run  (clean only, no database)
"""
import argparse
import json
import os
import pandas as pd
from config import *


def clean_orders(o, c, p):
    log = {"raw_rows": len(o)}

    o = o.drop_duplicates("order_id")
    log["duplicates_removed"] = log["raw_rows"] - len(o)

    o["order_date"] = pd.to_datetime(o["order_date"], errors="coerce")
    o["quantity"] = pd.to_numeric(o["quantity"], errors="coerce")
    o["discount"] = pd.to_numeric(o["discount"], errors="coerce").fillna(0)

    # discount stored as 15 instead of 0.15 -> normalise
    log["discounts_rescaled"] = int((o["discount"] > 1).sum())
    o.loc[o["discount"] > 1, "discount"] /= 100
    o["discount"] = o["discount"].clip(0, 0.9).round(2)

    o["status"] = o["status"].astype(str).str.strip().str.lower()
    o["region"] = o["region"].astype("string").str.strip().str.title()

    # fill missing region from the customer's country
    cust_region = o["customer_id"].map(c.set_index("customer_id")["country"].map(COUNTRY_REGION))
    log["regions_filled"] = int(o["region"].isna().sum())
    o["region"] = o["region"].fillna(cust_region)

    before = len(o)
    bad = o["order_date"].isna() | (o["quantity"] <= 0) | o["quantity"].isna() \
        | ~o["status"].isin(VALID_STATUS) \
        | ~o["customer_id"].isin(c["customer_id"]) | ~o["product_id"].isin(p["product_id"])
    o = o[~bad]
    log["invalid_rows_dropped"] = before - len(o)

    o["quantity"] = o["quantity"].astype(int)
    log["clean_rows"] = len(o)
    return o[["order_id", "order_date", "customer_id", "product_id", "quantity", "discount", "region", "status"]], log


def load(c, p, o):
    from sqlalchemy import create_engine, text
    from dotenv import load_dotenv
    load_dotenv()
    # session-mode pooler (DIRECT_URL) is best for a bulk load; fall back to DATABASE_URL
    url = os.environ.get("DIRECT_URL") or os.environ["DATABASE_URL"]
    # force the psycopg2 driver (SQLAlchemy 2.1 defaults to psycopg3 otherwise)
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+psycopg2://" + url[len(prefix):]
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE fact_orders, dim_customers, dim_products RESTART IDENTITY CASCADE"))
        c.to_sql("dim_customers", conn, if_exists="append", index=False, method="multi", chunksize=2000)
        p.to_sql("dim_products", conn, if_exists="append", index=False, method="multi", chunksize=2000)
        o.to_sql("fact_orders", conn, if_exists="append", index=False, method="multi", chunksize=2000)
        for tbl, pk in [("dim_customers", "customer_id"), ("dim_products", "product_id"), ("fact_orders", "order_id")]:
            conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{tbl}','{pk}'), (SELECT MAX({pk}) FROM {tbl}))"))
    print("Loaded into Postgres.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    c = pd.read_csv(RAW / "customers.csv", parse_dates=["signup_date"])
    p = pd.read_csv(RAW / "products.csv")
    o, log = clean_orders(pd.read_csv(RAW / "orders.csv"), c, p)

    CLEAN.mkdir(parents=True, exist_ok=True)
    o.to_csv(CLEAN / "orders.csv", index=False)
    (CLEAN / "quality_report.json").write_text(json.dumps({k: int(v) for k, v in log.items()}, indent=2))
    print("Data quality report:", json.dumps(log, indent=2))
    if not args.dry_run:
        load(c, p, o)