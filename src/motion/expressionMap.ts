import type { Mesh, Object3D } from "three";
import { CANONICAL_EXPRESSIONS, type CanonicalExpression } from "./types";

/**
 * Bridges canonical expression names (used in motion data) onto a model's morph
 * targets / blend shapes - the facial equivalent of boneMap.ts.
 *
 * Unlike a bone, which is a single node, one canonical expression often needs to
 * drive TWO underlying targets at once (a symmetric "raise both eyebrows" maps
 * onto separate left/right blend shapes). So each canonical name resolves to
 * every matching target it finds, not just the first.
 *
 * Naming here follows what Reallusion Character Creator / iClone exports
 * ("Mouth_Smile_L") and what ARKit-style rigs use ("mouthSmileLeft"), since
 * those two conventions cover most rigged humans with a face.
 */
const EXPRESSION_ALIASES: Record<CanonicalExpression, string[]> = {
  BROW_RAISE: ["Brow_Raise_L", "Brow_Raise_R", "browInnerUp", "browOuterUpLeft", "browOuterUpRight"],
  BROW_DROP: ["Brow_Drop_L", "Brow_Drop_R", "browDownLeft", "browDownRight"],
  EYE_BLINK: ["Eye_Blink_L", "Eye_Blink_R", "Eye_Blink", "eyeBlinkLeft", "eyeBlinkRight"],
  EYE_WIDE: ["Eye_Wide_L", "Eye_Wide_R", "eyeWideLeft", "eyeWideRight"],
  MOUTH_SMILE: ["Mouth_Smile_L", "Mouth_Smile_R", "Mouth_Smile", "mouthSmileLeft", "mouthSmileRight"],
  MOUTH_FROWN: ["Mouth_Frown_L", "Mouth_Frown_R", "Mouth_Frown", "mouthFrownLeft", "mouthFrownRight"],
  MOUTH_OPEN: ["Mouth_Open", "Open", "jawOpen"],
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface MorphTarget {
  mesh: Mesh;
  index: number;
}

export interface ExpressionMatch {
  canonical: CanonicalExpression;
  targetNames: string[];
  targets: MorphTarget[];
}

export interface ExpressionMapResult {
  matched: ExpressionMatch[];
  missing: CanonicalExpression[];
  /** How many distinct morph target names were found across the whole model. */
  totalTargets: number;
}

/**
 * Walk a loaded model's meshes and match their morph targets to canonical
 * expression names. A model with no morph targets (most placeholder rigs, many
 * game-ready GLBs) simply returns everything as "missing" - expressions are
 * optional, the way any single unmatched bone is optional.
 */
export function mapExpressions(root: Object3D): ExpressionMapResult {
  // name -> every (mesh, index) pair across all primitives that expose it.
  // A model this size often splits one head into several skinned-mesh
  // primitives (hair, eyes, teeth, body) that all share the same target list.
  const byNormalized = new Map<string, MorphTarget[]>();
  let totalTargets = 0;

  root.traverse((node) => {
    const mesh = node as Mesh;
    const dict = mesh.morphTargetDictionary;
    if (!dict || !mesh.morphTargetInfluences) return;

    for (const [name, index] of Object.entries(dict)) {
      totalTargets++;
      const key = normalize(name);
      const list = byNormalized.get(key);
      if (list) list.push({ mesh, index });
      else byNormalized.set(key, [{ mesh, index }]);
    }
  });

  const matched: ExpressionMatch[] = [];
  const missing: CanonicalExpression[] = [];

  for (const canonical of CANONICAL_EXPRESSIONS) {
    const targets: MorphTarget[] = [];
    const targetNames: string[] = [];

    for (const alias of EXPRESSION_ALIASES[canonical]) {
      const found = byNormalized.get(normalize(alias));
      if (found) {
        targets.push(...found);
        targetNames.push(alias);
      }
    }

    if (targets.length > 0) {
      matched.push({ canonical, targetNames, targets });
    } else {
      missing.push(canonical);
    }
  }

  return { matched, missing, totalTargets };
}
