import { createSlice, type Draft, type PayloadAction } from "@reduxjs/toolkit";
import type { UserProfile } from "@/lib/types";
import { sessionExpired } from "@/store/actions";
import { attachAsync, idleRequest, type RequestState } from "@/store/asyncState";
import { fetchProfile, login, logout, signup } from "./auth.thunks";

interface AuthState {
  token: string | null;
  profile: UserProfile | null;
  /** False until localStorage has been read, so guards don't redirect too early. */
  hydrated: boolean;
  request: RequestState;
  profileRequest: RequestState;
}

const initialState: AuthState = {
  token: null,
  profile: null,
  hydrated: false,
  request: idleRequest(),
  profileRequest: idleRequest(),
};

const clearSession = (state: Draft<AuthState>) => {
  state.token = null;
  state.profile = null;
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Called once from an effect with whatever localStorage held. */
    hydrate(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
      state.hydrated = true;
    },
    clearError(state) {
      state.request.error = null;
    },
  },
  extraReducers: (builder) => {
    attachAsync(builder, signup, (s) => s.request, (s, token: string) => {
      s.token = token;
    });
    attachAsync(builder, login, (s) => s.request, (s, token: string) => {
      s.token = token;
    });
    attachAsync(builder, logout, (s) => s.request, clearSession);
    attachAsync(builder, fetchProfile, (s) => s.profileRequest, (s, profile: UserProfile) => {
      s.profile = profile;
    });
    // A 401 anywhere in the app drops the session here, not in a component.
    builder.addCase(sessionExpired, clearSession);
  },
});

export const { hydrate, clearError } = authSlice.actions;
export const authReducer = authSlice.reducer;
