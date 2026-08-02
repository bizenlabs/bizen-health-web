// Selecting which finalised utterances still need inserting into the editor.
//
// The live stream appends to a client-side array in order, so tracking "how
// many have I inserted" as a count is fine there. Anything read back from the
// server is different: its array need not line up index-for-index with what
// this client produced. It carries the seeded segments of a resumed dictation,
// its order is the server's, and a retried append could historically land the
// same utterance twice. Reconcile by `sequence`, which is the stable identity
// of an utterance, and never by slicing at a positional count.

// The shape both the live segments (SegmentInput) and the server's
// (TranscriptSegment) satisfy.
type Sequenced = { sequence: number };

/**
 * Segments with a sequence past `processedMaxSeq`, in sequence order, with
 * repeats of the same sequence collapsed to the first occurrence.
 *
 * Returns a new array; the input is not mutated.
 */
export function selectFreshSegments<T extends Sequenced>(
  segments: readonly T[],
  processedMaxSeq: number,
): T[] {
  return segments
    .filter((s) => s.sequence > processedMaxSeq)
    .sort((a, b) => a.sequence - b.sequence)
    .filter((s, i, arr) => i === 0 || s.sequence !== arr[i - 1].sequence);
}

/** The highest sequence in `segments`, or `fallback` when there are none. */
export function maxSequence(
  segments: readonly Sequenced[],
  fallback = -1,
): number {
  return segments.reduce((max, s) => Math.max(max, s.sequence), fallback);
}
