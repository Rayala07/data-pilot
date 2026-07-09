import { apiFetch } from "@/lib/api";
import type { QueryResponse } from "@/lib/types";
import { createApiThunk } from "@/store/createApiThunk";

export interface AskArgs {
  connectionId: string;
  question: string;
}

/**
 * Note the distinction: a query the engine *ran* but couldn't answer (bad SQL,
 * a security refusal) comes back HTTP 200 with `ok: false`. That is a result,
 * not a request failure, so the thunk fulfils and the UI renders the failure
 * with its attempt trail. Only transport/auth/404 errors reject.
 */
export const runQuery = createApiThunk<QueryResponse, AskArgs>("query/run", (args) =>
  apiFetch<QueryResponse>("/query", { method: "POST", body: JSON.stringify(args) })
);
