// Small vector helpers: normalize, dot product, and (de)serialize for SQLite BLOBs.

/** Scales a vector to length 1, so cosine similarity becomes a plain dot product. */
export const normalize = (vector) => {
  const length = Math.hypot(...vector);
  const out = new Float32Array(vector.length);
  if (length === 0) return out;
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / length;
  return out;
};

export const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

/** Float32Array -> bytes for a BLOB column. */
export const toBlob = (vector) => Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);

/** BLOB bytes -> Float32Array (copied, so the byte offset is always aligned). */
export const fromBlob = (bytes) => new Float32Array(Uint8Array.from(bytes).buffer);
