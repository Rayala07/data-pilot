import { createSlice } from "@reduxjs/toolkit";
import type { ApiKeySummary, CreatedApiKey } from "@/lib/types";
import { attachAsync, idleRequest, type RequestState } from "@/store/asyncState";
import { createApiKey, fetchApiKeys, revokeApiKey } from "./apikeys.thunks";

interface ApiKeysState {
  items: ApiKeySummary[];
  /** The just-created key's raw secret, shown once then dismissed. */
  createdKey: CreatedApiKey | null;
  list: RequestState;
  create: RequestState;
  revoke: RequestState;
}

const initialState: ApiKeysState = {
  items: [],
  createdKey: null,
  list: idleRequest(),
  create: idleRequest(),
  revoke: idleRequest(),
};

const apiKeysSlice = createSlice({
  name: "apikeys",
  initialState,
  reducers: {
    /** Called after the user has copied the raw key away. */
    dismissCreatedKey(state) {
      state.createdKey = null;
      state.create = idleRequest();
    },
  },
  extraReducers: (builder) => {
    attachAsync(builder, fetchApiKeys, (s) => s.list, (s, items: ApiKeySummary[]) => {
      s.items = items;
    });
    attachAsync(builder, createApiKey, (s) => s.create, (s, created: CreatedApiKey) => {
      s.createdKey = created;
    });
    attachAsync(builder, revokeApiKey, (s) => s.revoke);
  },
});

export const { dismissCreatedKey } = apiKeysSlice.actions;
export const apiKeysReducer = apiKeysSlice.reducer;
