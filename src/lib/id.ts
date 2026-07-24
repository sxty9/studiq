/** Tiny non-cryptographic unique id for client-side entities (strokes, mock rows). */
let seq = 0;
export function uid(prefix = 'id'): string {
  seq += 1;
  // crypto.randomUUID exists in every browser Vite targets; fall back to a counter for odd envs.
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.abs((Date.now() ^ (seq * 2654435761)) >>> 0).toString(36);
  return `${prefix}_${rnd}${seq.toString(36)}`;
}
