import type { ActionReducerMapBuilder, Draft } from "@reduxjs/toolkit";

/**
 * One request, one state. Every async operation in the app is described by this
 * shape, so no component ever declares its own `loading` / `error` useState.
 */
export type Status = "idle" | "loading" | "succeeded" | "failed";

export interface RequestState {
  status: Status;
  error: string | null;
}

export const idleRequest = (): RequestState => ({ status: "idle", error: null });

export const isLoading = (r: RequestState) => r.status === "loading";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Just the three action creators we attach. Taking the full `AsyncThunk<...>`
 * here does not work: its ThunkApiConfig makes `rejected` contravariant on
 * `rejectValue`, and leaving `Returned` inferable from both the thunk and the
 * payload annotation makes TS union them into `T | undefined`. The payload type
 * is asserted once, below - the annotation on `onFulfilled` is the contract.
 */
interface ThunkActionCreators {
  pending: any;
  fulfilled: any;
  rejected: any;
}

interface RejectedAction {
  payload?: string;
  error?: { message?: string };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Wires pending → loading, rejected → error, fulfilled → success for a thunk.
 *
 * This is the single place loading and error transitions are written. A slice
 * only supplies (a) which RequestState slot the thunk owns and (b) what to do
 * with the payload on success - it never repeats the three-case boilerplate,
 * so a slice can't forget to clear an error or leave a spinner stuck on.
 */
export function attachAsync<S, Returned = void>(
  builder: ActionReducerMapBuilder<S>,
  thunk: ThunkActionCreators,
  selectRequest: (state: Draft<S>) => RequestState,
  onFulfilled?: (state: Draft<S>, payload: Returned) => void,
  /**
   * Extra work when the request starts (e.g. clearing a stale result).
   * It belongs here rather than as a second `addCase` in the slice: RTK
   * rejects two reducers for the same action type.
   */
  onPending?: (state: Draft<S>) => void
): void {
  builder
    .addCase(thunk.pending, (state: Draft<S>) => {
      const request = selectRequest(state);
      request.status = "loading";
      request.error = null;
      onPending?.(state);
    })
    .addCase(thunk.fulfilled, (state: Draft<S>, action: { payload: Returned }) => {
      const request = selectRequest(state);
      request.status = "succeeded";
      request.error = null;
      onFulfilled?.(state, action.payload);
    })
    .addCase(thunk.rejected, (state: Draft<S>, action: RejectedAction) => {
      const request = selectRequest(state);
      request.status = "failed";
      // rejectWithValue payload first: it carries the API's friendly message.
      request.error = action.payload ?? action.error?.message ?? "Something went wrong";
    });
}
