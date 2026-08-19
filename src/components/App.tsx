"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MotionEngineProvider } from "@/react/MotionEngineProvider";
import { MotionPanel } from "./MotionPanel";
import { CaptionBar } from "./CaptionBar";

// WebGL has nothing to render on the server.
const AvatarStage = dynamic(() => import("./AvatarStage").then((m) => m.AvatarStage), {
  ssr: false,
  loading: () => <div className="stage-loading">Loading...</div>,
});

export function App() {
  const [captions, setCaptions] = useState(true);

  return (
    <MotionEngineProvider>
      <main className="layout">
        <MotionPanel captions={captions} onCaptionsChange={setCaptions} />
        <section className="stage">
          <AvatarStage />
          {captions && <CaptionBar />}
        </section>
      </main>
    </MotionEngineProvider>
  );
}
