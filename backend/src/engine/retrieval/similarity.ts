// Cosine similarity, implemented directly (decision D2 - no vector DB, and the
// math is understood, not abstracted away). Cosine = dot(a, b) / (|a| |b|).
// We normalize each vector once, then similarity is just a dot product.

export function normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (const x of vec) sumSq += x * x;
  const magnitude = Math.sqrt(sumSq);
  if (magnitude === 0) return vec.slice();
  return vec.map((x) => x / magnitude);
}

export function dot(a: number[], b: number[]): number {
  // Guard against dimension mismatch (e.g. embeddings from different models).
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

/** Cosine similarity of two already-normalized vectors is just their dot product. */
export function cosineOfNormalized(a: number[], b: number[]): number {
  return dot(a, b);
}
