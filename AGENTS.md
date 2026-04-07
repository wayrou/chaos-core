# AGENTS.md - Chaos Core Working Guide

## Project Snapshot

Chaos Core is a Tauri + TypeScript tactical RPG with:
- grid-based battles
- card-driven actions
- equipment-driven deck building
- base camp / E.S.C. node-style UI
- dungeon operations, field maps, and theater progression

## Primary Source Of Truth

When working in this repo, trust sources in this order:
1. Direct user instructions in the current thread
2. The current codebase
3. `README.txt`
4. Attached or explicitly referenced GDD files

Do not treat old root markdown notes, audits, summaries, or assistant-specific files as design authority.

## Important Paths

- `src/core/` - game logic, generators, combat rules, progression systems
- `src/state/gameStore.ts` - global state integration
- `src/ui/screens/` - screen rendering and interaction
- `src/field/` - field map systems and town overlays
- `src/styles.css` and `src/field/field.css` - UI styling
- `src-tauri/` - Rust backend

## Implementation Rules

### Architecture

- Put game rules in `src/core/` as much as possible.
- Keep DOM and rendering logic in screen files.
- Prefer extending existing systems over adding parallel one-off systems.
- Reuse the existing node/window frameworks on E.S.C., battle HUD, field overlays, and title screen where appropriate.

### UI And Naming

- Do not add placeholder, debug, or helper windows/nodes with names like `cursor_proof`, `runtime_proof`, `proof`, `reimag`, or similar internal labels unless the user explicitly asks for them.
- Do not expose internal experiment names in player-facing UI.
- Avoid creating duplicate UI shells that bypass the established game aesthetic.
- Temporary debug UI should be removed before finishing unless the user explicitly wants it to stay.

### Documentation Hygiene

- Do not create new root-level markdown planning, audit, summary, or scratch files unless the user explicitly asks for a document.
- Prefer updating the actual code or `AGENTS.md` / `README.txt` rather than leaving behind sidecar implementation notes.
- If a temporary note is absolutely necessary during work, remove it before finishing unless the user asked to keep it.

### Gameplay Safety

- For battle changes, verify turn transitions, movement preview, card play, enemy turns, and victory/defeat flow together.
- For inventory/loadout changes, keep town inventory, loadout staging, and forward locker behavior aligned.
- For theater / operation changes, make sure custom-op configuration survives generation, floor changes, and re-entry.

## Current Style Direction

- Less fake software dashboard, more actual game interface.
- Keep ScrollLink flavor, but do not let it overpower readability or usability.
- Match existing Chaos Core node styling when adding draggable/minimizable windows.
- Favor intentional, in-world labels over system-debug phrasing.

## Working Preference

- Make focused changes directly in code.
- Keep root directory clutter low.
- If instructions in old docs conflict with the current game direction or current user request, follow the current user request.
