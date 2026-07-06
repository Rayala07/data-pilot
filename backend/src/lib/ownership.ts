// Single choke point for connection ownership checks. Every route that reads
// or mutates a Connection MUST go through this — fetching by id alone is a
// tenancy bug (see CLAUDE.md hard rule 6). A miss returns null so callers can
// respond 404, never 403 (403 would leak that the id exists for someone else).

import { prisma } from "../db/prisma";
import type { Connection } from "@prisma/client";

export async function getOwnedConnection(userId: string, connectionId: string): Promise<Connection | null> {
  return prisma.connection.findFirst({
    where: { id: connectionId, userId },
  });
}
