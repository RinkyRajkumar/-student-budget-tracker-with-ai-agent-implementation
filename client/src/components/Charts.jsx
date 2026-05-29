import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import CategoryBadge, { getCategoryMeta } from "./CategoryBadge.jsx";
import { formatCurrency } from "../services/currency.js";

export function CategoryChart({ data }) {
  return (
    <section className="card p-4">
      <h2 className="text-lg font-bold tracking-normal">Category spending</h2>
      <div className="mt-3 h-64">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="name" outerRadius={82} innerRadius={44} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={getCategoryMeta(entry.name).color || entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#f8fafc" }}
                labelStyle={{ color: "#f8fafc" }}
                itemStyle={{ color: "#f8fafc" }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-400">Add expenses to see a chart.</div>
        )}
      </div>
      <div className="mt-2 grid gap-2">
        {data.slice(0, 5).map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <span className="flex items-center gap-2">
              <CategoryBadge category={item.name} size={26} iconSize={13} />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums">{formatCurrency(item.total)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrendChart({ data }) {
  return (
    <section className="card p-4">
      <h2 className="text-lg font-bold tracking-normal">Monthly trend</h2>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid stroke="rgba(148,163,184,0.22)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#cbd5e1" }} />
            <YAxis tick={{ fontSize: 11, fill: "#cbd5e1" }} width={42} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#f8fafc" }}
              labelStyle={{ color: "#f8fafc" }}
              itemStyle={{ color: "#f8fafc" }}
            />
            <Area type="monotone" dataKey="total" stroke="#a78bfa" fill="rgba(124,58,237,0.28)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
