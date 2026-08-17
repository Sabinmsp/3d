import { Quaternion } from "three";
import { sampleExpressionTrack, sampleTrack, type CompiledClip } from "./compileClip";
import type { ExpressionBinding } from "./ExpressionBinding";
import type { RigBinding } from "./RigBinding";

/**
 * Plays a compiled clip onto a bound rig and (optionally) a bound face.
 *
 * This is the piece the final project reuses unchanged: it does not know where
 * clips come from (JSON file, trained model, network), and it does not know what
 * the avatar looks like. It advances a clock and writes quaternions and morph
 * weights. A rig with no face - no ExpressionBinding attached, or one with no
 * matched targets - just plays the bone motion with no expression.
 */
export class MotionController {
  private rig: RigBinding | null = null;
  private face: ExpressionBinding | null = null;
  private clip: CompiledClip | null = null;
  private time = 0;
  private playing = false;

  /** Scratch objects - reused so update() allocates nothing per frame. */
  private readonly sampled = new Quaternion();
  private readonly result = new Quaternion();

  speed = 1;
  loop = false;
  onFinished: (() => void) | null = null;

  setRig(rig: RigBinding | null): void {
    this.rig = rig;
    this.playing = false;
    this.time = 0;
  }

  getRig(): RigBinding | null {
    return this.rig;
  }

  setFace(face: ExpressionBinding | null): void {
    this.face = face;
  }

  getFace(): ExpressionBinding | null {
    return this.face;
  }

  play(clip: CompiledClip): void {
    this.clip = clip;
    this.time = 0;
    this.playing = true;
    // Clear any pose left behind by a previous clip so bones/expressions this
    // clip does not animate are not stuck mid-movement.
    this.rig?.resetToRest();
    this.face?.resetToNeutral();
    this.applyPose(0);
  }

  stop(): void {
    this.playing = false;
    this.time = 0;
    this.rig?.resetToRest();
    this.face?.resetToNeutral();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getProgress(): number {
    if (!this.clip || this.clip.duration <= 0) return 0;
    return Math.min(this.time / this.clip.duration, 1);
  }

  /** Call once per rendered frame with the delta in seconds. */
  update(delta: number): void {
    if (!this.playing || !this.clip || !this.rig) return;

    this.time += delta * this.speed;

    if (this.time >= this.clip.duration) {
      if (this.loop && this.clip.duration > 0) {
        this.time %= this.clip.duration;
      } else {
        this.applyPose(this.clip.duration);
        this.playing = false;
        this.time = 0;
        this.onFinished?.();
        return;
      }
    }

    this.applyPose(this.time);
  }

  private applyPose(time: number): void {
    const { clip, rig, face } = this;
    if (!clip || !rig) return;

    for (const [canonical, track] of clip.tracks) {
      const bone = rig.get(canonical);
      // A clip may reference bones this particular rig does not have. Skipping
      // is correct: the rest of the motion still plays.
      if (!bone) continue;

      sampleTrack(track, time, clip.easing, this.sampled);
      // rest * offset - see RigBinding for why motion is stored relative.
      this.result.copy(bone.restQuaternion).multiply(this.sampled);
      bone.node.quaternion.copy(this.result);
    }

    if (!face) return;
    for (const [canonical, track] of clip.expressionTracks) {
      if (!face.has(canonical)) continue;
      face.set(canonical, sampleExpressionTrack(track, time, clip.easing));
    }
  }
}
