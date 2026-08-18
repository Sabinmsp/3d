import { Quaternion, Vector3, type Object3D } from "three";
import type { CanonicalBone } from "./types";

/**
 * The signer's resting posture: standing relaxed, arms down at the sides.
 *
 * Rigged humans are almost always exported in a T-pose, because that is what is
 * convenient for skinning - not because anyone stands like that. Since motion
 * data is stored as offsets from the model's rest pose, a bone that a clip does
 * not animate stays exactly where the exporter left it. The result was an avatar
 * signing with one arm while the other stuck straight out sideways, which reads
 * as broken no matter how good the sign is.
 *
 * The arms are posed by AIMING them, not by hardcoded Euler angles. Which local
 * axis rotates a joint which way differs per rig and is not knowable from the
 * file - the first attempt here assumed "+Z lowers the right arm" and barely
 * moved it, because this rig's arm bone runs along local +Y with a non-trivial
 * rest rotation. Aiming sidesteps that entirely: measure the direction the bone
 * actually points, and rotate it to point where we want. That works on any rig.
 */

/** Where each arm bone should point, in world space. Y is up, +Z is forward. */
const ARM_TARGETS: Partial<Record<CanonicalBone, [number, number, number]>> = {
  // Slightly away from the torso so the arms do not intersect the body.
  RightUpperArm: [0.2, -1, 0.02],
  // A real relaxed arm carries a slight elbow bend, angled a little forward.
  RightForeArm: [0.13, -1, 0.16],
  LeftUpperArm: [-0.2, -1, 0.02],
  LeftForeArm: [-0.13, -1, 0.16],
};

/** A resting hand is softly curled, not flat. Matches the RELAXED handshape. */
const RESTING_CURL: Record<string, [number, number, number]> = {
  Thumb: [0.2, 0.15, 0.1],
  Index: [0.25, 0.3, 0.2],
  Middle: [0.3, 0.35, 0.25],
  Ring: [0.35, 0.4, 0.3],
  Pinky: [0.4, 0.45, 0.3],
};

/** Euler-based part of the neutral pose - fingers only, where axes are consistent. */
export const NEUTRAL_FINGER_POSE: Partial<Record<CanonicalBone, [number, number, number]>> = {};
for (const side of ["Right", "Left"] as const) {
  for (const [digit, curls] of Object.entries(RESTING_CURL)) {
    curls.forEach((curl, i) => {
      NEUTRAL_FINGER_POSE[`${side}${digit}${i + 1}` as CanonicalBone] = [0, 0, -curl];
    });
  }
}

/** Bones the neutral posture aims. Order matters: parents before children. */
export const AIMED_BONES: CanonicalBone[] = [
  "RightUpperArm",
  "RightForeArm",
  "LeftUpperArm",
  "LeftForeArm",
];

/**
 * Rotate `node` so the bone points along `targetWorldDir`.
 *
 * The bone's own direction is read from where its first child sits, rather than
 * assumed - that is the measurement that makes this rig-agnostic.
 */
export function aimBone(node: Object3D, targetWorldDir: [number, number, number]): Quaternion {
  const child = node.children.find((c) => (c as { isBone?: boolean }).isBone) ?? node.children[0];
  const dirLocal = child
    ? child.position.clone().normalize()
    : new Vector3(0, 1, 0);

  const parentWorld = new Quaternion();
  node.parent?.getWorldQuaternion(parentWorld);

  const targetInParent = new Vector3(...targetWorldDir)
    .normalize()
    .applyQuaternion(parentWorld.invert());

  return new Quaternion().setFromUnitVectors(dirLocal, targetInParent);
}

export function neutralTargetFor(bone: CanonicalBone): [number, number, number] | undefined {
  return ARM_TARGETS[bone];
}
