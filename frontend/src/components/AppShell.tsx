"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { cn } from "@/components/ui";
import { logout } from "@/features/auth/auth.thunks";
import { useAppDispatch } from "@/store/hooks";

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

/** Chrome for authenticated pages. Auth gating is RequireAuth's job, not this. */
export function AppShell({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/connections">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/connections">Connections</NavLink>
            <NavLink href="/api-keys">API keys</NavLink>
            <NavLink href="/docs">Docs</NavLink>
            <NavLink href="/profile">Profile</NavLink>
          </nav>
          <button
            onClick={() => dispatch(logout())}
            className="rounded-lg px-2.5 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            Sign out
          </button>
        </div>
      </header>
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
