"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const money = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`);
const COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24"];
const tip = { contentStyle: { background: "#0d1326", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10 }, formatter: (v) => money(v) };

function Count({ value, format }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const k = Math.min((t - t0) / 900, 1);
      setV(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(v)}</>;
}

export default function Dashboard() {
  const [f, setF] = useState({ region: "", category: "", year: "" });
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/stats?" + new URLSearchParams(f))
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : (setErr(""), setD(j))))
      .catch((e) => setErr(e.message));
  }, [f]);

  if (err) return <div className="wrap msg err">Error: {err}</div>;
  if (!d) return <div className="wrap msg">Loading analytics…</div>;

  const { kpi, options } = d;
  const cards = [
    ["Revenue", kpi.revenue, money],
    ["Profit", kpi.profit, money],
    ["Orders", kpi.orders, (n) => Math.round(n).toLocaleString()],
    ["Avg order value", kpi.orders ? kpi.revenue / kpi.orders : 0, (n) => `$${n.toFixed(2)}`],
    ["Profit margin", kpi.revenue ? (kpi.profit / kpi.revenue) * 100 : 0, (n) => `${n.toFixed(1)}%`],
  ];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>Insight<span>Forge</span></h1>
          <div className="sub">Sales intelligence · synthetic dataset · completed orders only</div>
        </div>
        <a className="btn" href="/ask">✦ Ask your data</a>
        <div className="filters">
          <select value={f.year} onChange={set("year")}>
            <option value="">All years</option>
            {[2024, 2025, 2026].map((y) => <option key={y}>{y}</option>)}
          </select>
          <select value={f.region} onChange={set("region")}>
            <option value="">All regions</option>
            {options.regions.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={f.category} onChange={set("category")}>
            <option value="">All categories</option>
            {options.categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </header>

      <div className="grid kpis">
        {cards.map(([label, val, fmt]) => (
          <div className="card" key={label}>
            <div className="label">{label}</div>
            <div className="value"><Count value={val} format={fmt} /></div>
          </div>
        ))}
      </div>

      <div className="grid charts">
        <div className="card wide">
          <h3>Monthly revenue & profit</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={d.trend}>
              <defs>
                <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="month" stroke="#8b97b8" fontSize={11} />
              <YAxis stroke="#8b97b8" fontSize={11} tickFormatter={money} />
              <Tooltip {...tip} />
              <Area type="monotone" dataKey="revenue" stroke="#22d3ee" fill="url(#gr)" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" stroke="#a78bfa" fill="url(#gp)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {[["Revenue by region", d.regions], ["Revenue by category", d.categories]].map(([title, rows]) => (
          <div className="card" key={title}>
            <h3>{title}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" stroke="#8b97b8" fontSize={11} tickFormatter={money} />
                <YAxis type="category" dataKey="name" stroke="#8b97b8" fontSize={11} width={100} />
                <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Top products</h3>
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>Units</th><th>Revenue</th><th>Profit</th></tr></thead>
          <tbody>
            {d.top.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td><td>{p.category}</td><td>{p.units.toLocaleString()}</td><td>{money(p.revenue)}</td><td>{money(p.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}