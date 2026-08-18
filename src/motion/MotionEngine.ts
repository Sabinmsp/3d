import type { Object3D } from "three";
import { compileClip, type CompiledClip } from "./compileClip";
import { ExpressionBinding, type ExpressionReport } from "./ExpressionBinding";
import { MotionController } from "./MotionController";
import { RigBinding, type RigReport } from "./RigBinding";
import {
  MotionNotFoundError,
  type MotionEntry,
  type MotionProvider,
} from "./providers/MotionProvider";
import { tokenizeGloss } from "./tokenize";
import type {
  CanonicalBone,
  CanonicalExpression,
  MotionStatus,
  ValidationStatus,
} from "./types";

/**
 * The public entry point: `engine.playText("HI")` or `engine.playText("how are you")`.
 *
 * Wires provider -> compiler -> controller -> rig, and exposes an observable
 * snapshot for the UI. Deliberately free of per-sign branching: adding FRIDAY
 * means adding FRIDAY.json, not editing this file.
 *
 * playText() only SPLITS input into tokens - "how are you" -> HOW, ARE, YOU -
 * each looked up independently and played in order. It does not translate
 * English into Auslan gloss. Real gloss (different word order, no function
 * words, spatial grammar) is a separate, much harder problem this proof of
 * concept does not attempt.
 */

export type EngineStatus = "idle" | "loading" | "playing" | "error";

/** One token's outcome within a played sequence, shown as a progress strip. */
export interface QueueItem {
  sign: string;
  status: "pending" | "playing" | "done" | "placeholder" | "missing" | "unplayable";
  /** Plain-English meaning, for captions. Absent until the clip has loaded. */
  meaning?: string;
  /** Whether this clip's linguistic content has been checked. Absent until loaded. */
  validation?: ValidationStatus;
}

export interface EngineState {
  status: EngineStatus;
  /** The sign currently loaded or playing. */
  currentSign: string | null;
  clipStatus: MotionStatus | null;
  clipNotes: string | null;
  /** Validation status of the clip currently playing. */
  clipValidation: ValidationStatus | null;
  error: string | null;
  rig: RigReport | null;
  face: ExpressionReport | null;
  /** Bones the loaded clip wants that this rig does not provide. */
  unmatchedBones: CanonicalBone[];
  /** Expressions the loaded clip wants that this model has no matching morph target for. */
  unmatchedExpressions: CanonicalExpression[];
  available: MotionEntry[];
  /** The full token sequence from the last playText() call, and progress through it. */
  queue: QueueItem[];
}

const INITIAL_STATE: EngineState = {
  status: "idle",
  currentSign: null,
  clipStatus: null,
  clipNotes: null,
  clipValidation: null,
  error: null,
  rig: null,
  face: null,
  unmatchedBones: [],
  unmatchedExpressions: [],
  available: [],
  queue: [],
};

type LoadResult =
  | { ok: true; clip: CompiledClip }
  | { ok: false; reason: "missing" | "error"; message: string };

export class MotionEngine {
  private readonly controller = new MotionController();
  private readonly compiled = new Map<string, CompiledClip>();
  private listeners = new Set<() => void>();
  private state: EngineState = INITIAL_STATE;
  /** Guards against a slow load, or the previous sequence, finishing after a newer request started. */
  private runToken = 0;

  constructor(private readonly provider: MotionProvider) {}

