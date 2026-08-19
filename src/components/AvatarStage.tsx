"use client";

import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PlaceholderAvatar } from "./PlaceholderAvatar";
import { AVATAR_URL } from "@/avatarConfig";
import { useMotionEngine } from "@/react/MotionEngineProvider";

/**
 * The Three.js half of the app: renderer, camera, lights, and whichever avatar
 * is available. Loaded client-side only - there is nothing to server-render.
 */

// Kept out of the main bundle so nothing requests the .glb until we know it exists.
const GltfAvatar = dynamic(() => import("./GltfAvatar").then((m) => m.GltfAvatar), {
  ssr: false,
});

export type AvatarSource = "checking" | "glb" | "placeholder";

/**
 * Forced to the placeholder stick figure for now - no .glb fetch, no load wait.
 * Flip FORCE_PLACEHOLDER back to false to resume probing for avatar.glb.
 */
const FORCE_PLACEHOLDER = true;

function useAvatarSource(): AvatarSource {
  const [source, setSource] = useState<AvatarSource>(FORCE_PLACEHOLDER ? "placeholder" : "checking");

  useEffect(() => {
    if (FORCE_PLACEHOLDER) return;
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

export function AvatarStage() {
  const source = useAvatarSource();
  const [, setLoadError] = useState<string | null>(null);

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
