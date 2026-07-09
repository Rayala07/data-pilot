"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConnectionListItem } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearCreateError } from "../connections.slice";
import { createConnection, fetchConnections } from "../connections.thunks";
import { ReadOnlyGuide } from "./ReadOnlyGuide";

function AddConnectionForm() {
  const dispatch = useAppDispatch();
  const create = useAppSelector((s) => s.connections.create);
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const submitting = isLoading(create);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await dispatch(createConnection({ name, connectionString }));
    if (createConnection.fulfilled.match(result)) {
      setName("");
      setConnectionString("");
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-fg">Add a connection</h2>
          <p className="text-xs text-fg-muted">
            Use a read-only role. DataPilot never writes, but the credential shouldn&apos;t be able to either.
          </p>
        </div>

        {create.error && <Alert>{create.error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production analytics" required />
          </Field>
          <Field label="Connection string">
            <Input
              className="font-mono text-xs"
              value={connectionString}
              onChange={(e) => {
                setConnectionString(e.target.value);
                if (create.error) dispatch(clearCreateError());
              }}
              placeholder="postgresql://readonly_user:…@host:5432/postgres"
              required
            />
          </Field>
        </div>

        <ReadOnlyGuide />

        <div className="flex items-center gap-3">
          <Button type="submit" loading={submitting} disabled={!name || !connectionString}>
            {submitting ? "Connecting & scanning…" : "Connect"}
          </Button>
          {submitting && (
            <span className="text-xs text-fg-muted">Introspecting schema and building embeddings — up to ~30s.</span>
          )}
        </div>
      </form>
    </Card>
  );
}

function ConnectionCard({ id, name, tableCount, scannedAt, canWrite }: ConnectionListItem) {
  return (
    <Link
      href={`/connections/${id}`}
      className="block rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">{name}</span>
          {/* Verified, not assumed. null = never probed, so we say nothing. */}
          {canWrite === true && <Badge tone="warning">Can write</Badge>}
          {canWrite === false && <Badge tone="success">Read-only</Badge>}
        </span>
        <span className="shrink-0 text-xs text-fg-muted">
          {tableCount} table{tableCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs text-fg-subtle">
        {scannedAt ? `Scanned ${new Date(scannedAt).toLocaleString()}` : "Not scanned yet"}
      </p>
    </Link>
  );
}

export function ConnectionsView() {
  const dispatch = useAppDispatch();
  const { items, list } = useAppSelector((s) => s.connections);

  useEffect(() => {
    dispatch(fetchConnections());
  }, [dispatch]);

  return (
    <div className="space-y-8">
      <PageHeader title="Connections" description="Databases DataPilot can read and answer questions about." />

      <AddConnectionForm />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Your databases</h2>

        {list.error && <Alert>{list.error}</Alert>}

        {isLoading(list) && items.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-[74px]" />
            <Skeleton className="h-[74px]" />
          </div>
        )}

        {!isLoading(list) && !list.error && items.length === 0 && (
          <EmptyState
            title="No connections yet"
            description="Add a read-only PostgreSQL connection string above to get started."
          />
        )}

        <div className="grid gap-2">
          {items.map((c) => (
            <ConnectionCard key={c.id} {...c} />
          ))}
        </div>
      </section>
    </div>
  );
}
