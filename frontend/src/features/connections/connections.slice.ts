import { createSlice } from "@reduxjs/toolkit";
import type { ConnectionSummary, SchemaProfile } from "@/lib/types";
import { attachAsync, idleRequest, type RequestState } from "@/store/asyncState";
import { createConnection, fetchConnections, fetchSchema, rescanConnection } from "./connections.thunks";

interface ConnectionsState {
  items: ConnectionSummary[];
  schema: SchemaProfile | null;
  // One RequestState per operation: a failing rescan must not blank the list's spinner.
  list: RequestState;
  create: RequestState;
  schemaRequest: RequestState;
  rescan: RequestState;
}

const initialState: ConnectionsState = {
  items: [],
  schema: null,
  list: idleRequest(),
  create: idleRequest(),
  schemaRequest: idleRequest(),
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
    attachAsync(builder, fetchConnections, (s) => s.list, (s, items: ConnectionSummary[]) => {
      s.items = items;
    });
    attachAsync(builder, createConnection, (s) => s.create);
    attachAsync(builder, fetchSchema, (s) => s.schemaRequest, (s, schema: SchemaProfile) => {
      s.schema = schema;
    });
    attachAsync(builder, rescanConnection, (s) => s.rescan, (s, schema: SchemaProfile) => {
      s.schema = schema;
    });
  },
});

export const { clearCreateError, clearSchema } = connectionsSlice.actions;
export const connectionsReducer = connectionsSlice.reducer;
