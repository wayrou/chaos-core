# Technica Runtime Imports

This folder is the thin import/adapter layer for Technica Chaos Core exports.

## What lives here

- `generated/`: runtime JSON files exported from Technica and checked into the repo
- `index.ts`: in-memory registries for imported maps, quests, and dialogues
- `importer.ts`: manifest-first registration helpers for future drag-and-drop or file-based import flows
- `types.ts`: imported dialogue graph types

## Current integration

- Imported field maps are added to the existing field map registry in `src/field/maps.ts`
- Imported quests are merged into the quest database in `src/quests/questData.ts`
- Imported dialogue graphs are played through `src/ui/screens/DialogueScreen.ts`

## Future drag-and-drop flow

1. Read `manifest.json` from the Technica bundle.
2. Load `entryFile`.
3. Pass both into `importTechnicaEntry(...)`.
4. Render or refresh the relevant Chaos Core screen.
