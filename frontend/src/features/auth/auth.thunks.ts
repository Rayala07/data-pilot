import { apiFetch, clearToken, setToken } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { createApiThunk } from "@/store/createApiThunk";
import { supabase } from "@/lib/supabase";

export interface Credentials {
  email: string;
  password: string;
  name?: string;
}

/**
 * Signup and login can both end up at the OTP screen, so they share one result
 * shape: either we're signed in, or a code is waiting in the user's inbox.
 */
export type AuthResult =
  | { status: "signed-in"; token: string }
  | { status: "check-email"; email: string };

export const signup = createApiThunk<AuthResult, Credentials>(
  "auth/signup",
  async (creds) => {
    const { data, error } = await supabase.auth.signUp({
      email: creds.email,
      password: creds.password,
      options: {
        data: { name: creds.name },
        // No emailRedirectTo — OTP mode: user types the code, no link click needed
      },
    });
    if (error) throw error;

    // Supabase's email-enumeration protection answers 200 OK with a *decoy* user
    // when the address is already registered: fake id, fake created_at, and a
    // confirmation_sent_at that never happened. No account is created and no mail
    // is sent. The only tell is an empty `identities` array — without this check
    // we'd send the user to /verify-email to wait for a code that isn't coming.
    if (data.user && data.user.identities?.length === 0) {
      throw new Error(
        "An account with this email already exists. Sign in instead — if you never confirmed it, signing in will send you a fresh code."
      );
    }

    // Email confirmations turned off on the project: Supabase returns a real,
    // already-confirmed session and sends nothing. Go straight into the app.
    if (data.session && data.user?.email_confirmed_at) {
      setToken(data.session.access_token);
      return { status: "signed-in", token: data.session.access_token };
    }

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
    if (!error) return;
    // The built-in Supabase mailer allows very few messages per hour; say so
    // rather than showing a bare "429".
    if (error.code === "over_email_send_rate_limit") {
      throw new Error("Too many codes requested. Please wait a few minutes and try again.");
    }
    throw error;
  }
);

export const login = createApiThunk<AuthResult, Credentials>("auth/login", async (creds) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });

  if (error) {
    // Account exists but the address was never confirmed. Dead-ending on
    // "Email not confirmed" leaves the user with no way forward, so mail a fresh
    // code and hand them to the OTP screen.
    if (error.code === "email_not_confirmed") {
      await supabase.auth.resend({ email: creds.email, type: "signup" });
      return { status: "check-email", email: creds.email };
    }
    throw error;
  }
  if (!data.session) throw new Error("No session returned");

  const token = data.session.access_token;
  setToken(token);
  return { status: "signed-in", token };
});

export const logout = createApiThunk<void>("auth/logout", async () => {
  await supabase.auth.signOut();
  clearToken();
});

export const fetchProfile = createApiThunk<UserProfile>("auth/fetchProfile", () =>
  apiFetch<UserProfile>("/auth/me")
);
