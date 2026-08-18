"use client";

import { useCallback, useState } from "react";
import { Euler, Quaternion } from "three";
import { useMotionEngine } from "@/react/MotionEngineProvider";
import { AXIS_MEANINGS } from "@/motion/rigCalibration";
import type { CanonicalBone } from "@/motion/types";

/**
 * Development-only rig calibration tool.
 *
 * Which local axis bends a joint, and in which direction, differs per rig and
 * cannot be read off the file. Guessing values and judging by eye is how the
 * sign clips ended up with rotations that folded the arm through the torso.
 * This panel replaces guessing with measurement: isolate one bone, rotate one
 * axis by a known amount, and read what that axis actually does.
 *
 * Rotations are applied exactly as playback applies them - `rest * offset`,
 * absolutely, never accumulated - so values found here transfer directly into a
 * clip. The rest pose is never overwritten.
 */

const TESTABLE: CanonicalBone[] = [
  "RightShoulder",
  "RightUpperArm",
  "RightForeArm",
  "RightHand",
  "RightIndex1",
  "LeftShoulder",
  "LeftUpperArm",
  "LeftForeArm",
  "LeftHand",
];

const DEG = Math.PI / 180;
const fmtQ = (q: Quaternion) =>
  `${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}, ${q.w.toFixed(2)}`;

export function BoneTester() {
  const engine = useMotionEngine();
  const [bone, setBone] = useState<CanonicalBone>("RightUpperArm");
  const [angles, setAngles] = useState({ x: 0, y: 0, z: 0 });
  const [showAxes, setShowAxes] = useState(false);

  const bound = engine.getRig()?.get(bone);
  const meaning = AXIS_MEANINGS[bone];

  const apply = useCallback(
    (next: { x: number; y: number; z: number }) => {
      const b = engine.getRig()?.get(bone);
      if (!b) return;
      const offset = new Quaternion().setFromEuler(
        new Euler(next.x * DEG, next.y * DEG, next.z * DEG, "XYZ"),
      );
      // rest * offset - never rest.set(), so the bind orientation survives.
      b.node.quaternion.copy(b.restQuaternion).multiply(offset);
    },
    [engine, bone],
  );

  const setAxis = (axis: "x" | "y" | "z", value: number) => {
    const next = { ...angles, [axis]: value };
    setAngles(next);
    apply(next);
  };

  const nudge = (axis: "x" | "y" | "z", by: number) =>
    setAxis(axis, Math.max(-90, Math.min(90, angles[axis] + by)));

  /** Put THIS bone back, leaving any other posing alone. */
  const resetBone = () => {
    setAngles({ x: 0, y: 0, z: 0 });
    const b = engine.getRig()?.get(bone);
    if (b) b.node.quaternion.copy(b.restQuaternion);
  };

  const resetAll = () => {
    setAngles({ x: 0, y: 0, z: 0 });
    engine.getRig()?.resetToRest();
  };

  const selectBone = (next: CanonicalBone) => {
    engine.getRig()?.resetToRest();
    setBone(next);
    setAngles({ x: 0, y: 0, z: 0 });
    if (showAxes) engine.setDebugBone(next);
  };

  const toggleAxes = (on: boolean) => {
    setShowAxes(on);
    engine.setDebugBone(on ? bone : null);
  };

  const runStep = (step: "neutral" | "upperArm" | "foreArm" | "hand" | "fingers") => {
    const rig = engine.getRig();
    if (!rig) return;
    rig.resetToRest();
    setAngles({ x: 0, y: 0, z: 0 });

    const pose = (name: CanonicalBone, x: number, y: number, z: number) => {
      const b = rig.get(name);
      if (!b) return;
      b.node.quaternion
        .copy(b.restQuaternion)
        .multiply(new Quaternion().setFromEuler(new Euler(x * DEG, y * DEG, z * DEG, "XYZ")));
    };

    if (step === "neutral") return;
    if (step === "upperArm") pose("RightUpperArm", 0, 0, -45);
    if (step === "foreArm") {
      pose("RightUpperArm", 0, 0, -45);
      pose("RightForeArm", 0, 0, -70);
    }
    if (step === "hand") {
      pose("RightUpperArm", 0, 0, -45);
      pose("RightForeArm", 0, 0, -70);
      pose("RightHand", 0, 0, -30);
    }
    if (step === "fingers") {
      pose("RightUpperArm", 0, 0, -45);
      pose("RightForeArm", 0, 0, -70);
      for (const digit of ["Index", "Middle", "Ring", "Pinky"] as const) {
        for (let j = 1; j <= 3; j++) pose(`Right${digit}${j}` as CanonicalBone, 0, 0, -70);
      }
    }
  };

  return (
    <details className="rig tester">
      <summary>Bone tester (dev)</summary>

      <select value={bone} onChange={(e) => selectBone(e.target.value as CanonicalBone)}>
        {TESTABLE.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <label className="check">
        <input type="checkbox" checked={showAxes} onChange={(e) => toggleAxes(e.target.checked)} />
        Show local axes (red=X, green=Y, blue=Z)
      </label>

      {meaning && (
        <div className="axis-key">
          <p>
            <b>X</b> {meaning.x}
          </p>
          <p>
            <b>Y</b> {meaning.y}
          </p>
          <p>
            <b>Z</b> {meaning.z}
          </p>
          {meaning.hint && <p className="axis-hint">{meaning.hint}</p>}
        </div>
      )}

      {(["x", "y", "z"] as const).map((axis) => (
        <label key={axis} className="slider">
          <span>
            {axis.toUpperCase()}
            <em>
              {angles[axis]}&deg; ({(angles[axis] * DEG).toFixed(2)} rad)
            </em>
          </span>
          <div className="nudge">
            <button type="button" className="chip" onClick={() => nudge(axis, -15)}>
              -
            </button>
            <input
              type="range"
              min={-90}
              max={90}
              step={1}
              value={angles[axis]}
              onChange={(e) => setAxis(axis, Number(e.target.value))}
            />
            <button type="button" className="chip" onClick={() => nudge(axis, 15)}>
              +
            </button>
          </div>
        </label>
      ))}

      <div className="steps">
        <button type="button" className="chip" onClick={resetBone}>
          Reset bone
        </button>
        <button type="button" className="chip" onClick={resetAll}>
          Reset full pose
        </button>
      </div>

      <dl className="bone-info">
        <dt>Model bone</dt>
        <dd>{bound?.nodeName ?? "-"}</dd>
        <dt>Parent</dt>
        <dd>{bound?.node.parent?.name ?? "-"}</dd>
        <dt>Rest quat</dt>
        <dd>{bound ? fmtQ(bound.restQuaternion) : "-"}</dd>
        <dt>Current quat</dt>
        <dd>{bound ? fmtQ(bound.node.quaternion) : "-"}</dd>
      </dl>

      <p className="hint">Staged check - run in order; each step resets first.</p>
      <div className="steps">
        {(
          [
            ["1. Neutral", "neutral"],
            ["2. Upper arm", "upperArm"],
            ["3. Forearm", "foreArm"],
            ["4. Hand", "hand"],
            ["5. Fingers", "fingers"],
          ] as const
        ).map(([label, step]) => (
          <button key={step} type="button" className="chip" onClick={() => runStep(step)}>
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}
