"""Generate a realistic, deliberately messy synthetic sales dataset (raw CSVs)."""
import datetime as dt
import numpy as np
import pandas as pd
from faker import Faker
from config import *

N_CUSTOMERS, N_ORDERS = 5_000, 120_000
START, END = "2024-01-01", "2026-09-30"

rng = np.random.default_rng(SEED)
Faker.seed(SEED)
fake = Faker()

# category -> (items, (min_price, max_price), cost_ratio)
CATALOG = {
    "Electronics": (["Wireless Earbuds", "Smart Watch", "Mechanical Keyboard", "4K Webcam", "Portable SSD", "Gaming Mouse"], (25, 450), 0.60),
    "Furniture": (["Ergo Chair", "Standing Desk", "Bookshelf", "Floor Lamp", "Sofa Bed", "Monitor Stand"], (40, 700), 0.55),
    "Office Supplies": (["Notebook Set", "Gel Pen Pack", "Desk Organizer", "Label Maker", "Whiteboard", "Paper Ream"], (3, 60), 0.50),
    "Apparel": (["Hoodie", "Running Shoes", "Denim Jacket", "Backpack", "Cap", "Sneakers"], (15, 160), 0.45),
    "Home & Kitchen": (["Air Fryer", "Coffee Maker", "Blender", "Knife Set", "Vacuum", "Water Bottle"], (10, 220), 0.52),
}
ADJ = ["Pro", "Lite", "Max", "Air", "Edge", "Prime"]
MONTH_F = {1: .85, 2: .8, 3: .9, 4: .95, 5: 1, 6: .95, 7: .9, 8: .95, 9: 1, 10: 1.05, 11: 1.5, 12: 1.7}


def make_customers():
    regions = list(GEO)
    rows = []
    for i in range(1, N_CUSTOMERS + 1):
        region = rng.choice(regions, p=REGION_WEIGHTS)
        country = str(rng.choice(list(GEO[region])))
        city = str(rng.choice(GEO[region][country]))
        signup = fake.date_between(dt.date(2023, 6, 1), dt.date(2026, 6, 30))
        rows.append((i, fake.name(), str(rng.choice(SEGMENTS, p=[.55, .30, .15])), city, country, signup))
    return pd.DataFrame(rows, columns=["customer_id", "name", "segment", "city", "country", "signup_date"])


def make_products():
    rows, pid = [], 1
    for cat, (items, (lo, hi), ratio) in CATALOG.items():
        for item in items:
            for adj in rng.choice(ADJ, 2, replace=False):
                price = round(float(rng.uniform(lo, hi)), 2)
                cost = round(price * ratio * float(rng.uniform(0.9, 1.1)), 2)
                rows.append((pid, f"{item} {adj}", cat, cost, price))
                pid += 1
    return pd.DataFrame(rows, columns=["product_id", "name", "category", "unit_cost", "unit_price"])


def make_orders(cust, prod):
    days = pd.date_range(START, END)
    trend = 1 + 0.6 * np.arange(len(days)) / len(days)  # business grows over time
    w = trend * np.array([MONTH_F[m] for m in days.month]) * np.where(days.dayofweek >= 5, 1.15, 1.0)
    dates = rng.choice(days.values.astype("datetime64[D]"), N_ORDERS, p=w / w.sum())

    cw = rng.pareto(3, N_CUSTOMERS) + 1  # a few loyal heavy buyers
    cid = rng.choice(cust.customer_id.values, N_ORDERS, p=cw / cw.sum())
    pw = 1 / np.arange(1, len(prod) + 1) ** 0.7
    rng.shuffle(pw)
    pid = rng.choice(prod.product_id.values, N_ORDERS, p=pw / pw.sum())

    peak = np.isin(pd.DatetimeIndex(dates).month, [11, 12])
    opts = np.array([0, .05, .10, .15, .20])
    disc = np.where(peak, rng.choice(opts, N_ORDERS, p=[.2, .15, .2, .2, .25]),
                    rng.choice(opts, N_ORDERS, p=[.5, .2, .15, .1, .05]))
    country = cust.set_index("customer_id").country
    region = pd.Series(cid).map(country).map(COUNTRY_REGION).values

    df = pd.DataFrame({
        "order_id": np.arange(1, N_ORDERS + 1), "order_date": dates, "customer_id": cid, "product_id": pid,
        "quantity": rng.choice([1, 2, 3, 4, 5], N_ORDERS, p=[.5, .25, .12, .08, .05]),
        "discount": disc, "region": region,
        "status": rng.choice(["completed", "returned", "cancelled"], N_ORDERS, p=[.90, .06, .04]),
    })
    # signup_date = shortly before each customer's first order (keeps data consistent)
    first = df.groupby("customer_id")["order_date"].min()
    lead = pd.to_timedelta(rng.integers(0, 120, len(first)), unit="D")
    cust.loc[cust.customer_id.isin(first.index), "signup_date"] = (first - lead).dt.date.values
    return df


def make_dirty(df):
    """Inject realistic data-quality problems so the ETL has real work to do."""
    df = df.astype({"region": object, "status": object, "discount": float})
    df.loc[df.sample(frac=.008, random_state=1).index, "region"] = None        # missing region
    idx = df.sample(frac=.01, random_state=2).index
    df.loc[idx, "region"] = df.loc[idx, "region"].str.lower() + "  "           # messy casing/spaces
    df.loc[df.sample(frac=.003, random_state=4).index, "quantity"] = -1        # invalid quantity
    df.loc[df.sample(frac=.004, random_state=5).index, "discount"] *= 100      # 15 instead of 0.15
    idx = df.sample(frac=.02, random_state=6).index
    df.loc[idx, "status"] = df.loc[idx, "status"].str.upper() + " "            # messy status
    df = pd.concat([df, df.sample(frac=.01, random_state=7)])                  # duplicate rows
    return df.sample(frac=1, random_state=8).reset_index(drop=True)


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    c, p = make_customers(), make_products()
    o = make_dirty(make_orders(c, p))
    c.to_csv(RAW / "customers.csv", index=False)
    p.to_csv(RAW / "products.csv", index=False)
    o.to_csv(RAW / "orders.csv", index=False)
    print(f"Generated {len(c):,} customers, {len(p)} products, {len(o):,} raw order rows -> {RAW}")