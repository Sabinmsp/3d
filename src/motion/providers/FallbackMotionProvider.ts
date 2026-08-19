import type { MotionClip } from "../types";
import {
  MotionNotFoundError,
  type MotionEntry,
  type MotionProvider,
} from "./MotionProvider";

/**
 * Tries providers in order and uses the first that returns a clip.
 *
 * The point is that the experimental path can never take the working path down.
 * A generative provider that is disabled, unreachable, or broken falls through
 * to the animation library, and the app keeps signing what it already knows.
 *
 * Failures are recorded rather than swallowed - a silently skipped provider is
 * how you end up believing a model is running when it is not.
 */
export class FallbackMotionProvider implements MotionProvider {
  readonly name: string;

  /** Why each provider declined, most recent request only. Surfaced for debugging. */
  readonly lastSkips: { provider: string; reason: string }[] = [];

  constructor(private readonly providers: MotionProvider[]) {
    if (providers.length === 0) throw new Error("FallbackMotionProvider needs at least one provider");
    this.name = `fallback(${providers.map((p) => p.name).join(" -> ")})`;
  }

  async getMotion(sign: string): Promise<MotionClip> {
    this.lastSkips.length = 0;
    let notFound = false;

    for (const provider of this.providers) {
      try {
        return await provider.getMotion(sign);
      } catch (error) {
        if (error instanceof MotionNotFoundError) notFound = true;
        this.lastSkips.push({
          provider: provider.name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // If every provider simply lacked the sign, that is "not found" rather than
    // "broken" - the UI distinguishes the two.
    if (notFound) throw new MotionNotFoundError(sign);
    throw new Error(
      `No provider could supply "${sign}":\n` +
        this.lastSkips.map((s) => `  - ${s.provider}: ${s.reason}`).join("\n"),
    );
  }

  /** Union of what every provider offers, de-duplicated, first provider winning. */
  async list(): Promise<MotionEntry[]> {
    const seen = new Map<string, MotionEntry>();
    for (const provider of this.providers) {
      try {
        for (const entry of await provider.list()) {
          if (!seen.has(entry.sign)) seen.set(entry.sign, entry);
        }
      } catch {
        // Listing is a convenience for the UI; one provider failing must not
        // empty the list.
      }
    }
    return [...seen.values()];
  }
}
