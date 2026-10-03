import { pool } from "../../../lib/db";
import { questionToSql } from "../../../lib/llm";
import { validateSql } from "../../../lib/safesql";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { question } = await req.json().catch(() => ({}));
  if (!question || question.length > 300) return Response.json({ error: "Ask a question (max 300 characters)." }, { status: 400 });

  let plan;
  try {
    plan = await questionToSql(question);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
  if (!plan.sql) return Response.json({ error: "That question can't be answered from the sales data." }, { status: 422 });

  let sql;
  try {
    sql = validateSql(plan.sql);
  } catch (e) {
    return Response.json({ error: e.message, sql: plan.sql }, { status: 422 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = 5000");
    const r = await client.query(`select * from (${sql}) as t limit 200`);
    await client.query("COMMIT");
    return Response.json({
      sql, title: plan.title, chart: plan.chart,
      columns: r.fields.map((f) => f.name), rows: r.rows,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return Response.json({ error: `Query failed: ${e.message}`, sql }, { status: 400 });
  } finally {
    client.release();
  }
}