// Fail fast on a misconfigured environment.
//
// Every secret is read lazily at the point of use (getLLMProvider, signToken,
// encrypt), which means a service with no secrets at all still boots, answers
// /health with 200, and gets marked live by the platform - then 500s the first
// time someone signs up or connects a database. Checking at startup turns a
// silent bad deploy into a loud one.
//
// Only names are ever printed. Never a value.

const HEX_64 = /^[0-9a-f]{64}$/i;
const POSTGRES_URL = /^postgres(ql)?:\/\//;

type Env = Record<string, string | undefined>;

const present = (v: string | undefined): v is string => typeof v === "string" && v.trim().length > 0;

/** Returns a human-readable problem per misconfiguration. Empty array = fine. */
export function validateEnv(env: Env = process.env): string[] {
  const problems: string[] = [];
  const isProduction = env.NODE_ENV === "production";

  const required = (key: string, hint?: string) => {
    if (!present(env[key])) problems.push(`${key} is required${hint ? ` - ${hint}` : ""}`);
  };

  // --- app database ---
  required("DATABASE_URL", "Postgres connection string for DataPilot's own database");
  if (present(env.DATABASE_URL) && !POSTGRES_URL.test(env.DATABASE_URL)) {
    problems.push("DATABASE_URL must be a postgres:// or postgresql:// URL");
  }
  // DIRECT_URL is deliberately not required: Prisma Client never uses it at
  // runtime, only `prisma migrate deploy` does (verified).

  // --- secrets ---
  required("JWT_SECRET");
  if (present(env.JWT_SECRET) && env.JWT_SECRET.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters");
  }

  required("ENCRYPTION_KEY");
  if (present(env.ENCRYPTION_KEY) && !HEX_64.test(env.ENCRYPTION_KEY)) {
    problems.push("ENCRYPTION_KEY must be 64 hex characters (32 bytes) - generate with: openssl rand -hex 32");
  }

  // --- providers ---
  required("LLM_BASE_URL");
  required("LLM_MODEL");
  required("EMBEDDING_BASE_URL");
  required("EMBEDDING_MODEL");

  if (!present(env.LLM_API_KEY) && !present(env.OPENROUTER_API_KEY)) {
    problems.push("LLM_API_KEY is required (or OPENROUTER_API_KEY, which it falls back to)");
  }
  if (!present(env.EMBEDDING_API_KEY) && !present(env.OPENROUTER_API_KEY)) {
    problems.push("EMBEDDING_API_KEY is required (or OPENROUTER_API_KEY, which it falls back to)");
  }

  if (present(env.LLM_MAX_TOKENS)) {
    const n = Number(env.LLM_MAX_TOKENS);
    if (!Number.isInteger(n) || n <= 0) problems.push("LLM_MAX_TOKENS must be a positive integer");
  }

  // --- production-only ---
  if (isProduction) {
    required("FRONTEND_URL", "the browser origin CORS allows; without it only http://localhost:3000 is permitted");

    // This hook deliberately corrupts a column name in the SQL prompt to demo
    // the self-correction loop. In production it would poison real queries.
    if (present(env.DEV_POISON_COLUMN)) {
      problems.push("DEV_POISON_COLUMN must not be set in production - it corrupts a column name in the SQL prompt");
    }
  }

  return problems;
}

/** Non-fatal advice: things that are legal but probably not what you meant. */
export function envWarnings(env: Env = process.env): string[] {
  const warnings: string[] = [];
  if (env.NODE_ENV !== "production") {
    warnings.push("NODE_ENV is not 'production' - CORS accepts any localhost origin. Set it before deploying.");
  }
  return warnings;
}

/** Called once from index.ts, before the server binds a port. */
export function assertEnv(): void {
  for (const warning of envWarnings()) console.warn(`warning: ${warning}`);

  const problems = validateEnv();
  if (problems.length === 0) return;

  console.error(
    ["Refusing to start - the environment is not configured:", ...problems.map((p) => `  • ${p}`), ""].join("\n")
  );
  process.exit(1);
}
