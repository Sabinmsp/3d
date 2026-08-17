"use client";

import { useState, type FormEvent } from "react";
import { useEngineState, useMotionEngine } from "@/react/MotionEngineProvider";
import type { AvatarSource } from "./AvatarStage";

export function MotionPanel({
  avatarSource,
  avatarError,
  captions,
  onCaptionsChange,
}: {
  avatarSource: AvatarSource;
  avatarError: string | null;
  captions: boolean;
  onCaptionsChange: (on: boolean) => void;
}) {
  const engine = useMotionEngine();
  const state = useEngineState();
  const [input, setInput] = useState("HI");
  const [loop, setLoop] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The entire "text -> animation" surface of the app is this one call.
    // playText() splits input on whitespace into gloss tokens and plays them
    // in order - it does not translate English into Auslan grammar.
    void engine.playText(input);
  };

  const boundArm = state.rig?.bound.filter((b) => b.canonical.startsWith("Right")) ?? [];

  return (
    <aside className="panel">
      <header>
        <h1>Text to 3D motion</h1>
        <p className="sub">Pipeline proof of concept</p>
      </header>

      <p className="disclaimer">
        <strong>Not Auslan.</strong> Every clip below (wave, nod, shake, expressions...) is a generic
        technical test animation used to prove that motion data can drive a skeleton and a face. None
        of it is linguistically valid Auslan and none of it should be presented as such. Real signs
        require validated Auslan motion data.
      </p>

      <form onSubmit={submit}>
        <label htmlFor="sign">Input</label>
        <input
          id="sign"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="HI"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="row">
          <button type="submit" disabled={state.status === "loading"}>
            {state.status === "loading" ? "Loading..." : "Play Motion"}
          </button>
          <button type="button" className="ghost" onClick={() => engine.stop()}>
            Stop
          </button>
        </div>

        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={loop}
              onChange={(event) => {
                setLoop(event.target.checked);
                engine.setLoop(event.target.checked);
              }}
            />
            Loop
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={captions}
              onChange={(event) => onCaptionsChange(event.target.checked)}
            />
            Captions
          </label>
        </div>
      </form>

      <div className="quick">
        {state.available.map((entry) => (
          <button
            key={entry.sign}
            type="button"
            className={`chip ${entry.status === "placeholder" ? "muted" : ""}`}
            onClick={() => {
              setInput(entry.sign);
              void engine.playMotion(entry.sign);
            }}
            title={entry.label}
          >
            {entry.sign}
          </button>
        ))}
      </div>

      {state.queue.length > 1 && (
        <ol className="queue">
          {state.queue.map((item, i) => (
            <li key={`${item.sign}-${i}`} className={`queue-${item.status}`}>
              {item.sign}
            </li>
          ))}
        </ol>
      )}

      <dl className="status">
        <dt>Current motion</dt>
        <dd>{state.currentSign ?? "-"}</dd>
        <dt>State</dt>
        <dd className={`state-${state.status}`}>{state.status}</dd>
        <dt>Avatar</dt>
        <dd>
          {avatarSource === "checking"
            ? "checking..."
            : avatarSource === "glb"
              ? "avatar.glb"
              : "placeholder figure"}
        </dd>
      </dl>

      {state.error && <p className="alert error">{state.error}</p>}

      {state.clipStatus === "placeholder" && !state.error && (
        <p className="alert warn">
          <strong>{state.currentSign}</strong> is a placeholder file with no motion data, so the
          avatar stays still. The lookup worked - the data does not exist yet.
        </p>
      )}

      {state.unmatchedBones.length > 0 && (
        <p className="alert warn">
          This clip animates bones the rig does not have: {state.unmatchedBones.join(", ")}. Add
          aliases in <code>src/motion/boneMap.ts</code>.
        </p>
      )}

      {state.unmatchedExpressions.length > 0 && (
        <p className="alert warn">
          This clip animates expressions the model has no morph target for:{" "}
          {state.unmatchedExpressions.join(", ")}. Add aliases in{" "}
          <code>src/motion/expressionMap.ts</code>.
        </p>
      )}

      {avatarError && (
        <p className="alert error">Could not load avatar.glb ({avatarError}). Using placeholder.</p>
      )}

      {avatarSource === "placeholder" && !avatarError && (
        <p className="alert info">
          No <code>public/models/avatar.glb</code> found. Showing the placeholder rig - drop a
          rigged GLB there and reload to use a real human.
        </p>
      )}

      <details className="rig">
        <summary>Resolved skeleton ({state.rig?.bound.length ?? 0} bones)</summary>
        {state.rig ? (
          <>
            <ul>
              {boundArm.map((bone) => (
                <li key={bone.canonical}>
                  <code>{bone.canonical}</code>
                  <span className="arrow">-&gt;</span>
                  <code className="node">{bone.nodeName}</code>
                </li>
              ))}
            </ul>
            {state.rig.missing.length > 0 && (
              <p className="missing">Unmatched: {state.rig.missing.join(", ")}</p>
            )}
            <p className="hint">
              Right-arm chain shown. {state.rig.totalNodes} nodes scanned in the model.
            </p>
          </>
        ) : (
          <p className="hint">No rig attached yet.</p>
        )}
      </details>

      <details className="rig">
        <summary>Resolved expressions ({state.face?.bound.length ?? 0} / 7)</summary>
        {state.face ? (
          <>
            <ul>
              {state.face.bound.map((expr) => (
                <li key={expr.canonical}>
                  <code>{expr.canonical}</code>
                  <span className="arrow">-&gt;</span>
                  <code className="node">{expr.targetNames.join(" + ")}</code>
                </li>
              ))}
            </ul>
            {state.face.missing.length > 0 && (
              <p className="missing">Unmatched: {state.face.missing.join(", ")}</p>
            )}
            <p className="hint">{state.face.totalTargets} morph targets scanned in the model.</p>
          </>
        ) : (
          <p className="hint">No face attached yet.</p>
        )}
      </details>
    </aside>
  );
}
