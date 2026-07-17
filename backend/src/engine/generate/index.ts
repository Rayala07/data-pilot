// Generate: builds the prompt from a focused schema context and asks the LLM
// for a single PostgreSQL SELECT, then extracts the SQL from the response.
// Framework-free - depends only on the LLMProvider interface.

import type { LLMProvider, Result, TableProfile } from "../types";

// Structured feedback from a previous failed attempt, given back to the model
// verbatim on retry. Unused on Day 3 (single pass); the Day 4 loop fills it.
export interface RetryFeedback {
  previousSql: string;
  failureType: string;
  detail: string;
}

const SYSTEM_PROMPT = [
  "You are a PostgreSQL expert. Given a database schema and a question, write ONE PostgreSQL SELECT query that answers it.",
  "Rules:",
  "- Output ONLY the SQL. No explanation, no markdown fences.",
  "- Use ONLY the tables and columns listed in the schema. Never invent identifiers.",
  "- It MUST be a single read-only SELECT. Never INSERT/UPDATE/DELETE/DDL, and never multiple statements.",
  "- Use PostgreSQL syntax: EXTRACT(YEAR FROM col) not YEAR(col); ILIKE for case-insensitive matching; :: for casts.",
  "- The schema uses abbreviated column names - map the question's business terms onto them.",
  "- Prefer explicit JOINs using the foreign keys provided.",
  // Chart selection keys off a real date-typed column. Splitting a period into
  // separate year/month integers yields three numeric columns and no time axis,
  // so a time series would silently degrade to a plain table.
  "- When grouping by time, return the period as ONE date column, e.g. date_trunc('month', ord_dt)::date AS month - never separate year and month integer columns. Order time series ascending by that column.",
  // A surrogate id is a numeric column that isn't a measure; selecting it turns
  // a "label + measure" result into two numerics and suppresses the bar chart.
  "- Select only the columns needed to answer the question. Do not include surrogate id / primary-key columns unless the question asks for them - prefer the human-readable name column.",
].join("\n");

function buildSchemaContext(tables: TableProfile[]): string {
  return tables
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name} ${c.dataType}`).join(", ");
      const pk = t.primaryKey.length ? `\n  primary key: ${t.primaryKey.join(", ")}` : "";
      const fks = t.foreignKeys.length
        ? `\n  foreign keys: ${t.foreignKeys.map((fk) => `${fk.column} -> ${fk.refTable}.${fk.refColumn}`).join(", ")}`
        : "";
      const desc = t.description ? ` - ${t.description}` : "";
      return `Table ${t.schema}.${t.name}${desc}\n  columns: ${cols}${pk}${fks}`;
    })
    .join("\n\n");
}

export function buildMessages(question: string, tables: TableProfile[], feedback?: RetryFeedback) {
  const parts = [`Schema:\n${buildSchemaContext(tables)}`, `Question: ${question}`];
  if (feedback) {
    parts.push(
      [
        "Your previous SQL failed.",
        `SQL: ${feedback.previousSql}`,
        `Failure type: ${feedback.failureType}`,
        `Detail: ${feedback.detail}`,
        "Fix the query. Return only SQL.",
      ].join("\n")
    );
  }
  parts.push("Return only the SQL.");
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: parts.join("\n\n") },
  ];
}

// Pulls SQL out of a model response: prefers a fenced ```sql block, otherwise
// cuts prose before the first SELECT/WITH, and drops a trailing semicolon.
export function extractSql(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const kw = text.match(/\b(select|with)\b/i);
  if (kw && kw.index! > 0) text = text.slice(kw.index!);
  return text.replace(/;\s*$/, "").trim();
}

export async function generateSql(
  question: string,
  tables: TableProfile[],
  llm: LLMProvider,
  feedback?: RetryFeedback
): Promise<Result<string, "generation_error">> {
  const res = await llm.complete(buildMessages(question, tables, feedback), { maxTokens: 700, temperature: 0 });
  if (!res.ok) return { ok: false, reason: "generation_error", detail: res.detail };

  const sql = extractSql(res.value);
  if (!sql) return { ok: false, reason: "generation_error", detail: "model returned no SQL" };
  return { ok: true, value: sql };
}
