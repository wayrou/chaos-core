# Chaos Core Gear Export

Runtime entry: `weapon_iron_watchblade.gear.json`
Content id: `weapon_iron_watchblade`

Importer notes:
- Imported gear registers into Chaos Core's equipment pool and base storage when marked as starting owned.
- Acquisition metadata preserves shop availability, enemy drop references, and floor or region victory reward hooks for future runtime adapters.
- Granted card ids are normalized for direct deck and catalog use.
- Attached gear icons resolve through `iconPath` when present.
- `weapon_iron_watchblade.source.json` preserves the original Technica authoring document.
