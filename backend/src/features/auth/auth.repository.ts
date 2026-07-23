// All app-DB access for the auth feature lives here - the service never touches
// Prisma directly.

import { prisma } from "../../db/prisma";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(supabaseId: string, email: string, name: string) {
  return prisma.user.create({ data: { supabaseId, email, name } });
}

export function findUserBySupabaseId(supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, createdAt: true, supabaseId: true },
  });
}
