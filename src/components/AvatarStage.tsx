"use client";

import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { AxesHelper, SkeletonHelper, type Object3D } from "three";
import { PlaceholderAvatar } from "./PlaceholderAvatar";
import { AVATAR_URL } from "@/avatarConfig";
import { useEngineState, useMotionEngine } from "@/react/MotionEngineProvider";

/**
 * The Three.js half of the app: renderer, camera, lights, and whichever avatar
 * is available. Loaded client-side only - there is nothing to server-render.
 */

// Kept out of the main bundle so nothing requests the .glb until we know it exists.
const GltfAvatar = dynamic(() => import("./GltfAvatar").then((m) => m.GltfAvatar), {
  ssr: false,
});

export type AvatarSource = "checking" | "glb" | "placeholder";

/** Probe for a real avatar once, and fall back quietly when there isn't one. */
function useAvatarSource(): AvatarSource {
  const [source, setSource] = useState<AvatarSource>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch(AVATAR_URL, { method: "HEAD" })
      .then((response) => {
        if (!cancelled) setSource(response.ok ? "glb" : "placeholder");
      })
      .catch(() => {
        if (!cancelled) setSource("placeholder");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return source;
}

/** Drives the animation clock. One line, once per rendered frame. */
function MotionTicker() {
  const engine = useMotionEngine();
  useFrame((_, delta) => engine.update(delta));
  return null;
}

/**
 * Draws the live skeleton over the mesh, so a bad pose can be read as bones
 * rather than inferred from how the skin deforms.
 */
function SkeletonOverlay() {
  const engine = useMotionEngine();
  const { scene } = useThree();
  // Re-run once the rig actually binds - the avatar takes seconds to load, so
  // this effect would otherwise fire against an empty rig and never retry.
  const rigReport = useEngineState().rig;

  useEffect(() => {
    const rig = engine.getRig();
    const root = rig?.all()[0]?.node;
    if (!root) return;

    // Walk to the top of the skeleton so the helper covers the whole rig.
    let top: Object3D = root;
    while (top.parent && (top.parent as { isBone?: boolean }).isBone) top = top.parent;

    const helper = new SkeletonHelper(top);
    scene.add(helper);
    return () => {
      scene.remove(helper);
      helper.dispose();
    };
  }, [engine, scene, rigReport]);

  return null;
}

/** A malformed .glb should degrade to the placeholder, not blank the screen. */
class AvatarErrorBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Draws the selected bone's own X/Y/Z axes at its position, so the axis a
 * slider moves can be seen rather than inferred. Red=X, green=Y, blue=Z.
 */
function BoneAxes() {
  const engine = useMotionEngine();
  const state = useEngineState();
  const { scene } = useThree();

  useEffect(() => {
    const bone = state.debugBone;
    const bound = bone ? engine.getRig()?.get(bone) : null;
    if (!bound) return;

    const helper = new AxesHelper(0.18);
    // Parent to the bone itself so the axes follow it as it rotates.
    bound.node.add(helper);
    return () => {
      bound.node.remove(helper);
      helper.dispose();
    };
  }, [engine, scene, state.debugBone, state.rig]);

  return null;
}

export function AvatarStage({
  onSourceChange,
  showSkeleton = false,
}: {
  onSourceChange?: (source: AvatarSource, error: string | null) => void;
  showSkeleton?: boolean;
}) {
  const source = useAvatarSource();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onSourceChange?.(loadError ? "placeholder" : source, loadError);
  }, [source, loadError, onSourceChange]);

  return (
    <Canvas shadows camera={{ position: [0.4, 1.5, 2.8], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#0b1220"]} />

      <hemisphereLight args={["#dbeafe", "#0f172a", 1.1]} />
      <directionalLight
        position={[3, 5, 3]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />

      {/* Floor - gives the figure somewhere to stand and catches its shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[3, 48]} />
        <meshStandardMaterial color="#111c33" />
      </mesh>
      <gridHelper args={[6, 12, "#1e3a5f", "#16233d"]} position={[0, 0.001, 0]} />

      <Suspense fallback={null}>
        {source === "glb" ? (
          <AvatarErrorBoundary onError={setLoadError} fallback={<PlaceholderAvatar />}>
            <GltfAvatar />
          </AvatarErrorBoundary>
        ) : source === "placeholder" ? (
          <PlaceholderAvatar />
        ) : null}
      </Suspense>

      <MotionTicker />
      {showSkeleton && <SkeletonOverlay />}
      <BoneAxes />

      {/* Inspect the arm from any angle. */}
      <OrbitControls
        target={[0, 1.15, 0]}
        enableDamping
        minDistance={0.8}
        maxDistance={8}
        maxPolarAngle={Math.PI / 1.9}
      />
    </Canvas>
  );
}
