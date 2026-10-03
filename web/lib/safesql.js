// Validates LLM-written SQL before it ever touches the database.
const BLOCKED = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute|set|reset|vacuum|listen|notify|pg_\w+|information_schema|dblink|lo_\w+)\b/i;

export function validateSql(raw) {
  let sql = String(raw || "").trim().replace(/;+\s*$/, "");
  if (!sql) throw new Error("No SQL was generated.");
  if (sql.length > 2000) throw new Error("Query too long.");
  if (/;|--|\/\*/.test(sql)) throw new Error("Only a single plain SELECT statement is allowed.");
  if (!/^(select|with)\b/i.test(sql)) throw new Error("Only SELECT queries are allowed.");
  if (BLOCKED.test(sql)) throw new Error("Query contains a blocked keyword.");
  const tables = [...sql.matchAll(/\b(?:from|join)\s+([a-z_."]+)/gi)].map((m) => m[1].replace(/"/g, "").toLowerCase());
  const ctes = [...sql.matchAll(/\b([a-z_]\w*)\s+as\s*\(/gi)].map((m) => m[1].toLowerCase());
  const bad = tables.filter((t) => t !== "v_sales" && t !== "public.v_sales" && !ctes.includes(t));
  if (bad.length) throw new Error(`Only the v_sales view can be queried (found: ${bad[0]}).`);
  return sql;
}