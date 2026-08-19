"use client";

import { useState, type FormEvent } from "react";
import { useEngineState, useMotionEngine } from "@/react/MotionEngineProvider";

export function MotionPanel({
  captions,
  onCaptionsChange,
}: {
  captions: boolean;
  onCaptionsChange: (on: boolean) => void;
}) {
  const engine = useMotionEngine();
  const state = useEngineState();
  const [input, setInput] = useState("HELLO");
  const [loop, setLoop] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void engine.playText(input);
  };

  return (
    <aside className="panel">
      <header>
        <h1>Text to sign</h1>
        <p className="sub">Proof of concept</p>
      </header>

      {/* Short, but kept: these signs are guesses, and the person most likely to
          trust them is the person least able to check them. */}
      <p className="disclaimer">
        <strong>Unverified drafts</strong> - not checked by a fluent Auslan signer.
      </p>

      <form onSubmit={submit}>
        <input
          id="sign"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="HELLO"
          autoComplete="off"
          spellCheck={false}
          aria-label="Sign to play"
        />

        <div className="row">
          <button type="submit" disabled={state.status === "loading"}>
            {state.status === "loading" ? "Loading..." : "Play"}
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
            className="chip"
            onClick={() => {
              setInput(entry.sign);
              void engine.playMotion(entry.sign);
            }}
          >
            {entry.sign}
          </button>
        ))}
      </div>

      {state.error && <p className="alert error">{state.error}</p>}
    </aside>
  );
}
