/**
 * E2E tests for the authentication flow.
 *
 * These tests verify the full sign-in journey end-to-end:
 *   1. The login page renders correctly
 *   2. Providing correct credentials redirects to /connections
 *   3. The backend correctly verifies the Supabase JWT (no "Missing or invalid token" errors)
 *   4. Protected API calls succeed with the stored token
 *   5. An invalid credential shows an error message (not a crash)
 */

import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { TEST_STATE_PATH } from "./global.setup";

function getTestCredentials(): { email: string; password: string } {
  const raw = fs.readFileSync(TEST_STATE_PATH, "utf-8");
  return JSON.parse(raw);
}

test.describe("Sign-in page", () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh — no stale tokens from previous runs
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForURL("**/login");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Page renders
  // ──────────────────────────────────────────────────────────────────────────
  test("renders the login form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Successful login → redirect + no 401
  // ──────────────────────────────────────────────────────────────────────────
  test("correct credentials redirect to /connections and backend returns no 401", async ({ page }) => {
    const { email, password } = getTestCredentials();

    // Intercept all backend calls and collect any 401s
    const unauthorizedCalls: string[] = [];
    page.on("response", (response) => {
      if (
        response.status() === 401 &&
        response.url().includes("localhost:4000")
      ) {
        unauthorizedCalls.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should land on /connections within 10 seconds
    await page.waitForURL("**/connections", { timeout: 10_000 });
    expect(page.url()).toContain("/connections");

    // Wait briefly for any triggered API calls to settle
    await page.waitForTimeout(1_500);

    // CRITICAL: no backend call should have returned 401 "Missing or invalid token"
    expect(unauthorizedCalls).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Token stored in localStorage after login
  // ──────────────────────────────────────────────────────────────────────────
  test("stores a valid JWT in localStorage after login", async ({ page }) => {
    const { email, password } = getTestCredentials();

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("**/connections", { timeout: 10_000 });

    const token = await page.evaluate(() =>
      localStorage.getItem("datapilot_token")
    );

    expect(token).not.toBeNull();
    // Basic JWT shape: three base64url segments separated by dots
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. /auth/me returns the user profile (token is correctly verified backend-side)
  // ──────────────────────────────────────────────────────────────────────────
  test("/auth/me returns 200 with the logged-in user profile", async ({ page }) => {
    const { email, password } = getTestCredentials();

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("**/connections", { timeout: 10_000 });

    // Retrieve the stored token and call /auth/me directly
    const token = await page.evaluate(() =>
      localStorage.getItem("datapilot_token")
    );
    expect(token).not.toBeNull();

    const response = await page.evaluate(async (jwt) => {
      const res = await fetch("http://localhost:4000/auth/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      return { status: res.status, body: await res.json() };
    }, token!);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("email");
    // Backend should return the same email (case-insensitive in Supabase)
    expect((response.body.email as string).toLowerCase()).toBe(email.toLowerCase());
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Wrong password shows an error — does NOT crash or redirect
  // ──────────────────────────────────────────────────────────────────────────
  test("wrong password shows an error message and stays on /login", async ({ page }) => {
    const { email } = getTestCredentials();

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("WrongPassword999!");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should stay on the login page
    await page.waitForTimeout(3_000);
    expect(page.url()).toContain("/login");

    // An error message must be visible — exact wording comes from Supabase
    const alert = page.locator("[role=alert], .alert, [class*=alert]").first();
    await expect(alert).toBeVisible({ timeout: 5_000 });
  });
});
