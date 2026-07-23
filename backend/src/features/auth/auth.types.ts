/** Never includes passwordHash. The user's id is deliberately absent too: the
 *  caller already carries it in their token, and nothing needs it rendered. */
export interface UserProfile {
  email: string;
  name?: string | null;
  createdAt: string;
  connectionCount: number;
  queryCount: number;
}
