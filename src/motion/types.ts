import type { EulerOrder } from "three";
import { HANDSHAPES, isHandshapeName } from "./handshapes";

/**
 * Core data contract for the whole pipeline.
 *
 * Everything upstream (a JSON file today, a trained motion model later) produces
 * a `MotionClip`. Everything downstream (the animation controller, the avatar,
 * the renderer) only ever consumes a `MotionClip`. Nothing in this file knows
 * about Auslan, Three.js scenes, or React.
 */

/** XYZ Euler rotation in RADIANS. */
export type Vec3 = [number, number, number];

/**
 * Rig-agnostic bone names used inside motion data.
 *
 * Motion files never reference a model-specific bone name like
 * "mixamorig:RightForeArm". They use these canonical names, and `boneMap.ts`
 * resolves them against whatever skeleton the loaded GLB actually has. That is
 * what lets the same HI.json drive a different avatar tomorrow.
 */
export const CANONICAL_BONES = [
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftUpperArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightUpperArm",
  "RightForeArm",
  "RightHand",

  // Finger joints. Handshape is phonemic in signed languages - two signs can be
  // identical in location and movement and differ only in the fingers - so these
  // are not optional detail, they are part of the minimal unit of meaning.
  // Numbered outward from the palm: 1 = knuckle, 3 = fingertip joint.
  "RightThumb1",
  "RightThumb2",
  "RightThumb3",
  "RightIndex1",
  "RightIndex2",
  "RightIndex3",
  "RightMiddle1",
  "RightMiddle2",
  "RightMiddle3",
  "RightRing1",
  "RightRing2",
  "RightRing3",
  "RightPinky1",
  "RightPinky2",
  "RightPinky3",
  "LeftThumb1",
  "LeftThumb2",
  "LeftThumb3",
  "LeftIndex1",
  "LeftIndex2",
  "LeftIndex3",
  "LeftMiddle1",
  "LeftMiddle2",
  "LeftMiddle3",
  "LeftRing1",
  "LeftRing2",
  "LeftRing3",
  "LeftPinky1",
  "LeftPinky2",
  "LeftPinky3",
] as const;

export type CanonicalBone = (typeof CANONICAL_BONES)[number];

const CANONICAL_BONE_SET = new Set<string>(CANONICAL_BONES);

export function isCanonicalBone(name: string): name is CanonicalBone {
  return CANONICAL_BONE_SET.has(name);
}

/**
 * Rig-agnostic facial expression names used inside motion data.
 *
 * Maps onto morph target / blend shape weights (0..1) via `expressionMap.ts`,
 * the same way CANONICAL_BONES maps onto skeleton joints via boneMap.ts. Not
 * every avatar has a face rig - a clip that uses these on a model with no morph
 * targets just plays its bone motion with no expression, the same way a clip
 * referencing a bone the rig lacks just skips that bone.
 */
export const CANONICAL_EXPRESSIONS = [
  // Non-manual features. In Auslan these are grammar, not decoration: brow
  // position distinguishes question types, and head/brow together mark negation,
  // topics and conditionals.
  "BROW_RAISE",
  "BROW_DROP",
  "EYE_BLINK",
  "EYE_WIDE",
  "EYE_SQUINT",
  "MOUTH_SMILE",
  "MOUTH_FROWN",
  "MOUTH_OPEN",

  // Mouth patterns. Signed languages carry meaning on the mouth in two ways:
  // "mouthings" borrowed from the spoken language, and "mouth gestures" that
  // belong to the sign itself. Some sign pairs differ ONLY in mouth pattern, so
  // these are load-bearing, not lip-sync polish.
  "MOUTH_AH",
  "MOUTH_OO",
  "MOUTH_EE",
  "MOUTH_MM",
  "MOUTH_FF",
  "MOUTH_PUFF",
  "MOUTH_PURSE",
] as const;

export type CanonicalExpression = (typeof CANONICAL_EXPRESSIONS)[number];

const CANONICAL_EXPRESSION_SET = new Set<string>(CANONICAL_EXPRESSIONS);

export function isCanonicalExpression(name: string): name is CanonicalExpression {
  return CANONICAL_EXPRESSION_SET.has(name);
}

