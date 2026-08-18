# Text → motion data → 3D human

A proof of concept for one link in a Deaf accessibility project: showing that
**stored motion data can programmatically drive a rigged 3D human in a browser**,
with no per-word animation code.

Type `HELLO`, press Play Motion, and the avatar signs it — arm, **handshape**,
**mouth pattern** and **facial expression** all driven entirely by
`public/motions/HELLO.json`.

Type more than one word — e.g. `HELLO GOOD` — and each token is looked up and
played in sequence, one after another. This is **splitting text into tokens and
queuing clips**, not translating English into Auslan. See "What playText() does
and does not do" below before reading anything into the word order.

There are 10 draft sign clips (`HELLO THANK-YOU YES NO GOOD BAD SORRY DEAF HELP
NAME`) plus 2 deliberate placeholders (`PAY`, `FRIDAY`).

> ### These signs are unverified drafts
>
> The clips in this repo **attempt** real Auslan signs. They were authored from
> written descriptions by someone who is not a signer, and **none has been
> checked by a fluent Auslan signer**. Every one should be treated as a guess
> about form until reviewed.
>
> This is not false modesty. The failure mode of a signing avatar is silent:
> wrong signing still looks like fluent signing to someone who cannot check it,
> and that describes exactly the audience this project serves. A confident,
> polished, wrong avatar is worse than an obviously unfinished one.
>
> Each clip carries a required `validation` field, currently
> `unvalidated-draft` for all of them, and the app displays that status in the
> caption bar every time a clip plays. Nothing can quietly graduate to looking
> trustworthy — see [Validation](#validation).
>
> Known-weakest areas, in rough order: two-handed signs with contact between the
> hands (`HELP`), signs where the hand should touch the body (`SORRY`, `DEAF`,
> `NAME`, `THANK-YOU`), and every mouth pattern.

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
"HELLO"                    text / gloss token
  ↓
MotionProvider             finds and loads HELLO.json
  ↓
MotionClip                 keyframes: bone rotations + handshape + expressions
  ↓
compileClip                expands handshapes, builds per-channel tracks
  ↓
MotionController           interpolates and applies all channels over time
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
    HELLO.json THANK-YOU.json YES.json NO.json GOOD.json
    BAD.json SORRY.json DEAF.json HELP.json NAME.json
                          10 DRAFT sign clips - none reviewed by a signer
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
    handshapes.ts         named handshapes (FLAT, FIST, POINT...) → finger rotations
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

There is no `if (word === "HELLO")` anywhere. Playing any input is:

```ts
engine.playText("HELLO");          // one token
engine.playText("HELLO GOOD");     // a queued sequence
```

which splits the input on whitespace, and for each token: finds `<TOKEN>.json`,
reads its keyframes, resolves the bones against whatever skeleton is loaded,
interpolates, and applies the rotations over time, then moves on to the next
token once the clip finishes. Adding a sign means **adding a file**, not editing
code:

```bash
cp public/motions/HELLO.json public/motions/PLEASE.json
```

Edit the frames, add it to `manifest.json`, and `playText("PLEASE")` works.

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
strip, and moves on. Playing a single word, e.g. `HELLO`, is just a one-token
sequence.

## Validation

Every clip must declare a `validation` field. There is no default — a clip that
omits it fails to parse, with an error naming the file. That is deliberate: the
one thing that must never happen quietly is an unchecked sign rendering as if it
were trustworthy.

| Status | Meaning |
| --- | --- |
| `unvalidated-draft` | Authored from written descriptions. **Not** checked by a fluent signer. All 10 clips are currently here. |
| `community-reviewed` | Reviewed and corrected by a qualified Auslan informant or translator. Record who, in `reviewedBy`. |
| `technical-test` | Not a sign at all — a fixture (a wave, a nod) used to exercise the pipeline. |

While any token in a sequence is a draft, the caption bar shows an amber
**"Unverified draft signing"** banner, and the panel carries the same warning.

### What review actually requires

Reviewing these is not "does it look about right". Each clip needs checking on
the five parameters a sign is described by — handshape, orientation, location,
movement, and non-manual features — and each clip's `notes` field states what
articulation was attempted and what the author was unsure about, so a reviewer
has something specific to correct rather than a blank yes/no.

Known structural gaps that no amount of tuning fixes:

- **Contact is faked.** Hand-to-body and hand-to-hand contact is approximated by
  posing joints independently. Nothing guarantees the hand actually reaches the
  chin, ear or opposite palm — it just gets near. Signs distinguished by contact
  location are unreliable here.
- **Movement paths are keyframed straight lines.** Signs with arcs, circles or
  repeated contact are approximated with a handful of keys.
- **Mouth patterns are single visemes.** Real mouthings are shaped over the whole
  sign; these are one held shape.

## Handshapes

Handshape is phonemic — two signs can be identical in location and movement and
differ only in the fingers — so motion data names a shape rather than listing 15
finger rotations:

```json
{ "time": 0.35, "handshape": { "Right": "FLAT" } }
```

`src/motion/handshapes.ts` expands that into joint rotations. Defined shapes:
`FLAT`, `SPREAD`, `FIST`, `POINT`, `TWO`, `GOOD`, `HOOK`, `CUP`, `ROUND`,
`RELAXED`. Explicit `bones` entries in the same frame win over the handshape, so
a clip can say "FLAT, but with the thumb tucked".

The rotations in that file are eyeballed against one rig, not measured from
signer data — they are among the first things a reviewer should correct.

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
