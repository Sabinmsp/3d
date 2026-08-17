# Text → motion data → 3D human

A proof of concept for one link in a Deaf accessibility project: showing that
**stored motion data can programmatically drive a rigged 3D human in a browser**,
with no per-word animation code.

Type `HI`, press Play Motion, and the avatar waves — arm, hand and **facial
expression** all driven entirely by `public/motions/HI.json`.

Type more than one word — e.g. `HI YES THANKS` — and each token is looked up and
played in sequence, one after another. This is **splitting text into tokens and
queuing clips**, not translating English into Auslan. See "What playText() does
and does not do" below before reading anything into the word order.

There are 10 working test clips (`HI BYE YES NO THANKS STOP COME POINT THINKING
HAPPY`) plus 2 deliberate placeholders (`PAY`, `FRIDAY`).

> ### This is not Auslan
>
> **Every clip in this repo is a generic technical fixture** — a wave, a nod, a
> head shake, a smile. None of them are linguistically valid Auslan signs and
> none should be shown to anyone as one. They exist to prove the data-to-avatar
> pipeline works, nothing more. Real signs require validated Auslan motion data
> produced with Deaf community involvement. The same disclaimer is displayed in
> the app itself.
>
> This matters especially for the face. In Auslan, facial expression is
> **grammar**, not decoration — brow position distinguishes question types,
> and mouth patterns carry meaning that the hands do not. The expression support
> here is a rendering capability, not a claim that any of these faces mean
> anything.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000, then press **Play Motion**. Drag to orbit the camera
and inspect the arm from any angle; scroll to zoom.

The rigged avatar (`public/models/avatar.glb`) is committed, so this works on a
fresh clone with no extra setup. It is 48 MiB and takes ~20 seconds to load and
decode on first paint — the panel reads `0 bones` until it finishes. To swap in a
different human, or if the file is missing, see
[`public/models/README.md`](public/models/README.md); the app falls back to a
built-in placeholder figure and says so in the panel.

## The pipeline

```
"HI"                       text / gloss token
  ↓
MotionProvider             finds and loads HI.json
  ↓
MotionClip                 keyframes: time + bone rotations + expression weights
  ↓
compileClip                keyframes → per-bone and per-expression tracks
  ↓
MotionController           interpolates and applies both over time
  ↓
RigBinding                 canonical bone names → this model's actual bones
ExpressionBinding          canonical expressions → this model's morph targets
  ↓
Three.js / R3F             renders each frame
```

Each stage only knows about its neighbours. That is the whole point: when
stored JSON is replaced by a trained motion-generation model, only the provider
changes. The controller, the rig binding, the avatar and the UI stay as they are.

## Project structure

```
public/
  motions/
    HI.json BYE.json YES.json NO.json THANKS.json
    STOP.json COME.json POINT.json THINKING.json HAPPY.json
                          10 working test clips (none are real signs)
    PAY.json              placeholder - no motion data
    FRIDAY.json           placeholder - no motion data
    manifest.json         list of known signs, drives the quick-pick chips
  models/
    avatar.glb            the rigged human (committed, 48 MiB)
    README.md             how to swap in a different model

src/
  motion/                 pure TypeScript - no React, no scene graph
    types.ts              MotionClip / MotionFrame + validation of untrusted data
    boneMap.ts            canonical bone names → Mixamo / RPM / VRM / Rigify / CC names
    expressionMap.ts      canonical expressions → CC / ARKit morph target names
    compileClip.ts        keyframes → per-bone + per-expression tracks, interpolation
    RigBinding.ts         binds canonical names to a loaded model, captures rest pose
    ExpressionBinding.ts  binds canonical expressions to the model's morph targets
    MotionController.ts   the animation controller: clock, sampling, applying
    MotionEngine.ts       ties it together, exposes playText() and observable state
    tokenize.ts           "how are you" → ["HOW", "ARE", "YOU"]
    providers/
      MotionProvider.ts        the interface a future motion model implements
      LocalJsonMotionProvider.ts   today's implementation: fetch a JSON file

  components/
    App.tsx               layout
    CaptionBar.tsx        subtitle track overlaying the scene
    AvatarStage.tsx       Canvas, lights, camera, OrbitControls, per-frame tick
    GltfAvatar.tsx        loads avatar.glb, normalises scale, attaches the rig
    PlaceholderAvatar.tsx fallback figure with a real, correctly-named joint tree
    MotionPanel.tsx       input, Play Motion, status, bone-resolution readout
  react/
    MotionEngineProvider.tsx   owns the single engine instance
  avatarConfig.ts         where the .glb lives
```

## The one generic function

There is no `if (word === "HI")` anywhere. Playing any input is:

```ts
engine.playText("HI");             // one token
engine.playText("HI TEST_NOD");    // a queued sequence
```

