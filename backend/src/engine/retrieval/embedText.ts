// Builds the text that represents a table for embedding. Per decision D8, we
// embed "name + columns + description + sample values" - not the bare table
// name - so that user vocabulary ("revenue", "sales") matches schemas named
// like `pay_txn.txn_amt_inr`.

import type { TableProfile } from "../types";

export function buildTableEmbeddingText(table: TableProfile): string {
  const columns = table.columns
    .map((c) => {
      const samples = c.sampleValues.slice(0, 5).join(", ");
      return samples ? `${c.name} (${c.dataType}) e.g. ${samples}` : `${c.name} (${c.dataType})`;
    })
    .join("; ");

  const parts = [
    `Table: ${table.name}`,
    table.description ? `Description: ${table.description}` : "",
    `Columns: ${columns}`,
  ].filter(Boolean);

  return parts.join("\n");
}
