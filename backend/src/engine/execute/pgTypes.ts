// Maps Postgres type OIDs to the semantic kind the presentation layer needs.
//
// Why OIDs and not `typeof value`: node-pg returns int8 (bigint) and numeric as
// JavaScript strings to avoid precision loss. Verified against the seed DB —
// COUNT(*) comes back as "10057" (oid 20) and SUM(line_amt_inr) as
// "558324675.32" (oid 1700). Inferring from the value would label both "text"
// and chart selection would degrade to a table for every aggregate query.

import type { FieldKind } from "../types";

// oid values are stable in pg_type and safe to hard-code.
const NUMERIC_OIDS = new Set([
  20, // int8
  21, // int2
  23, // int4
  26, // oid
  700, // float4
  701, // float8
  790, // money
  1700, // numeric
]);

const DATE_OIDS = new Set([
  1082, // date
  1083, // time
  1114, // timestamp
  1184, // timestamptz
  1266, // timetz
]);

const BOOLEAN_OIDS = new Set([16]);

export function kindForOid(oid: number): FieldKind {
  if (NUMERIC_OIDS.has(oid)) return "numeric";
  if (DATE_OIDS.has(oid)) return "date";
  if (BOOLEAN_OIDS.has(oid)) return "boolean";
  return "text";
}
