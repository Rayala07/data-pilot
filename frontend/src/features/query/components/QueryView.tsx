"use client";

import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, CodeBlock, Disclosure, Input, PageHeader, Skeleton } from "@/components/ui";
import type { Attempt, FieldMeta } from "@/lib/types";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setQuestion } from "../query.slice";
import { runQuery } from "../query.thunks";
import { ResultChart } from "./ResultChart";

const EXAMPLES = [
  "monthly revenue for the last 6 months",
  "how many users signed up in 2025?",
  "top 5 products by revenue",
];

function formatCell(value: unknown, kind: FieldMeta["kind"]): string {
  if (value === null || value === undefined) return "-";
  if (kind === "date") {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  if (kind === "numeric") {
    const n = Number(value);
    if (Number.isFinite(n)) return n.toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ResultTable({ fields, rows }: { fields: FieldMeta[]; rows: Record<string, unknown>[] }) {
  const shown = rows.slice(0, 200);
  return (
    <div className="space-y-1.5">
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {fields.map((f) => (
                <th
                  key={f.name}
                  className={`px-3 py-2 font-mono text-xs font-medium text-fg-muted ${f.kind === "numeric" ? "text-right" : ""}`}
                >
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {fields.map((f) => (
                  <td key={f.name} className={`px-3 py-1.5 text-fg ${f.kind === "numeric" ? "text-right tabular-nums" : ""}`}>
                    {formatCell(row[f.name], f.kind)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={fields.length} className="px-3 py-8 text-center text-sm text-fg-subtle">
                  No rows matched.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {rows.length > shown.length && (
        <p className="text-xs text-fg-subtle">
          Showing first {shown.length} of {rows.length} rows.
        </p>
      )}
    </div>
  );
}

/** Visible proof of the self-correction loop: what failed, why, what came next. */
function AttemptTrail({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length <= 1) return null;
  return (
    <Disclosure summary={`Attempt history (${attempts.length} attempts)`}>
      <div className="space-y-4">
        {attempts.map((a) => (
          <div key={a.attemptNumber} className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-fg">Attempt {a.attemptNumber}</span>
              {a.failureType ? <Badge tone="danger">{a.failureType}</Badge> : <Badge tone="success">succeeded</Badge>}
              <span className="text-xs tabular-nums text-fg-subtle">{a.latencyMs} ms</span>
            </div>
            {a.sql && <CodeBlock>{a.sql}</CodeBlock>}
            {a.errorText && <p className="text-xs text-danger">{a.errorText}</p>}
          </div>
        ))}
      </div>
    </Disclosure>
  );
}

export function QueryView({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { question, result, request } = useAppSelector((s) => s.query);
  const running = isLoading(request);

  function ask(q: string) {
    if (!q.trim() || running) return;
    dispatch(setQuestion(q));
    dispatch(runQuery({ connectionId, question: q }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ask a question"
        description="Plain English in, verified read-only SQL out."
        actions={
          <Button variant="secondary" onClick={() => router.push(`/connections/${connectionId}`)}>
            Schema
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => dispatch(setQuestion(e.target.value))}
            placeholder="monthly revenue for the last 6 months"
          />
          <Button type="submit" loading={running} disabled={!question.trim()}>
            {running ? "Running" : "Run"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={running}
              onClick={() => ask(ex)}
              className="rounded-full border border-line px-3 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-45"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {running && (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-[300px]" />
          <p className="text-sm text-fg-muted">Retrieving tables, generating SQL, validating, executing…</p>
        </div>
      )}

      {/* Transport/auth failure - the request never produced a result. */}
      {request.error && <Alert title="Request failed">{request.error}</Alert>}

      {/* The engine ran but couldn't answer. A result, not a request error. */}
      {result && !result.ok && (
        <div className="space-y-3">
          <Alert
            tone={result.failureType === "security" ? "warning" : "danger"}
            title={`${result.failureType} failure${result.attempts.length > 1 ? ` after ${result.attempts.length} attempts` : ""}`}
          >
            <p>{result.detail}</p>
            {result.sql && (
              <div className="pt-2">
                <CodeBlock>{result.sql}</CodeBlock>
              </div>
            )}
          </Alert>
          <AttemptTrail attempts={result.attempts} />
        </div>
      )}

      {result && result.ok && (
        <div className="space-y-5">
          {result.attempts.length > 1 && (
            <Alert tone="success" title={`Self-corrected after ${result.attempts.length - 1} retr${result.attempts.length - 1 === 1 ? "y" : "ies"}`} />
          )}

          {result.answer.explanation && (
            <p className="text-base leading-relaxed text-fg">{result.answer.explanation}</p>
          )}

          <ResultChart chart={result.answer.chart} rows={result.answer.rows} />

          {/* The raw table is always present - it is also the relief for chart
              hues that fall below 3:1 contrast on the light surface. */}
          <ResultTable fields={result.answer.fields} rows={result.answer.rows} />

          <p className="text-xs text-fg-subtle">
            {result.answer.rowCount} row{result.answer.rowCount === 1 ? "" : "s"}
            {result.attempts[0] && ` · ${result.attempts[0].latencyMs} ms · retrieved: ${result.attempts[0].retrievedTables.join(", ")}`}
          </p>

          <Disclosure summary={`SQL${result.answer.sqlDescription ? ` - ${result.answer.sqlDescription}` : ""}`}>
            <CodeBlock>{result.answer.sql}</CodeBlock>
          </Disclosure>

          <AttemptTrail attempts={result.attempts} />
        </div>
      )}
    </div>
  );
}
