import { Quaternion, type Object3D } from "three";
import { mapSkeleton, type BoneMatch } from "./boneMap";
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

    for (const match of result.matched) {
      this.bones.set(match.canonical, {
        canonical: match.canonical,
        nodeName: match.nodeName,
        node: match.node,
        restQuaternion: match.node.quaternion.clone(),
      });
    }

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
