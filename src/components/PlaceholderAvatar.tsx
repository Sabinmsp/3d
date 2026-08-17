"use client";

import { useEffect, useRef } from "react";
import type { Group } from "three";
import { useMotionEngine } from "@/react/MotionEngineProvider";

/**
 * A stand-in rigged figure, used until a real .glb is dropped into
 * /public/models/avatar.glb.
 *
 * Two things make this a genuine test of the pipeline rather than a cartoon:
 *
 * 1. Node names follow the Mixamo convention ("mixamorig:RightForeArm"), so the
 *    bone resolver in boneMap.ts does the same aliasing work it will do for a
 *    real download.
 * 2. Joints are nested exactly like a skeleton, with each limb extending along
 *    its own local +Y axis. THREE.Bone extends Object3D, so the animation
 *    controller cannot tell the difference between these groups and real bones.
 *
 * Rest pose is a T-pose facing +Z. The character's right side is world -X.
 */

const SKIN = "#94a3b8";
const BODY = "#64748b";
/** The limb the test motion drives - tinted so movement is obvious. */
const ACTIVE = "#38bdf8";

export function PlaceholderAvatar() {
  const engine = useMotionEngine();
  const rootRef = useRef<Group>(null);

  useEffect(() => {
    engine.attachRig(rootRef.current);
    return () => engine.attachRig(null);
  }, [engine]);

  return (
    <group ref={rootRef} name="PlaceholderAvatarRoot">
      <group name="mixamorig:Hips" position={[0, 0.92, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.3, 0.18, 0.18]} />
          <meshStandardMaterial color={BODY} />
        </mesh>

        <group name="mixamorig:Spine" position={[0, 0.1, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.34, 0.42, 0.2]} />
            <meshStandardMaterial color={BODY} />
          </mesh>

          <group name="mixamorig:Spine2" position={[0, 0.4, 0]}>
            <group name="mixamorig:Neck" position={[0, 0.06, 0]}>
              <mesh position={[0, 0.04, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.05, 0.08, 12]} />
                <meshStandardMaterial color={SKIN} />
              </mesh>

              <group name="mixamorig:Head" position={[0, 0.08, 0]}>
                <mesh position={[0, 0.11, 0]} castShadow>
                  <sphereGeometry args={[0.115, 24, 16]} />
                  <meshStandardMaterial color={SKIN} />
                </mesh>
                {/* Nose - marks which way the figure faces. */}
                <mesh position={[0, 0.1, 0.11]} castShadow>
                  <boxGeometry args={[0.03, 0.03, 0.05]} />
                  <meshStandardMaterial color={SKIN} />
                </mesh>
              </group>
            </group>

            {/* Right arm: rotate +90deg about Z so local +Y points along world -X. */}
            <group name="mixamorig:RightShoulder" position={[-0.07, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
              <group name="mixamorig:RightArm" position={[0, 0.11, 0]}>
                <mesh position={[0, 0.14, 0]} castShadow>
                  <capsuleGeometry args={[0.05, 0.18, 6, 12]} />
                  <meshStandardMaterial color={ACTIVE} />
                </mesh>

                <group name="mixamorig:RightForeArm" position={[0, 0.28, 0]}>
                  <mesh position={[0, 0.125, 0]} castShadow>
                    <capsuleGeometry args={[0.045, 0.16, 6, 12]} />
                    <meshStandardMaterial color={ACTIVE} />
                  </mesh>

                  <group name="mixamorig:RightHand" position={[0, 0.25, 0]}>
                    {/* Palm: thin along local X (world up in T-pose). */}
                    <mesh position={[0, 0.055, 0]} castShadow>
                      <boxGeometry args={[0.032, 0.11, 0.085]} />
                      <meshStandardMaterial color={ACTIVE} />
                    </mesh>
                    {/* Thumb - gives the hand a readable orientation while waving. */}
                    <mesh position={[0, 0.03, 0.055]} castShadow>
                      <boxGeometry args={[0.028, 0.06, 0.028]} />
                      <meshStandardMaterial color={ACTIVE} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>

            {/* Left arm: mirrored, so local +Y points along world +X. */}
            <group name="mixamorig:LeftShoulder" position={[0.07, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <group name="mixamorig:LeftArm" position={[0, 0.11, 0]}>
                <mesh position={[0, 0.14, 0]} castShadow>
                  <capsuleGeometry args={[0.05, 0.18, 6, 12]} />
                  <meshStandardMaterial color={SKIN} />
                </mesh>

                <group name="mixamorig:LeftForeArm" position={[0, 0.28, 0]}>
                  <mesh position={[0, 0.125, 0]} castShadow>
                    <capsuleGeometry args={[0.045, 0.16, 6, 12]} />
                    <meshStandardMaterial color={SKIN} />
                  </mesh>

                  <group name="mixamorig:LeftHand" position={[0, 0.25, 0]}>
                    <mesh position={[0, 0.055, 0]} castShadow>
                      <boxGeometry args={[0.032, 0.11, 0.085]} />
                      <meshStandardMaterial color={SKIN} />
                    </mesh>
                    <mesh position={[0, 0.03, 0.055]} castShadow>
                      <boxGeometry args={[0.028, 0.06, 0.028]} />
                      <meshStandardMaterial color={SKIN} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>

        {/* Legs: rotated 180deg about Z so local +Y points down the limb. */}
        <Leg side="Right" x={-0.09} />
        <Leg side="Left" x={0.09} />
      </group>
    </group>
  );
}

function Leg({ side, x }: { side: "Left" | "Right"; x: number }) {
  return (
    <group name={`mixamorig:${side}UpLeg`} position={[x, -0.09, 0]} rotation={[0, 0, Math.PI]}>
      <mesh position={[0, 0.19, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.26, 6, 12]} />
        <meshStandardMaterial color={BODY} />
      </mesh>

      <group name={`mixamorig:${side}Leg`} position={[0, 0.38, 0]}>
        <mesh position={[0, 0.19, 0]} castShadow>
          <capsuleGeometry args={[0.052, 0.26, 6, 12]} />
          <meshStandardMaterial color={BODY} />
        </mesh>

        <group name={`mixamorig:${side}Foot`} position={[0, 0.38, 0]}>
          <mesh position={[0, 0.035, 0.07]} castShadow>
            <boxGeometry args={[0.1, 0.07, 0.22]} />
            <meshStandardMaterial color={BODY} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
