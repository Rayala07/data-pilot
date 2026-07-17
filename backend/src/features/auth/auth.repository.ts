// All app-DB access for the auth feature lives here - the service never touches
// Prisma directly.

import { prisma } from "../../db/prisma";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(email: string, passwordHash: string) {
  return prisma.user.create({ data: { email, passwordHash } });
}

/** Selects explicitly - passwordHash must never leave the repository. */
export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, createdAt: true },
  });
}

// --- demo sandbox tenants ----------------------------------------------------

export function createDemoUser(email: string, passwordHash: string) {
  return prisma.user.create({ data: { email, passwordHash, isDemo: true } });
}

export function countDemoUsers(): Promise<number> {
  return prisma.user.count({ where: { isDemo: true } });
}

/**
 * Deletes demo tenants older than the cutoff. onDelete: Cascade wipes their
 * connections, schema profiles, and query logs with them - sandboxes leave
 * nothing behind.
 */
export async function deleteDemoUsersOlderThan(cutoff: Date): Promise<number> {
  const result = await prisma.user.deleteMany({
    where: { isDemo: true, createdAt: { lt: cutoff } },
  });
  return result.count;
}
