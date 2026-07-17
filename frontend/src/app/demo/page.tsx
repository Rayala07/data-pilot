"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { Alert, Button, Spinner } from "@/components/ui";
import { demoLogin } from "@/features/auth/auth.thunks";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

/**
 * The portfolio's "try it live" target. Lives outside the (public)/(app) route
 * groups so neither guard interferes mid-flow: a visitor arrives signed out,
 * and leaves signed in - both guards would want to redirect at some point in
 * between.
 *
 * Flow: create an ephemeral sandbox tenant, then land directly on the cloned
 * connection's overview - headline, entity chips, and four suggested questions.
 * The visitor's first click is already an answered query.
 */
function DemoFlow() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { token, hydrated, request } = useAppSelector((s) => s.auth);
  const started = useRef(false);
  // /demo?ref=acme - tags this session so its activity is attributable to the
  // link that was sent. Telemetry only; the server sanitizes it.
  const ref = useSearchParams().get("ref") ?? undefined;

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;

    // Already signed in (maybe an earlier demo) - nothing to create.
    if (token) {
      router.replace("/connections");
      return;
    }

    dispatch(demoLogin(ref)).then((action) => {
      if (demoLogin.fulfilled.match(action)) {
        router.replace(`/connections/${action.payload.connectionId}`);
      }
    });
  }, [hydrated, token, dispatch, router, ref]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-brand text-base font-bold text-brand-fg">D</span>
        <span className="text-lg font-semibold tracking-tight text-fg">DataPilot</span>
      </div>

      {request.error ? (
        <div className="w-full max-w-sm space-y-4">
          <Alert title="Couldn't start the demo">{request.error}</Alert>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                started.current = false;
                dispatch(demoLogin(ref)).then((action) => {
                  if (demoLogin.fulfilled.match(action)) {
                    router.replace(`/connections/${action.payload.connectionId}`);
                  }
                });
              }}
            >
              Try again
            </Button>
            <Link href="/login" className="flex-1">
              <Button variant="secondary" className="w-full">Sign in instead</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner className="size-5 text-brand" />
          <p className="text-sm font-medium text-fg">Setting up your demo sandbox…</p>
          <p className="max-w-xs text-xs text-fg-subtle">
            {isLoading(request)
              ? "Creating an isolated workspace with a sample e-commerce database already connected."
              : "One moment…"}
          </p>
          <p className="max-w-xs text-xs text-fg-subtle">
            If the server was asleep this can take up to a minute the first time.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Reading ?ref= opts the flow into client-side rendering, which Next requires
 * to sit behind a Suspense boundary or the page can't be prerendered at all.
 */
export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <Spinner className="size-5 text-brand" />
          <p className="text-sm font-medium text-fg">Setting up your demo sandbox…</p>
        </div>
      }
    >
      <DemoFlow />
    </Suspense>
  );
}
