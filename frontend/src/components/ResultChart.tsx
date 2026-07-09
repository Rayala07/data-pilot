"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/types";

// Fixed slot order — a series keeps its hue regardless of rank or how many
// siblings it has. Never cycled: past 8 series we fall back to the table.
const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

/** Postgres numeric/int8 arrive as JS strings — coerce before plotting. */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateLabel(v: unknown): string {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const formatTick = (v: number) => compact.format(v);

const AXIS = { fill: "var(--viz-muted)", fontSize: 12 } as const;
const axisProps = {
  tick: AXIS,
  tickLine: false,
  axisLine: { stroke: "var(--viz-axis)" },
} as const;

const tooltipProps = {
  contentStyle: {
    background: "var(--viz-surface)",
    border: "1px solid var(--hairline)",
    borderRadius: 8,
    color: "var(--ink-primary)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--ink-secondary)" },
  cursor: { stroke: "var(--viz-axis)", strokeWidth: 1 },
} as const;

function Grid() {
  // Recessive: horizontal hairlines only, never a full mesh.
  return <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="0" vertical={false} />;
}

export function ResultChart({
  chart,
  rows,
}: {
  chart: ChartSpec;
  rows: Record<string, unknown>[];
}) {
  if (chart.type === "table") return null;

  // A hero number needs no plot, no axes, and no tooltip.
  if (chart.type === "stat") {
    const n = toNum(chart.value);
    return (
      <div className="rounded-lg border p-6" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          {chart.label}
        </p>
        <p className="mt-1 text-4xl font-semibold" style={{ color: "var(--ink-primary)" }}>
          {n === null ? String(chart.value) : n.toLocaleString()}
        </p>
      </div>
    );
  }

  const shell = (children: React.ReactNode) => (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}
    >
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  );

  if (chart.type === "line") {
    const { xField, yFields } = chart;
    // Time ascending. ISO timestamps sort correctly as strings.
    const data = [...rows]
      .sort((a, b) => String(a[xField]).localeCompare(String(b[xField])))
      .map((r) => {
        const point: Record<string, unknown> = { [xField]: formatDateLabel(r[xField]) };
        for (const y of yFields) point[y] = toNum(r[y]);
        return point;
      });

    return shell(
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <Grid />
        <XAxis dataKey={xField} {...axisProps} />
        {/* One axis. Never a second y-scale — differing magnitudes stay honest. */}
        <YAxis {...axisProps} tickFormatter={formatTick} width={56} />
        <Tooltip {...tooltipProps} />
        {yFields.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-secondary)" }} />}
        {yFields.slice(0, SERIES.length).map((y, i) => (
          <Line
            key={y}
            type="monotone"
            dataKey={y}
            stroke={SERIES[i]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: SERIES[i] }}
            // 2px surface ring so overlapping marks stay separable.
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--viz-surface)" }}
            connectNulls
          />
        ))}
      </LineChart>
    );
  }

  if (chart.type === "bar") {
    const { xField, yField } = chart;
    const data = rows.map((r) => ({ [xField]: String(r[xField] ?? ""), [yField]: toNum(r[yField]) }));
    return shell(
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }} barCategoryGap="20%">
        <Grid />
        <XAxis dataKey={xField} {...axisProps} interval={0} angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? "end" : "middle"} height={data.length > 8 ? 64 : 30} />
        <YAxis {...axisProps} tickFormatter={formatTick} width={56} />
        <Tooltip {...tooltipProps} cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }} />
        {/* Rounded data-end, anchored to the baseline. */}
        <Bar dataKey={yField} fill={SERIES[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  }

  // scatter
  const { xField, yField } = chart;
  const data = rows
    .map((r) => ({ x: toNum(r[xField]), y: toNum(r[yField]) }))
    .filter((p) => p.x !== null && p.y !== null);

  return shell(
    <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
      <Grid />
      <XAxis type="number" dataKey="x" name={xField} {...axisProps} tickFormatter={formatTick} />
      <YAxis type="number" dataKey="y" name={yField} {...axisProps} tickFormatter={formatTick} width={56} />
      <Tooltip {...tooltipProps} cursor={{ strokeDasharray: "3 3" }} />
      <Scatter data={data} fill={SERIES[0]} />
    </ScatterChart>
  );
}
