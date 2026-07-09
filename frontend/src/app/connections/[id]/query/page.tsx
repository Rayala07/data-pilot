"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResultChart } from "@/components/ResultChart";
import { apiFetch, getToken } from "@/lib/api";
import type { Attempt, FieldMeta, QueryResponse } from "@/lib/types";

const EXAMPLES = [
  "monthly revenue for the last 6 months",
  "how many users signed up in 2025?",
  "top 5 products by revenue",
];

function formatCell(value: unknown, kind: FieldMeta["kind"]): string {
  if (value === null || value === undefined) return "—";
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

// The attempt trail is the visible proof of the self-correction loop.
function AttemptTrail({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length <= 1) return null;
  return (
    <details className="rounded-lg border p-3" style={{ borderColor: "var(--hairline)" }}>
      <summary className="cursor-pointer text-sm font-medium">Attempt history ({attempts.length} attempts)</summary>
      <div className="mt-3 space-y-3">
        {attempts.map((a) => (
          <div key={a.attemptNumber} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Attempt {a.attemptNumber}</span>
              {a.failureType ? (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{a.failureType}</span>
              ) : (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">succeeded</span>
              )}
              <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{a.latencyMs} ms</span>
            </div>
            {a.sql && (
              <pre className="overflow-x-auto rounded p-2 text-xs" style={{ background: "var(--surface)" }}>{a.sql}</pre>
            )}
            {a.errorText && <p className="text-xs text-red-600">{a.errorText}</p>}
          </div>
        ))}
      </div>
    </details>
  );
}

function ResultTable({ fields, rows }: { fields: FieldMeta[]; rows: Record<string, unknown>[] }) {
  const shown = rows.slice(0, 200);
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--hairline)" }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
              {fields.map((f) => (
                <th
                  key={f.name}
                  className={`px-3 py-2 font-mono text-xs font-medium ${f.kind === "numeric" ? "text-right" : ""}`}
                  style={{ color: "var(--ink-secondary)" }}
                >
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--hairline)" }}>
                {fields.map((f) => (
                  <td
                    key={f.name}
                    className={`px-3 py-1.5 ${f.kind === "numeric" ? "text-right tabular-nums" : ""}`}
                  >
                    {formatCell(row[f.name], f.kind)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={fields.length} className="px-3 py-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                  No rows matched.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          Showing first {shown.length} of {rows.length} rows.
        </p>
      )}
    </div>
  );
}

export default function QueryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, [router]);

  async function run(q: string) {
    if (!q.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await apiFetch<QueryResponse>("/query", {
        method: "POST",
        body: JSON.stringify({ connectionId: params.id, question: q }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ask a question</h1>
        <button onClick={() => router.push(`/connections/${params.id}`)} className="text-sm underline">
          ← Schema
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(question);
        }}
        className="space-y-2"
      >
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="monthly revenue for the last 6 months"
            className="flex-1 rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-lg bg-black px-5 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {loading ? "Running…" : "Run"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={loading}
              onClick={() => {
                setQuestion(ex);
                run(ex);
              }}
              className="rounded-full border px-3 py-1 text-xs disabled:opacity-40"
              style={{ borderColor: "var(--hairline)", color: "var(--ink-secondary)" }}
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {loading && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded" style={{ background: "var(--viz-grid)" }} />
          <div className="h-[300px] animate-pulse rounded-lg" style={{ background: "var(--viz-grid)" }} />
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Retrieving tables, generating SQL, validating, executing…
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && !result.ok && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              {result.failureType} failure
              {result.attempts.length > 1 && ` after ${result.attempts.length} attempts`}
            </p>
            <p className="text-sm text-red-700">{result.detail}</p>
            {result.sql && <pre className="overflow-x-auto rounded bg-white p-2 text-xs text-zinc-800">{result.sql}</pre>}
          </div>
          <AttemptTrail attempts={result.attempts} />
        </div>
      )}

      {result && result.ok && (
        <div className="space-y-5">
          {result.attempts.length > 1 && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
              ✓ Self-corrected after {result.attempts.length - 1} retr{result.attempts.length - 1 === 1 ? "y" : "ies"}
            </div>
          )}

          {result.answer.explanation && (
            <p className="text-base leading-relaxed" style={{ color: "var(--ink-primary)" }}>
              {result.answer.explanation}
            </p>
          )}

          <ResultChart chart={result.answer.chart} rows={result.answer.rows} />

          {/* The raw table is always present — it is also the relief for the
              chart slots that fall below 3:1 contrast on the light surface. */}
          <ResultTable fields={result.answer.fields} rows={result.answer.rows} />

          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {result.answer.rowCount} row{result.answer.rowCount === 1 ? "" : "s"}
            {result.attempts[0] && ` · ${result.attempts[0].latencyMs} ms · retrieved: ${result.attempts[0].retrievedTables.join(", ")}`}
          </p>

          <details className="rounded-lg border p-3" style={{ borderColor: "var(--hairline)" }}>
            <summary className="cursor-pointer text-sm font-medium">
              SQL{result.answer.sqlDescription ? ` — ${result.answer.sqlDescription}` : ""}
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">{result.answer.sql}</pre>
          </details>

          <AttemptTrail attempts={result.attempts} />
        </div>
      )}
    </div>
  );
}
