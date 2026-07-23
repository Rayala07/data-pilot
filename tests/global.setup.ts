/**
 * Global Playwright setup.
 *
 * Creates a dedicated E2E test user in Supabase (with a confirmed email so the
 * backend's isConfirmedSession check passes) and writes the credentials to a
 * shared state file that the specs can import.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import dotenv from "dotenv";
import path from "node:path";

// Load from backend/.env where the secrets actually live during dev
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const TEST_STATE_PATH = path.join(__dirname, ".test-state.json");
export const TEST_EMAIL = `e2e-datapilot-${Date.now()}@test.local`;
export const TEST_PASSWORD = "TestPassword123!";

export default async function globalSetup() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create a new user with a pre-confirmed email using the Admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true, // skips OTP — marks email_confirmed_at immediately
  });

  if (error) {
    throw new Error(`E2E setup: failed to create test user: ${error.message}`);
  }

  // Persist the user id so teardown can delete it
  fs.writeFileSync(
    TEST_STATE_PATH,
    JSON.stringify({ userId: data.user.id, email: TEST_EMAIL, password: TEST_PASSWORD })
  );

  console.log(`[E2E setup] Created test user: ${TEST_EMAIL} (${data.user.id})`);
}
