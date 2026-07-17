export interface TokenPayload {
  userId: string;
  /** Present (true) only on ephemeral demo-sandbox tokens. */
  demo?: boolean;
}

// Signup and login take the same shape; one type covers both.
export interface CredentialsInput {
  email: string;
  password: string;
}

export type AuthResult =
  | { ok: true; token: string }
  | { ok: false; status: number; error: string };

/** Never includes passwordHash. The user's id is deliberately absent too: the
 *  caller already carries it in their token, and nothing needs it rendered. */
export interface UserProfile {
  email: string;
  createdAt: string;
  connectionCount: number;
  queryCount: number;
}
