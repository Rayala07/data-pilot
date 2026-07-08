// Every query attempt is logged to the app DB (D11) — this table is the sole
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
