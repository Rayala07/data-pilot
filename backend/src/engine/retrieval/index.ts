// Retrieval module: enriches a SchemaProfile at ingest (descriptions +
// embeddings) and, at query time, picks the tables relevant to a question via
// in-memory cosine similarity plus FK-neighbor expansion.

import type {
  EmbeddingProvider,
  LLMProvider,
  Result,
  RetrievedTable,
  SchemaProfile,
  TableProfile,
} from "../types";
import { describeTable } from "./describe";
import { buildTableEmbeddingText } from "./embedText";
import { cosineOfNormalized, normalize } from "./similarity";

const TOP_K = 6;
// FK-neighbor expansion pulls tables joined to the strongest hits (architecture.md).
const FK_EXPAND_FROM_TOP = 3;
// Bound description-generation concurrency so a wide schema doesn't fire dozens
// of LLM calls at once.
const DESCRIBE_CONCURRENCY = 4;

async function mapWithConcurrency<T, U>(items: T[], limit: number, fn: (item: T) => Promise<U>): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Fills each table's `description` (LLM) and `embedding` (embedding of
 * name+columns+description+samples). Mutates and returns the same profile.
 * Embeddings are stored normalized so query-time similarity is a plain dot product.
 */
export async function enrichSchemaProfile(
  profile: SchemaProfile,
  llm: LLMProvider,
  embedder: EmbeddingProvider
): Promise<Result<SchemaProfile, "embedding_error">> {
  const descriptions = await mapWithConcurrency(profile.tables, DESCRIBE_CONCURRENCY, (t) => describeTable(t, llm));
  profile.tables.forEach((t, i) => {
    t.description = descriptions[i];
  });

  const texts = profile.tables.map(buildTableEmbeddingText);
  const embedded = await embedder.embed(texts);
  if (!embedded.ok) return embedded;

  profile.tables.forEach((t, i) => {
    t.embedding = normalize(embedded.value[i]);
  });

  return { ok: true, value: profile };
}

function tableKey(t: { schema: string; name: string }): string {
  return `${t.schema}.${t.name}`;
}

// Tables FK-linked to `seed` in either direction (seed references them, or they
// reference seed), so a question about orders also surfaces the joined lines/payments.
function foreignKeyNeighbors(seed: TableProfile, all: TableProfile[]): TableProfile[] {
  const neighborNames = new Set<string>();
  for (const fk of seed.foreignKeys) neighborNames.add(fk.refTable);
  for (const t of all) {
    if (t.foreignKeys.some((fk) => fk.refTable === seed.name)) neighborNames.add(t.name);
  }
  return all.filter((t) => neighborNames.has(t.name));
}

/**
 * Ranks tables against a question. Returns the top-k by cosine similarity, then
 * adds any FK-neighbors of the top few (marked viaForeignKey) that weren't
 * already selected. Tables without an embedding are skipped.
 */
export async function retrieveTables(
  question: string,
  profile: SchemaProfile,
  embedder: EmbeddingProvider,
  topK: number = TOP_K
): Promise<Result<RetrievedTable[], "embedding_error">> {
  const embedded = await embedder.embed([question]);
  if (!embedded.ok) return embedded;
  const queryVec = normalize(embedded.value[0]);

  const scored = profile.tables
    .filter((t) => Array.isArray(t.embedding) && t.embedding.length > 0)
    .map((t) => ({ table: t, score: cosineOfNormalized(queryVec, t.embedding!) }))
    .sort((a, b) => b.score - a.score);

  // Small-schema guard: k=6 is right for large schemas, but on a schema with
  // only a handful of tables it would return almost everything, defeating the
  // point of retrieval (narrowing context). Never take more than half the
  // embedded tables when that's fewer than k. FK expansion below still pulls in
  // whatever's needed to join.
  const effectiveK = Math.min(topK, Math.max(3, Math.ceil(scored.length / 2)));

  const selected = new Map<string, RetrievedTable>();
  for (const { table, score } of scored.slice(0, effectiveK)) {
    selected.set(tableKey(table), { schema: table.schema, name: table.name, score, viaForeignKey: false });
  }

  // Expand from the top few direct hits along foreign keys.
  const scoreByName = new Map(scored.map((s) => [s.table.name, s.score]));
  for (const { table } of scored.slice(0, FK_EXPAND_FROM_TOP)) {
    for (const neighbor of foreignKeyNeighbors(table, profile.tables)) {
      const key = tableKey(neighbor);
      if (!selected.has(key)) {
        selected.set(key, {
          schema: neighbor.schema,
          name: neighbor.name,
          score: scoreByName.get(neighbor.name) ?? 0,
          viaForeignKey: true,
        });
      }
    }
  }

  return { ok: true, value: Array.from(selected.values()) };
}
