# Technica Runtime Imports

This folder is the thin import/adapter layer for Technica Chaos Core exports.

## What lives here

- `generated/`: runtime JSON files exported from Technica and checked into the repo
- `index.ts`: in-memory registries for imported maps, quests, dialogues, items, gear, and cards
- `importer.ts`: manifest-first registration helpers for future drag-and-drop or file-based import flows
- `types.ts`: imported runtime content and dialogue graph types

## Current integration

- Imported field maps are added to the existing field map registry in `src/field/maps.ts`
- Imported quests are merged into the quest database in `src/quests/questData.ts`
- Imported dialogue graphs are played through `src/ui/screens/DialogueScreen.ts`
- User-imported packages are persisted locally and restored on boot
- Chaos Core exposes a main-menu `Import Content` screen for drag-and-drop installs
- Imported gear merges into the equipment registry used by loadout, battle, and workshop screens
- Imported cards register into the battle card catalog and workshop library database
- Imported item, gear, and card asset paths are preserved for future drag-and-drop bundle import

## Import flow

1. Read `manifest.json` from the Technica bundle.
2. Load `entryFile`.
3. Pass both into `importTechnicaEntry(...)`.
4. Persist the installed package for future sessions.
4. Persist the installed package for future sessions.
5. When the bundle includes `assets/...`, provide `resolveAssetPath` so runtime JSON can point at the unpacked files directly.
6. Render or refresh the relevant Chaos Core screen.
