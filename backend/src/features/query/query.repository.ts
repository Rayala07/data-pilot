// Every query attempt is logged to the app DB (D11) - this table is the sole
// data source for the Day 6 benchmark, so it's written from the very first
// end-to-end query, not retrofitted later.

import { prisma } from "../../db/prisma";

export interface QueryLogInput {
  userId: string;
  connectionId: string;
  question: string;
  retrievedTables: unknown;
  sql: string | null;
  validationResult: unknown;
  executionResult: unknown;
  errorText: string | null;
  attemptNumber: number;
  latencyMs: number;
}

export function writeQueryLog(input: QueryLogInput) {
  return prisma.queryLog.create({
    data: {
      userId: input.userId,
      connectionId: input.connectionId,
      question: input.question,
      retrievedTables: (input.retrievedTables as object) ?? undefined,
      sql: input.sql ?? undefined,
      validationResult: (input.validationResult as object) ?? undefined,
      executionResult: (input.executionResult as object) ?? undefined,
      errorText: input.errorText ?? undefined,
      attemptNumber: input.attemptNumber,
      latencyMs: input.latencyMs,
    },
  });
}

/** Scoped by userId - a global count would leak other tenants' activity. */
export function countQueryLogs(userId: string): Promise<number> {
  return prisma.queryLog.count({ where: { userId } });
}

/**
 * The demo query cap's ledger. Every attempt is already logged for the
 * benchmark (D11), so rate limiting is a count over existing data - no new
 * bookkeeping. Counts attempts, not questions: retries cost LLM calls too.
 */
export function countQueryLogsSince(userId: string, since: Date): Promise<number> {
  return prisma.queryLog.count({ where: { userId, createdAt: { gte: since } } });
}
