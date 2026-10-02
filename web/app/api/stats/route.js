import { pool } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const args = [p.get("region") || null, p.get("category") || null, p.get("year") || null];
  const where = `status = 'completed'
    and ($1::text is null or region = $1)
    and ($2::text is null or category = $2)
    and ($3::int is null or extract(year from order_date) = $3::int)`;
  const q = (sql, a = args) => pool.query(sql, a).then((r) => r.rows);

  try {
    const [kpi, trend, regions, categories, top, regionList, categoryList] = await Promise.all([
      q(`select coalesce(sum(revenue),0)::float as revenue, coalesce(sum(profit),0)::float as profit,
                count(distinct order_id)::int as orders from v_sales where ${where}`),
      q(`select to_char(date_trunc('month', order_date),'YYYY-MM') as month,
                sum(revenue)::float as revenue, sum(profit)::float as profit
         from v_sales where ${where} group by 1 order by 1`),
      q(`select region as name, sum(revenue)::float as revenue from v_sales where ${where} group by 1 order by 2 desc`),
      q(`select category as name, sum(revenue)::float as revenue from v_sales where ${where} group by 1 order by 2 desc`),
      q(`select product as name, category, sum(quantity)::int as units, sum(revenue)::float as revenue, sum(profit)::float as profit
         from v_sales where ${where} group by 1,2 order by revenue desc limit 8`),
      q(`select distinct region as name from v_sales order by 1`, []),
      q(`select distinct category as name from v_sales order by 1`, []),
    ]);
    return Response.json({
      kpi: kpi[0], trend, regions, categories, top,
      options: { regions: regionList.map((r) => r.name), categories: categoryList.map((r) => r.name) },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}