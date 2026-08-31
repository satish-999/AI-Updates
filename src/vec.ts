/** pgvector interchange helpers. Vectors cross the wire as '[a,b,c]' text. */

export function parseVector(text: string): Float32Array {
  const inner = text.trim().replace(/^\[|\]$/g, "");
  const parts = inner.split(",");
  const out = new Float32Array(parts.length);
  for (let i = 0; i < parts.length; i++) out[i] = Number(parts[i]);
  return out;
}

export function formatVector(v: Float32Array | number[]): string {
  return `[${Array.from(v).join(",")}]`;
}

/**
 * Incremental centroid: c' = (c*n + e) / (n+1), renormalised to unit length.
 *
 * Renormalising matters — pgvector's `<=>` is cosine distance, which ignores
 * magnitude, but keeping centroids unit-length means the stored vector stays
 * directly comparable to the unit-length article embeddings and future
 * averaging does not drift.
 */
export function updateCentroid(
  centroid: Float32Array,
  incoming: Float32Array,
  n: number
): Float32Array {
  if (centroid.length !== incoming.length) {
    throw new Error(`dim mismatch: ${centroid.length} vs ${incoming.length}`);
  }
  const out = new Float32Array(centroid.length);
  let norm = 0;
  for (let i = 0; i < centroid.length; i++) {
    const val = (centroid[i] * n + incoming[i]) / (n + 1);
    out[i] = val;
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
