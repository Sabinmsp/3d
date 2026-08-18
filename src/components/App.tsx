"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { MotionEngineProvider } from "@/react/MotionEngineProvider";
import { MotionPanel } from "./MotionPanel";
import { CaptionBar } from "./CaptionBar";
import type { AvatarSource } from "./AvatarStage";

// WebGL has nothing to render on the server.
const AvatarStage = dynamic(() => import("./AvatarStage").then((m) => m.AvatarStage), {
  ssr: false,
  loading: () => <div className="stage-loading">Loading 3D scene...</div>,
});

export function App() {
  const [avatarSource, setAvatarSource] = useState<AvatarSource>("checking");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [captions, setCaptions] = useState(true);
  const [skeleton, setSkeleton] = useState(false);

  const handleSourceChange = useCallback((source: AvatarSource, error: string | null) => {
    setAvatarSource(source);
    setAvatarError(error);
  }, []);

  return (
    <MotionEngineProvider>
      <main className="layout">
        <MotionPanel
          avatarSource={avatarSource}
          avatarError={avatarError}
          captions={captions}
          onCaptionsChange={setCaptions}
          skeleton={skeleton}
          onSkeletonChange={setSkeleton}
        />
        <section className="stage">
          <AvatarStage onSourceChange={handleSourceChange} showSkeleton={skeleton} />
          {captions && <CaptionBar />}
          <p className="hint-overlay">Drag to orbit &middot; scroll to zoom</p>
        </section>
      </main>
    </MotionEngineProvider>
  );
}
