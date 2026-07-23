import {
  countConnections,
} from "../connections/connections.repository";
import { countQueryLogs } from "../query/query.repository";
import { findUserById } from "./auth.repository";
import type { UserProfile } from "./auth.types";

/**
 * The authenticated user's own profile. `userId` comes from the verified token,
 * never from the request body, and every count is scoped to it.
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const [connectionCount, queryCount] = await Promise.all([
    countConnections(userId),
    countQueryLogs(userId),
  ]);

  return {
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    connectionCount,
    queryCount,
  };
}
