/**
 * Global Playwright teardown.
 *
 * Deletes the E2E test user created in globalSetup so the Supabase project
 * stays clean across test runs.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { TEST_STATE_PATH } from "./global.setup";

// Load from backend/.env where the secrets actually live during dev
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function globalTeardown() {
  if (!fs.existsSync(TEST_STATE_PATH)) return;

  const state = JSON.parse(fs.readFileSync(TEST_STATE_PATH, "utf-8")) as {
    userId: string;
    email: string;
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.auth.admin.deleteUser(state.userId);
  if (error) {
    console.warn(`[E2E teardown] Could not delete test user ${state.email}: ${error.message}`);
  } else {
    console.log(`[E2E teardown] Deleted test user: ${state.email}`);
  }

  fs.unlinkSync(TEST_STATE_PATH);
}
