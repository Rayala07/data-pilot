import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RetrievedTable } from "@/lib/types";
import { attachAsync, idleRequest, type RequestState } from "@/store/asyncState";
import { retrieveTables } from "./retrieval.thunks";

interface RetrievalState {
  question: string;
  tables: RetrievedTable[] | null;
  request: RequestState;
}

const initialState: RetrievalState = {
  question: "",
  tables: null,
  request: idleRequest(),
};

const retrievalSlice = createSlice({
  name: "retrieval",
  initialState,
  reducers: {
    setQuestion(state, action: PayloadAction<string>) {
      state.question = action.payload;
    },
    reset(state) {
      state.tables = null;
      state.request = idleRequest();
    },
  },
  extraReducers: (builder) => {
    attachAsync(builder, retrieveTables, (s) => s.request, (s, tables: RetrievedTable[]) => {
      s.tables = tables;
    });
  },
});

export const { setQuestion: setRetrievalQuestion, reset: resetRetrieval } = retrievalSlice.actions;
export const retrievalReducer = retrievalSlice.reducer;
