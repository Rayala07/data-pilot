/* Hallmark · genre: modern-minimal · macrostructure: Index-First · theme: project system (globals.css)
 * nav: inherited (AppShell) · footer: none (app page) · enrichment: none — typography only
 * The page IS the list. One bordered index panel, hairline-divided rows, no card-in-card.
 */

"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { ConnectionListItem } from "@/lib/types";
import { Alert, Badge, Button, Field, Input, Skeleton, cn } from "@/components/ui";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearCreateError } from "../connections.slice";
import { createConnection, fetchConnections } from "../connections.thunks";
import { ReadOnlyGuide } from "./ReadOnlyGuide";

/** A plus that becomes a close by rotating 45° — one primitive, transform only. */
function PlusMark({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      className={cn(
        "size-3.5 transition-transform duration-200 ease-emphasis",
        open && "rotate-45"
      )}
    >
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Always visible, never hover-only — coarse pointers get the same affordance. */
function GoMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "size-4 shrink-0 text-fg-subtle",
        "transition-[color,transform] duration-200 ease-emphasis",
        "group-hover:translate-x-0.5 group-hover:text-brand",
        "group-focus-visible:translate-x-0.5 group-focus-visible:text-brand"
      )}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/**
 * Collapsed to a single row until asked for. The form is the page's one job, but
 * it is not the page's one *state* — most visits are here to open a database that
 * already exists, and an always-open five-field form buries that list below the fold.
 */
function AddConnectionPanel() {
  const dispatch = useAppDispatch();
  const create = useAppSelector((s) => s.connections.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const panelId = useId();
  const submitting = isLoading(create);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await dispatch(createConnection({ name, connectionString }));
    if (createConnection.fulfilled.match(result)) {
      setName("");
      setConnectionString("");
      // Silent success: the new row appearing in the index below is the receipt.
      setOpen(false);
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border bg-surface",
        "transition-[border-color,box-shadow] duration-200 ease-emphasis",
        open ? "border-line-strong shadow-raise" : "border-line"
      )}
    >
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left sm:px-5",
            "transition-colors duration-200 ease-emphasis hover:bg-surface-2"
          )}
        >
          <span className="whitespace-nowrap text-sm font-medium text-fg">Add a connection</span>
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2",
              "text-fg-muted transition-colors duration-200 ease-emphasis",
              open && "border-line-strong text-fg"
            )}
          >
            <PlusMark open={open} />
          </span>
        </button>
      </h2>

      {open && (
        <div id={panelId} className="border-t border-line px-4 pb-5 pt-4 sm:px-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="max-w-prose text-xs text-fg-muted">
              Use a read-only role. DataPilot never writes, but the credential shouldn&rsquo;t be able to either.
            </p>

            {create.error && <Alert>{create.error}</Alert>}

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production analytics"
                  required
                />
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

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button type="submit" loading={submitting} disabled={!name || !connectionString}>
                <span className="whitespace-nowrap">{submitting ? "Connecting…" : "Connect"}</span>
              </Button>
              {submitting && (
                <span className="text-xs text-fg-muted">
                  Introspecting schema and building embeddings — up to ~30s.
                </span>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

/**
 * A row, not a card. The index panel owns the border; rows are separated by
 * hairlines — a bordered card inside a bordered panel is card-in-card.
 */
function ConnectionRow({ id, name, tableCount, scannedAt, canWrite }: ConnectionListItem) {
  return (
    <Link
      href={`/connections/${id}`}
      className={cn(
        "group flex items-center gap-4 px-4 py-3.5 sm:px-5",
        "transition-colors duration-200 ease-emphasis hover:bg-surface-2"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-fg">{name}</span>
          {/* Verified, not assumed. null = never probed, so we say nothing. */}
          {canWrite === true && <Badge tone="warning">Can write</Badge>}
          {canWrite === false && <Badge tone="success">Read-only</Badge>}
        </span>
        <span className="mt-1 block truncate text-xs text-fg-subtle">
          <span className="tabular-nums">{tableCount}</span> table{tableCount === 1 ? "" : "s"}
          {scannedAt ? ` · scanned ${new Date(scannedAt).toLocaleDateString()}` : " · not scanned yet"}
        </span>
      </span>
      <GoMark />
    </Link>
  );
}

export function ConnectionsView() {
  const dispatch = useAppDispatch();
  const { items, list } = useAppSelector((s) => s.connections);
  const headingId = useId();

  useEffect(() => {
    dispatch(fetchConnections());
  }, [dispatch]);

  const loading = isLoading(list) && items.length === 0;
  const empty = !isLoading(list) && !list.error && items.length === 0;

  // Explicit margins rather than a uniform space-y: the gap above the index is
  // deliberately wider than the one under the header.
  return (
    <div>
      <header className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Connections</h1>
        <p className="max-w-prose text-sm text-fg-muted">
          Databases DataPilot can read and answer questions about.
        </p>
      </header>

      <AddConnectionPanel />

      <section aria-labelledby={headingId} className="mt-8 rounded-card border border-line bg-surface">
        <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
          <h2 id={headingId} className="text-sm font-medium text-fg">
            Connected databases
          </h2>
          {items.length > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{items.length}</span>
          )}
        </div>

        {list.error && (
          <div className="px-4 py-4 sm:px-5">
            <Alert>{list.error}</Alert>
          </div>
        )}

        {loading && (
          <div className="space-y-3 px-4 py-4 sm:px-5">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        )}

        {empty && (
          <p className="px-4 py-8 text-center text-sm text-fg-muted sm:px-5">
            No databases yet. Add a read-only connection string above to get started.
          </p>
        )}

        {items.length > 0 && (
          <div className="divide-y divide-line">
            {items.map((c) => (
              <ConnectionRow key={c.id} {...c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