  // --- observable state (consumed by React via useSyncExternalStore) ---

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): EngineState => this.state;

  private setState(patch: Partial<EngineState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  // --- rig lifecycle ---

  /** Called by the avatar component once its model exists in the scene. */
  attachRig(root: Object3D | null): void {
    if (!root) {
      this.controller.setRig(null);
      this.controller.setFace(null);
      this.setState({ rig: null, face: null, unmatchedBones: [], unmatchedExpressions: [] });
      return;
    }

    const binding = new RigBinding(root);
    const face = new ExpressionBinding(root);
    this.controller.setRig(binding);
    this.controller.setFace(face);
    this.setState({
      rig: binding.report,
      face: face.report,
      unmatchedBones: [],
      unmatchedExpressions: [],
    });
  }

  // --- loading ---

  async loadAvailable(): Promise<void> {
    this.setState({ available: await this.provider.list() });
  }

  private async loadClip(key: string): Promise<LoadResult> {
    try {
      let cached = this.compiled.get(key);
      if (!cached) {
        cached = compileClip(await this.provider.getMotion(key));
        this.compiled.set(key, cached);
      }
      return { ok: true, clip: cached };
    } catch (error) {
      if (error instanceof MotionNotFoundError) {
        return {
          ok: false,
          reason: "missing",
          message: `No motion file for "${key}". Add public/motions/${key}.json to teach it this sign.`,
        };
      }
      return {
        ok: false,
        reason: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // --- playback ---

  /**
   * THE generic function. Splits `input` into gloss tokens and plays them one
   * after another. A single word, e.g. "HI", is a one-token sequence, so this
   * also covers the original `playMotion("HI")` case.
   */
  async playText(input: string): Promise<void> {
    const tokens = tokenizeGloss(input);
    const token = ++this.runToken;

    if (tokens.length === 0) {
      this.setState({
        status: "error",
        error: "Enter a sign to play.",
        currentSign: null,
        queue: [],
      });
      return;
    }

    if (!this.controller.getRig()) {
      this.setState({ status: "error", error: "Avatar is not loaded yet.", queue: [] });
      return;
    }

    this.setState({
      status: "loading",
      currentSign: null,
      error: null,
      clipNotes: null,
      queue: tokens.map((sign) => ({ sign, status: "pending" })),
    });

    // "Still running" means the last item started an unbounded loop and
    // deliberately did not wait for an onFinished that will never come - in
    // that case the sequence has not really gone idle, it is still animating.
    let stillRunning = false;
    for (let i = 0; i < tokens.length; i++) {
      if (token !== this.runToken) return; // superseded by a newer play() call
      stillRunning = await this.playQueueItem(token, i, tokens);
    }

    if (token !== this.runToken) return;
    if (!stillRunning) {
      this.setState({ status: "idle", currentSign: null });
    }
  }

  /** Plays a single sign with no queue UI - used by the quick-pick chips. */
  async playMotion(sign: string): Promise<void> {
    await this.playText(sign);
  }

  private markQueue(index: number, status: QueueItem["status"], extra?: Partial<QueueItem>): void {
    const queue = this.state.queue.slice();
    if (queue[index]) queue[index] = { ...queue[index], status, ...extra };
    this.setState({ queue });
  }

  /** Returns true if playback continues independently after this call returns (an unbounded loop). */
  private async playQueueItem(token: number, index: number, tokens: string[]): Promise<boolean> {
    const key = tokens[index];
    this.markQueue(index, "playing");
    // Clear the previous item's clip status/notes so a stale "placeholder"
    // banner from an earlier token can't linger over this one.
    this.setState({
      currentSign: key,
      clipStatus: null,
      clipNotes: null,
      clipValidation: null,
      unmatchedBones: [],
      unmatchedExpressions: [],
    });

    const result = await this.loadClip(key);
    if (token !== this.runToken) return false;

    if (!result.ok) {
      this.markQueue(index, result.reason === "missing" ? "missing" : "unplayable");
      this.setState({ status: "error", error: result.message, clipStatus: null });
      // Keep going - one bad token in a sentence shouldn't stop the rest.
      return false;
    }

    const clip = result.clip;
    const rig = this.controller.getRig();
    const face = this.controller.getFace();
    const unmatchedBones = clip.bones.filter((bone) => !rig?.has(bone));
    const unmatchedExpressions = clip.expressions.filter((e) => !face?.has(e));

    if (clip.status === "placeholder" || clip.duration === 0) {
      this.markQueue(index, "placeholder", {
        meaning: clip.meaning,
        validation: clip.validation,
      });
      this.setState({
        status: "loading",
        clipStatus: "placeholder",
        clipNotes: clip.notes ?? null,
        clipValidation: clip.validation,
        unmatchedBones,
        unmatchedExpressions,
        error: null,
      });
      return false;
    }

    this.markQueue(index, "playing", { meaning: clip.meaning, validation: clip.validation });
    this.setState({
      status: "playing",
      clipStatus: clip.status,
      clipNotes: clip.notes ?? null,
      clipValidation: clip.validation,
      unmatchedBones,
      unmatchedExpressions,
      error: null,
    });

    // A looping clip never calls onFinished, so it can only ever be the last
    // item in the queue - everything before it is played once regardless of
    // the loop setting, or the sequence would hang on item 1.
    const isLast = index === tokens.length - 1;
    const loopThis = this.controller.loop && isLast;
    const savedLoop = this.controller.loop;
    this.controller.loop = loopThis;

    if (loopThis) {
      this.controller.play(clip);
      this.markQueue(index, "playing");
      return true; // intentionally not awaited - it plays until stop() is called
    }

    await new Promise<void>((resolve) => {
      this.controller.onFinished = () => resolve();
      this.controller.play(clip);
    });
    this.controller.loop = savedLoop;

    if (token !== this.runToken) return false;
    this.markQueue(index, "done");
    return false;
  }

  stop(): void {
    this.runToken++; // supersede any in-flight sequence
    this.controller.stop();
    this.setState({ status: "idle", queue: [], currentSign: null });
  }

  setLoop(loop: boolean): void {
    this.controller.loop = loop;
  }

  /** Driven by the render loop. */
  update(delta: number): void {
    this.controller.update(delta);
  }
}
