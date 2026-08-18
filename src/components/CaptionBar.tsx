"use client";

import { useEngineState } from "@/react/MotionEngineProvider";

/**
 * The caption / subtitle track: the written form of what the avatar is signing,
 * shown over the scene as the sequence plays.
 *
 * Two things it must never do:
 *
 * 1. Imply a sign was produced when it wasn't - tokens with no usable motion
 *    data are marked, not silently rendered as if they played.
 * 2. Present an unverified sign as if it were verified. A caption reading
 *    "hello" under an avatar making an unreviewed guess at HELLO is exactly the
 *    failure this project has to avoid, because the reader is precisely the
 *    person who cannot check it. So the draft badge rides along with the word.
 */
export function CaptionBar() {
  const state = useEngineState();

  if (state.queue.length === 0) return null;

  const active = state.queue.find((item) => item.status === "playing");
  const anyDraft = state.queue.some((item) => item.validation === "unvalidated-draft");

  return (
    <div className="captions" role="status" aria-live="polite" aria-atomic="true">
      {/* The plain-English meaning of the sign currently being produced. */}
      {active?.meaning && <p className="caption-meaning">{active.meaning}</p>}

      <p className="caption-line">
        {state.queue.map((item, i) => (
          <span key={`${item.sign}-${i}`} className={`caption-token caption-${item.status}`}>
            {item.sign}
            {item.status === "missing" && <span className="caption-note">no data</span>}
            {item.status === "placeholder" && <span className="caption-note">placeholder</span>}
          </span>
        ))}
      </p>

      {anyDraft ? (
        <p className="caption-warning">
          Unverified draft signing &middot; not checked by a fluent Auslan signer
        </p>
      ) : (
        <p className="caption-source">gloss tokens &middot; not an Auslan translation</p>
      )}
    </div>
  );
}
