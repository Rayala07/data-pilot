import { apiFetch, clearToken, setToken } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { createApiThunk } from "@/store/createApiThunk";

export interface Credentials {
  email: string;
  password: string;
}

async function authenticate(path: string, body: Credentials): Promise<string> {
  const { token } = await apiFetch<{ token: string }>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  // Persist here rather than in the reducer: reducers must stay pure.
  setToken(token);
  return token;
}

export const signup = createApiThunk<string, Credentials>("auth/signup", (creds) =>
  authenticate("/auth/signup", creds)
);

export const login = createApiThunk<string, Credentials>("auth/login", (creds) =>
  authenticate("/auth/login", creds)
);

export const logout = createApiThunk<void>("auth/logout", async () => {
  clearToken();
});

export const fetchProfile = createApiThunk<UserProfile>("auth/fetchProfile", () =>
  apiFetch<UserProfile>("/auth/me")
);

export interface DemoSession {
  token: string;
  /** The cloned seed connection - the page lands the visitor directly on it. */
  connectionId: string;
}

/** One click from a portfolio to a live, isolated sandbox. */
export const demoLogin = createApiThunk<DemoSession>("auth/demo", async () => {
  const session = await apiFetch<DemoSession>("/auth/demo", { method: "POST" });
  setToken(session.token);
  return session;
});
