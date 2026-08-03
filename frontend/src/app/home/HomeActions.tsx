"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useAppSelector } from "@/store/hooks";

/**
 * Auth-aware CTAs for the landing page.
 *
 * - Signed out  → "Sign in" + "Get started"
 * - Signed in   → "Go to app"
 *
 * Thin client islands so the rest of the landing page stays a pure server
 * component (no bundle cost for the static marketing copy).
 *
 * Voice: exactly one filled control per row. The secondary is a typographic
 * link (.dp-btn--quiet), not a second button — two filled buttons side by side
 * make the reader choose before they've read anything.
 */

/**
 * Sign in is a nav link rather than a quiet button so both text destinations in
 * the bar share one hover language — the underline that wipes in from the left.
 * A `text-decoration` underline can't animate directionally, so mixing the two
 * meant two different hovers sitting inches apart.
 */
export function HomeNavActions() {
  const { token } = useAppSelector((s) => s.auth);

  return (
    <div className="dp-nav__actions">
      {token ? (
        <Link href="/connections" className="dp-btn dp-btn--primary">
          Go to app
        </Link>
      ) : (
        <>
          <Link href="/login" className="dp-nav__link">
            Sign in
          </Link>
          <Link href="/signup" className="dp-btn dp-btn--primary">
            Get started
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * The hero CTA carries index 3 in the hero's one orchestrated entrance — it sits
 * between the lede (2) and the trust row (4), so the stagger has to run through
 * this island rather than around it.
 */
export function HomeHeroCta() {
  const { token } = useAppSelector((s) => s.auth);

  return (
    <div className="dp-actions dp-enter" style={{ "--i": 3 } as CSSProperties}>
      {token ? (
        <Link href="/connections" className="dp-btn dp-btn--primary dp-btn--lg">
          Go to app
        </Link>
      ) : (
        <>
          <Link href="/signup" className="dp-btn dp-btn--primary dp-btn--lg">
            Connect your database
          </Link>
          <Link href="/login" className="dp-btn dp-btn--quiet dp-btn--lg">
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * The closing CTA pairs a filled primary with an *outlined* secondary rather
 * than the typographic link used elsewhere — this is the one row on the page
 * where both options deserve a button, and it matches the reference's
 * filled + outlined pairing.
 */
export function HomeCtaActions() {
  const { token } = useAppSelector((s) => s.auth);

  return (
    <div className="dp-cta__actions">
      {token ? (
        <Link href="/connections" className="dp-btn dp-btn--primary dp-btn--lg">
          Go to app
        </Link>
      ) : (
        <>
          <Link href="/signup" className="dp-btn dp-btn--primary dp-btn--lg">
            Get started free
          </Link>
          <Link href="/login" className="dp-btn dp-btn--ghost dp-btn--lg">
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}
