// All app-DB access for the auth feature lives here — the service never touches
// Prisma directly.

import { prisma } from "../../db/prisma";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(email: string, passwordHash: string) {
  return prisma.user.create({ data: { email, passwordHash } });
}
