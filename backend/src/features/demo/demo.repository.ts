// What a demo visitor actually did, recorded so it OUTLIVES them.
//
// Demo tenants are swept after 24h and cascade through Connection/QueryLog, so
// by the time you go looking, the real tables are empty. DemoEvent has no
// relation to User precisely so the sweep cannot reach it.
//
// Every write here is fire-and-forget (see recordDemoEvent): telemetry must
// never fail, slow, or break the request it is observing.

import { prisma } from "../../db/prisma";

export type DemoEventName = "session_started" | "connection_added" | "question_asked";

/** Truncated so a pathological question can't bloat the row. */
const MAX_DETAIL = 500;
const MAX_REF = 64;

export interface DemoEventInput {
  sessionId: string;
  ref?: string | null;
  event: DemoEventName;
  detail?: string | null;
}

/**
 * Records one event. Deliberately NOT awaited by callers - a telemetry outage
 * must not turn into a failed demo. Errors are swallowed, not surfaced.
 */
export function recordDemoEvent({ sessionId, ref, event, detail }: DemoEventInput): void {
  void prisma.demoEvent
    .create({
      data: {
        sessionId,
        ref: ref ? ref.slice(0, MAX_REF) : null,
        event,
        detail: detail ? detail.slice(0, MAX_DETAIL) : null,
      },
    })
    .catch(() => {
      // Swallowed on purpose: nothing about the visitor's experience should
      // depend on whether we managed to write a tracking row.
    });
}

export interface DemoSessionReport {
  sessionId: string;
  ref: string | null;
  startedAt: Date;
  connectionsAdded: number;
  questions: { detail: string | null; createdAt: Date }[];
}

/** Everything recorded, newest session first. Read-only; used by the report script. */
export async function listDemoActivity(): Promise<DemoSessionReport[]> {
  const events = await prisma.demoEvent.findMany({ orderBy: { createdAt: "asc" } });

  const sessions = new Map<string, DemoSessionReport>();
  for (const e of events) {
    let s = sessions.get(e.sessionId);
    if (!s) {
      s = { sessionId: e.sessionId, ref: e.ref, startedAt: e.createdAt, connectionsAdded: 0, questions: [] };
      sessions.set(e.sessionId, s);
    }
    // A session's ref is set at start; keep the first non-null we see.
    if (!s.ref && e.ref) s.ref = e.ref;
    if (e.event === "connection_added") s.connectionsAdded += 1;
    if (e.event === "question_asked") s.questions.push({ detail: e.detail, createdAt: e.createdAt });
  }

  return [...sessions.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}
