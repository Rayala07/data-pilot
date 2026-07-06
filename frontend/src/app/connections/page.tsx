"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, clearToken, getToken } from "@/lib/api";
import type { ConnectionSummary } from "@/lib/types";

export default function ConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<ConnectionSummary[] | null>(null);
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadConnections() {
    const list = await apiFetch<ConnectionSummary[]>("/connections");
    setConnections(list);
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    loadConnections().catch((err) => setError(err instanceof Error ? err.message : "Failed to load connections"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/connections", {
        method: "POST",
        body: JSON.stringify({ name, connectionString }),
      });
      setName("");
      setConnectionString("");
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add connection");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Connections</h1>
        <button onClick={handleLogout} className="text-sm underline">
          Log out
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Add a connection</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="My e-commerce DB"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium">Connection string (read-only role)</label>
          <input
            required
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            className="w-full rounded border px-3 py-2 font-mono text-sm"
            placeholder="postgresql://readonly_user:...@host:5432/postgres"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Connecting & scanning..." : "Connect"}
        </button>
      </form>

      <div className="space-y-2">
        {connections === null && <p className="text-sm text-zinc-500">Loading...</p>}
        {connections?.length === 0 && <p className="text-sm text-zinc-500">No connections yet.</p>}
        {connections?.map((c) => (
          <Link
            key={c.id}
            href={`/connections/${c.id}`}
            className="block rounded border p-4 hover:bg-zinc-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-zinc-500">{c.tableCount} tables</span>
            </div>
            {c.scannedAt && (
              <p className="text-xs text-zinc-400">Scanned {new Date(c.scannedAt).toLocaleString()}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
