export interface TokenPayload {
  userId: string;
}

// Signup and login take the same shape; one type covers both.
export interface CredentialsInput {
  email: string;
  password: string;
}

export type AuthResult =
  | { ok: true; token: string }
  | { ok: false; status: number; error: string };
