// Validate: AST-based, never regex (decision D4). A candidate query is allowed
// only if its AST root is a single pure SELECT and every table/column it
// references exists in the SchemaProfile. This is a whitelist - anything not
// explicitly permitted is rejected - and it runs BEFORE execution (D6) so
// hallucinated identifiers are caught cheaply and named in the failure detail.

import { Parser } from "node-sql-parser";
import type { SchemaProfile, TableProfile } from "../types";

const PARSE_OPT = { database: "PostgreSQL" } as const;
const parser = new Parser();

export type ValidateFailureType = "validation" | "security" | "hallucination";

export type ValidateOutcome =
  | { ok: true; sql: string; referencedTables: string[] }
  | { ok: false; failureType: ValidateFailureType; detail: string };

// node-sql-parser's TS types don't expose every field we read (with, columns),
// so a few reads go through a loose shape.
interface LooseColumn {
  as?: string | null;
  expr?: { column?: string };
}
interface LooseCte {
  name?: { value?: string } | string;
  columns?: Array<string | { value?: string }>;
  stmt?: { type?: string; ast?: { type?: string; columns?: LooseColumn[] }; columns?: LooseColumn[] };
}
interface LooseStmt {
  type?: string;
  with?: LooseCte[] | null;
  columns?: LooseColumn[] | string;
}

/**
 * Collects every alias defined anywhere in a SELECT list.
 *
 * A shallow read of `column.as` is not enough: for `date_trunc('month', c)::date
 * AS month` node-sql-parser leaves `column.as = null` and hangs the alias off the
 * cast node (`column.expr.as`). Missing it made `GROUP BY month` look like a
 * reference to a nonexistent column, wrongly failing valid SQL as a
 * hallucination. Walking the expression tree is robust to that and to nesting.
 *
 * Over-collecting is the safe direction: aliases only ever *permit* an
 * unqualified name. Table-qualified columns are still checked strictly, so a
 * real hallucination on a known table is still caught.
 */
function collectAliases(node: unknown, out: Set<string>, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 8) return;
  if (Array.isArray(node)) {
    for (const child of node) collectAliases(child, out, depth + 1);
    return;
  }
  const rec = node as Record<string, unknown>;
  if (typeof rec.as === "string" && rec.as) out.add(rec.as.toLowerCase());
  for (const key of Object.keys(rec)) {
    if (key !== "as") collectAliases(rec[key], out, depth + 1);
  }
}

// Names produced by a CTE (its output columns) are valid to reference in the
// outer query even though they aren't base-table columns - collect them so the
// column-existence check doesn't flag them as hallucinated.
function collectCteOutputs(cte: LooseCte): string[] {
  const names = new Set<string>();
  if (Array.isArray(cte.columns)) {
    for (const c of cte.columns) {
      const n = typeof c === "string" ? c : c?.value;
      if (n) names.add(n.toLowerCase());
    }
  }
  const stmtCols = cte.stmt?.ast?.columns ?? cte.stmt?.columns;
  if (Array.isArray(stmtCols)) {
    collectAliases(stmtCols, names);
    for (const c of stmtCols) {
      if (typeof c?.expr?.column === "string") names.add(c.expr.column.toLowerCase());
    }
  }
  return Array.from(names);
}

