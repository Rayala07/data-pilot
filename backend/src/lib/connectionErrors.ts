import type { FailureReason } from "../engine/types";

const MESSAGES: Record<FailureReason, string> = {
  unreachable: "Couldn't reach that database. Check the host, port, and that it accepts connections from the internet (SSL included).",
  bad_credentials: "That username/password was rejected by the database.",
  not_postgres: "That connection succeeded but the server doesn't look like Postgres — double-check the connection string.",
  introspection_error: "Connected successfully, but scanning the schema failed. You can retry the scan from the connection page.",
};

export function friendlyConnectionError(reason: FailureReason): string {
  return MESSAGES[reason];
}
