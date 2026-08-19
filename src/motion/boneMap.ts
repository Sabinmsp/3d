import type { Object3D } from "three";
import { CANONICAL_BONES, type CanonicalBone } from "./types";

/**
 * Bridges canonical bone names (used in motion data) to the actual node names in
 * a rigged GLB.
 *
 * Rig vendors disagree on naming: Mixamo exports "mixamorig:RightForeArm",
 * Ready Player Me exports "RightForeArm", VRM exports "rightLowerArm", Rigify
 * exports "forearm.R", Auto-Rig Pro exports "forearm_stretch.r", Reallusion
 * Character Creator (CC3/CC4, e.g. models
 * exported from CC/iClone) exports "CC_Base_R_Upperarm". Motion data should not
 * have to care, so each canonical bone lists the aliases we know about, most
 * specific first.
 */
// Cast rather than annotate: the finger entries are generated, so TypeScript
// cannot see that every canonical key is present. isCanonicalBone() and the
// CANONICAL_BONES list remain the source of truth for what must exist.
const BONE_ALIASES = {
  Hips: ["root.x", "Hips", "mixamorig:Hips", "hip", "pelvis", "CC_Base_Hip"],
  Spine: ["spine_01.x", "Spine", "mixamorig:Spine", "spine", "spine_01", "CC_Base_Spine01"],
  Chest: [
    "spine_03.x", "spine_02.x", "Spine2",
    "Spine1",
    "Chest",
    "UpperChest",
    "chest",
    "spine_03",
    "CC_Base_Spine02",
  ],
  Neck: ["neck.x", "Neck", "mixamorig:Neck", "neck", "CC_Base_NeckTwist01"],
  Head: ["head.x", "Head", "mixamorig:Head", "head", "CC_Base_Head"],

  LeftShoulder: [
    "shoulder.l", "LeftShoulder",
    "shoulder.L",
    "clavicle_l",
    "leftShoulder",
    "CC_Base_L_Clavicle",
  ],
  LeftUpperArm: [
    "arm_stretch.l", "LeftArm",
    "LeftUpperArm",
    "upper_arm.L",
    "upperarm_l",
    "leftUpperArm",
    "CC_Base_L_Upperarm",
  ],
  LeftForeArm: [
    "forearm_stretch.l", "LeftForeArm",
    "LeftLowerArm",
    "forearm.L",
    "lowerarm_l",
    "leftLowerArm",
    "CC_Base_L_Forearm",
  ],
  LeftHand: ["hand.l", "LeftHand", "hand.L", "hand_l", "leftHand", "CC_Base_L_Hand"],

  RightShoulder: [
    "shoulder.r", "RightShoulder",
    "shoulder.R",
    "clavicle_r",
    "rightShoulder",
    "CC_Base_R_Clavicle",
  ],
  RightUpperArm: [
    "arm_stretch.r", "RightArm",
    "RightUpperArm",
    "upper_arm.R",
    "upperarm_r",
    "rightUpperArm",
    "CC_Base_R_Upperarm",
  ],
  RightForeArm: [
    "forearm_stretch.r", "RightForeArm",
    "RightLowerArm",
    "forearm.R",
    "lowerarm_r",
    "rightLowerArm",
    "CC_Base_R_Forearm",
  ],
  RightHand: ["hand.r", "RightHand", "hand.R", "hand_r", "rightHand", "CC_Base_R_Hand"],

  ...fingerAliases(),
} as Record<CanonicalBone, string[]>;

/**
 * Finger aliases for both hands, generated rather than written out 30 times.
 *
 * Conventions differ in the digit's name (Mid vs Middle) and in whether the
 * hand is part of the bone name (Mixamo's "RightHandIndex1" vs Character
 * Creator's "CC_Base_R_Index1"), but all of them number joints outward from the
 * palm the same way.
 */
function fingerAliases(): Record<string, string[]> {
  const digits: [canonical: string, cc: string, mixamo: string, arp: string][] = [
    ["Thumb", "Thumb", "Thumb", "thumb"],
    ["Index", "Index", "Index", "index"],
    // Character Creator abbreviates the middle finger; Auto-Rig Pro does not.
    ["Middle", "Mid", "Middle", "middle"],
    ["Ring", "Ring", "Ring", "ring"],
    ["Pinky", "Pinky", "Pinky", "pinky"],
  ];

  const out: Record<string, string[]> = {};
  for (const side of ["Right", "Left"] as const) {
    const s = side === "Right" ? "R" : "L";
    for (const [canonical, cc, mixamo, arp] of digits) {
      for (const joint of [1, 2, 3]) {
        out[`${side}${canonical}${joint}`] = [
          // Auto-Rig Pro: first joint is bare, later joints carry a c_ prefix.
          joint === 1 ? `${arp}1.${s}` : `c_${arp}${joint}.${s}`,
          `${side}Hand${mixamo}${joint}`, // Mixamo / Ready Player Me
          `CC_Base_${s}_${cc}${joint}`, // Character Creator
          `${cc.toLowerCase()}.0${joint}.${s}`, // Rigify (f_index.01.R)
          `f_${cc.toLowerCase()}.0${joint}.${s}`,
          `${side.toLowerCase()}${canonical}${jointWord(joint)}`, // VRM
        ];
      }
    }
  }
  return out;
}

function jointWord(joint: number): string {
  return joint === 1 ? "Proximal" : joint === 2 ? "Intermediate" : "Distal";
}

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
