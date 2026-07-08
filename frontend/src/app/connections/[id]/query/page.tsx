"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

interface Attempt {
  attemptNumber: number;
  sql: string | null;
  retrievedTables: string[];
  failureType?: string;
  errorText?: string;
  latencyMs: number;
}
interface QuerySuccess {
  ok: true;
  sql: string;
  rows: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
  attempts: Attempt[];
}
interface QueryFailure {
  ok: false;
  failureType: string;
  detail: string;
  sql?: string;
  attempts: Attempt[];
}
type QueryResponse = QuerySuccess | QueryFailure;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Day 3 minimal query page: question -> executed SQL + raw rows + attempt info.
// Charts and NL explanation come in Day 5.
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await apiFetch<QueryResponse>("/query", {
        method: "POST",
        body: JSON.stringify({ connectionId: params.id, question }),
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

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="how many users signed up in 2025?"
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && !result.ok && (
        <div className="space-y-2 rounded border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            {result.failureType} failure
          </p>
          <p className="text-sm text-red-700">{result.detail}</p>
          {result.sql && (
            <pre className="overflow-x-auto rounded bg-white p-2 text-xs">{result.sql}</pre>
          )}
        </div>
      )}

      {result && result.ok && (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Executed SQL</p>
            <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">{result.sql}</pre>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-zinc-500">
              {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
              {result.attempts[0] && ` · ${result.attempts[0].latencyMs} ms · retrieved: ${result.attempts[0].retrievedTables.join(", ")}`}
            </p>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50">
                    {result.fields.map((f) => (
                      <th key={f} className="px-3 py-1.5 font-mono text-xs">{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {result.fields.map((f) => (
                        <td key={f} className="px-3 py-1.5 tabular-nums">{cell(row[f])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length > 200 && (
              <p className="text-xs text-zinc-400">Showing first 200 of {result.rows.length} rows.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
