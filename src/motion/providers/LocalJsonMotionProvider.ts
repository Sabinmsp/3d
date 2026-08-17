import { parseMotionClip, type MotionClip } from "../types";
import {
  MotionNotFoundError,
  type MotionEntry,
  type MotionProvider,
} from "./MotionProvider";

/**
 * Reads motion clips from static JSON under /public/motions.
 *
 * Fetched at runtime rather than imported at build time, so adding a new sign is
 * "drop in a file", not "rebuild the app".
 */
export class LocalJsonMotionProvider implements MotionProvider {
  readonly name = "local-json";

  private readonly cache = new Map<string, MotionClip>();
  private manifest: Promise<MotionEntry[]> | null = null;

  constructor(private readonly baseUrl = "/motions") {}

  /** "  hi " -> "HI". Gloss tokens are uppercase by convention. */
  private normalizeSign(sign: string): string {
    return sign.trim().toUpperCase();
  }

  async getMotion(sign: string): Promise<MotionClip> {
    const key = this.normalizeSign(sign);
    if (!key) throw new MotionNotFoundError(sign);

    const cached = this.cache.get(key);
    if (cached) return cached;

    const url = `${this.baseUrl}/${encodeURIComponent(key)}.json`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (cause) {
      throw new Error(`Could not reach ${url}`, { cause });
    }

    if (response.status === 404) throw new MotionNotFoundError(key);
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);

    const clip = parseMotionClip(await response.json(), `${key}.json`);
    this.cache.set(key, clip);
    return clip;
  }

  async list(): Promise<MotionEntry[]> {
    this.manifest ??= (async () => {
      const response = await fetch(`${this.baseUrl}/manifest.json`);
      if (!response.ok) return [];
      const data = (await response.json()) as { signs?: MotionEntry[] };
      return data.signs ?? [];
    })();

    try {
      return await this.manifest;
    } catch {
      // The manifest only drives a convenience list in the UI - losing it should
      // not stop playback from working.
      this.manifest = null;
      return [];
    }
  }
}
