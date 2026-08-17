import type { Object3D } from "three";
import { CANONICAL_BONES, type CanonicalBone } from "./types";

/**
 * Bridges canonical bone names (used in motion data) to the actual node names in
 * a rigged GLB.
 *
 * Rig vendors disagree on naming: Mixamo exports "mixamorig:RightForeArm",
 * Ready Player Me exports "RightForeArm", VRM exports "rightLowerArm", Rigify
 * exports "forearm.R", Reallusion Character Creator (CC3/CC4, e.g. models
 * exported from CC/iClone) exports "CC_Base_R_Upperarm". Motion data should not
 * have to care, so each canonical bone lists the aliases we know about, most
 * specific first.
 */
const BONE_ALIASES: Record<CanonicalBone, string[]> = {
  Hips: ["Hips", "mixamorig:Hips", "hip", "pelvis", "CC_Base_Hip"],
  Spine: ["Spine", "mixamorig:Spine", "spine", "spine_01", "CC_Base_Spine01"],
  Chest: [
    "Spine2",
    "Spine1",
    "Chest",
    "UpperChest",
    "chest",
    "spine_03",
    "CC_Base_Spine02",
  ],
  Neck: ["Neck", "mixamorig:Neck", "neck", "CC_Base_NeckTwist01"],
  Head: ["Head", "mixamorig:Head", "head", "CC_Base_Head"],

  LeftShoulder: [
    "LeftShoulder",
    "shoulder.L",
    "clavicle_l",
    "leftShoulder",
    "CC_Base_L_Clavicle",
  ],
  LeftUpperArm: [
    "LeftArm",
    "LeftUpperArm",
    "upper_arm.L",
    "upperarm_l",
    "leftUpperArm",
    "CC_Base_L_Upperarm",
  ],
  LeftForeArm: [
    "LeftForeArm",
    "LeftLowerArm",
    "forearm.L",
    "lowerarm_l",
    "leftLowerArm",
    "CC_Base_L_Forearm",
  ],
  LeftHand: ["LeftHand", "hand.L", "hand_l", "leftHand", "CC_Base_L_Hand"],

  RightShoulder: [
    "RightShoulder",
    "shoulder.R",
    "clavicle_r",
    "rightShoulder",
    "CC_Base_R_Clavicle",
  ],
  RightUpperArm: [
    "RightArm",
    "RightUpperArm",
    "upper_arm.R",
    "upperarm_r",
    "rightUpperArm",
    "CC_Base_R_Upperarm",
  ],
  RightForeArm: [
    "RightForeArm",
    "RightLowerArm",
    "forearm.R",
    "lowerarm_r",
    "rightLowerArm",
    "CC_Base_R_Forearm",
  ],
  RightHand: ["RightHand", "hand.R", "hand_r", "rightHand", "CC_Base_R_Hand"],
};

/** "mixamorig:RightForeArm" -> "mixamorigrightforearm" */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface BoneMatch {
  canonical: CanonicalBone;
  /** The node name as it exists in the model. */
  nodeName: string;
  node: Object3D;
  /** How confident the match is - exact alias hit, or a prefixed/suffixed variant. */
  how: "exact" | "suffix";
}

export interface BoneMapResult {
  matched: BoneMatch[];
  /** Canonical bones we could not find in this skeleton. */
  missing: CanonicalBone[];
  /** Every node name we considered, for debugging an unfamiliar rig. */
  candidateNames: string[];
}

/**
 * Walk a loaded model and match its nodes to canonical bone names.
 *
 * Works on any Object3D hierarchy, not just THREE.Bone, because Bone extends
 * Object3D. That is deliberate: the placeholder avatar is built from plain
 * groups and binds through exactly the same code path as a real skinned GLB.
 */
export function mapSkeleton(root: Object3D): BoneMapResult {
  const byNormalized = new Map<string, Object3D>();
  const candidateNames: string[] = [];

  root.traverse((node) => {
    if (!node.name) return;
    candidateNames.push(node.name);
    const key = normalize(node.name);
    // First occurrence wins - rigs sometimes duplicate names between the
    // skeleton and a mesh that shadows it.
    if (!byNormalized.has(key)) byNormalized.set(key, node);
  });

  const matched: BoneMatch[] = [];
  const missing: CanonicalBone[] = [];
  const claimed = new Set<Object3D>();

  // Two passes so that exact hits claim their node before the looser suffix
  // pass runs. Without this, a fuzzy match could steal a bone that a later
  // canonical name would have matched exactly.
  const pending = new Set<CanonicalBone>(CANONICAL_BONES);

  for (const canonical of CANONICAL_BONES) {
    for (const alias of BONE_ALIASES[canonical]) {
      const node = byNormalized.get(normalize(alias));
      if (node && !claimed.has(node)) {
        matched.push({ canonical, nodeName: node.name, node, how: "exact" });
        claimed.add(node);
        pending.delete(canonical);
        break;
      }
    }
  }

  for (const canonical of pending) {
    let found: Object3D | undefined;
    for (const alias of BONE_ALIASES[canonical]) {
      const target = normalize(alias);
      for (const [key, node] of byNormalized) {
        // Suffix rather than substring: rig prefixes ("mixamorig:", "Armature|")
        // are common, and a substring test would let "RightArm" match
        // "RightArmTwist".
        if (key.endsWith(target) && !claimed.has(node)) {
          found = node;
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      matched.push({ canonical, nodeName: found.name, node: found, how: "suffix" });
      claimed.add(found);
    } else {
      missing.push(canonical);
    }
  }

  return { matched, missing, candidateNames };
}
