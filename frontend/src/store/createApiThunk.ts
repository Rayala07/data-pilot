import { createAsyncThunk, type GetThunkAPI } from "@reduxjs/toolkit";
import { ApiError, clearToken } from "@/lib/api";
import { sessionExpired } from "./actions";

type ThunkApi = { rejectValue: string };

/**
 * The one place an API error becomes redux state.
 *
 * Every feature thunk goes through here, so error extraction is uniform (the
 * backend's friendly `{ error }` message, never a raw stack), and an expired
 * token logs the user out from a single spot instead of being re-handled in
 * every component that happens to make a request.
 */
export function createApiThunk<Returned, Arg = void>(
  type: string,
  handler: (arg: Arg, api: GetThunkAPI<ThunkApi>) => Promise<Returned>
) {
  return createAsyncThunk<Returned, Arg, ThunkApi>(type, async (arg, api) => {
    try {
      return await handler(arg, api);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        api.dispatch(sessionExpired());
      }
      return api.rejectWithValue(err instanceof Error ? err.message : "Something went wrong");
    }
  });
}
