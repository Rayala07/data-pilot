// Who used /demo, and what did they do?
//
//   npm run demo:report
//
// Reads DemoEvent, which deliberately outlives the 24h sweep that deletes demo
// users (and cascades their Connection/QueryLog away). Read-only.

import { listDemoActivity } from "../src/features/demo/demo.repository";
import { prisma } from "../src/db/prisma";

function ago(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

async function main(): Promise<void> {
  const sessions = await listDemoActivity();

  if (sessions.length === 0) {
    console.log("No demo activity recorded yet.");
    return;
  }

  const tagged = sessions.filter((s) => s.ref);
  console.log(`${sessions.length} demo session(s) recorded - ${tagged.length} from a tagged link.\n`);

  for (const s of sessions) {
    const who = s.ref ? `ref=${s.ref}` : "untagged";
    const engaged = s.connectionsAdded > 0 ? "CONNECTED THEIR OWN DB" : "sample only";

    console.log(`${s.startedAt.toISOString()}  (${ago(s.startedAt)})`);
    console.log(`  ${who}  session=${s.sessionId.slice(0, 8)}  ${engaged}`);
    console.log(`  own databases connected: ${s.connectionsAdded}`);
    console.log(`  questions asked: ${s.questions.length}`);
    for (const q of s.questions) {
      console.log(`    - "${q.detail}"`);
    }
    console.log("");
  }

  // The headline: did anyone go past looking?
  const converted = sessions.filter((s) => s.connectionsAdded > 0);
  console.log("---");
  console.log(`sessions that connected their own database: ${converted.length}/${sessions.length}`);
  for (const c of converted) {
    console.log(`  ${c.ref ?? "untagged"} - ${c.questions.length} question(s), ${ago(c.startedAt)}`);
  }
}

main()
  .catch((e: unknown) => {
    console.error("demo-report failed:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
