import type { CanonicalBone } from "./types";

/**
 * What each local rotation axis actually DOES on this rig.
 *
 * Bone axes are a property of how a model was built and exported; they are not
 * knowable from the file, and they are not consistent between rigs. Guessing
 * them is what produced arms folding through the torso earlier in this project.
 *
 * These entries were measured, not assumed: each axis was rotated 30 degrees in
 * isolation from the neutral pose and the hand's world displacement recorded.
 * The measurement for the right upper arm, hand movement in metres:
 *
 *   +X  ->  dz +0.25   arm swings FORWARD
 *   -X  ->  dz -0.26   arm swings BACKWARD
 *   +Y  ->  (~0.01)    twist about the bone's own length - hand barely moves
 *   +Z  ->  dx +0.24   arm crosses IN toward the body
 *   -Z  ->  dx -0.27   arm raises OUT away from the body
 *
 * Re-run the sweep if the avatar is ever replaced.
 */

export interface AxisMeaning {
  x: string;
  y: string;
  z: string;
  /** Human-readable note about which direction is usually wanted. */
  hint?: string;
}

export const AXIS_MEANINGS: Partial<Record<CanonicalBone, AxisMeaning>> = {
  RightUpperArm: {
    x: "+ forward / - backward",
    y: "twist (arm rotates in place)",
    z: "- raises OUT / + crosses IN",
    hint: "To raise the arm use NEGATIVE Z. X only swings it forward and back.",
  },
  LeftUpperArm: {
    x: "+ forward / - backward",
    y: "twist (arm rotates in place)",
    z: "+ raises OUT / - crosses IN",
    hint: "Mirrored from the right: raising uses POSITIVE Z.",
  },
  RightForeArm: {
    x: "minor / off-axis",
    y: "twist (forearm rotates)",
    z: "- bends the elbow",
    hint: "Elbow bend is NEGATIVE Z. Avoid large Y here - it couples with the bend.",
  },
  LeftForeArm: {
    x: "minor / off-axis",
    y: "twist (forearm rotates)",
    z: "+ bends the elbow",
  },
  RightHand: {
    x: "wrist nods up / down",
    y: "PALM DIRECTION (twist)",
    z: "wrist tilts side to side",
    hint: "Palm orientation lives on Y here, not on the forearm.",
  },
  LeftHand: {
    x: "wrist nods up / down",
    y: "PALM DIRECTION (twist)",
    z: "wrist tilts side to side",
  },
};

/**
 * Named, meaningful rotations - so a sign can be described as
 * "RIGHT_ARM_OUT" rather than a magic number whose axis nobody remembers.
 * Values are radians, applied as offsets from the neutral standing pose.
 */
export const POSE_VOCAB = {
  RIGHT_ARM_OUT_SMALL: { bone: "RightUpperArm" as CanonicalBone, euler: [0, 0, -0.6] },
  RIGHT_ARM_OUT: { bone: "RightUpperArm" as CanonicalBone, euler: [0, 0, -0.85] },
  RIGHT_ARM_UP: { bone: "RightUpperArm" as CanonicalBone, euler: [0.25, 0, -1.45] },
  RIGHT_ARM_FORWARD: { bone: "RightUpperArm" as CanonicalBone, euler: [1.0, 0, -0.3] },
  RIGHT_ELBOW_BENT: { bone: "RightForeArm" as CanonicalBone, euler: [0, 0, -1.6] },
  RIGHT_ELBOW_TIGHT: { bone: "RightForeArm" as CanonicalBone, euler: [0, 0, -1.95] },
  RIGHT_PALM_FORWARD: { bone: "RightHand" as CanonicalBone, euler: [0, 1.96, 0] },
} as const;
