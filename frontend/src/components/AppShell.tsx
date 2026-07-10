"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { cn } from "@/components/ui";
import { logout } from "@/features/auth/auth.thunks";
import { getTokenClaims } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-8 text-base" : "size-7 text-sm";
  const text = size === "lg" ? "text-lg" : "text-sm";
  return (
    <span className="flex items-center gap-2">
      <span className={cn("grid place-items-center rounded-md bg-brand font-bold text-brand-fg", box)}>D</span>
      <span className={cn("font-semibold tracking-tight text-fg", text)}>DataPilot</span>
    </span>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Shown only for demo-sandbox sessions (the JWT carries a `demo` claim — an
 * unverified read, fine for UI). The signup CTA must clear the demo token
 * first, or RequireGuest would bounce the visitor straight back into the app.
 */
function DemoBanner() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  return (
    <div className="border-b border-line bg-warning-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-2">
        <p className="text-xs text-warning">
          <span className="font-semibold">Demo sandbox</span> — a sample e-commerce database, isolated to you. Data
          resets after 24 hours.
        </p>
        <button
          onClick={async () => {
            await dispatch(logout());
            router.push("/signup");
          }}
          className="text-xs font-medium text-warning underline underline-offset-2"
        >
          Sign up to connect your own database
        </button>
      </div>
    </div>
  );
}

/** Chrome for authenticated pages. Auth gating is RequireAuth's job, not this. */
export function AppShell({ children }: { children: ReactNode }) {
  const token = useAppSelector((s) => s.auth.token);
  // Re-derive when the token changes (demo -> real signup, logout, ...).
  const isDemo = useMemo(() => getTokenClaims()?.demo === true, [token]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/connections">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/connections">Connections</NavLink>
            <NavLink href="/profile">Profile</NavLink>
          </nav>
        </div>
      </header>
      {isDemo && <DemoBanner />}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

/** Chrome for the signed-out pages: centred card, no nav. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Wordmark size="lg" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs text-fg-subtle">
        Ask your PostgreSQL database questions in plain English. Read-only, always.
      </p>
    </div>
  );
}
