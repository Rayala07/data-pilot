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
import { Card } from "@/components/ui";
import type { ChartSpec } from "@/lib/types";

// Fixed slot order - a series keeps its hue regardless of rank or sibling
// count. Never cycled: past 8 series the selector falls back to a table.
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

/** Postgres numeric/int8 arrive as JS strings - coerce before plotting. */
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

const axisProps = {
  tick: { fill: "var(--viz-muted)", fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: "var(--viz-axis)" },
} as const;

const tooltipProps = {
  contentStyle: {
    background: "var(--viz-surface)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    color: "var(--fg)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--fg-muted)" },
  cursor: { stroke: "var(--viz-axis)", strokeWidth: 1 },
} as const;

// Recessive: horizontal hairlines only, never a full mesh.
const Grid = () => <CartesianGrid stroke="var(--viz-grid)" vertical={false} />;

export function ResultChart({ chart, rows }: { chart: ChartSpec; rows: Record<string, unknown>[] }) {
  if (chart.type === "table") return null;

  // A hero number needs no plot, no axes, and no tooltip.
  if (chart.type === "stat") {
    const n = toNum(chart.value);
    return (
      <Card className="p-6">
        <p className="text-sm text-fg-muted">{chart.label}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-fg">
          {n === null ? String(chart.value) : n.toLocaleString()}
        </p>
      </Card>
    );
  }

  const shell = (children: React.ReactElement) => (
    <Card className="p-4">
      <div className="h-[300px] w-full">
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </Card>
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
        {/* One axis. Never a second y-scale - differing magnitudes stay honest. */}
        <YAxis {...axisProps} tickFormatter={formatTick} width={56} />
        <Tooltip {...tooltipProps} />
        {/* A legend whenever identity can't rest on a single named series. */}
        {yFields.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {yFields.slice(0, SERIES.length).map((y, i) => (
          <Line
            key={y}
            type="monotone"
            dataKey={y}
            stroke={SERIES[i]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: SERIES[i] }}
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
    const crowded = data.length > 8;
    return shell(
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }} barCategoryGap="20%">
        <Grid />
        <XAxis
          dataKey={xField}
          {...axisProps}
          interval={0}
          angle={crowded ? -30 : 0}
          textAnchor={crowded ? "end" : "middle"}
          height={crowded ? 64 : 30}
        />
        <YAxis {...axisProps} tickFormatter={formatTick} width={56} />
        <Tooltip {...tooltipProps} cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }} />
        {/* Rounded data-end, anchored to the baseline. */}
        <Bar dataKey={yField} fill={SERIES[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  }

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
