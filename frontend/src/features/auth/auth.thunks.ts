import { apiFetch, clearToken, setToken } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { createApiThunk } from "@/store/createApiThunk";
import { supabase } from "@/lib/supabase";

export interface Credentials {
  email: string;
  password: string;
  name?: string;
}

export const signup = createApiThunk<{ status: "check-email"; email: string }, Credentials>(
  "auth/signup",
  async (creds) => {
    const { error } = await supabase.auth.signUp({
      email: creds.email,
      password: creds.password,
      options: {
        data: { name: creds.name },
        // No emailRedirectTo — OTP mode: user types the code, no link click needed
      },
    });
    if (error) throw error;
    return { status: "check-email", email: creds.email };
  }
);

export const verifyOtp = createApiThunk<string, { email: string; token: string }>(
  "auth/verifyOtp",
  async ({ email, token }) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    if (error) throw error;
    if (!data.session) throw new Error("Verification succeeded but no session was returned.");
    const accessToken = data.session.access_token;
    setToken(accessToken);
    return accessToken;
  }
);

export const resendOtp = createApiThunk<void, string>(
  "auth/resendOtp",
  async (email) => {
    const { error } = await supabase.auth.resend({ email, type: "signup" });
    if (error) throw error;
  }
);

export const login = createApiThunk<string, Credentials>("auth/login", async (creds) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error) throw error;
  if (!data.session) throw new Error("No session returned");

  const token = data.session.access_token;
  setToken(token);
  return token;
});

export const logout = createApiThunk<void>("auth/logout", async () => {
  await supabase.auth.signOut();
  clearToken();
});

export const fetchProfile = createApiThunk<UserProfile>("auth/fetchProfile", () =>
  apiFetch<UserProfile>("/auth/me")
);
