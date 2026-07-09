"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, Badge, Button, Card, PageHeader, Skeleton } from "@/components/ui";
import type { TableProfile } from "@/lib/types";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSchema, rescanConnection } from "../connections.thunks";

function TableCard({ table }: { table: TableProfile }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="font-mono text-sm font-medium text-fg">
          {table.schema}.{table.name}
        </h3>
        <span className="text-xs tabular-nums text-fg-muted">~{table.rowEstimate.toLocaleString()} rows</span>
      </div>

      {table.description && <p className="border-b border-line px-4 py-3 text-sm text-fg-muted">{table.description}</p>}

      {table.foreignKeys.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
          {table.foreignKeys.map((fk) => (
            <Badge key={fk.column} tone="brand">
              {fk.column} → {fk.refTable}.{fk.refColumn}
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-fg-muted">
              <th className="px-4 py-2 font-medium">Column</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Null</th>
              <th className="px-4 py-2 font-medium">Sample values</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((col) => (
              <tr key={col.name} className="border-b border-line last:border-0">
                <td className="px-4 py-1.5 font-mono text-xs text-fg">
                  <span className="inline-flex items-center gap-1.5">
                    {col.name}
                    {table.primaryKey.includes(col.name) && <Badge>PK</Badge>}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-xs text-fg-muted">{col.dataType}</td>
                <td className="px-4 py-1.5 text-xs text-fg-muted">{col.nullable ? "yes" : "no"}</td>
                <td className="max-w-sm truncate px-4 py-1.5 text-xs text-fg-subtle">
                  {col.sampleValues.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function SchemaView({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { schema, schemaRequest, rescan } = useAppSelector((s) => s.connections);

  useEffect(() => {
    dispatch(fetchSchema(connectionId));
  }, [dispatch, connectionId]);

  const busy = isLoading(schemaRequest) || isLoading(rescan);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schema"
        description={
          schema
            ? `${schema.tables.length} tables · scanned ${new Date(schema.scannedAt).toLocaleString()}`
            : "Loading the database structure…"
        }
        actions={
          <>
            <Button onClick={() => router.push(`/connections/${connectionId}/query`)}>Ask a question</Button>
            <Button variant="secondary" onClick={() => router.push(`/connections/${connectionId}/retrieve`)}>
              Retrieval debug
            </Button>
            <Button
              variant="secondary"
              loading={isLoading(rescan)}
              onClick={() => dispatch(rescanConnection(connectionId))}
            >
              Rescan
            </Button>
          </>
        }
      />

      {schemaRequest.error && <Alert title="Couldn't load the schema">{schemaRequest.error}</Alert>}
      {rescan.error && <Alert title="Rescan failed">{rescan.error}</Alert>}

      {busy && !schema && (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      <div className="space-y-4">
        {schema?.tables.map((t) => (
          <TableCard key={`${t.schema}.${t.name}`} table={t} />
        ))}
      </div>
    </div>
  );
}
