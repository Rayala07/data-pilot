"use client";

import { useEffect, useState } from "react";
import { CodeBlock, CopyButton, Disclosure } from "@/components/ui";

const ROLE = "datapilot_readonly";

/**
 * There is no universal no-code way to create a least-privilege Postgres role -
 * it is a privileged operation by definition. The lowest-friction path that
 * works everywhere is: copy this, paste it into your provider's browser SQL
 * editor, press Run. No terminal, no psql, nothing to install.
 *
 * We generate the password here so the SQL and the connection string come out
 * already matching; the user only fills in host and database. It's generated in
 * the browser and never sent anywhere except inside the connection string they
 * choose to submit (which is encrypted at rest).
 */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Deliberately no `GRANT CONNECT`: PUBLIC already holds it by default on every
// managed Postgres, and the only correct way to name the current database in a
// GRANT is a DO block with format(%I) - noise for a beginner-facing snippet.
// The rare hardened case is covered by the footnote below instead.
function sqlFor(password: string): string {
  return [
    `-- Creates a role that can read your data and nothing else.`,
    `CREATE ROLE ${ROLE} WITH LOGIN PASSWORD '${password}';`,
    ``,
    `GRANT USAGE ON SCHEMA public TO ${ROLE};`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE};`,
    ``,
    `-- so tables you create later are readable too`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public`,
    `  GRANT SELECT ON TABLES TO ${ROLE};`,
  ].join("\n");
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-fg">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs tabular-nums text-fg-muted">
          {n}
        </span>
        {title}
      </p>
      <div className="space-y-2 pl-7">{children}</div>
    </div>
  );
}

export function ReadOnlyGuide() {
  // Generated after mount: crypto.getRandomValues doesn't exist during SSR, and
  // a value that differed between server and client would be a hydration error.
  const [password, setPassword] = useState<string | null>(null);
  useEffect(() => setPassword(generatePassword()), []);

  const pw = password ?? "•".repeat(24);
  const sql = sqlFor(pw);
  const connectionString = `postgresql://${ROLE}:${pw}@HOST:5432/DATABASE`;

  return (
    <Disclosure summary="How do I get a read-only connection string?">
      <div className="space-y-5">
        <p className="text-sm text-fg-muted">
          No terminal needed. Most managed Postgres hosts give you a SQL editor (or query console) in the browser -
          paste, press Run, done. Any Postgres also works over <span className="text-fg">psql</span>.
        </p>

        <Step n={1} title="Run this once, as an admin, on the database you want to connect">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CodeBlock>{sql}</CodeBlock>
            </div>
            <CopyButton value={sql} label="Copy SQL" />
          </div>
          <p className="text-xs text-fg-subtle">
            The password is generated in your browser - it is not sent anywhere until you submit the connection string
            above, which we encrypt at rest.
          </p>
        </Step>

        <Step n={2} title="Point it at your database, then paste it into the field above">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CodeBlock>{connectionString}</CodeBlock>
            </div>
            <CopyButton value={connectionString} label="Copy" />
          </div>
          <p className="text-xs text-fg-subtle">
            Fill in <span className="text-fg">HOST</span> and <span className="text-fg">DATABASE</span>, or take the
            string your provider already gives you and just swap in the username and password above - keeping its host,
            database, and any <code className="font-mono text-fg">?sslmode=...</code> parameters.
          </p>
          <p className="text-xs text-fg-subtle">
            Use a <span className="text-fg">direct</span> (session-mode) connection, not a{" "}
            <span className="text-fg">transaction pooler</span>: DataPilot applies a read-only setting to your session
            and runs several queries on it, and a pooler can route them to different connections and drop it. A string
            is pooled if its host or parameters contain <code className="font-mono text-fg">pooler</code>,{" "}
            <code className="font-mono text-fg">pgbouncer</code>, or <code className="font-mono text-fg">pool</code>, or
            it uses a pooling-only port such as <code className="font-mono text-fg">6543</code>. If your provider lists
            two strings, pick the one labelled <span className="text-fg">Direct</span> or{" "}
            <span className="text-fg">Session</span>.
          </p>
        </Step>

        <div className="space-y-1.5 rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-xs text-fg-muted">
            <span className="font-medium text-fg">Not the person who manages the database?</span> Send them step 1 -
            they only need to run it once and give you back the string from step 2.
          </p>
          <p className="text-xs text-fg-muted">
            <span className="font-medium text-fg">Prefer zero SQL?</span> Some providers offer a read-only replica
            endpoint - point DataPilot at that and skip step 1 entirely. Writes are rejected by the endpoint itself.
          </p>
          <p className="text-xs text-fg-muted">
            <span className="font-medium text-fg">Step 1 says it can&apos;t connect?</span> Your admin has revoked the
            default CONNECT grant. Also run{" "}
            <code className="font-mono text-fg">GRANT CONNECT ON DATABASE your_db TO {ROLE};</code>
          </p>
        </div>

        <p className="text-xs text-fg-subtle">
          DataPilot checks this for you: after connecting, it verifies the credential really cannot write, and warns you
          if it can.
        </p>
      </div>
    </Disclosure>
  );
}
