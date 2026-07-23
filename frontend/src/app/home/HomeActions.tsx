"use client";

import Link from "next/link";
import { useAppSelector } from "@/store/hooks";

/**
 * Auth-aware nav actions for the landing page.
 *
 * - Signed out  → "Sign in" + "Get started"
 * - Signed in   → "Go to app"
 *
 * This is a thin client island so the rest of the landing page stays a
 * pure server component (no bundle cost for the static marketing copy).
 */
export function HomeNavActions() {
  const { token } = useAppSelector((s) => s.auth);

  if (token) {
    return (
      <div className="dp-nav__actions">
        <Link href="/connections" className="dp-btn dp-btn--primary">
          Go to app
        </Link>
      </div>
    );
  }

  return (
    <div className="dp-nav__actions">
      <Link href="/login" className="dp-btn dp-btn--ghost">Sign in</Link>
      <Link href="/signup" className="dp-btn dp-btn--primary">Get started</Link>
    </div>
  );
}

/**
 * Auth-aware hero CTA for the landing page.
 * Mirrors the nav logic so both buttons stay consistent.
 */
export function HomeHeroCta() {
  const { token } = useAppSelector((s) => s.auth);

  if (token) {
    return (
      <div className="dp-hero__cta">
        <Link href="/connections" className="dp-btn dp-btn--primary dp-btn--lg">
          Go to app →
        </Link>
      </div>
    );
  }

  return (
    <div className="dp-hero__cta">
      <Link href="/signup" className="dp-btn dp-btn--primary dp-btn--lg">
        Connect your database →
      </Link>
      <Link href="/login" className="dp-btn dp-btn--ghost dp-btn--lg">
        Sign in
      </Link>
    </div>
  );
}

/**
 * Auth-aware final CTA section buttons.
 */
export function HomeCtaActions() {
  const { token } = useAppSelector((s) => s.auth);

  if (token) {
    return (
      <div className="dp-cta__actions">
        <Link href="/connections" className="dp-btn dp-btn--primary dp-btn--lg dp-btn--light">
          Go to app →
        </Link>
      </div>
    );
  }

  return (
    <div className="dp-cta__actions">
      <Link href="/signup" className="dp-btn dp-btn--primary dp-btn--lg dp-btn--light">
        Get started - it&apos;s free →
      </Link>
      <Link href="/login" className="dp-btn dp-btn--ghost-light dp-btn--lg">
        Sign in
      </Link>
    </div>
  );
}
