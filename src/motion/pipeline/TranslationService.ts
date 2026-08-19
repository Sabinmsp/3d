import { tokenizeGloss } from "../tokenize";

/**
 * English -> Auslan gloss.
 *
 * This is the seam a fine-tuned Qwen3-4B (or any translation model) plugs into.
 * It is deliberately separate from motion: the translator decides WHAT signs to
 * produce, the motion layer decides HOW the avatar moves.
 */

export interface GlossResult {
  /** The gloss tokens to sign, in signing order. */
  tokens: string[];
  /** Which implementation produced this, shown in the UI so nothing looks more authoritative than it is. */
  source: string;
  /**
   * True only when a real translation model produced this. False means the
   * tokens are NOT Auslan grammar and must not be presented as a translation.
   */
  translated: boolean;
  /** Optional note surfaced to the user. */
  note?: string;
}

export interface TranslationService {
  readonly name: string;
  translate(englishText: string): Promise<GlossResult>;
}

/**
 * The current implementation: splits text into tokens and uppercases them.
 *
 * It is named "passthrough" rather than "translator" on purpose. Auslan has its
 * own grammar - different word order, no direct equivalents for most English
 * function words, meaning carried spatially and on the face. Splitting an English
 * sentence into words gives English word order with English words attached to
 * clips. That is not Auslan, and calling this a translator would be a lie that
 * later readers of the code would believe.
 */
export class PassthroughGlossService implements TranslationService {
  readonly name = "passthrough-tokenizer";

  async translate(englishText: string): Promise<GlossResult> {
    return {
      tokens: tokenizeGloss(englishText),
      source: this.name,
      translated: false,
      note: "Word-split only - English order, not Auslan grammar.",
    };
  }
}

/**
 * Placeholder for the fine-tuned Qwen3-4B translator.
 *
 * Not wired to anything yet, and deliberately fails loudly rather than falling
 * back to word-splitting: silently degrading a "translation" to a word-split
 * would produce confident, wrong gloss with no signal that it happened.
 *
 * To make this real, stand up an endpoint that accepts { text } and returns
 * { tokens: string[] }, then pass its URL here.
 */
export class QwenGlossService implements TranslationService {
  readonly name = "qwen3-4b-lora";

  constructor(private readonly endpoint?: string) {}

  async translate(englishText: string): Promise<GlossResult> {
    if (!this.endpoint) {
      throw new Error(
        "QwenGlossService has no endpoint configured. English-to-Auslan-gloss " +
          "translation is not implemented yet - no model has been fine-tuned or " +
          "hosted for this project. Use PassthroughGlossService for now.",
      );
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: englishText }),
    });
    if (!response.ok) {
      throw new Error(`Gloss translation endpoint returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as { tokens?: unknown };
    if (!Array.isArray(data.tokens) || !data.tokens.every((t) => typeof t === "string")) {
      throw new Error('Gloss endpoint must return { tokens: string[] }');
    }

    return {
      tokens: data.tokens as string[],
      source: this.name,
      translated: true,
      note: "Machine-translated gloss - requires review by a qualified Auslan translator.",
    };
  }
}
