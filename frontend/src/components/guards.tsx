"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui";
import { useAppSelector } from "@/store/hooks";

/**
 * Route protection lives here and nowhere else.
 *
 * Both guards wait on `auth.hydrated` before deciding anything. The token is
 * read from localStorage in an effect (it doesn't exist during SSR), so acting
 * on `token === null` before hydration would bounce a signed-in user to /login
 * on every hard refresh.
 *
 * Neither guard renders its children while a redirect is pending - otherwise a
 * protected page would flash its contents, and would fire its data-fetching
 * effects, before navigating away.
 */

function Pending() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Signed-in only. Anonymous visitors go to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, hydrated } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  // Don't render children until we know the auth state AND the user is signed in.
  // Rendering children before hydration would fire data-fetching effects with no token.
  // Rendering children when there's no token (but pre-redirect) would flash the page.
  if (!hydrated) return <Pending />;
  if (!token) return <Pending />; // redirect is queued, suppress content flash
  return <>{children}</>;
}

/** Signed-out only. Authenticated users are pushed to the app. */
export function RequireGuest({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, hydrated } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (hydrated && token) router.replace("/connections");
  }, [hydrated, token, router]);

  if (!hydrated) return <Pending />;
  if (token) return <Pending />; // redirect is queued, suppress login flash
  return <>{children}</>;
}
