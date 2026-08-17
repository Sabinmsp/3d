"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { MotionEngineProvider } from "@/react/MotionEngineProvider";
import { MotionPanel } from "./MotionPanel";
import type { AvatarSource } from "./AvatarStage";

// WebGL has nothing to render on the server.
const AvatarStage = dynamic(() => import("./AvatarStage").then((m) => m.AvatarStage), {
  ssr: false,
  loading: () => <div className="stage-loading">Loading 3D scene...</div>,
});

export function App() {
  const [avatarSource, setAvatarSource] = useState<AvatarSource>("checking");
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleSourceChange = useCallback((source: AvatarSource, error: string | null) => {
    setAvatarSource(source);
    setAvatarError(error);
  }, []);

  return (
    <MotionEngineProvider>
      <main className="layout">
        <MotionPanel avatarSource={avatarSource} avatarError={avatarError} />
        <section className="stage">
          <AvatarStage onSourceChange={handleSourceChange} />
          <p className="hint-overlay">Drag to orbit &middot; scroll to zoom</p>
        </section>
      </main>
    </MotionEngineProvider>
  );
}
