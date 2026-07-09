import { apiFetch } from "@/lib/api";
import type { ConnectionListItem, ConnectionSummary, SchemaProfile } from "@/lib/types";
import { createApiThunk } from "@/store/createApiThunk";

export const fetchConnections = createApiThunk<ConnectionListItem[]>("connections/fetchAll", () =>
  apiFetch<ConnectionListItem[]>("/connections")
);

export interface NewConnection {
  name: string;
  connectionString: string;
}

export const createConnection = createApiThunk<ConnectionListItem, NewConnection>(
  "connections/create",
  async (body, api) => {
    const created = await apiFetch<{ id: string; name: string; tableCount: number }>("/connections", {
      method: "POST",
      body: JSON.stringify(body),
    });
    // Refresh the list so scannedAt and counts come from the server, not guesses.
    api.dispatch(fetchConnections());
    return { ...created, scannedAt: null };
  }
);

export const fetchSchema = createApiThunk<SchemaProfile, string>("connections/fetchSchema", (connectionId) =>
  apiFetch<SchemaProfile>(`/connections/${connectionId}/schema`)
);

export const rescanConnection = createApiThunk<SchemaProfile, string>("connections/rescan", (connectionId) =>
  apiFetch<SchemaProfile>(`/connections/${connectionId}/rescan`, { method: "POST" })
);

/** Business-language overview. Cached server-side after the first call. */
export const fetchSummary = createApiThunk<ConnectionSummary, string>("connections/fetchSummary", (connectionId) =>
  apiFetch<ConnectionSummary>(`/connections/${connectionId}/summary`)
);
