import { createSlice } from "@reduxjs/toolkit";
import type { ConnectionListItem, ConnectionSummary, SchemaProfile } from "@/lib/types";
import { attachAsync, idleRequest, type RequestState } from "@/store/asyncState";
import {
  createConnection,
  fetchConnections,
  fetchSchema,
  fetchSummary,
  rescanConnection,
} from "./connections.thunks";

interface ConnectionsState {
  items: ConnectionListItem[];
  schema: SchemaProfile | null;
  summary: ConnectionSummary | null;
  // One RequestState per operation: a failing rescan must not blank the list's spinner.
  list: RequestState;
  create: RequestState;
  schemaRequest: RequestState;
  summaryRequest: RequestState;
  rescan: RequestState;
}

const initialState: ConnectionsState = {
  items: [],
  schema: null,
  summary: null,
  list: idleRequest(),
  create: idleRequest(),
  schemaRequest: idleRequest(),
  summaryRequest: idleRequest(),
  rescan: idleRequest(),
};

const connectionsSlice = createSlice({
  name: "connections",
  initialState,
  reducers: {
    clearCreateError(state) {
      state.create.error = null;
    },
    clearSchema(state) {
      state.schema = null;
      state.schemaRequest = idleRequest();
    },
  },
  extraReducers: (builder) => {
    attachAsync(builder, fetchConnections, (s) => s.list, (s, items: ConnectionListItem[]) => {
      s.items = items;
    });
    attachAsync(builder, createConnection, (s) => s.create);
    attachAsync(builder, fetchSchema, (s) => s.schemaRequest, (s, schema: SchemaProfile) => {
      s.schema = schema;
    });
    attachAsync(builder, fetchSummary, (s) => s.summaryRequest, (s, summary: ConnectionSummary) => {
      s.summary = summary;
    });
    attachAsync(
      builder,
      rescanConnection,
      (s) => s.rescan,
      (s, schema: SchemaProfile) => {
        s.schema = schema;
        // The server dropped its cached summary along with the old schema, so
        // drop ours too and let the overview refetch a regenerated one.
        s.summary = null;
      }
    );
  },
});

export const { clearCreateError, clearSchema } = connectionsSlice.actions;
export const connectionsReducer = connectionsSlice.reducer;
