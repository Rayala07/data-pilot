"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, Button, Card, Disclosure, PageHeader, Skeleton } from "@/components/ui";
import { setQuestion } from "@/features/query/query.slice";
import { runQuery } from "@/features/query/query.thunks";
import type { ConnectionSummary, EntitySummary } from "@/lib/types";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchConnections, fetchSchema, fetchSummary, rescanConnection } from "../connections.thunks";
import { SchemaTables } from "./SchemaTables";

/** "Jan 2024 - Jun 2026" */
function formatRange(range: NonNullable<ConnectionSummary["dateRange"]>): string | null {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };
  const from = fmt(range.from);
  const to = fmt(range.to);
  return from && to ? `${from} - ${to}` : null;
}

function EntityChip({ entity }: { entity: EntitySummary }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
      <span aria-hidden className="text-base leading-none">
        {entity.emoji}
      </span>
      <span className="text-sm text-fg">{entity.label}</span>
      <span className="text-sm tabular-nums text-fg-muted">{entity.count.toLocaleString()}</span>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <Skeleton className="h-6 w-72" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
      <p className="text-sm text-fg-muted">Reading your schema and working out what it&apos;s about…</p>
    </div>
  );
}

export function ConnectionOverview({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { items, summary, summaryRequest, schema, schemaRequest, rescan } = useAppSelector((s) => s.connections);

  useEffect(() => {
    dispatch(fetchSummary(connectionId));
    dispatch(fetchSchema(connectionId));
  }, [dispatch, connectionId]);

  // The name lives on the connections list; a deep link may not have loaded it.
  useEffect(() => {
    if (items.length === 0) dispatch(fetchConnections());
  }, [dispatch, items.length]);

  const connection = items.find((c) => c.id === connectionId);
  const name = connection?.name ?? "your database";

  /** Suggestions are data, not code: they fill the input and run the normal query flow. */
  function askSuggestion(question: string) {
    dispatch(setQuestion(question));
    dispatch(runQuery({ connectionId, question }));
    router.push(`/connections/${connectionId}/query`);
  }

  async function handleRescan() {
    await dispatch(rescanConnection(connectionId));
    // The rescan invalidated the cached summary server-side; pull the new one.
    dispatch(fetchSummary(connectionId));
  }

  const range = summary?.dateRange ? formatRange(summary.dateRange) : null;
  const generating = isLoading(summaryRequest) && !summary;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Connected to ${name}`}
        description="DataPilot has read your schema. Here's what it looks like."
        actions={
          <>
            <Button onClick={() => router.push(`/connections/${connectionId}/query`)}>Ask a question</Button>
            <Button variant="secondary" loading={isLoading(rescan)} onClick={handleRescan}>
              Rescan
            </Button>
          </>
        }
      />

      {/* Verified at connect time, not assumed. Non-blocking: DataPilot still
          only ever runs validated SELECTs on a read-only session. */}
      {connection?.canWrite === true && (
        <Alert tone="warning" title="This credential can modify your data">
          DataPilot only ever runs read-only queries, but the credential you gave it is stronger than it needs to be.
          Consider swapping it for a read-only role - the connect screen shows how.
        </Alert>
      )}

      {summaryRequest.error && <Alert title="Couldn't build the overview">{summaryRequest.error}</Alert>}
      {rescan.error && <Alert title="Rescan failed">{rescan.error}</Alert>}

      {generating && <SummarySkeleton />}

      {summary && (
        <div className="space-y-6">
          {summary.headline && <p className="text-lg text-fg">{summary.headline}</p>}

          <div className="flex flex-wrap gap-2">
            {summary.entities.map((e) => (
              <EntityChip key={e.label} entity={e} />
            ))}
          </div>

          {range && <p className="text-sm text-fg-muted">Your data covers {range}</p>}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Try asking</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {summary.suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => askSuggestion(q)}
                  className="rounded-lg border border-line bg-surface px-4 py-3 text-left text-sm text-fg transition-colors hover:border-brand hover:bg-surface-2"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Demoted, not deleted: the system's own model of the database. */}
      <Disclosure summary="View technical details">
        {isLoading(schemaRequest) && !schema && <Skeleton className="h-40" />}
        {schemaRequest.error && <Alert title="Couldn't load the schema">{schemaRequest.error}</Alert>}
        {schema && <SchemaTables schema={schema} />}
      </Disclosure>
    </div>
  );
}
