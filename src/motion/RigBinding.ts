import { Euler, Quaternion, type Object3D } from "three";
import { mapSkeleton, type BoneMatch } from "./boneMap";
import {
  AIMED_BONES,
  NEUTRAL_FINGER_POSE,
  aimBone,
  neutralTargetFor,
} from "./neutralPose";
import type { CanonicalBone } from "./types";

/**
 * A resolved link between canonical bone names and a specific loaded model.
 *
 * Also captures each bone's REST rotation at bind time. Motion data is stored as
 * an offset from rest, so playback is `rest * offset` - which is what makes a
 * clip authored against one avatar still readable on another.
 */
export interface BoundBone {
  canonical: CanonicalBone;
  nodeName: string;
  node: Object3D;
  restQuaternion: Quaternion;
}

export interface RigReport {
  bound: { canonical: CanonicalBone; nodeName: string; how: BoneMatch["how"] }[];
  missing: CanonicalBone[];
  totalNodes: number;
}

export class RigBinding {
  private readonly bones = new Map<CanonicalBone, BoundBone>();
  readonly report: RigReport;

  constructor(root: Object3D) {
    const result = mapSkeleton(root);
    const euler = new Euler();
    const offset = new Quaternion();

    for (const match of result.matched) {
      // Finger curl is a plain Euler offset - those axes are consistent enough
      // across rigs to hardcode.
      const curl = NEUTRAL_FINGER_POSE[match.canonical];
      const restQuaternion = match.node.quaternion.clone();

      if (curl) {
        euler.set(curl[0], curl[1], curl[2], "XYZ");
        offset.setFromEuler(euler);
        restQuaternion.multiply(offset);
      }

      this.bones.set(match.canonical, {
        canonical: match.canonical,
        nodeName: match.nodeName,
        node: match.node,
        restQuaternion,
      });
    }

    // Arms are AIMED rather than offset by fixed angles - see neutralPose.ts for
    // why. Parents first, and the world matrix is refreshed between joints so
    // each child aims from its parent's already-posed orientation.
    for (const bone of AIMED_BONES) {
      const bound = this.bones.get(bone);
      const target = neutralTargetFor(bone);
      if (!bound || !target) continue;

      bound.node.updateMatrixWorld(true);
      const aimed = aimBone(bound.node, target);
      bound.restQuaternion.copy(aimed);
      bound.node.quaternion.copy(aimed);
      bound.node.updateMatrixWorld(true);
    }

    // Drop the avatar into the neutral posture immediately, so it is standing
    // naturally before anything plays.
    this.resetToRest();

    this.report = {
      bound: result.matched.map((m) => ({
        canonical: m.canonical,
        nodeName: m.nodeName,
        how: m.how,
      })),
      missing: result.missing,
      totalNodes: result.candidateNames.length,
    };
  }

  get(bone: CanonicalBone): BoundBone | undefined {
    return this.bones.get(bone);
  }

  /** All bound bones - used by the dev console when calibrating a rig. */
  all(): BoundBone[] {
    return [...this.bones.values()];
  }

  has(bone: CanonicalBone): boolean {
    return this.bones.has(bone);
  }

  /** Snap every bound bone back to the pose the model shipped with. */
  resetToRest(): void {
    for (const bone of this.bones.values()) {
      bone.node.quaternion.copy(bone.restQuaternion);
    }
  }
}
