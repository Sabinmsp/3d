"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { MotionEngine, type EngineState } from "@/motion/MotionEngine";
import { LocalJsonMotionProvider } from "@/motion/providers/LocalJsonMotionProvider";

/**
 * Owns the single MotionEngine instance and exposes it to the tree.
 *
 * Swapping the data source for the real project is a one-line change here -
 * replace LocalJsonMotionProvider with a model-backed provider.
 */

const MotionEngineContext = createContext<MotionEngine | null>(null);

export function MotionEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => new MotionEngine(new LocalJsonMotionProvider()), []);

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
