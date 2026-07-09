import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { QueryResponse } from "@/lib/types";
import { attachAsync, idleRequest, type RequestState } from "@/store/asyncState";
import { runQuery } from "./query.thunks";

interface QueryState {
  question: string;
  result: QueryResponse | null;
  request: RequestState;
}

const initialState: QueryState = {
  question: "",
  result: null,
  request: idleRequest(),
};

const querySlice = createSlice({
  name: "query",
  initialState,
  reducers: {
    setQuestion(state, action: PayloadAction<string>) {
      state.question = action.payload;
    },
    reset(state) {
      state.result = null;
      state.request = idleRequest();
    },
  },
  extraReducers: (builder) => {
    attachAsync(
      builder,
      runQuery,
      (s) => s.request,
      (s, result: QueryResponse) => {
        s.result = result;
      },
      // Clear a stale answer the moment a new question is in flight.
      (s) => {
        s.result = null;
      }
    );
  },
});

export const { setQuestion, reset: resetQuery } = querySlice.actions;
export const queryReducer = querySlice.reducer;
