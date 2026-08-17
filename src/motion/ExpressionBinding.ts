import type { Object3D } from "three";
import { mapExpressions, type MorphTarget } from "./expressionMap";
import type { CanonicalExpression } from "./types";

export interface ExpressionReport {
  bound: { canonical: CanonicalExpression; targetNames: string[] }[];
  missing: CanonicalExpression[];
  totalTargets: number;
}

/**
 * A resolved link between canonical expression names and a specific loaded
 * model's morph targets - the facial equivalent of RigBinding.
 *
 * Morph weights are absolute (0..1), not offsets from rest, so unlike
 * RigBinding there is no rest value to capture - "reset" just means "set every
 * bound target back to 0".
 */
export class ExpressionBinding {
  private readonly expressions = new Map<CanonicalExpression, MorphTarget[]>();
  readonly report: ExpressionReport;

  constructor(root: Object3D) {
    const result = mapExpressions(root);

    for (const match of result.matched) {
      this.expressions.set(match.canonical, match.targets);
    }

    this.report = {
      bound: result.matched.map((m) => ({ canonical: m.canonical, targetNames: m.targetNames })),
      missing: result.missing,
      totalTargets: result.totalTargets,
    };
  }

  has(expression: CanonicalExpression): boolean {
    return this.expressions.has(expression);
  }

  set(expression: CanonicalExpression, weight: number): void {
    const targets = this.expressions.get(expression);
    if (!targets) return;
    for (const { mesh, index } of targets) {
      mesh.morphTargetInfluences![index] = weight;
    }
  }

  /** Zero every bound morph target - the facial equivalent of resetToRest(). */
  resetToNeutral(): void {
    for (const targets of this.expressions.values()) {
      for (const { mesh, index } of targets) {
        mesh.morphTargetInfluences![index] = 0;
      }
    }
  }
}
