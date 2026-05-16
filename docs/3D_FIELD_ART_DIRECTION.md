# Chaos Core 3D Field Art Direction

This document defines the 3D field-zone look for Chaos Core. It exists to keep the project from drifting into generic low-poly, realistic 3D, or forced-perspective paper-doll solutions.

## North Star

The field layer should feel like Ardycia translated into small cel-shaded figurines:

- Real 3D forms that hold up under a free camera.
- Chibi-adventure silhouettes with large heads, compact bodies, chunky boots, gloves, straps, tools, and weapons.
- Flat color shapes, hand-painted details, thick black outlines, warm key light, cool shadow fill, and ambient fog.
- Toy-like readability, not realism.
- Handmade imperfection: asymmetry, slightly crooked silhouettes, repaired gear, worn cloth, brass, rusted steel, old terminal glow.

Avoid Paper Mario-style billboard characters for field zones. The free camera is a core design value, so field characters, NPCs, enemies, and interactable props need real volume from every angle.

## Layer Split

Field zones:

- Use real 3D models for Aeriss, HAVEN NPCs, Outer Deck NPCs, field enemies, important props, and navigation geometry.
- Use cel-shaded materials and inverted-hull outlines.
- Use simple rigs and shared animation sets.

Tactical battles:

- Keep 2D sprite billboards/standees.
- Tactical battles can preserve the current board-game readability and do not need full 3D unit models for every class.
- Tactical battle maps still use the same shared toon renderer contract as field zones: warm key, cool fill, ambient fog, color grading, toon materials, and inverted-hull outlines on 3D map geometry.

This split keeps production manageable while letting field exploration become fully 3D.

## Rendering Contract

All 3D field scenes should use:

- Warm directional key light.
- Cool blue-green shadow/fill light.
- Soft ambient hemisphere light.
- Ambient fog for depth and mood.
- ACES tone mapping plus a mild canvas color-grade pass.
- Thick black or near-black inverted-hull outlines on characters, enemies, important props, and blocky architecture.
- Toon material bands instead of realistic PBR shading.

The shared implementation lives in `src/ui/threeToonStyle.ts`. HAVEN 3D and 3D tactical battle maps should both use this module rather than defining their own scene lights, fog, color-grade filter, toon material, or outline material.

Do not use glossy realism as the default. Brass, old steel, and magical OS accents may glow or catch light, but most materials should stay flat, readable, and illustrated.

## Outline Rules

Use inverted-hull outlines as the default field style:

- Characters: thickest outline.
- Enemies: slightly thicker than friendly characters.
- Important props: medium outline.
- Architecture and wall blocks: thinner outline so the scene does not become visually noisy.
- FX sprites, labels, telegraphs, target rings, and transparent planes do not need hull outlines.

Outlines should read as ink, not as realistic contact shadow. Prefer near-black with a slight green/brown bias over pure UI black if the scene becomes too harsh.

## Character Model Scope

Start with one shared humanoid base rig.

Recommended budgets:

- Aeriss or key NPC: 1,500 to 4,000 triangles, 512 or 1024 texture, shared humanoid rig.
- Background NPC: 700 to 2,000 triangles, shared rig, palette/material swaps where possible.
- Field enemy: 1,000 to 3,500 triangles, strong silhouette over detail.
- Small prop: 100 to 1,000 triangles.

Model priorities:

- Recognizable silhouette at gameplay distance.
- Big readable head and face.
- Simple dot/shape eyes that preserve the 2D design language.
- Chunky hands, feet, weapons, bags, and gear.
- Asymmetric costume shapes.
- Hand-painted straps, patches, scuffs, labels, rivets, and wear.

Avoid:

- High-detail anatomy.
- Realistic cloth simulation.
- Complex hair cards unless the character is a hero asset.
- Unique skeletons for every NPC.
- Full gear-variant modeling before the base style is proven.

## Animation Scope

The 3D field animation set is intentionally small.

Aeriss:

- `idle`
- `walk`
- `run`
- `interact`
- `blade_attack`
- `launcher_fire`
- `grapple_fire`
- `hurt`

NPCs:

- `idle`
- `walk`
- `talk`
- `work`

Field enemies:

- `idle`
- `move`
- `windup`
- `attack`
- `hurt`

Do not build fall or defeat animations yet. Enemy removal can stay as pop, fade, spark, or simple vanish until the core 3D style is stable.

Animation style:

- Snappy timing.
- Small squash/bob.
- Clear windup before attacks.
- Minimal limb complexity.
- Strong pose readability from gameplay distance.

## Asset Pipeline

Use GLB as the target runtime format.

Suggested paths:

```text
public/assets/models/characters/aeriss.glb
public/assets/models/npcs/haven_worker_a.glb
public/assets/models/enemies/latchwire_slinger.glb
public/assets/models/props/courier_board.glb
```

Each model should include:

- One root object with clean scale.
- Named animation clips using the names in this document.
- Materials named by role, such as `coat`, `skin`, `brass`, `old_steel`, `cloth`, `os_glow`.
- No hidden high-poly source meshes in exported GLB files.

Future code should route models through a registry rather than hard-coded imports:

```ts
{
  id: "npc_haven_worker_a",
  model: "/assets/models/npcs/haven_worker_a.glb",
  scale: 1,
  outline: "character",
  animationSet: "humanoid_basic"
}
```

## First Production Target

Prove the style with Aeriss first.

The first successful milestone is:

- Aeriss loads as a 3D GLB in HAVEN 3D.
- The model uses toon shading and inverted-hull outlines.
- The free camera can orbit around the model without revealing billboard tricks.
- Idle, walk, run, interact, blade attack, launcher fire, grapple fire, and hurt are represented.
- The model still feels connected to the original 2D Chaos Core art.

After Aeriss works, build one HAVEN NPC, one Outer Deck NPC, and one field enemy using the same rules.

## Scope Discipline

Model the space. Draw the identity into the materials, silhouettes, and details.

Do not build a large 3D asset library until one small field zone proves the style. The first durable target is a compact vertical slice, not a full conversion of every map.
