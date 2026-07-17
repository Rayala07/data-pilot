export interface TokenPayload {
  userId: string;
  /** Present (true) only on ephemeral demo-sandbox tokens. */
  demo?: boolean;
  /**
   * The /demo?ref=... tag, carried so events recorded LATER in the session
   * (a connection added, a question asked) still attribute to the link the
   * visitor arrived on. Never trusted for anything but telemetry.
   */
  ref?: string;
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
