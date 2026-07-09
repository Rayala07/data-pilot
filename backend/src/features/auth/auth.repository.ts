// All app-DB access for the auth feature lives here — the service never touches
// Prisma directly.

import { prisma } from "../../db/prisma";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(email: string, passwordHash: string) {
  return prisma.user.create({ data: { email, passwordHash } });
}

/** Selects explicitly — passwordHash must never leave the repository. */
export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, createdAt: true },
  });
}
