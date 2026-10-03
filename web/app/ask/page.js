"use client";
import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const EXAMPLES = [
  "Which region had the highest profit in 2025?",
  "Monthly revenue trend for Electronics",
  "Top 5 products by units sold",
  "Return rate by category",
];
const tip = { contentStyle: { background: "#0d1326", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10 } };

export default function Ask() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(text = q) {
    if (!text.trim()) return;
    setQ(text); setBusy(true); setRes(null);
    const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
    setRes(await r.json());
    setBusy(false);
  }

  const cols = res?.columns || [];
  const rows = (res?.rows || []).map((r) => ({ ...r, [cols[1]]: Number(r[cols[1]]) }));
  const canChart = rows.length > 1 && cols.length >= 2 && res.chart !== "table" && rows.every((r) => !isNaN(r[cols[1]]));

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>Ask your <span>data</span></h1>
          <div className="sub">Natural language → safe SQL → instant answer</div>
        </div>
        <a className="btn" href="/">← Dashboard</a>
      </header>

      <div className="card askbox">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="e.g. Which category has the best profit margin?" maxLength={300} />
        <button className="btn solid" onClick={() => run()} disabled={busy}>{busy ? "Thinking…" : "Ask"}</button>
        <div className="chips">{EXAMPLES.map((e) => <span key={e} onClick={() => run(e)}>{e}</span>)}</div>
      </div>

      {res?.error && <div className="card err" style={{ marginTop: 16 }}>{res.error}</div>}
      {res?.sql && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Generated SQL</h3>
          <pre>{res.sql}</pre>
        </div>
      )}
      {res?.rows && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{res.title || "Result"} · {res.rows.length} rows</h3>
          {canChart && (
            <ResponsiveContainer width="100%" height={280}>
              {res.chart === "line" ? (
                <LineChart data={rows}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey={cols[0]} stroke="#8b97b8" fontSize={11} /><YAxis stroke="#8b97b8" fontSize={11} /><Tooltip {...tip} /><Line dataKey={cols[1]} stroke="#22d3ee" strokeWidth={2} dot={false} /></LineChart>
              ) : (
                <BarChart data={rows}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey={cols[0]} stroke="#8b97b8" fontSize={11} /><YAxis stroke="#8b97b8" fontSize={11} /><Tooltip {...tip} /><Bar dataKey={cols[1]} fill="#a78bfa" radius={[6, 6, 0, 0]} /></BarChart>
              )}
            </ResponsiveContainer>
          )}
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table>
              <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{res.rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c}>{String(r[c])}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}