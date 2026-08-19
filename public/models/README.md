# The rigged avatar

**`avatar.glb` is committed to this repo**, so a fresh clone renders the real
human with no extra setup — no download step, no Git LFS, no config.

## Current model

A young-boy character, converted from an Auto-Rig Pro FBX export
(`young+boy+character+riigged.fbx`). Auto-Rig Pro drives its deform bones with
**constraints**, which glTF cannot carry — exported naively, `hand.r` hangs
directly off the scene root instead of off the forearm, and rotating the upper
arm moves nothing downstream. The conversion re-parents the 57 deform bones into
a real anatomical chain (head/tail positions untouched, so existing vertex
weights still bind correctly) before exporting. See
`src/motion/boneMap.ts` for the resulting alias list.

**Known limitation:** this export has no shape keys / morph targets, so it has
no facial expression channels — `ExpressionBinding` reports 0/15 on this model.
Body and hand signing are unaffected. Some material textures also failed to
carry over from the embedded FBX data (dimensions unreadable at import), so the
model currently renders untextured/grey; this is cosmetic only.

## Replacing it

Save any other rigged human over the same path:

```
public/models/avatar.glb
```

That exact path and filename. Reload the page and the app picks it up
automatically — there is no code change and no config to edit. If the file is
missing or fails to parse, the app falls back to the built-in placeholder figure
and says so in the panel.

If the source is FBX rather than GLB, convert with Blender first
(`Blender --background --python <script> -- in.fbx out.glb`). If the rig is
built with Auto-Rig Pro (or anything else that animates via constraints), check
whether the exported bone hierarchy actually chains deform bones anatomically —
see "Auto-Rig Pro" below before assuming a broken export is a Three.js bug.

Other `.glb`/`.gltf`/`.bin` files in this folder stay gitignored; only
`avatar.glb` is tracked. Use Git LFS instead of committing directly if a
replacement model gets close to GitHub's 50 MiB warning threshold.

## What the model needs

**Required**

1. **A skeleton.** The mesh must be skinned to bones. A static mesh will load and
   render, but nothing will move — the app animates bone nodes, not vertices.
2. **An anatomical bone chain**: shoulder → upper arm → forearm → hand, each
   parented inside the previous, in the exported file. A rig that drives
   movement through constraints (Auto-Rig Pro, Rigify's control layer) needs
   its **deform** bones re-parented into a real chain before export — glTF has
   no concept of constraints, so whatever the exported parent/child hierarchy
   says is what Three.js has to work with.
3. **Recognisable bone names.** See the table below.
4. **Y-up, facing +Z.** GLTF is Y-up by default, so this is usually automatic.

**Not required**

- Any particular scale — the app measures the model and normalises it to 1.75m.
- Any particular height off the floor — the app drops it so its feet sit at y=0.
- Baked animation clips — motion comes from JSON, not from the GLB.
- Rest pose — the app poses a standing neutral itself; export in T-pose is fine.

**Wanted, not required**

- Finger bones, for handshapes.
- Shape keys / morph targets, for facial expression. Skipped gracefully if
  absent — the app reports 0 matched and plays bone motion with no face.

## Bone naming

Motion files use rig-agnostic names. `src/motion/boneMap.ts` maps them to
whatever your model actually calls its bones, so several conventions work as-is:

| Canonical name  | Mixamo                    | Ready Player Me / plain | VRM             | Rigify        | Character Creator     | Auto-Rig Pro         |
| --------------- | -------------------------- | ------------------------ | --------------- | ------------- | ---------------------- | ---------------------- |
| `RightShoulder` | `mixamorig:RightShoulder`  | `RightShoulder`          | `rightShoulder` | `shoulder.R`  | `CC_Base_R_Clavicle`   | `shoulder.r`           |
| `RightUpperArm` | `mixamorig:RightArm`       | `RightArm`               | `rightUpperArm` | `upper_arm.R` | `CC_Base_R_Upperarm`   | `arm_stretch.r`        |
| `RightForeArm`  | `mixamorig:RightForeArm`   | `RightForeArm`           | `rightLowerArm` | `forearm.R`   | `CC_Base_R_Forearm`    | `forearm_stretch.r`    |
| `RightHand`     | `mixamorig:RightHand`      | `RightHand`               | `rightHand`     | `hand.R`      | `CC_Base_R_Hand`       | `hand.r`               |

Left-side and spine bones follow the same pattern — see `BONE_ALIASES` in
`src/motion/boneMap.ts` for the full list, including fingers.

Prefixes are handled automatically, so `Armature|mixamorig:RightArm` matches too.

**If your rig uses different names:** open the "Resolved skeleton" details in
the browser devtools via `window.__rig.report` (dev builds only), or add the
missing names to `BONE_ALIASES` and reload.

## Auto-Rig Pro (and other constraint-driven rigs)

Auto-Rig Pro's exported skeleton is not directly animatable: its ~150 deform
bones (the ones actually skinning the mesh, found via each mesh's vertex
groups) are constrained to a much larger set of IK/FK/pole/twist control bones,
and only the constrained *result* matches an anatomical pose — the deform
bones' raw parent/child relationships in the file do not.

Fix at conversion time, in Blender, before exporting to GLB:

1. Import the FBX.
2. Find the deform bones: the union of every mesh's vertex group names,
   intersected with the armature's bone names.
3. In Edit Mode, re-parent each deform bone to its anatomical parent
   (`hand.r` → `forearm_stretch.r` → `arm_stretch.r` → `shoulder.r` → spine),
   with `use_connect = False` so head/tail positions - and therefore the
   existing vertex weights - are untouched.
4. Export GLB with `export_apply=True`.

The scripts used for the current model are not committed (one-off conversion),
but the approach above reproduces them.

## Where to get a model

Any rigged humanoid GLB works. Mixamo (Adobe account, free) and Ready Player Me
both export GLB with compatible skeletons; VRoid Studio exports VRM which you
would convert to GLB first. Download it yourself and drop it in this folder.

## A caveat about rest poses

Motion data is stored as rotation **offsets from a standing neutral pose that
the app itself constructs** (see `src/motion/neutralPose.ts`), not from
whatever pose the model was exported in — most exports are T-pose, which is not
how anyone stands, so leaving it there made every unanimated arm stick out
sideways. The app aims the arms into a relaxed standing posture at bind time and
treats that as rest.

This still assumes a rotation on one rig means the same thing on another: "bend
the elbow" is only the same Euler offset on two rigs if their bone axes agree.
Verify a new rig's axes by rotating one bone in isolation and checking that only
its own limb moves - `window.__rig` exposes the bound skeleton in dev builds for
exactly this. If a clip drives the arm somewhere unintended, adjust the numbers
in that clip's JSON rather than assuming the rig is broken.
