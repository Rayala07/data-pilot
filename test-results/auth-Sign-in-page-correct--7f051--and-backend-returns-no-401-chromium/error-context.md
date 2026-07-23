# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Sign-in page >> correct credentials redirect to /connections and backend returns no 401
- Location: tests\auth.spec.ts:43:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel(/email/i)

```

# Page snapshot

```yaml
- alert [ref=e1]
```

# Test source

```ts
  1   | /**
  2   |  * E2E tests for the authentication flow.
  3   |  *
  4   |  * These tests verify the full sign-in journey end-to-end:
  5   |  *   1. The login page renders correctly
  6   |  *   2. Providing correct credentials redirects to /connections
  7   |  *   3. The backend correctly verifies the Supabase JWT (no "Missing or invalid token" errors)
  8   |  *   4. Protected API calls succeed with the stored token
  9   |  *   5. An invalid credential shows an error message (not a crash)
  10  |  */
  11  | 
  12  | import { expect, test } from "@playwright/test";
  13  | import fs from "node:fs";
  14  | import { TEST_STATE_PATH } from "./global.setup";
  15  | 
  16  | function getTestCredentials(): { email: string; password: string } {
  17  |   const raw = fs.readFileSync(TEST_STATE_PATH, "utf-8");
  18  |   return JSON.parse(raw);
  19  | }
  20  | 
  21  | test.describe("Sign-in page", () => {
  22  |   test.beforeEach(async ({ page }) => {
  23  |     // Start fresh — no stale tokens from previous runs
  24  |     await page.goto("/login");
  25  |     await page.evaluate(() => localStorage.clear());
  26  |     await page.reload();
  27  |     await page.waitForURL("**/login");
  28  |   });
  29  | 
  30  |   // ──────────────────────────────────────────────────────────────────────────
  31  |   // 1. Page renders
  32  |   // ──────────────────────────────────────────────────────────────────────────
  33  |   test("renders the login form", async ({ page }) => {
  34  |     await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  35  |     await expect(page.getByLabel(/email/i)).toBeVisible();
  36  |     await expect(page.getByLabel(/password/i)).toBeVisible();
  37  |     await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  38  |   });
  39  | 
  40  |   // ──────────────────────────────────────────────────────────────────────────
  41  |   // 2. Successful login → redirect + no 401
  42  |   // ──────────────────────────────────────────────────────────────────────────
  43  |   test("correct credentials redirect to /connections and backend returns no 401", async ({ page }) => {
  44  |     const { email, password } = getTestCredentials();
  45  | 
  46  |     // Intercept all backend calls and collect any 401s
  47  |     const unauthorizedCalls: string[] = [];
  48  |     page.on("response", (response) => {
  49  |       if (
  50  |         response.status() === 401 &&
  51  |         response.url().includes("localhost:4000")
  52  |       ) {
  53  |         unauthorizedCalls.push(`${response.status()} ${response.url()}`);
  54  |       }
  55  |     });
  56  | 
> 57  |     await page.getByLabel(/email/i).fill(email);
      |                                     ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  58  |     await page.getByLabel(/password/i).fill(password);
  59  |     await page.getByRole("button", { name: /sign in/i }).click();
  60  | 
  61  |     // Should land on /connections within 10 seconds
  62  |     await page.waitForURL("**/connections", { timeout: 10_000 });
  63  |     expect(page.url()).toContain("/connections");
  64  | 
  65  |     // Wait briefly for any triggered API calls to settle
  66  |     await page.waitForTimeout(1_500);
  67  | 
  68  |     // CRITICAL: no backend call should have returned 401 "Missing or invalid token"
  69  |     expect(unauthorizedCalls).toHaveLength(0);
  70  |   });
  71  | 
  72  |   // ──────────────────────────────────────────────────────────────────────────
  73  |   // 3. Token stored in localStorage after login
  74  |   // ──────────────────────────────────────────────────────────────────────────
  75  |   test("stores a valid JWT in localStorage after login", async ({ page }) => {
  76  |     const { email, password } = getTestCredentials();
  77  | 
  78  |     await page.getByLabel(/email/i).fill(email);
  79  |     await page.getByLabel(/password/i).fill(password);
  80  |     await page.getByRole("button", { name: /sign in/i }).click();
  81  | 
  82  |     await page.waitForURL("**/connections", { timeout: 10_000 });
  83  | 
  84  |     const token = await page.evaluate(() =>
  85  |       localStorage.getItem("datapilot_token")
  86  |     );
  87  | 
  88  |     expect(token).not.toBeNull();
  89  |     // Basic JWT shape: three base64url segments separated by dots
  90  |     expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  91  |   });
  92  | 
  93  |   // ──────────────────────────────────────────────────────────────────────────
  94  |   // 4. /auth/me returns the user profile (token is correctly verified backend-side)
  95  |   // ──────────────────────────────────────────────────────────────────────────
  96  |   test("/auth/me returns 200 with the logged-in user profile", async ({ page }) => {
  97  |     const { email, password } = getTestCredentials();
  98  | 
  99  |     await page.getByLabel(/email/i).fill(email);
  100 |     await page.getByLabel(/password/i).fill(password);
  101 |     await page.getByRole("button", { name: /sign in/i }).click();
  102 | 
  103 |     await page.waitForURL("**/connections", { timeout: 10_000 });
  104 | 
  105 |     // Retrieve the stored token and call /auth/me directly
  106 |     const token = await page.evaluate(() =>
  107 |       localStorage.getItem("datapilot_token")
  108 |     );
  109 |     expect(token).not.toBeNull();
  110 | 
  111 |     const response = await page.evaluate(async (jwt) => {
  112 |       const res = await fetch("http://localhost:4000/auth/me", {
  113 |         headers: { Authorization: `Bearer ${jwt}` },
  114 |       });
  115 |       return { status: res.status, body: await res.json() };
  116 |     }, token!);
  117 | 
  118 |     expect(response.status).toBe(200);
  119 |     expect(response.body).toHaveProperty("email");
  120 |     // Backend should return the same email (case-insensitive in Supabase)
  121 |     expect((response.body.email as string).toLowerCase()).toBe(email.toLowerCase());
  122 |   });
  123 | 
  124 |   // ──────────────────────────────────────────────────────────────────────────
  125 |   // 5. Wrong password shows an error — does NOT crash or redirect
  126 |   // ──────────────────────────────────────────────────────────────────────────
  127 |   test("wrong password shows an error message and stays on /login", async ({ page }) => {
  128 |     const { email } = getTestCredentials();
  129 | 
  130 |     await page.getByLabel(/email/i).fill(email);
  131 |     await page.getByLabel(/password/i).fill("WrongPassword999!");
  132 |     await page.getByRole("button", { name: /sign in/i }).click();
  133 | 
  134 |     // Should stay on the login page
  135 |     await page.waitForTimeout(3_000);
  136 |     expect(page.url()).toContain("/login");
  137 | 
  138 |     // An error message must be visible — exact wording comes from Supabase
  139 |     const alert = page.locator("[role=alert], .alert, [class*=alert]").first();
  140 |     await expect(alert).toBeVisible({ timeout: 5_000 });
  141 |   });
  142 | });
  143 | 
```