which splits the input on whitespace, and for each token: finds `<TOKEN>.json`,
reads its keyframes, resolves the bones against whatever skeleton is loaded,
interpolates, and applies the rotations over time, then moves on to the next
token once the clip finishes. Adding a sign means **adding a file**, not editing
code:

```bash
cp public/motions/HI.json public/motions/THANKS.json
```

Edit the frames, add it to `manifest.json`, and `playText("THANKS")` works.

## What `playText()` does and does not do

It **splits on whitespace and strips punctuation** — `tokenizeGloss()` in
`src/motion/tokenize.ts` turns `"Pay $250 by Friday."` into
`["PAY", "250", "BY", "FRIDAY"]` — then looks each token up and queues it.

It does **not** translate English into Auslan. Auslan has its own grammar:
different word order, no direct equivalent for most English function words,
meaning carried spatially and on the face, not just through the hands. Typing an
English sentence and getting one clip per English word is English word order
with English words attached to clips — not a sign sequence a Deaf signer would
recognise as grammatical, even once every individual clip is a validated sign.

Text-to-gloss translation is a separate, much harder problem, deliberately out of
scope here, and one that needs qualified Auslan translators / Deaf community
review before its output goes in front of anyone as real signing.

In the UI, an unresolved queue token doesn't stop the sequence — the app plays
what it can, marks each token `done` / `placeholder` / `missing` in the progress
strip, and moves on. Playing a single word, e.g. `HI`, is just a one-token
sequence.

## Captions

A subtitle track renders over the scene (toggle: **Captions**), showing the gloss
tokens with the one currently being signed highlighted. It is driven by the same
engine state as playback, so it cannot drift out of sync with the avatar.

Tokens the avatar did **not** actually sign are marked rather than silently shown
as if they played — `placeholder` in amber, `no data` struck through in red. That
distinction matters: a caption reading `PAY` under a motionless avatar would
otherwise imply a sign was produced when nothing happened.

The bar is a `role="status"` / `aria-live="polite"` region, so screen readers
announce each token as it plays.

Captions display **gloss tokens, not a translation** — labelled as such in the
bar itself, for the same reason described above.

## Motion data format

```json
{
  "sign": "HI",
  "duration": 2.4,
  "easing": "smoothstep",
  "frames": [
    {
      "time": 0,
      "bones": { "RightForeArm": [0, 0, 0] },
      "expressions": { "MOUTH_SMILE": 0 }
    },
    {
      "time": 0.6,
      "bones": { "RightForeArm": [0, 0, -1.8] },
      "expressions": { "MOUTH_SMILE": 0.7 }
    }
  ]
}
```

**Bones**

- Rotations are `[x, y, z]` Euler angles in **radians**.
- They are **offsets from the model's rest pose**, not absolute local rotations.
  `[0, 0, 0]` means "exactly as exported". This is what lets one clip drive
  different avatars.
- Bone names are **canonical**, never model-specific. `boneMap.ts` translates.

**Expressions** (optional)

- Weights are **absolute**, `0` (neutral) to `1` (fully applied) — unlike bones,
  they are not deltas from rest, because a morph target has no meaningful "rest
  rotation" to offset from.
- Names are canonical (`MOUTH_SMILE`, `BROW_RAISE`, `EYE_BLINK`, `EYE_WIDE`,
  `BROW_DROP`, `MOUTH_FROWN`, `MOUTH_OPEN`); `expressionMap.ts` translates them
  to the model's actual morph targets. One canonical name often drives **two**
  targets (a symmetric brow raise is usually separate `_L` and `_R` shapes).
- Entirely optional. A model with no face rig plays the bone motion and silently
  skips expressions, the same way an unmatched bone is skipped.

**Both**

- Frames are **sparse** — list only what changes. A channel holds its last value
  until its next keyframe.
- Unknown bone/expression names, and weights outside `0..1`, are rejected at load
  with a clear error rather than silently ignored — worth having now that a model
  will generate these later.

## Verifying it works

The panel's **Resolved skeleton** and **Resolved expressions** sections show
which canonical names bound to which nodes/morph targets in the loaded model, and
which were not found. That is the first place to look when a new avatar does not
move as expected.

On the current Character Creator avatar this reads 13 bones and 7/7 expressions.

Behaviour worth knowing:

- Unknown sign → error naming the file you would need to add.
- `PAY` / `FRIDAY` → reports "placeholder, no motion data" and the avatar stays
  still. The lookup succeeded; the data does not exist.
- Clip end → the avatar returns to its rest pose and the state returns to `idle`.

## Deliberately not built yet

PDF ingestion, LLM summarisation, Auslan gloss translation, authentication,
databases, Blender automation, and model fine-tuning are all out of scope here.
This proves one link in the chain, so the rest can be built against a controller
that is known to work.
