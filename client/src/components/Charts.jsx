import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
    <section className="card flex min-h-[22rem] flex-col p-4">
      <h2 className="text-lg font-bold tracking-normal">Monthly trend</h2>
      <div className="mt-3 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 6 }}>
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

export function WeeklyStackedSpendingChart({ data, categories }) {
  return (
    <section className="card p-4 xl:col-span-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-normal">Weekly spending by category</h2>
          <p className="mt-1 text-sm text-slate-400">Each bar shows the week total split into category colors.</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Stacked weekly view</p>
      </div>
      <div className="mt-4 h-72">
        {data.length && categories.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 6 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${Number(value) / 1000}k`} />
              <Tooltip
                cursor={{ fill: "rgba(139,92,246,0.08)" }}
                formatter={(value, name) => [formatCurrency(value), name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.range || "Week"}
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(167,139,250,0.22)", borderRadius: 14, color: "#f8fafc" }}
                labelStyle={{ color: "#f8fafc", fontWeight: 800 }}
                itemStyle={{ color: "#f8fafc" }}
              />
              {categories.map((category, index) => (
                <Bar
                  key={category}
                  dataKey={category}
                  stackId="weekly-spend"
                  fill={getCategoryMeta(category).color}
                  radius={index === categories.length - 1 ? [10, 10, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={58}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-3xl border border-dashed border-violet-300/20 bg-white/[0.03] text-center text-sm text-slate-400">
            Add expenses to see weekly category bars.
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.slice(0, 12).map((category) => (
          <span key={category} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getCategoryMeta(category).color }} />
            {category}
          </span>
        ))}
      </div>
    </section>
  );
}
