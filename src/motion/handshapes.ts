import type { CanonicalBone, Vec3 } from "./types";

/**
 * Named handshapes, the way sign linguistics actually describes them.
 *
 * A sign is conventionally described by five parameters: handshape, orientation,
 * location, movement, and non-manual features. Authoring 30 finger rotations per
 * keyframe would be both unreadable and wrong-headed - handshape is a discrete
 * contrastive category, not a continuous pose, so motion data names it:
 *
 *     "handshape": { "Right": "FLAT" }
 *
 * and this file expands that into joint rotations at compile time.
 *
 * Names follow the Auslan handshape inventory described in Johnston & Schembri's
 * work where a direct equivalent exists. The ROTATIONS here are approximations
 * authored by eye against one rig - they are not measured from signer data, and
 * they are the part most in need of review by a qualified Auslan informant.
 */

/** Per-joint curl for one digit: [knuckle, middle, tip], radians. */
export type DigitCurl = [number, number, number];

export interface Handshape {
  /** Short description of the shape, shown in the app's handshape reference. */
  description: string;
  thumb: DigitCurl;
  index: DigitCurl;
  middle: DigitCurl;
  ring: DigitCurl;
  pinky: DigitCurl;
  /** Finger separation at the knuckle, radians. 0 = together. */
  spread?: number;
}

/**
 * Curl direction for this rig family.
 *
 * Character Creator and Mixamo both run +Y down the bone with the curl about Z,
 * and a NEGATIVE Z rotation closes the hand. If a new rig curls backwards, this
 * is the single value to flip.
 */
const CURL_AXIS: "x" | "y" | "z" = "z";
const CURL_SIGN = -1;

export const HANDSHAPES: Record<string, Handshape> = {
  /** Open hand, fingers extended and together. Auslan "flat". */
  FLAT: {
    description: "Open hand, fingers straight and together",
    thumb: [0, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
  },

  /** Open hand with fingers splayed. Auslan "spread". */
  SPREAD: {
    description: "Open hand, fingers splayed apart",
    thumb: [0, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
    spread: 0.22,
  },

  /** Closed fist. Auslan "fist". */
  FIST: {
    description: "Closed fist",
    thumb: [0.5, 0.5, 0.3],
    index: [1.5, 1.7, 1.2],
    middle: [1.5, 1.7, 1.2],
    ring: [1.5, 1.7, 1.2],
    pinky: [1.5, 1.7, 1.2],
  },

  /** Index extended, the rest closed. Auslan "point". */
  POINT: {
    description: "Index finger extended, others closed",
    thumb: [0.6, 0.6, 0.3],
    index: [0, 0, 0],
    middle: [1.5, 1.7, 1.2],
    ring: [1.5, 1.7, 1.2],
    pinky: [1.5, 1.7, 1.2],
  },

  /** Index and middle extended. Auslan "two". */
  TWO: {
    description: "Index and middle extended, others closed",
    thumb: [0.6, 0.6, 0.3],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [1.5, 1.7, 1.2],
    pinky: [1.5, 1.7, 1.2],
    spread: 0.18,
  },

  /** Thumb extended upward from a fist. Auslan "good". */
  GOOD: {
    description: "Fist with thumb extended up",
    thumb: [-0.15, 0, 0],
    index: [1.6, 1.7, 1.2],
    middle: [1.6, 1.7, 1.2],
    ring: [1.6, 1.7, 1.2],
    pinky: [1.6, 1.7, 1.2],
  },

  /** Fingers bent at the knuckles only, palm open. Auslan "hook"/"claw". */
  HOOK: {
    description: "Fingers bent at the knuckles, palm open",
    thumb: [0.3, 0.3, 0.2],
    index: [0.55, 0.8, 0.5],
    middle: [0.55, 0.8, 0.5],
    ring: [0.55, 0.8, 0.5],
    pinky: [0.55, 0.8, 0.5],
    spread: 0.1,
  },

  /** Curved open hand, as if holding a ball. Auslan "cup". */
  CUP: {
    description: "Curved open hand",
    thumb: [0.35, 0.25, 0.2],
    index: [0.4, 0.45, 0.35],
    middle: [0.4, 0.45, 0.35],
    ring: [0.4, 0.45, 0.35],
    pinky: [0.4, 0.45, 0.35],
    spread: 0.08,
  },

  /** Fingers and thumb meeting in a circle. Auslan "round"/"O". */
  ROUND: {
    description: "Fingers and thumb forming a circle",
    thumb: [0.6, 0.5, 0.4],
    index: [0.85, 0.7, 0.6],
    middle: [0.85, 0.7, 0.6],
    ring: [0.85, 0.7, 0.6],
    pinky: [0.85, 0.7, 0.6],
  },

  /** Relaxed neutral hand - the resting position between signs. */
  RELAXED: {
    description: "Relaxed neutral hand",
    thumb: [0.2, 0.15, 0.1],
    index: [0.25, 0.3, 0.2],
    middle: [0.3, 0.35, 0.25],
    ring: [0.35, 0.4, 0.3],
    pinky: [0.4, 0.45, 0.3],
    spread: 0.05,
  },
};

export type HandshapeName = keyof typeof HANDSHAPES;

export function isHandshapeName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(HANDSHAPES, name);
}

const DIGITS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
const DIGIT_KEYS = ["thumb", "index", "middle", "ring", "pinky"] as const;

/** Spread fans the fingers outward from the middle finger. */
const SPREAD_FACTOR: Record<(typeof DIGITS)[number], number> = {
  Thumb: 1.4,
  Index: 1,
  Middle: 0,
  Ring: -1,
  Pinky: -1.9,
};

function curlVec(amount: number, spread: number): Vec3 {
  const v: Vec3 = [0, 0, 0];
  const axisIndex = CURL_AXIS === "x" ? 0 : CURL_AXIS === "y" ? 1 : 2;
  v[axisIndex] = amount * CURL_SIGN;
  // Abduction is a separate axis from curl, and only meaningful at the knuckle.
  if (spread !== 0) v[1] += spread;
  return v;
}

/**
 * Expand a named handshape into per-bone rotation offsets for one hand.
 * Unknown names return an empty object rather than throwing - validation
 * happens at parse time, where a clear error can name the file.
 */
export function expandHandshape(
  side: "Right" | "Left",
  name: string,
): Partial<Record<CanonicalBone, Vec3>> {
  const shape = HANDSHAPES[name];
  if (!shape) return {};

  const out: Partial<Record<CanonicalBone, Vec3>> = {};
  const mirror = side === "Left" ? -1 : 1;

  DIGITS.forEach((digit, d) => {
    const curls = shape[DIGIT_KEYS[d]];
    const spread = (shape.spread ?? 0) * SPREAD_FACTOR[digit] * mirror;

    for (let joint = 0; joint < 3; joint++) {
      const bone = `${side}${digit}${joint + 1}` as CanonicalBone;
      out[bone] = curlVec(curls[joint], joint === 0 ? spread : 0);
    }
  });

  return out;
}
