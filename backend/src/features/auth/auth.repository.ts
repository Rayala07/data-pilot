// All app-DB access for the auth feature lives here - the service never touches
// Prisma directly.

import { prisma } from "../../db/prisma";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserBySupabaseId(supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

/**
 * Resolve the local row for an authenticated Supabase user, provisioning one on
 * first sight.
 *
 * Matching on `supabaseId` alone is not enough to conclude the user is new:
 *   • rows created before the Supabase-auth migration carry `supabaseId: null`;
 *   • deleting and re-creating a Supabase user mints a fresh id for an address
 *     that is otherwise unchanged.
 * In both cases the address already owns a row, so an unconditional `create`
 * violates the unique index on `email` (P2002).
 *
 * Supabase has already confirmed the address by the time we get here, and it
 * keeps emails unique across auth users, so the row for that email is by
 * definition this user's — claiming it is the correct link, and it preserves
 * their existing connections and API keys. `update` deliberately touches only
 * `supabaseId`: an adopted row's `name` is whatever the user last set, which is
 * better than the auth metadata we'd otherwise overwrite it with.
 *
 * The upsert also settles the race between two concurrent first requests — the
 * loser updates instead of failing on the unique index.
 */
export function findOrCreateUser(supabaseId: string, email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    update: { supabaseId },
    create: { supabaseId, email, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, createdAt: true, supabaseId: true },
  });
}
