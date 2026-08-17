"use client";

import { useEngineState } from "@/react/MotionEngineProvider";

/**
 * The caption / subtitle track: the written form of what the avatar is signing,
 * shown over the scene as the sequence plays.
 *
 * This pairs the visual sign with its gloss token so the two can be read
 * together. It reflects EXACTLY what the motion engine is playing - each token
 * lights up as its clip runs, and tokens with no usable motion data are marked
 * rather than quietly skipped, so the caption never implies the avatar signed
 * something it did not.
 *
 * These are gloss tokens, not a translation. See the disclaimer in the panel.
 */
export function CaptionBar() {
  const state = useEngineState();

  // Nothing requested yet - stay out of the way rather than showing an empty bar.
  if (state.queue.length === 0) return null;

  return (
    <div className="captions" role="status" aria-live="polite" aria-atomic="true">
      <p className="caption-line">
        {state.queue.map((item, i) => (
          <span key={`${item.sign}-${i}`} className={`caption-token caption-${item.status}`}>
            {item.sign}
            {item.status === "missing" && <span className="caption-note">no data</span>}
            {item.status === "placeholder" && <span className="caption-note">placeholder</span>}
          </span>
        ))}
      </p>
      <p className="caption-source">gloss tokens &middot; not an Auslan translation</p>
    </div>
  );
}
