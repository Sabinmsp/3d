import type { EulerOrder } from "three";

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
  "BROW_RAISE",
  "BROW_DROP",
  "EYE_BLINK",
  "EYE_WIDE",
  "MOUTH_SMILE",
  "MOUTH_FROWN",
  "MOUTH_OPEN",
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
}

export type MotionStatus = "ready" | "placeholder";

export interface MotionClip {
  /** Gloss token this clip animates, e.g. "HI". */
  sign: string;
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

    return { time: frame.time as number, bones, expressions };
  });

  if (frames.length === 0) fail("clip has no frames");

  return {
    sign: obj.sign as string,
    duration: obj.duration as number,
    frames,
    status: obj.status === "placeholder" ? "placeholder" : "ready",
    rotationOrder: (obj.rotationOrder as EulerOrder | undefined) ?? "XYZ",
    easing: obj.easing === "linear" ? "linear" : "smoothstep",
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
  };
}
