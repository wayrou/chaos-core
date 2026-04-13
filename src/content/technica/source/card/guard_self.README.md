# Chaos Core Card Export

Runtime entry: `guard_self.card.json`
Content id: `guard_self`

Importer notes:
- Imported cards populate both the battle card runtime and Chaos Core's card library metadata.
- `effectFlow` is now the primary scripted runtime source of truth; `effects` is exported as a compatibility projection.
- Class and gear source references are normalized when provided.
- Attached card art resolves through `artPath` when present.
- `guard_self.source.json` preserves the authoring document.
