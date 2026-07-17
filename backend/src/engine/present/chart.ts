// Deterministic chart selection (D9). Chart choice is a function of result
// shape - column kinds and row count - so it's a lookup table, not a judgement
// call, and never an LLM decision. Free, instant, and it can't hallucinate a
// chart type the frontend has no renderer for.

import type { ChartSpec, FieldMeta } from "../types";

const BAR_MAX_ROWS = 30;
const SCATTER_MIN_ROWS = 30;

export function selectChart(fields: FieldMeta[], rows: Record<string, unknown>[]): ChartSpec {
  if (rows.length === 0 || fields.length === 0) return { type: "table" };

  const numeric = fields.filter((f) => f.kind === "numeric");
  const dates = fields.filter((f) => f.kind === "date");
  // Booleans read as categories on an axis, same as text.
  const categorical = fields.filter((f) => f.kind === "text" || f.kind === "boolean");

  // 1 row x 1 numeric column -> a single headline number.
  if (rows.length === 1 && fields.length === 1 && numeric.length === 1) {
    return { type: "stat", label: numeric[0].name, value: String(rows[0][numeric[0].name] ?? "") };
  }

  // A time column plus at least one measure -> time series.
  if (dates.length >= 1 && numeric.length >= 1) {
    return { type: "line", xField: dates[0].name, yFields: numeric.map((f) => f.name) };
  }

  // One category and one measure, few enough rows to label -> bar.
  if (categorical.length === 1 && numeric.length === 1 && rows.length <= BAR_MAX_ROWS) {
    return { type: "bar", xField: categorical[0].name, yField: numeric[0].name };
  }

  // Two measures over many points -> scatter (correlation, not ranking).
  if (numeric.length >= 2 && rows.length > SCATTER_MIN_ROWS) {
    return { type: "scatter", xField: numeric[0].name, yField: numeric[1].name };
  }

  return { type: "table" };
}
