import { apiFetch } from "@/lib/api";
import type { RetrievedTable } from "@/lib/types";
import { createApiThunk } from "@/store/createApiThunk";

export interface RetrieveArgs {
  connectionId: string;
  question: string;
}

export const retrieveTables = createApiThunk<RetrievedTable[], RetrieveArgs>(
  "retrieval/retrieve",
  async ({ connectionId, question }) => {
    const res = await apiFetch<{ question: string; tables: RetrievedTable[] }>(
      `/connections/${connectionId}/retrieve`,
      { method: "POST", body: JSON.stringify({ question }) }
    );
    return res.tables;
  }
);
