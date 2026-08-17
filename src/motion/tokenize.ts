/**
 * Turns typed text into a list of gloss tokens.
 *
 * "how are you" -> ["HOW", "ARE", "YOU"]
 * "Pay $250 by Friday." -> ["PAY", "250", "BY", "FRIDAY"]
 *
 * This is a splitter, not a translator. It does not reorder anything, drop
 * function words, or apply any grammar - so its output is English word order
 * with English words, which is NOT Auslan. Real gloss has its own structure and
 * has to come from validated translation, not from this function.
 */
export function tokenizeGloss(input: string): string[] {
  return input
    .trim()
    .toUpperCase()
    .split(/\s+/)
    // Strip surrounding punctuation but keep internal marks, so a token like
    // TEST_NOD or a compound gloss survives intact.
    .map((token) => token.replace(/^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_-]+$/gu, ""))
    .filter((token) => token.length > 0);
}