/**
 * One keyframe.
 *
 * IMPORTANT: bone rotations are OFFSETS FROM THE MODEL'S REST POSE, not absolute
 * local rotations. `[0, 0, 0]` means "exactly as the rigged model was exported".
 * This is what keeps a clip portable: a T-pose rig and an A-pose rig both start
 * from their own neutral and receive the same relative movement.
 *
 * Frames may be sparse - a frame only needs to list the bones it changes.
 *
 * `expressions` are UNRELATED to bone offsets: each is an ABSOLUTE morph target
 * weight from 0 (neutral) to 1 (fully applied), not a delta from rest. A frame
 * that omits an expression holds whatever the previous keyframe set - so a clip
 * that never mentions MOUTH_SMILE never touches it, and one that sets it once
 * and never again keeps smiling until a later frame explicitly sets it back to 0.
 */
export interface MotionFrame {
  time: number;
  bones: Partial<Record<CanonicalBone, Vec3>>;
  expressions?: Partial<Record<CanonicalExpression, number>>;
  /**
   * Named handshape per hand, e.g. `{ "Right": "FLAT" }`. Expanded into finger
   * bone rotations at compile time - see handshapes.ts. Explicit `bones` entries
   * win over the handshape, so a clip can name a shape and then adjust one digit.
   */
  handshape?: Partial<Record<"Right" | "Left", string>>;
}

export type MotionStatus = "ready" | "placeholder";

/**
 * How much trust this clip's linguistic content has earned.
 *
 * There is no default and no "probably fine" value. A clip is either reviewed by
 * someone qualified to judge it, or it is a draft - and the app says which, every
 * time it plays. This exists because the failure mode of a signing avatar is
 * silent: wrong signing still looks like fluent signing to someone who cannot
 * check it, which is precisely the audience being served.
 */
export type ValidationStatus =
  /** Authored from written descriptions, NOT checked by a fluent signer. */
  | "unvalidated-draft"
  /** Reviewed and corrected by a qualified Auslan informant or translator. */
  | "community-reviewed"
  /** Not a sign at all - a technical fixture (a wave, a nod) used to test the pipeline. */
  | "technical-test";

export interface MotionClip {
  /** Gloss token this clip animates, e.g. "THANK-YOU". */
  sign: string;
  /** Plain-English meaning, shown in captions so the sign can be read alongside it. */
  meaning?: string;
  /** Required. See ValidationStatus - there is deliberately no default. */
  validation: ValidationStatus;
  /**
   * Who reviewed this clip and when, once it has been. Free text, shown in the
   * app. Empty for drafts.
   */
  reviewedBy?: string;
  /** Total length in seconds. */
  duration: number;
  frames: MotionFrame[];
  /**
   * "placeholder" means: this file exists to prove the lookup path works, but
   * carries no real motion. The UI must say so rather than imply a valid sign.
   */
  status?: MotionStatus;
  /** Euler order for the frame rotations. Defaults to "XYZ". */
  rotationOrder?: EulerOrder;
  /** Interpolation curve between keyframes. Defaults to "smoothstep". */
  easing?: "linear" | "smoothstep";
  notes?: string;
}

export class MotionDataError extends Error {}

/**
 * Validate untrusted motion data.
 *
 * Today the input is a hand-authored JSON file. Later it will be the output of a
 * motion-generation model, which is exactly when a real parse boundary starts
 * earning its keep - a malformed clip should fail loudly here rather than
 * silently produce a broken pose on screen.
 */
