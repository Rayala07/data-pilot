import { apiFetch } from "@/lib/api";
import type { ApiKeySummary, CreatedApiKey } from "@/lib/types";
import { createApiThunk } from "@/store/createApiThunk";

export const fetchApiKeys = createApiThunk<ApiKeySummary[]>("apikeys/fetchAll", () =>
  apiFetch<ApiKeySummary[]>("/api-keys")
);

/** Returns the raw key - the caller shows it once, then it's gone. */
export const createApiKey = createApiThunk<CreatedApiKey, string>("apikeys/create", async (name, api) => {
  const created = await apiFetch<CreatedApiKey>("/api-keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  api.dispatch(fetchApiKeys());
  return created;
});

export const revokeApiKey = createApiThunk<string, string>("apikeys/revoke", async (id, api) => {
  await apiFetch(`/api-keys/${id}/revoke`, { method: "POST" });
  api.dispatch(fetchApiKeys());
  return id;
});

/** Permanent removal - the backend only allows it once the key is revoked. */
export const deleteApiKey = createApiThunk<string, string>("apikeys/delete", async (id, api) => {
  await apiFetch(`/api-keys/${id}`, { method: "DELETE" });
  api.dispatch(fetchApiKeys());
  return id;
});
