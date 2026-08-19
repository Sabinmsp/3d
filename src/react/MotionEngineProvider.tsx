"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { MotionEngine, type EngineState } from "@/motion/MotionEngine";
import { LocalJsonMotionProvider } from "@/motion/providers/LocalJsonMotionProvider";
import { FallbackMotionProvider } from "@/motion/providers/FallbackMotionProvider";
import { SignSparKProvider } from "@/motion/providers/SignSparKProvider";

/**
 * Owns the single MotionEngine instance and exposes it to the tree.
 *
 * Motion sources are a chain: the hand-authored animation library answers first,
 * and generative providers sit behind it. That ordering is deliberate - an
 * experimental model can never take down the path that already works, and a
 * disabled or unreachable model falls straight through.
 *
 * SignSparK is present but disabled; it needs a self-hosted GPU service and its
 * output mapping confirmed first. See SignSparKProvider.ts for the specifics.
 */

const MotionEngineContext = createContext<MotionEngine | null>(null);

export function MotionEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(
    () =>
      new MotionEngine(
        new FallbackMotionProvider([
          new LocalJsonMotionProvider(),
          new SignSparKProvider({ enabled: false }),
        ]),
      ),
    [],
  );

  useEffect(() => {
    void engine.loadAvailable();
  }, [engine]);

  return <MotionEngineContext.Provider value={engine}>{children}</MotionEngineContext.Provider>;
}

export function useMotionEngine(): MotionEngine {
  const engine = useContext(MotionEngineContext);
  if (!engine) throw new Error("useMotionEngine must be used inside <MotionEngineProvider>");
  return engine;
}

export function useEngineState(): EngineState {
  const engine = useMotionEngine();
  return useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);
}
