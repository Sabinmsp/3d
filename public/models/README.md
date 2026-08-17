# The rigged avatar

**`avatar.glb` is committed to this repo**, so a fresh clone renders the real
human with no extra setup — no download step, no Git LFS, no config.

## Replacing it

Save any other rigged human over the same path:

```
public/models/avatar.glb
```

That exact path and filename. Reload the page and the app picks it up
automatically — there is no code change and no config to edit. If the file is
missing or fails to parse, the app falls back to the built-in placeholder figure
and says so in the panel.

Other `.glb`/`.gltf`/`.bin` files in this folder stay gitignored; only
`avatar.glb` is tracked. At 48 MiB it sits under GitHub's 50 MiB warning
threshold — if you swap in a noticeably larger model, use Git LFS rather than
committing it directly, since git history is permanent.

## What the model needs

**Required**

1. **A skeleton.** The mesh must be skinned to bones. A static mesh will load and
   render, but nothing will move — the app animates bone nodes, not vertices.
2. **A right-arm chain**, since that is what the HI test clip drives:
   upper arm → forearm → hand, each nested inside the previous.
3. **Recognisable bone names.** See the table below.
4. **Y-up, facing +Z.** GLTF is Y-up by default, so this is usually automatic.

**Not required**

- Any particular scale — the app measures the model and normalises it to 1.75m.
- Any particular height off the floor — the app drops it so its feet sit at y=0.
- Baked animation clips — motion comes from JSON, not from the GLB.
- Finger bones, blend shapes, or textures. All fine to have, none needed yet.
  (Real Auslan will need articulated fingers and a face. Not for this test.)

## Bone naming

Motion files use rig-agnostic names. `src/motion/boneMap.ts` maps them to
whatever your model actually calls its bones, so several conventions work as-is:

| Canonical name  | Mixamo                      | Ready Player Me / plain | VRM             | Rigify        | Character Creator (CC3/CC4, iClone) |
| --------------- | --------------------------- | ----------------------- | --------------- | ------------- | ------------------------------------ |
| `RightShoulder` | `mixamorig:RightShoulder`   | `RightShoulder`         | `rightShoulder` | `shoulder.R`  | `CC_Base_R_Clavicle`                 |
| `RightUpperArm` | `mixamorig:RightArm`        | `RightArm`              | `rightUpperArm` | `upper_arm.R` | `CC_Base_R_Upperarm`                 |
| `RightForeArm`  | `mixamorig:RightForeArm`    | `RightForeArm`          | `rightLowerArm` | `forearm.R`   | `CC_Base_R_Forearm`                  |
| `RightHand`     | `mixamorig:RightHand`       | `RightHand`             | `rightHand`     | `hand.R`      | `CC_Base_R_Hand`                     |

`avatar.glb` in this folder is a Character Creator export (exported via
Blender's glTF I/O, skin name `CC_Base_*`) — that convention is what's currently
in use, 13/13 canonical bones the HI clip needs resolve automatically.

Left-side and spine bones follow the same pattern — see `BONE_ALIASES` in
`src/motion/boneMap.ts` for the full list.

Prefixes are handled automatically, so `Armature|mixamorig:RightArm` matches too.

**If your rig uses different names:** open the "Resolved skeleton" section in the
app panel. It lists every canonical bone, what it bound to, and which ones it
could not find. Add the missing names to `BONE_ALIASES` and reload.

## Where to get a model

Any rigged humanoid GLB works. Mixamo (Adobe account, free) and Ready Player Me
both export GLB with compatible skeletons; VRoid Studio exports VRM which you
would convert to GLB first. Download it yourself and drop it in this folder.

## A caveat about rest poses

Motion data is stored as rotation **offsets from the model's own rest pose**, so
a clip is portable across rigs. But "raise the forearm" is only the same rotation
on two rigs if their bone axes agree.

`HI.json` was authored against a T-pose rig with Mixamo-style bone axes (each
limb extending along its local +Y). A rig built differently — an A-pose export,
or bones rolled another way — will play the clip but the arm may travel somewhere
unintended. That is expected, and it is exactly the calibration step the real
project has to solve properly with validated capture data. For now, adjust the
numbers in `public/motions/HI.json` until the test arm moves the way you expect.