export function validateSql(sql: string, profile: SchemaProfile): ValidateOutcome {
  // 1. Parseable?
  let ast: unknown;
  try {
    ast = parser.astify(sql, PARSE_OPT);
  } catch (err) {
    return { ok: false, failureType: "validation", detail: `Could not parse SQL: ${(err as Error).message}` };
  }

  // 2. Exactly one statement (rejects `SELECT 1; DROP TABLE ...`).
  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    return { ok: false, failureType: "security", detail: "Only a single statement is allowed." };
  }

  // 3. Root must be a SELECT (rejects DELETE/UPDATE/INSERT/DDL/EXPLAIN/...).
  const stmt = statements[0] as LooseStmt;
  if (stmt.type !== "select") {
    return {
      ok: false,
      failureType: "security",
      detail: `Only SELECT statements are allowed (got ${String(stmt.type).toUpperCase()}).`,
    };
  }

  // 4. Any CTE must itself be a SELECT - reject data-modifying CTEs
  // (`WITH x AS (DELETE ... RETURNING ...) ...`). CTE names are excluded from
  // the table-existence check below since they aren't real tables.
  const cteNames = new Set<string>();
  const cteOutputs = new Set<string>();
  if (Array.isArray(stmt.with)) {
    for (const cte of stmt.with) {
      const name = typeof cte?.name === "string" ? cte.name : cte?.name?.value;
      if (typeof name === "string") cteNames.add(name.toLowerCase());
      const cteType = cte?.stmt?.ast?.type ?? cte?.stmt?.type;
      if (cteType && cteType !== "select") {
        return { ok: false, failureType: "security", detail: "Data-modifying CTEs are not allowed." };
      }
      for (const out of collectCteOutputs(cte)) cteOutputs.add(out);
    }
  }

  const tablesByName = new Map<string, TableProfile>();
  for (const t of profile.tables) tablesByName.set(t.name.toLowerCase(), t);

  // 5. Table existence. tableList entries are `type::db::table`.
  const referenced: string[] = [];
  const missingTables: string[] = [];
  for (const entry of safeTableList(sql)) {
    const table = entry.split("::")[2];
    if (!table) continue;
    const low = table.toLowerCase();
    if (cteNames.has(low)) continue;
    if (!referenced.includes(low)) referenced.push(low);
    if (!tablesByName.has(low)) missingTables.push(table);
  }
  if (missingTables.length) {
    const available = profile.tables.map((t) => t.name).join(", ");
    return {
      ok: false,
      failureType: "hallucination",
      detail: `Unknown table(s): ${dedupe(missingTables).join(", ")}. Available tables: ${available}`,
    };
  }

  // 6. Column existence. columnList entries are `type::qualifier::column`.
  // Qualifiers are alias-resolved to real table names by the parser. Output
  // aliases (SUM(x) AS rev) show up unqualified and must be excluded, or a
  // valid query would be wrongly flagged.
  const columnsByTable = new Map<string, Set<string>>();
  const columnUnion = new Set<string>();
  for (const low of referenced) {
    const t = tablesByName.get(low);
    if (!t) continue;
    const set = new Set(t.columns.map((c) => c.name.toLowerCase()));
    columnsByTable.set(low, set);
    for (const c of set) columnUnion.add(c);
  }

  const aliases = new Set<string>(cteOutputs);
  if (Array.isArray(stmt.columns)) collectAliases(stmt.columns, aliases);

  const missingCols: string[] = [];
  for (const entry of safeColumnList(sql)) {
    const [, qualifier, column] = entry.split("::");
    if (!column || column === "(.*)") continue;
    const colLow = column.toLowerCase();

    if (qualifier && qualifier !== "null") {
      const qLow = qualifier.toLowerCase();
      if (cteNames.has(qLow)) continue; // column off a CTE output - unverifiable, allow
      const set = columnsByTable.get(qLow);
      if (set && !set.has(colLow)) missingCols.push(`${qualifier}.${column}`);
    } else {
      // Unqualified: skip output aliases; otherwise it must exist somewhere.
      if (aliases.has(colLow)) continue;
      if (!columnUnion.has(colLow)) missingCols.push(column);
    }
  }
  if (missingCols.length) {
    const byTable = referenced
      .map((low) => `${low}(${tablesByName.get(low)?.columns.map((c) => c.name).join(", ")})`)
      .join("; ");
    return {
      ok: false,
      failureType: "hallucination",
      detail: `Unknown column(s): ${dedupe(missingCols).join(", ")}. Available columns by table: ${byTable}`,
    };
  }

  return { ok: true, sql, referencedTables: referenced };
}

function safeTableList(sql: string): string[] {
  try {
    return parser.tableList(sql, PARSE_OPT);
  } catch {
    return [];
  }
}

function safeColumnList(sql: string): string[] {
  try {
    return parser.columnList(sql, PARSE_OPT);
  } catch {
    return [];
  }
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}
