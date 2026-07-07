"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

interface RetrievedTable {
  schema: string;
  name: string;
  score: number;
  viaForeignKey: boolean;
}

// Day 2 debug page: shows which tables retrieval selects for a question, with
// scores, so the retrieval step is visible (not a black box).
export default function RetrieveDebugPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [question, setQuestion] = useState("");
  const [tables, setTables] = useState<RetrievedTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTables(null);
    try {
      const res = await apiFetch<{ question: string; tables: RetrievedTable[] }>(
        `/connections/${params.id}/retrieve`,
        { method: "POST", body: JSON.stringify({ question }) }
      );
      setTables(res.tables);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retrieval failed");
    } finally {
      setLoading(false);
    }
  }

  const maxScore = tables && tables.length > 0 ? Math.max(...tables.map((t) => t.score)) : 1;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Retrieval debug</h1>
        <button onClick={() => router.push(`/connections/${params.id}`)} className="text-sm underline">
          ← Schema
        </button>
      </div>
      <p className="text-sm text-zinc-500">
        Ask a question to see which tables the retrieval step selects, ranked by cosine similarity.
        Tables pulled in by foreign-key expansion are tagged.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="what were last month's sales?"
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Retrieving..." : "Retrieve"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tables && (
        <div className="space-y-2">
          {tables.length === 0 && <p className="text-sm text-zinc-500">No tables retrieved.</p>}
          {tables.map((t) => (
            <div key={`${t.schema}.${t.name}`} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono">
                  {t.schema}.{t.name}
                  {t.viaForeignKey && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">via FK</span>
                  )}
                </span>
                <span className="text-sm tabular-nums text-zinc-500">{t.score.toFixed(4)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-zinc-100">
                <div className="h-full bg-black" style={{ width: `${Math.max(2, (t.score / maxScore) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
