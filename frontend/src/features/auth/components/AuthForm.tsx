"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearError } from "../auth.slice";
import { login, signup } from "../auth.thunks";

/**
 * One component for both screens — the only differences are the thunk, the
 * copy, and the link. Loading and error come straight from the auth slice, so
 * there is no local `useState` for either.
 *
 * No redirect here: a successful thunk sets `auth.token`, and RequireGuest —
 * which wraps this route group — navigates away. Redirect logic lives in one place.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const dispatch = useAppDispatch();
  const { request } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isSignup = mode === "signup";
  const submitting = isLoading(request);

  // Don't carry an error from one screen to the other.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch, mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const action = isSignup ? signup : login;
    await dispatch(action({ email, password }));
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-fg-muted">
            {isSignup ? "Connect a database in the next step." : "Sign in to your connections."}
          </p>
        </div>

        {request.error && <Alert>{request.error}</Alert>}

        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" hint={isSignup ? "At least 8 characters." : undefined}>
          <Input
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Button type="submit" className="w-full" loading={submitting} disabled={!email || !password}>
          {isSignup ? "Create account" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-fg-muted">
          {isSignup ? "Already have an account? " : "No account? "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-brand hover:underline">
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </form>
    </Card>
  );
}
