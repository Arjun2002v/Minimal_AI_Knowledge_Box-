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

export const toBlob = (vector) => Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);

export const fromBlob = (bytes) => new Float32Array(Uint8Array.from(bytes).buffer);
