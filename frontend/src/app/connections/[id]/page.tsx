"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import type { SchemaProfile } from "@/lib/types";

export default function ConnectionSchemaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [schema, setSchema] = useState<SchemaProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);

  async function load() {
    const profile = await apiFetch<SchemaProfile>(`/connections/${params.id}/schema`);
    setSchema(profile);
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load schema"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleRescan() {
    setRescanning(true);
    setError(null);
    try {
      await apiFetch(`/connections/${params.id}/rescan`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rescan failed");
    } finally {
      setRescanning(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Schema summary</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/connections/${params.id}/query`)}
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            Ask a question
          </button>
          <button
            onClick={() => router.push(`/connections/${params.id}/retrieve`)}
            className="rounded border px-4 py-2 text-sm"
          >
            Retrieval debug
          </button>
          <button
            onClick={handleRescan}
            disabled={rescanning}
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            {rescanning ? "Rescanning..." : "Rescan"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!schema && !error && <p className="text-sm text-zinc-500">Loading...</p>}
      {schema && (
        <p className="text-sm text-zinc-500">
          {schema.tables.length} tables · scanned {new Date(schema.scannedAt).toLocaleString()}
        </p>
      )}

      <div className="space-y-6">
        {schema?.tables.map((table) => (
          <div key={`${table.schema}.${table.name}`} className="rounded border p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-lg font-medium">
                {table.schema}.{table.name}
              </h2>
              <span className="text-sm text-zinc-500">~{table.rowEstimate.toLocaleString()} rows</span>
            </div>
            {table.description && <p className="mt-1 text-sm text-zinc-600">{table.description}</p>}
            {table.foreignKeys.length > 0 && (
              <p className="mt-1 text-sm text-zinc-500">
                FKs:{" "}
                {table.foreignKeys
                  .map((fk) => `${fk.column} → ${fk.refTable}.${fk.refColumn}`)
                  .join(", ")}
              </p>
            )}
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b text-zinc-500">
                  <th className="py-1 pr-4">Column</th>
                  <th className="py-1 pr-4">Type</th>
                  <th className="py-1 pr-4">Nullable</th>
                  <th className="py-1 pr-4">PK</th>
                  <th className="py-1">Sample values</th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((col) => (
                  <tr key={col.name} className="border-b last:border-0">
                    <td className="py-1 pr-4 font-mono">{col.name}</td>
                    <td className="py-1 pr-4 text-zinc-500">{col.dataType}</td>
                    <td className="py-1 pr-4 text-zinc-500">{col.nullable ? "yes" : "no"}</td>
                    <td className="py-1 pr-4 text-zinc-500">
                      {table.primaryKey.includes(col.name) ? "✓" : ""}
                    </td>
                    <td className="py-1 text-zinc-500">{col.sampleValues.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
