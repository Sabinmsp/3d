import type { MotionClip, MotionStatus } from "../types";

/**
 * The seam between "where motion comes from" and "how motion is played".
 *
 * Today: LocalJsonMotionProvider reads /motions/HI.json.
 * Later: a provider that calls a trained Auslan motion model, or a server route
 * that returns generated frames, drops in here with no change to the controller,
 * the avatar, or the UI.
 */
export interface MotionProvider {
  readonly name: string;

  /** Resolve a gloss token ("HI") to a clip. Throws MotionNotFoundError if absent. */
  getMotion(sign: string): Promise<MotionClip>;

  /** What this provider can currently offer, for UI listing. */
  list(): Promise<MotionEntry[]>;
}

export interface MotionEntry {
  sign: string;
  status: MotionStatus;
  label?: string;
}

export class MotionNotFoundError extends Error {
  constructor(public readonly sign: string) {
    super(`No motion data found for "${sign}"`);
  }
}
