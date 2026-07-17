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
  // Postgres folds unquoted identifiers to lowercase, so a table created as
  // "OrderItem" (every ORM does this) is unreachable unless it is quoted. The
  // schema block below already shows each identifier in the exact form to use.
  '- Identifiers are case-sensitive. Copy each table and column EXACTLY as written in the schema, keeping any double quotes: if it appears as "createdAt", write "createdAt", never createdAt.',
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

/**
 * An identifier that survives Postgres unquoted: already lowercase, and not a
 * reserved word. Anything else must be quoted or it silently resolves to
 * something that doesn't exist.
 */
const LOWERCASE_SAFE = /^[a-z_][a-z0-9_]*$/;

// Reserved words that plausibly name a real business table or column. These are
// lowercase and so look safe, but are a syntax error unquoted - `user` and
// `order` in particular are everywhere.
const RESERVED = new Set([
  "all", "analyse", "analyze", "and", "any", "array", "as", "asc", "asymmetric", "authorization",
  "between", "binary", "both", "case", "cast", "check", "collate", "column", "concurrently",
  "constraint", "create", "cross", "current_catalog", "current_date", "current_role",
  "current_schema", "current_time", "current_timestamp", "current_user", "default", "deferrable",
  "desc", "distinct", "do", "else", "end", "except", "false", "fetch", "for", "foreign", "freeze",
  "from", "full", "grant", "group", "having", "ilike", "in", "initially", "inner", "intersect",
  "into", "is", "isnull", "join", "lateral", "leading", "left", "like", "limit", "localtime",
  "localtimestamp", "natural", "not", "notnull", "null", "offset", "on", "only", "or", "order",
  "outer", "overlaps", "placing", "primary", "references", "returning", "right", "select",
  "session_user", "similar", "some", "symmetric", "table", "tablesample", "then", "to", "trailing",
  "true", "union", "unique", "user", "using", "variadic", "verbose", "when", "where", "window",
  "with",
]);

/** Renders an identifier exactly as the model must write it. */
function ident(name: string): string {
  if (LOWERCASE_SAFE.test(name) && !RESERVED.has(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

// Identifiers are rendered pre-quoted rather than merely instructed about: the
// model copies what it sees, so showing public."OrderItem" is far more reliable
// than telling it to quote. Clean snake_case schemas are untouched and still
// produce readable, unquoted SQL.
function buildSchemaContext(tables: TableProfile[]): string {
  return tables
    .map((t) => {
      const cols = t.columns.map((c) => `${ident(c.name)} ${c.dataType}`).join(", ");
      const pk = t.primaryKey.length ? `\n  primary key: ${t.primaryKey.map(ident).join(", ")}` : "";
      const fks = t.foreignKeys.length
        ? `\n  foreign keys: ${t.foreignKeys
            .map((fk) => `${ident(fk.column)} -> ${ident(fk.refTable)}.${ident(fk.refColumn)}`)
            .join(", ")}`
        : "";
      const desc = t.description ? ` - ${t.description}` : "";
      return `Table ${ident(t.schema)}.${ident(t.name)}${desc}\n  columns: ${cols}${pk}${fks}`;
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
