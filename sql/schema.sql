-- InsightForge schema (run once in the Supabase SQL Editor)

create table dim_customers (
  customer_id serial primary key,
  name text not null,
  segment text,
  city text,
  country text,
  signup_date date
);

create table dim_products (
  product_id serial primary key,
  name text not null,
  category text,
  unit_cost numeric(10,2),
  unit_price numeric(10,2)
);

create table fact_orders (
  order_id serial primary key,
  order_date date not null,
  customer_id int references dim_customers(customer_id),
  product_id int references dim_products(product_id),
  quantity int not null,
  discount numeric(4,2) default 0,
  region text,
  status text default 'completed'
);

create index idx_orders_date on fact_orders(order_date);
create index idx_orders_region on fact_orders(region);

-- reporting view used by the dashboard and the AI "Ask your data" feature
create view v_sales as
select
  o.order_id, o.order_date, o.region, o.status,
  c.segment, c.country,
  p.category, p.name as product,
  o.quantity,
  round(o.quantity * p.unit_price * (1 - o.discount), 2) as revenue,
  round(o.quantity * (p.unit_price * (1 - o.discount) - p.unit_cost), 2) as profit
from fact_orders o
join dim_customers c using (customer_id)
join dim_products p using (product_id);

-- security: block public API access to the raw tables
alter table dim_customers enable row level security;
alter table dim_products enable row level security;
alter table fact_orders enable row level security;