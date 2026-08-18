import { Euler, Quaternion } from "three";
import { expandHandshape } from "./handshapes";
import type {
  CanonicalBone,
  CanonicalExpression,
  MotionClip,
  ValidationStatus,
  Vec3,
} from "./types";

/**
 * Turns authored keyframes into something cheap to sample every frame.
 *
 * Authored data is frame-major (a list of moments, each listing some bones and
 * expressions). Playback wants bone-major / expression-major (per channel, a
 * sorted list of times and values) so each channel can be interpolated
 * independently. Doing the conversion once at load time keeps the per-frame
 * update allocation-free.
 */

export interface BoneTrack {
  times: number[];
  quats: Quaternion[];
}

/** A scalar track for one expression's morph weight, 0..1. */
export interface ExpressionTrack {
  times: number[];
  weights: number[];
}

export interface CompiledClip {
  sign: string;
  meaning?: string;
  validation: ValidationStatus;
  reviewedBy?: string;
  duration: number;
  status: "ready" | "placeholder";
  easing: "linear" | "smoothstep";
  tracks: Map<CanonicalBone, BoneTrack>;
  expressionTracks: Map<CanonicalExpression, ExpressionTrack>;
  /** Bones this clip actually animates. */
  bones: CanonicalBone[];
  /** Expressions this clip actually animates. */
  expressions: CanonicalExpression[];
  notes?: string;
}

export function compileClip(clip: MotionClip): CompiledClip {
  const order = clip.rotationOrder ?? "XYZ";
  const frames = [...clip.frames].sort((a, b) => a.time - b.time);
  const tracks = new Map<CanonicalBone, BoneTrack>();
  const expressionTracks = new Map<CanonicalExpression, ExpressionTrack>();
  const euler = new Euler();

  for (const frame of frames) {
    // A named handshape expands into finger rotations, then explicit `bones`
    // entries are layered on top - so a clip can say "FLAT, but with the thumb
    // tucked" without having to spell out all fifteen joints.
    const handshapeBones: Partial<Record<CanonicalBone, Vec3>> = {};
    for (const [side, name] of Object.entries(frame.handshape ?? {})) {
      if (!name) continue;
      Object.assign(handshapeBones, expandHandshape(side as "Right" | "Left", name));
    }

    for (const [boneName, rotation] of Object.entries({ ...handshapeBones, ...frame.bones })) {
      if (!rotation) continue;
      const bone = boneName as CanonicalBone;

      let track = tracks.get(bone);
      if (!track) {
        track = { times: [], quats: [] };
        tracks.set(bone, track);
      }

      euler.set(rotation[0], rotation[1], rotation[2], order);
      track.times.push(frame.time);
      track.quats.push(new Quaternion().setFromEuler(euler));
    }

    for (const [name, weight] of Object.entries(frame.expressions ?? {})) {
      if (weight === undefined) continue;
      const expression = name as CanonicalExpression;

      let track = expressionTracks.get(expression);
      if (!track) {
        track = { times: [], weights: [] };
        expressionTracks.set(expression, track);
      }

      track.times.push(frame.time);
      track.weights.push(weight);
    }
  }

  const duration = clip.duration > 0 ? clip.duration : frames[frames.length - 1]?.time ?? 0;

  return {
    sign: clip.sign,
    meaning: clip.meaning,
    validation: clip.validation,
    reviewedBy: clip.reviewedBy,
    duration,
    status: clip.status ?? "ready",
    easing: clip.easing ?? "smoothstep",
    tracks,
    expressionTracks,
    bones: [...tracks.keys()],
    expressions: [...expressionTracks.keys()],
    notes: clip.notes,
  };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Where `time` lands within a track's keyframes, and the eased blend factor
 * between them. Shared by sampleTrack (slerp) and sampleExpressionTrack (lerp)
 * so both channel types clamp and ease identically.
 */
function locate(
  times: number[],
  time: number,
  easing: "linear" | "smoothstep",
): { before: number } | { i: number; t: number } {
  const last = times.length - 1;
  if (time <= times[0]) return { before: 0 };
  if (time >= times[last]) return { before: last };

  // Linear scan: tracks here are a handful of keys, so a binary search would
  // cost more in complexity than it saves in time.
  let i = 0;
  while (i < last && times[i + 1] < time) i++;

  const span = times[i + 1] - times[i];
  const raw = span > 0 ? (time - times[i]) / span : 0;
  return { i, t: easing === "smoothstep" ? smoothstep(raw) : raw };
}

/**
 * Sample one bone track at `time`, writing the result into `out`.
 *
 * Clamps outside the track's own range, so a bone that stops being keyed simply
 * holds its last rotation instead of snapping back.
 */
export function sampleTrack(
  track: BoneTrack,
  time: number,
  easing: "linear" | "smoothstep",
  out: Quaternion,
): Quaternion {
  const loc = locate(track.times, time, easing);
  if ("before" in loc) return out.copy(track.quats[loc.before]);
  return out.copy(track.quats[loc.i]).slerp(track.quats[loc.i + 1], loc.t);
}

/** Sample one expression track at `time`. Same clamping behaviour as sampleTrack. */
export function sampleExpressionTrack(
  track: ExpressionTrack,
  time: number,
  easing: "linear" | "smoothstep",
): number {
  const loc = locate(track.times, time, easing);
  if ("before" in loc) return track.weights[loc.before];
  const a = track.weights[loc.i];
  const b = track.weights[loc.i + 1];
  return a + (b - a) * loc.t;
}
