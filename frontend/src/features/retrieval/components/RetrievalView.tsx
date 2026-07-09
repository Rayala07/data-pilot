"use client";

import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setRetrievalQuestion } from "../retrieval.slice";
import { retrieveTables } from "../retrieval.thunks";

export function RetrievalView({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { question, tables, request } = useAppSelector((s) => s.retrieval);
  const running = isLoading(request);

  const maxScore = tables?.length ? Math.max(...tables.map((t) => t.score)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retrieval debug"
        description="Which tables the embedding search selects for a question, and how strongly."
        actions={
          <Button variant="secondary" onClick={() => router.push(`/connections/${connectionId}`)}>
            Schema
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) dispatch(retrieveTables({ connectionId, question }));
        }}
        className="flex gap-2"
      >
        <Input
          value={question}
          onChange={(e) => dispatch(setRetrievalQuestion(e.target.value))}
          placeholder="what were last month's sales?"
        />
        <Button type="submit" loading={running} disabled={!question.trim()}>
          Retrieve
        </Button>
      </form>

      {request.error && <Alert title="Retrieval failed">{request.error}</Alert>}

      {running && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {!running && tables?.length === 0 && (
        <EmptyState title="No tables retrieved" description="Nothing in this database looked related to that question." />
      )}

      <div className="space-y-2">
        {!running &&
          tables
            ?.slice()
            .sort((a, b) => b.score - a.score)
            .map((t) => (
              <Card key={`${t.schema}.${t.name}`} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-sm text-fg">
                    {t.schema}.{t.name}
                    {t.viaForeignKey && <Badge tone="brand">via FK</Badge>}
                  </span>
                  <span className="text-sm tabular-nums text-fg-muted">{t.score.toFixed(4)}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(2, (t.score / maxScore) * 100)}%` }}
                  />
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}
