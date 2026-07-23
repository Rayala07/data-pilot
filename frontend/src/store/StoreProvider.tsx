"use client";

import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { hydrate } from "@/features/auth/auth.slice";
import { getToken, setToken, clearToken } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { makeStore, type AppStore } from "./store";

/** Returns true only for a Supabase session where the user has confirmed their email. */
function isConfirmedSession(session: { user?: { email_confirmed_at?: string | null } } | null) {
  return Boolean(session?.user?.email_confirmed_at);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    const store = makeStore();
    // ── Synchronous pre-hydration ─────────────────────────────────────────────
    // localStorage is only available in the browser. Reading it here, during the
    // very first render (before any paint), means guards see the correct
    // `hydrated: true` state immediately — no async gap, no flash.
    //
    // The async `supabase.auth.getSession()` in the effect below will
    // subsequently verify / refresh the token and may update it, but because
    // guards already have the right answer from localStorage the UI never
    // transitions through a wrong state.
    if (typeof window !== "undefined") {
      store.dispatch(hydrate(getToken()));
    }
    storeRef.current = store;
  }

  useEffect(() => {
    const store = storeRef.current!;

    // ── 1. Restore session on page load ──────────────────────────────────────
    // Only trust Supabase sessions where the email is confirmed.  The signUp
    // call creates a transient, unconfirmed session that Supabase stores in its
    // own localStorage key; if we blindly restore it we'll show the app for a
    // second then get a 401 from our backend.
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (isConfirmedSession(session)) {
        // Genuine confirmed session – sync to our token slot and Redux.
        setToken(session!.access_token);
        store.dispatch(hydrate(session!.access_token));
      } else {
        // No session or unconfirmed session (left over from a signUp before OTP).
        // Silently ignore — do NOT call supabase.auth.signOut() here because that
        // fires SIGNED_OUT which our handler will process and call clearToken(),
        // wiping any real token that was just set by the login/verifyOtp thunk.
        store.dispatch(hydrate(getToken()));
      }
    });

    // ── 2. Keep Redux in sync with Supabase auth events ──────────────────────
    // Skip events that fire during the OTP pending flow – signUp fires
    // SIGNED_IN with a transient unconfirmed session before the email is
    // confirmed, which would set a token and immediately redirect to /connections.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip all events while a signup OTP is pending.
      if (store.getState().auth.pendingEmail) return;

      if (event === "SIGNED_OUT") {
        // Guard against a race condition: when the page loads with an old
        // expired Supabase session, the SDK fires a background token-refresh
        // request. If the user logs in *before* that refresh fails, Supabase
        // fires SIGNED_OUT (for the old session) AFTER SIGNED_IN (for the new
        // one), wiping the freshly acquired token from localStorage.
        //
        // Fix: re-check the live Supabase session before clearing. A genuine
        // sign-out has no session; a spurious one (concurrent with a fresh
        // login) already has a confirmed session from the new SIGNED_IN.
        supabase.auth.getSession().then(({ data }) => {
          if (!isConfirmedSession(data.session)) {
            clearToken();
            store.dispatch(hydrate(null));
          }
          // If there IS a confirmed session, SIGNED_IN already set the
          // correct token — leave it alone.
        });
        return;
      }

      if (session && isConfirmedSession(session)) {
        // Confirmed user signed in / token refreshed.
        setToken(session.access_token);
        store.dispatch(hydrate(session.access_token));
      }
      // Any other event with an unconfirmed / null session – ignore.
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
