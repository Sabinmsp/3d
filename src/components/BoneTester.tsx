"use client";

import { useCallback, useState } from "react";
import { Euler, Quaternion } from "three";
import { useMotionEngine } from "@/react/MotionEngineProvider";
import type { CanonicalBone } from "@/motion/types";

/**
 * Development-only rig calibration tool.
 *
 * Which local axis bends a given joint, and in which direction, differs per rig
 * and cannot be read off the file. Guessing values and judging the result by eye
 * is how the sign clips ended up with rotations that fold the arm through the
 * torso. This panel replaces guessing with measurement: isolate one bone, rotate
 * it a known amount on one axis, and see exactly what that axis does.
 *
 * Rotations are applied the same way playback applies them - `rest * offset`,
 * absolutely, never accumulated - so what is measured here is what a clip gets.
 */

const TESTABLE: CanonicalBone[] = [
  "RightShoulder",
  "RightUpperArm",
  "RightForeArm",
  "RightHand",
  "LeftShoulder",
  "LeftUpperArm",
  "LeftForeArm",
  "LeftHand",
];

const DEG = Math.PI / 180;

export function BoneTester() {
  const engine = useMotionEngine();
  const [bone, setBone] = useState<CanonicalBone>("RightUpperArm");
  const [angles, setAngles] = useState({ x: 0, y: 0, z: 0 });

  const apply = useCallback(
    (next: { x: number; y: number; z: number }) => {
      const rig = engine.getRig();
      const bound = rig?.get(bone);
      if (!bound) return;

      // rest * offset - identical to MotionController.applyPose(), so the
      // numbers found here transfer directly into a clip's `bones` entry.
      const offset = new Quaternion().setFromEuler(
        new Euler(next.x * DEG, next.y * DEG, next.z * DEG, "XYZ"),
      );
      bound.node.quaternion.copy(bound.restQuaternion).multiply(offset);
    },
    [engine, bone],
  );

  const setAxis = (axis: "x" | "y" | "z", value: number) => {
    const next = { ...angles, [axis]: value };
    setAngles(next);
    apply(next);
  };

  const reset = () => {
    setAngles({ x: 0, y: 0, z: 0 });
    engine.getRig()?.resetToRest();
  };

  const selectBone = (next: CanonicalBone) => {
    // Put the previous bone back before moving on, so tests never stack.
    engine.getRig()?.resetToRest();
    setBone(next);
    setAngles({ x: 0, y: 0, z: 0 });
  };

  return (
    <details className="rig tester">
      <summary>Bone tester (dev)</summary>

      <p className="hint">
        Isolate one joint and rotate it a known amount. Values are radians in a
        clip: <code>{(angles.x * DEG).toFixed(2)}</code>,{" "}
        <code>{(angles.y * DEG).toFixed(2)}</code>,{" "}
        <code>{(angles.z * DEG).toFixed(2)}</code>
      </p>

      <select value={bone} onChange={(e) => selectBone(e.target.value as CanonicalBone)}>
        {TESTABLE.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      {(["x", "y", "z"] as const).map((axis) => (
        <label key={axis} className="slider">
          <span>
            {axis.toUpperCase()}
            <em>{angles[axis]}&deg;</em>
          </span>
          <input
            type="range"
            min={-90}
            max={90}
            step={1}
            value={angles[axis]}
            onChange={(e) => setAxis(axis, Number(e.target.value))}
          />
        </label>
      ))}

      <button type="button" className="ghost" onClick={reset}>
        RESET POSE
      </button>
    </details>
  );
}
