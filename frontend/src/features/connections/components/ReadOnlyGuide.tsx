"use client";

import { useEffect, useState } from "react";
import { CodeBlock, CopyButton, Disclosure } from "@/components/ui";

const ROLE = "datapilot_readonly";

/**
 * There is no universal no-code way to create a least-privilege Postgres role -
 * it is a privileged operation by definition. The lowest-friction path that
 * works everywhere is: copy this, paste it into your database's browser SQL
 * editor, press Run.
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
// The rare hardened case is covered by the troubleshooting note below instead.
function sqlFor(password: string): string {
  return [
    `-- Creates a login that can read your data and nothing else.`,
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
          DataPilot only ever reads your data, so connect it with a login that can read but not change anything.
          Two copy-pastes and you&apos;re done.
        </p>

        <Step n={1} title="Make a read-only login">
          <p className="text-xs text-fg-subtle">
            Paste this into your database&apos;s SQL editor and run it (it also works in{" "}
            <span className="text-fg">psql</span>). You&apos;ll need admin access to the database.
          </p>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CodeBlock>{sql}</CodeBlock>
            </div>
            <CopyButton value={sql} label="Copy SQL" />
          </div>
          <p className="text-xs text-fg-subtle">
            The password is made in your browser and isn&apos;t sent anywhere until you connect.
          </p>
        </Step>

        <Step n={2} title="Put it in a connection string">
          <p className="text-xs text-fg-subtle">
            Replace <span className="text-fg">HOST</span> and <span className="text-fg">DATABASE</span> with yours.
            Already have a connection string from your provider? Keep it exactly as is and just change the username and
            password to the ones below.
          </p>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CodeBlock>{connectionString}</CodeBlock>
            </div>
            <CopyButton value={connectionString} label="Copy" />
          </div>
          <p className="text-xs text-fg-subtle">Then paste the finished string into the field above.</p>
        </Step>

        <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-xs font-medium text-fg">If something goes wrong</p>
          <p className="text-xs text-fg-muted">
            <span className="text-fg">It won&apos;t connect or times out.</span> Use your provider&apos;s{" "}
            <span className="text-fg">Direct</span> or <span className="text-fg">Session</span> connection string, not a{" "}
            <span className="text-fg">Pooled</span> or <span className="text-fg">Transaction</span> one. (Pooled strings
            usually have <code className="font-mono text-fg">pooler</code> or{" "}
            <code className="font-mono text-fg">pgbouncer</code> in the address, or use port{" "}
            <code className="font-mono text-fg">6543</code>.)
          </p>
          <p className="text-xs text-fg-muted">
            <span className="text-fg">&quot;permission denied for database&quot;.</span> Run this once too:{" "}
            <code className="font-mono text-fg">GRANT CONNECT ON DATABASE your_db TO {ROLE};</code>
          </p>
          <p className="text-xs text-fg-muted">
            <span className="text-fg">You don&apos;t manage this database.</span> Send step 1 to whoever does, and have
            them give you back the string from step 2.
          </p>
        </div>

        <p className="text-xs text-fg-subtle">
          After you connect, DataPilot double-checks that the login really can&apos;t write.
        </p>
      </div>
    </Disclosure>
  );
}
