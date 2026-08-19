import type { CanonicalBone } from "../types";

/**
 * SMPL-X / MANO -> our canonical bone names.
 *
 * This is the conversion layer that any research motion model needs before its
 * output can drive our avatar. Models in this space (SignSparK, SignAvatars,
 * and essentially all recent sign-language-production work) emit parametric body
 * model parameters, not named bone rotations for a specific rig:
 *
 *   SMPL-X  - body, indexed joints, 6D or axis-angle rotations
 *   MANO    - hands, 15 joints per hand
 *   FLAME   - face, expression coefficients
 *
 * None of those are "RightUpperArm". Without this mapping, model output cannot
 * reach the avatar at all.
 *
 * IMPORTANT - what is verified here and what is not:
 *
 *  - MANO's 15-joint-per-hand ordering below is the standard published order and
 *    is stable across implementations.
 *  - The SMPL-X body indices below are the standard full-body SMPL-X joint
 *    order. SignSparK's paper describes regressing an UPPER-BODY subset of
 *    "10 joints", and does not state which 10 or in what order. That subset must
 *    be confirmed against real checkpoint output before it can be trusted -
 *    see UPPER_BODY_SUBSET_UNVERIFIED below.
 */

/** Standard SMPL-X body joint indices, for the joints we can drive. */
export const SMPLX_BODY_JOINTS: Record<number, CanonicalBone> = {
  0: "Hips",
  3: "Spine",
  6: "Chest",
  12: "Neck",
  15: "Head",
  16: "LeftShoulder",
  17: "RightShoulder",
  18: "LeftUpperArm", // left_elbow drives the upper arm segment above it
  19: "RightUpperArm",
  20: "LeftForeArm", // left_wrist drives the forearm segment
  21: "RightForeArm",
};

/**
 * Standard MANO joint order, per hand. Index 0 of each triple is the knuckle.
 * Note MANO orders the digits index, middle, pinky, ring, thumb - pinky before
 * ring, which is a common source of silently swapped fingers.
 */
export const MANO_JOINT_ORDER = [
  "Index1",
  "Index2",
  "Index3",
  "Middle1",
  "Middle2",
  "Middle3",
  "Pinky1",
  "Pinky2",
  "Pinky3",
  "Ring1",
  "Ring2",
  "Ring3",
  "Thumb1",
  "Thumb2",
  "Thumb3",
] as const;

export function manoBone(side: "Left" | "Right", jointIndex: number): CanonicalBone | undefined {
  const suffix = MANO_JOINT_ORDER[jointIndex];
  return suffix ? (`${side}${suffix}` as CanonicalBone) : undefined;
}

/**
 * Set to true only once a real SignSparK checkpoint's output has been inspected
 * and the upper-body joint subset confirmed. Until then any retarget attempt
 * should refuse rather than silently animate the wrong joints - the failure mode
 * of guessing here is an avatar that signs confidently and wrongly.
 */
export const UPPER_BODY_SUBSET_UNVERIFIED = true;

/**
 * A single frame of parametric-model motion, as a research model would emit it.
 * Rotations are 6D or axis-angle depending on the model; conversion to
 * quaternions happens in the retargeter, not here.
 */
export interface SmplxFrame {
  time: number;
  /** jointIndex -> rotation, in whatever representation `rotationFormat` says. */
  body: Record<number, number[]>;
  leftHand?: Record<number, number[]>;
  rightHand?: Record<number, number[]>;
}

export interface SmplxMotion {
  fps: number;
  rotationFormat: "axis-angle" | "6d" | "quaternion";
  frames: SmplxFrame[];
}