export function parseMotionClip(raw: unknown, sourceLabel: string): MotionClip {
  // Annotated on the variable, not just the arrow, so TypeScript treats a call
  // to it as terminating control flow and narrows the checks below.
  const fail: (msg: string) => never = (msg) => {
    throw new MotionDataError(`${sourceLabel}: ${msg}`);
  };

  if (typeof raw !== "object" || raw === null) fail("expected a JSON object");
  const obj = raw as Record<string, unknown>;

  if (typeof obj.sign !== "string" || obj.sign.length === 0) {
    fail('missing "sign"');
  }

  // Deliberately required with no default. A clip that forgets to declare its
  // validation status must fail loudly rather than quietly render as if trusted.
  const VALID_STATUSES: ValidationStatus[] = [
    "unvalidated-draft",
    "community-reviewed",
    "technical-test",
  ];
  if (!VALID_STATUSES.includes(obj.validation as ValidationStatus)) {
    fail(
      `missing or invalid "validation". Must be one of: ${VALID_STATUSES.join(", ")}. ` +
        `Every clip must declare whether its linguistic content has been checked.`,
    );
  }
  if (typeof obj.duration !== "number" || !Number.isFinite(obj.duration) || obj.duration < 0) {
    fail('"duration" must be a non-negative number');
  }
  if (!Array.isArray(obj.frames)) fail('"frames" must be an array');

  const frames: MotionFrame[] = (obj.frames as unknown[]).map((rawFrame, i) => {
    if (typeof rawFrame !== "object" || rawFrame === null) fail(`frame ${i} is not an object`);
    const frame = rawFrame as Record<string, unknown>;

    if (typeof frame.time !== "number" || !Number.isFinite(frame.time) || frame.time < 0) {
      fail(`frame ${i} has an invalid "time"`);
    }
    if (typeof frame.bones !== "object" || frame.bones === null) {
      fail(`frame ${i} is missing "bones"`);
    }

    const bones: Partial<Record<CanonicalBone, Vec3>> = {};
    for (const [boneName, value] of Object.entries(frame.bones as Record<string, unknown>)) {
      if (!isCanonicalBone(boneName)) {
        fail(
          `frame ${i} references unknown bone "${boneName}". ` +
            `Valid names: ${CANONICAL_BONES.join(", ")}`,
        );
      }
      if (
        !Array.isArray(value) ||
        value.length !== 3 ||
        !value.every((n) => typeof n === "number" && Number.isFinite(n))
      ) {
        fail(`frame ${i} bone "${boneName}" must be [x, y, z] in radians`);
      }
      bones[boneName] = [value[0], value[1], value[2]] as Vec3;
    }

    let expressions: Partial<Record<CanonicalExpression, number>> | undefined;
    if (frame.expressions !== undefined) {
      if (typeof frame.expressions !== "object" || frame.expressions === null) {
        fail(`frame ${i} has an invalid "expressions"`);
      }
      expressions = {};
      for (const [name, value] of Object.entries(frame.expressions as Record<string, unknown>)) {
        if (!isCanonicalExpression(name)) {
          fail(
            `frame ${i} references unknown expression "${name}". ` +
              `Valid names: ${CANONICAL_EXPRESSIONS.join(", ")}`,
          );
        }
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
          fail(`frame ${i} expression "${name}" must be a number between 0 and 1`);
        }
        expressions[name] = value;
      }
    }

    let handshape: Partial<Record<"Right" | "Left", string>> | undefined;
    if (frame.handshape !== undefined) {
      if (typeof frame.handshape !== "object" || frame.handshape === null) {
        fail(`frame ${i} has an invalid "handshape"`);
      }
      handshape = {};
      for (const [side, name] of Object.entries(frame.handshape as Record<string, unknown>)) {
        if (side !== "Right" && side !== "Left") {
          fail(`frame ${i} handshape side must be "Right" or "Left", got "${side}"`);
        }
        if (typeof name !== "string" || !isHandshapeName(name)) {
          fail(
            `frame ${i} handshape "${String(name)}" is not defined. ` +
              `Known handshapes: ${Object.keys(HANDSHAPES).join(", ")}`,
          );
        }
        handshape[side] = name;
      }
    }

    return { time: frame.time as number, bones, expressions, handshape };
  });

  if (frames.length === 0) fail("clip has no frames");

  return {
    sign: obj.sign as string,
    meaning: typeof obj.meaning === "string" ? obj.meaning : undefined,
    validation: obj.validation as ValidationStatus,
    reviewedBy: typeof obj.reviewedBy === "string" ? obj.reviewedBy : undefined,
    duration: obj.duration as number,
    frames,
    status: obj.status === "placeholder" ? "placeholder" : "ready",
    rotationOrder: (obj.rotationOrder as EulerOrder | undefined) ?? "XYZ",
    easing: obj.easing === "linear" ? "linear" : "smoothstep",
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
  };
}
