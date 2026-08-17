"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { AVATAR_URL, TARGET_HEIGHT } from "@/avatarConfig";
import { useMotionEngine } from "@/react/MotionEngineProvider";

/**
 * Loads the real rigged avatar and hands its skeleton to the motion engine.
 *
 * Note how little there is here: the GLB path and the placeholder path both just
 * call `engine.attachRig(root)`. Bone naming, rest poses and interpolation are
 * all handled below the React layer.
 */
export function GltfAvatar() {
  const engine = useMotionEngine();
  const { scene } = useGLTF(AVATAR_URL);

  // Fit the model to the camera framing without touching its local transforms -
  // the wrapper group carries the scale, so bone rest rotations stay untouched.
  const { scale, yOffset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const fitted = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
    return { scale: fitted, yOffset: -box.min.y * fitted };
  }, [scene]);

  useEffect(() => {
    scene.traverse((node) => {
      node.castShadow = true;
    });
    engine.attachRig(scene);
    return () => engine.attachRig(null);
  }, [engine, scene]);

  return (
    <group name="GltfAvatarRoot" scale={scale} position={[0, yOffset, 0]}>
      <primitive object={scene} />
    </group>
  );
}
