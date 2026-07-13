"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CodeBlock,
  CopyButton,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { dismissCreatedKey } from "../apikeys.slice";
import { createApiKey, deleteApiKey, fetchApiKeys, revokeApiKey } from "../apikeys.thunks";

/** The one-time reveal. Once dismissed the raw key is unrecoverable. */
function CreatedKeyNotice() {
  const dispatch = useAppDispatch();
  const created = useAppSelector((s) => s.apikeys.createdKey);
  if (!created) return null;

  return (
    <Alert tone="success" title={`Key "${created.name}" created`}>
      <div className="space-y-2">
        <p>Copy it now — for your security it won&apos;t be shown again.</p>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CodeBlock>{created.key}</CodeBlock>
          </div>
          <CopyButton value={created.key} label="Copy key" />
        </div>
        <Button variant="secondary" size="sm" onClick={() => dispatch(dismissCreatedKey())}>
          I&apos;ve saved it
        </Button>
      </div>
    </Alert>
  );
}

function CreateKeyForm() {
  const dispatch = useAppDispatch();
  const create = useAppSelector((s) => s.apikeys.create);
  const [name, setName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await dispatch(createApiKey(name.trim()));
    if (createApiKey.fulfilled.match(result)) setName("");
  }

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-fg">Create an API key</h2>
          <p className="text-xs text-fg-muted">
            Use it with the public API (see <span className="font-mono">docs/api.md</span>) to run queries from your own
            backend.
          </p>
        </div>
        {create.error && <Alert>{create.error}</Alert>}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production backend" required />
            </Field>
          </div>
          <Button type="submit" loading={isLoading(create)} disabled={!name.trim()}>
            Create key
          </Button>
        </div>
      </form>
    </Card>
  );
}

function KeyRow({
  id,
  name,
  keyPrefix,
  lastUsedAt,
  revokedAt,
}: {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}) {
  const dispatch = useAppDispatch();
  const revoke = useAppSelector((s) => s.apikeys.revoke);
  const remove = useAppSelector((s) => s.apikeys.remove);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-0 space-y-0.5">
        <p className="flex items-center gap-2 text-sm font-medium text-fg">
          {name}
          {revokedAt && <Badge tone="danger">Revoked</Badge>}
        </p>
        <p className="font-mono text-xs text-fg-muted">
          {keyPrefix}
          <span className="text-fg-subtle">…</span>
        </p>
        <p className="text-xs text-fg-subtle">
          {lastUsedAt ? `Last used ${new Date(lastUsedAt).toLocaleString()}` : "Never used"}
        </p>
      </div>
      {revokedAt ? (
        // A revoked key can no longer authenticate; deleting only tidies the list.
        <Button variant="ghost" size="sm" loading={isLoading(remove)} onClick={() => dispatch(deleteApiKey(id))}>
          Delete
        </Button>
      ) : (
        <Button variant="danger" size="sm" loading={isLoading(revoke)} onClick={() => dispatch(revokeApiKey(id))}>
          Revoke
        </Button>
      )}
    </div>
  );
}

export function ApiKeysView() {
  const dispatch = useAppDispatch();
  const { items, list } = useAppSelector((s) => s.apikeys);

  useEffect(() => {
    dispatch(fetchApiKeys());
  }, [dispatch]);

  return (
    <div className="space-y-8">
      <PageHeader title="API keys" description="Credentials for calling DataPilot's public API from your own services." />

      <CreatedKeyNotice />
      <CreateKeyForm />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Your keys</h2>

        {list.error && <Alert>{list.error}</Alert>}

        {isLoading(list) && items.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}

        {!isLoading(list) && !list.error && items.length === 0 && (
          <EmptyState title="No API keys yet" description="Create one above to start using the public API." />
        )}

        {items.length > 0 && (
          <Card>
            {items.map((k) => (
              <KeyRow key={k.id} {...k} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
