import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBattleScreen } from "./BattleScreen";
import { renderMainMenu } from "./MainMenuScreen";
import { createBuilderQuickTestBattle } from "../../core/tacticalBattle";
import {
  cloneTacticalMapDefinition,
  createBlankTacticalMap,
  createTacticalMapId,
  deleteCustomTacticalMap,
  getBuiltInTacticalMaps,
  getTacticalMapCatalog,
  getTacticalMapTemplates,
  instantiateTemplateMap,
  type TacticalMapDefinition,
  type TacticalMapObjectType,
  type TacticalMapPoint,
  type TacticalMapSurface,
  type TacticalMapTheme,
  type TacticalTraversalKind,
  upsertCustomTacticalMap,
  validateTacticalMapDefinition,
} from "../../core/tacticalMaps";

type BuilderTool =
  | "footprint"
  | "erase"
  | "elevation_up"
  | "elevation_down"
  | "surface"
  | "object"
  | "friendly_spawn"
  | "enemy_spawn"
  | "relay"
  | "friendly_breach"
  | "enemy_breach"
  | "extraction"
  | "traversal";

const BUILDER_SURFACES: TacticalMapSurface[] = ["stone", "metal", "dirt", "grate", "industrial", "ruin"];
const BUILDER_OBJECTS: TacticalMapObjectType[] = [
  "barricade_wall",
  "destructible_wall",
  "destructible_cover",
  "med_station",
  "ammo_crate",
  "proximity_mine",
  "smoke_emitter",
  "portable_ladder",
  "light_tower",
  "extraction_anchor",
];
const BUILDER_THEMES: TacticalMapTheme[] = ["sandbox", "breach", "lane_control", "vertical_assault", "collapse"];
const BUILDER_TRAVERSAL_KINDS: TacticalTraversalKind[] = ["ladder", "portable_ladder", "stairs", "ramp", "bridge", "grapple"];

let builderDraft: TacticalMapDefinition | null = null;
let builderTool: BuilderTool = "footprint";
let builderSurface: TacticalMapSurface = "industrial";
let builderObject: TacticalMapObjectType = "barricade_wall";
let builderTraversalKind: TacticalTraversalKind = "ladder";
let builderPendingTraversalStart: TacticalMapPoint | null = null;
let builderZoom = 1;
let builderMessage: { type: "success" | "error" | "info"; text: string } | null = null;

function getBuilderAuthor(): string {
  return getGameState().profile.callsign?.trim() || "AERISS";
}

function ensureBuilderDraft(): TacticalMapDefinition {
  if (!builderDraft) {
    builderDraft = createBlankTacticalMap({
      author: getBuilderAuthor(),
      theme: "sandbox",
    });
  }
  return builderDraft;
}

function setBuilderDraft(nextDraft: TacticalMapDefinition): void {
  builderDraft = {
    ...cloneTacticalMapDefinition(nextDraft),
    metadata: {
      ...nextDraft.metadata,
      author: getBuilderAuthor(),
    },
  };
}

function withUpdatedDraft(updater: (draft: TacticalMapDefinition) => TacticalMapDefinition): void {
  const nextDraft = updater(cloneTacticalMapDefinition(ensureBuilderDraft()));
  nextDraft.metadata.author = getBuilderAuthor();
  setBuilderDraft(nextDraft);
}

function togglePoint(list: TacticalMapPoint[], point: TacticalMapPoint): TacticalMapPoint[] {
  const existing = list.some((entry) => entry.x === point.x && entry.y === point.y);
  if (existing) {
    return list.filter((entry) => entry.x !== point.x || entry.y !== point.y);
  }
  return [...list, { ...point }];
}

function removePointFromAllZones(draft: TacticalMapDefinition, point: TacticalMapPoint): TacticalMapDefinition {
  const prune = (list: TacticalMapPoint[]) => list.filter((entry) => entry.x !== point.x || entry.y !== point.y);
  return {
    ...draft,
    zones: {
      friendlySpawn: prune(draft.zones.friendlySpawn),
      enemySpawn: prune(draft.zones.enemySpawn),
      relay: prune(draft.zones.relay),
      friendlyBreach: prune(draft.zones.friendlyBreach),
      enemyBreach: prune(draft.zones.enemyBreach),
      extraction: prune(draft.zones.extraction),
    },
  };
}

function isPlayableTile(draft: TacticalMapDefinition, point: TacticalMapPoint): boolean {
  return draft.tiles.some((tile) => tile.x === point.x && tile.y === point.y);
}

function applyBuilderCellAction(x: number, y: number): void {
  const point = { x, y };
  const draft = ensureBuilderDraft();
  const hasTile = isPlayableTile(draft, point);

  if (!hasTile && builderTool !== "footprint") {
    builderMessage = { type: "info", text: "Paint a footprint tile before editing it." };
    renderMapBuilderScreen();
    return;
  }

  withUpdatedDraft((currentDraft) => {
    const nextDraft = cloneTacticalMapDefinition(currentDraft);
    const tileIndex = nextDraft.tiles.findIndex((tile) => tile.x === x && tile.y === y);

    switch (builderTool) {
      case "footprint":
        if (tileIndex < 0) {
          nextDraft.tiles.push({ x, y, elevation: 0, surface: builderSurface });
        }
        break;
      case "erase":
        if (tileIndex >= 0) {
          nextDraft.tiles.splice(tileIndex, 1);
          nextDraft.objects = nextDraft.objects.filter((objectDef) => objectDef.x !== x || objectDef.y !== y);
          nextDraft.traversalLinks = nextDraft.traversalLinks.filter(
            (link) =>
              (link.from.x !== x || link.from.y !== y)
              && (link.to.x !== x || link.to.y !== y),
          );
          return removePointFromAllZones(nextDraft, point);
        }
        break;
      case "elevation_up":
      case "elevation_down":
        if (tileIndex >= 0) {
          const delta = builderTool === "elevation_up" ? 1 : -1;
          const currentTile = nextDraft.tiles[tileIndex];
          nextDraft.tiles[tileIndex] = {
            ...currentTile,
            elevation: Math.max(-1, Math.min(2, currentTile.elevation + delta)),
          };
        }
        break;
      case "surface":
        if (tileIndex >= 0) {
          nextDraft.tiles[tileIndex] = {
            ...nextDraft.tiles[tileIndex],
            surface: builderSurface,
          };
        }
        break;
      case "object": {
        const existingObjectIndex = nextDraft.objects.findIndex((objectDef) => objectDef.x === x && objectDef.y === y);
        if (existingObjectIndex >= 0 && nextDraft.objects[existingObjectIndex].type === builderObject) {
          nextDraft.objects.splice(existingObjectIndex, 1);
        } else {
          if (existingObjectIndex >= 0) {
            nextDraft.objects.splice(existingObjectIndex, 1);
          }
          nextDraft.objects.push({
            id: `obj_${builderObject}_${createTacticalMapId("cell")}`,
            type: builderObject,
            x,
            y,
          });
        }
        break;
      }
      case "friendly_spawn":
        nextDraft.zones.friendlySpawn = togglePoint(nextDraft.zones.friendlySpawn, point);
        break;
      case "enemy_spawn":
        nextDraft.zones.enemySpawn = togglePoint(nextDraft.zones.enemySpawn, point);
        break;
      case "relay":
        nextDraft.zones.relay = togglePoint(nextDraft.zones.relay, point);
        break;
      case "friendly_breach":
        nextDraft.zones.friendlyBreach = togglePoint(nextDraft.zones.friendlyBreach, point);
        break;
      case "enemy_breach":
        nextDraft.zones.enemyBreach = togglePoint(nextDraft.zones.enemyBreach, point);
        break;
      case "extraction":
        nextDraft.zones.extraction = togglePoint(nextDraft.zones.extraction, point);
        break;
      case "traversal":
        if (!builderPendingTraversalStart) {
          builderPendingTraversalStart = point;
          builderMessage = { type: "info", text: "Traversal start selected. Click a destination tile." };
          return nextDraft;
        }
        if (builderPendingTraversalStart.x === x && builderPendingTraversalStart.y === y) {
          builderPendingTraversalStart = null;
          builderMessage = { type: "info", text: "Traversal selection cleared." };
          return nextDraft;
        }
        nextDraft.traversalLinks.push({
          id: `trav_${builderTraversalKind}_${createTacticalMapId("link")}`,
          kind: builderTraversalKind,
          from: { ...builderPendingTraversalStart },
          to: { x, y },
          bidirectional: true,
        });
        builderPendingTraversalStart = null;
        break;
    }

    return nextDraft;
  });

  renderMapBuilderScreen();
}

function buildGridMarkup(draft: TacticalMapDefinition): string {
  const tileMap = new Map(draft.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  const objectMap = new Map(draft.objects.map((objectDef) => [`${objectDef.x},${objectDef.y}`, objectDef]));

  let html = "";
  for (let y = 0; y < draft.height; y++) {
    for (let x = 0; x < draft.width; x++) {
      const key = `${x},${y}`;
      const tile = tileMap.get(key);
      const objectDef = objectMap.get(key);
      const isPendingTraversal = Boolean(builderPendingTraversalStart && builderPendingTraversalStart.x === x && builderPendingTraversalStart.y === y);
      const classes = [
        "map-builder-cell",
        tile ? "map-builder-cell--playable" : "map-builder-cell--void",
        tile ? `map-builder-cell--surface-${tile.surface}` : "",
        tile && tile.elevation !== 0 ? `map-builder-cell--elevation-${tile.elevation}` : "",
        draft.zones.friendlySpawn.some((point) => point.x === x && point.y === y) ? "map-builder-cell--friendly-spawn" : "",
        draft.zones.enemySpawn.some((point) => point.x === x && point.y === y) ? "map-builder-cell--enemy-spawn" : "",
        draft.zones.relay.some((point) => point.x === x && point.y === y) ? "map-builder-cell--relay" : "",
        draft.zones.friendlyBreach.some((point) => point.x === x && point.y === y) ? "map-builder-cell--friendly-breach" : "",
        draft.zones.enemyBreach.some((point) => point.x === x && point.y === y) ? "map-builder-cell--enemy-breach" : "",
        draft.zones.extraction.some((point) => point.x === x && point.y === y) ? "map-builder-cell--extraction" : "",
        isPendingTraversal ? "map-builder-cell--traversal-source" : "",
      ].filter(Boolean).join(" ");

      const objectLabel = objectDef
        ? objectDef.type === "med_station"
          ? "MED"
          : objectDef.type === "ammo_crate"
            ? "AMM"
            : objectDef.type === "proximity_mine"
              ? "MINE"
              : objectDef.type === "smoke_emitter"
                ? "SMK"
                : objectDef.type === "portable_ladder"
                  ? "LDR"
                  : objectDef.type === "light_tower"
                    ? "LGT"
                    : objectDef.type === "extraction_anchor"
                      ? "EXT"
                      : objectDef.type === "destructible_cover"
                        ? "CVR"
                        : objectDef.type === "destructible_wall"
                          ? "DWL"
                          : "BAR"
        : "";

      html += `
        <button
          type="button"
          class="${classes}"
          data-map-builder-x="${x}"
          data-map-builder-y="${y}"
        >
          <span class="map-builder-cell__coord">${x},${y}</span>
          ${tile ? `<span class="map-builder-cell__elevation">${tile.elevation}</span>` : ""}
          ${objectLabel ? `<span class="map-builder-cell__object">${objectLabel}</span>` : ""}
        </button>
      `;
    }
  }
  return html;
}

function saveDraft(): void {
  const draft = ensureBuilderDraft();
  const validation = validateTacticalMapDefinition(draft);
  if (!validation.valid) {
    builderMessage = { type: "error", text: validation.errors[0] ?? "Map validation failed." };
    renderMapBuilderScreen();
    return;
  }
  const saved = upsertCustomTacticalMap(draft, getBuilderAuthor());
  setBuilderDraft(saved);
  builderMessage = { type: "success", text: `${saved.name} saved to the custom map library.` };
  renderMapBuilderScreen();
}

export function relaunchMapBuilderQuickTest(): void {
  const draft = ensureBuilderDraft();
  const validation = validateTacticalMapDefinition(draft);
  if (!validation.valid) {
    builderMessage = { type: "error", text: validation.errors[0] ?? "Map validation failed." };
    renderMapBuilderScreen();
    return;
  }
  const objectiveType = draft.supportedModes[0] ?? "elimination";
  const battle = createBuilderQuickTestBattle(getGameState(), draft, objectiveType);
  if (!battle) {
    builderMessage = { type: "error", text: "Failed to launch quick test battle." };
    renderMapBuilderScreen();
    return;
  }
  updateGameState((prev) => ({
    ...prev,
    currentBattle: battle,
    phase: "battle",
  }));
  renderBattleScreen();
}

function loadTemplate(templateId: string): void {
  const template = instantiateTemplateMap(templateId, getBuilderAuthor());
  if (!template) {
    builderMessage = { type: "error", text: "Template could not be loaded." };
    renderMapBuilderScreen();
    return;
  }
  setBuilderDraft(template);
  builderMessage = { type: "success", text: `${template.name} loaded as a new draft.` };
  renderMapBuilderScreen();
}

function loadCatalogMap(mapId: string): void {
  const catalog = getTacticalMapCatalog();
  const custom = catalog.customMaps.find((map) => map.id === mapId);
  if (custom) {
    setBuilderDraft(custom);
    builderMessage = { type: "info", text: `${custom.name} loaded for editing.` };
    renderMapBuilderScreen();
    return;
  }
  const builtIn = catalog.builtInMaps.find((map) => map.id === mapId);
  if (builtIn) {
    const copy = cloneTacticalMapDefinition(builtIn);
    copy.id = createTacticalMapId("custom");
    copy.name = `${builtIn.name} Copy`;
    copy.isBuiltIn = false;
    copy.isTemplate = false;
    copy.metadata.author = getBuilderAuthor();
    setBuilderDraft(copy);
    builderMessage = { type: "info", text: `${builtIn.name} loaded as an editable copy.` };
    renderMapBuilderScreen();
  }
}

function deleteCurrentDraft(): void {
  const draft = ensureBuilderDraft();
  deleteCustomTacticalMap(draft.id);
  builderDraft = createBlankTacticalMap({ author: getBuilderAuthor() });
  builderMessage = { type: "success", text: "Custom map deleted. Blank draft loaded." };
  renderMapBuilderScreen();
}

export function renderMapBuilderScreen(): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const draft = ensureBuilderDraft();
  const catalog = getTacticalMapCatalog();
  const validation = validateTacticalMapDefinition(draft);
  const isCustomDraft = catalog.customMaps.some((map) => map.id === draft.id);

  app.innerHTML = `
    <div class="map-builder-screen">
      <header class="map-builder-header">
        <div>
          <div class="map-builder-kicker">TACTICAL MAP SYSTEM</div>
          <h1 class="map-builder-title">MAP BUILDER</h1>
          <div class="map-builder-subtitle">Persistent tactical layouts, custom skirmish maps, and one-click local playtests.</div>
        </div>
        <div class="map-builder-actions">
          <button class="comms-array-btn" id="mapBuilderBackBtn">BACK</button>
          <button class="comms-array-btn" id="mapBuilderDuplicateBtn">DUPLICATE</button>
          <button class="comms-array-btn comms-array-btn--primary" id="mapBuilderQuickTestBtn">QUICK TEST</button>
          <button class="comms-array-btn comms-array-btn--primary" id="mapBuilderSaveBtn">SAVE</button>
        </div>
      </header>

      <div class="map-builder-layout">
        <aside class="map-builder-sidebar">
          <section class="map-builder-panel">
            <div class="map-builder-panel__title">Draft</div>
            <label>Name <input id="mapBuilderNameInput" value="${draft.name.replace(/"/g, "&quot;")}" /></label>
            <label>Theme
              <select id="mapBuilderThemeSelect">
                ${BUILDER_THEMES.map((theme) => `<option value="${theme}" ${draft.theme === theme ? "selected" : ""}>${theme.replace(/_/g, " ").toUpperCase()}</option>`).join("")}
              </select>
            </label>
            <label>Width
              <select id="mapBuilderWidthSelect">
                ${Array.from({ length: 7 }, (_, index) => index + 4).map((value) => `<option value="${value}" ${draft.width === value ? "selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label>Height
              <select id="mapBuilderHeightSelect">
                ${Array.from({ length: 6 }, (_, index) => index + 3).map((value) => `<option value="${value}" ${draft.height === value ? "selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label>Surface
              <select id="mapBuilderSurfaceSelect">
                ${BUILDER_SURFACES.map((surface) => `<option value="${surface}" ${builderSurface === surface ? "selected" : ""}>${surface.toUpperCase()}</option>`).join("")}
              </select>
            </label>
            <label>Object
              <select id="mapBuilderObjectSelect">
                ${BUILDER_OBJECTS.map((objectType) => `<option value="${objectType}" ${builderObject === objectType ? "selected" : ""}>${objectType.replace(/_/g, " ").toUpperCase()}</option>`).join("")}
              </select>
            </label>
            <label>Traversal
              <select id="mapBuilderTraversalSelect">
                ${BUILDER_TRAVERSAL_KINDS.map((kind) => `<option value="${kind}" ${builderTraversalKind === kind ? "selected" : ""}>${kind.replace(/_/g, " ").toUpperCase()}</option>`).join("")}
              </select>
            </label>
            <label>Zoom <input type="range" min="0.7" max="1.4" step="0.1" id="mapBuilderZoomInput" value="${builderZoom}" /></label>
            <div class="map-builder-mode-grid">
              ${(["elimination", "control_relay", "breakthrough"] as const).map((mode) => `
                <label><input type="checkbox" data-map-builder-mode="${mode}" ${draft.supportedModes.includes(mode) ? "checked" : ""} /> ${mode.replace(/_/g, " ").toUpperCase()}</label>
              `).join("")}
            </div>
          </section>

          <section class="map-builder-panel">
            <div class="map-builder-panel__title">Tools</div>
            <div class="map-builder-tool-grid">
              ${([
                ["footprint", "Footprint"],
                ["erase", "Erase"],
                ["elevation_up", "Raise"],
                ["elevation_down", "Lower"],
                ["surface", "Surface"],
                ["object", "Object"],
                ["friendly_spawn", "Friendly Spawn"],
                ["enemy_spawn", "Enemy Spawn"],
                ["relay", "Relay"],
                ["friendly_breach", "Friendly Breach"],
                ["enemy_breach", "Enemy Breach"],
                ["extraction", "Extraction"],
                ["traversal", "Traversal"],
              ] as Array<[BuilderTool, string]>).map(([tool, label]) => `
                <button type="button" class="map-builder-tool ${builderTool === tool ? "is-active" : ""}" data-map-builder-tool="${tool}">${label}</button>
              `).join("")}
            </div>
          </section>

          <section class="map-builder-panel">
            <div class="map-builder-panel__title">Validation</div>
            <div class="map-builder-validation ${validation.valid ? "is-valid" : "is-invalid"}">
              ${validation.valid ? "READY" : "BLOCKED"}
            </div>
            <div class="map-builder-validation-list">
              ${(validation.errors.length > 0 ? validation.errors : ["No blocking validation errors."]).map((message) => `<div class="map-builder-validation-item map-builder-validation-item--error">${message}</div>`).join("")}
              ${validation.warnings.map((message) => `<div class="map-builder-validation-item map-builder-validation-item--warning">${message}</div>`).join("")}
            </div>
          </section>

          <section class="map-builder-panel">
            <div class="map-builder-panel__title">Templates</div>
            <div class="map-builder-library-list">
              <button class="map-builder-library-item" type="button" id="mapBuilderNewBlankBtn">NEW BLANK</button>
              ${getTacticalMapTemplates().map((map) => `<button class="map-builder-library-item" type="button" data-map-builder-template="${map.id}">${map.name}</button>`).join("")}
            </div>
          </section>

          <section class="map-builder-panel">
            <div class="map-builder-panel__title">Built-In Maps</div>
            <div class="map-builder-library-list">
              ${getBuiltInTacticalMaps().map((map) => `<button class="map-builder-library-item" type="button" data-map-builder-load="${map.id}">${map.name}</button>`).join("")}
            </div>
          </section>

          <section class="map-builder-panel">
            <div class="map-builder-panel__title">Custom Library</div>
            <div class="map-builder-library-list">
              ${catalog.customMaps.length > 0
                ? catalog.customMaps.map((map) => `<button class="map-builder-library-item" type="button" data-map-builder-load="${map.id}">${map.name}</button>`).join("")
                : `<div class="map-builder-empty">No custom maps saved yet.</div>`}
            </div>
            ${isCustomDraft ? `<button class="comms-array-btn" id="mapBuilderDeleteBtn">DELETE CURRENT MAP</button>` : ""}
          </section>
        </aside>

        <main class="map-builder-main">
          <section class="map-builder-panel">
            <div class="map-builder-panel__title">Canvas</div>
            <div class="map-builder-canvas" style="--map-builder-zoom:${builderZoom}; grid-template-columns: repeat(${draft.width}, 1fr);">
              ${buildGridMarkup(draft)}
            </div>
            <div class="map-builder-note">
              ${builderPendingTraversalStart ? `Traversal start: ${builderPendingTraversalStart.x},${builderPendingTraversalStart.y}` : "Click tiles to paint footprint, zones, objects, and traversal links."}
            </div>
          </section>
          ${builderMessage ? `<div class="map-builder-message map-builder-message--${builderMessage.type}">${builderMessage.text}</div>` : ""}
        </main>
      </div>
    </div>
  `;

  const attachChange = <T extends HTMLElement>(id: string, callback: (element: T) => void) => {
    const element = document.getElementById(id) as T | null;
    if (element) {
      element.addEventListener("change", () => callback(element));
    }
  };

  const attachClick = (id: string, callback: () => void) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("click", callback);
    }
  };

  attachClick("mapBuilderBackBtn", () => void renderMainMenu());
  attachClick("mapBuilderSaveBtn", () => saveDraft());
  attachClick("mapBuilderQuickTestBtn", () => relaunchMapBuilderQuickTest());
  attachClick("mapBuilderDuplicateBtn", () => {
    const draftCopy = cloneTacticalMapDefinition(ensureBuilderDraft());
    draftCopy.id = createTacticalMapId("custom");
    draftCopy.name = `${draftCopy.name} Copy`;
    draftCopy.metadata.author = getBuilderAuthor();
    setBuilderDraft(draftCopy);
    builderMessage = { type: "success", text: "Draft duplicated." };
    renderMapBuilderScreen();
  });
  attachClick("mapBuilderNewBlankBtn", () => {
    builderPendingTraversalStart = null;
    setBuilderDraft(createBlankTacticalMap({ author: getBuilderAuthor() }));
    builderMessage = { type: "info", text: "Blank map draft created." };
    renderMapBuilderScreen();
  });
  attachClick("mapBuilderDeleteBtn", () => deleteCurrentDraft());

  attachChange<HTMLInputElement>("mapBuilderNameInput", (element) => {
    withUpdatedDraft((draftToUpdate) => ({ ...draftToUpdate, name: element.value.trim() || "Untitled Tactical Map" }));
  });
  attachChange<HTMLSelectElement>("mapBuilderThemeSelect", (element) => {
    withUpdatedDraft((draftToUpdate) => ({ ...draftToUpdate, theme: element.value as TacticalMapTheme }));
  });
  attachChange<HTMLSelectElement>("mapBuilderWidthSelect", (element) => {
    const width = Number(element.value);
    withUpdatedDraft((draftToUpdate) => ({
      ...draftToUpdate,
      width,
      tiles: draftToUpdate.tiles.filter((tile) => tile.x < width),
      objects: draftToUpdate.objects.filter((objectDef) => objectDef.x < width),
      traversalLinks: draftToUpdate.traversalLinks.filter((link) => link.from.x < width && link.to.x < width),
      zones: {
        friendlySpawn: draftToUpdate.zones.friendlySpawn.filter((point) => point.x < width),
        enemySpawn: draftToUpdate.zones.enemySpawn.filter((point) => point.x < width),
        relay: draftToUpdate.zones.relay.filter((point) => point.x < width),
        friendlyBreach: draftToUpdate.zones.friendlyBreach.filter((point) => point.x < width),
        enemyBreach: draftToUpdate.zones.enemyBreach.filter((point) => point.x < width),
        extraction: draftToUpdate.zones.extraction.filter((point) => point.x < width),
      },
    }));
    renderMapBuilderScreen();
  });
  attachChange<HTMLSelectElement>("mapBuilderHeightSelect", (element) => {
    const height = Number(element.value);
    withUpdatedDraft((draftToUpdate) => ({
      ...draftToUpdate,
      height,
      tiles: draftToUpdate.tiles.filter((tile) => tile.y < height),
      objects: draftToUpdate.objects.filter((objectDef) => objectDef.y < height),
      traversalLinks: draftToUpdate.traversalLinks.filter((link) => link.from.y < height && link.to.y < height),
      zones: {
        friendlySpawn: draftToUpdate.zones.friendlySpawn.filter((point) => point.y < height),
        enemySpawn: draftToUpdate.zones.enemySpawn.filter((point) => point.y < height),
        relay: draftToUpdate.zones.relay.filter((point) => point.y < height),
        friendlyBreach: draftToUpdate.zones.friendlyBreach.filter((point) => point.y < height),
        enemyBreach: draftToUpdate.zones.enemyBreach.filter((point) => point.y < height),
        extraction: draftToUpdate.zones.extraction.filter((point) => point.y < height),
      },
    }));
    renderMapBuilderScreen();
  });
  attachChange<HTMLSelectElement>("mapBuilderSurfaceSelect", (element) => {
    builderSurface = element.value as TacticalMapSurface;
  });
  attachChange<HTMLSelectElement>("mapBuilderObjectSelect", (element) => {
    builderObject = element.value as TacticalMapObjectType;
  });
  attachChange<HTMLSelectElement>("mapBuilderTraversalSelect", (element) => {
    builderTraversalKind = element.value as TacticalTraversalKind;
  });
  attachChange<HTMLInputElement>("mapBuilderZoomInput", (element) => {
    builderZoom = Number(element.value);
    renderMapBuilderScreen();
  });

  document.querySelectorAll<HTMLElement>("[data-map-builder-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      builderTool = button.dataset.mapBuilderTool as BuilderTool;
      builderMessage = null;
      renderMapBuilderScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-map-builder-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const templateId = button.dataset.mapBuilderTemplate;
      if (templateId) {
        loadTemplate(templateId);
      }
    });
  });

  document.querySelectorAll<HTMLElement>("[data-map-builder-load]").forEach((button) => {
    button.addEventListener("click", () => {
      const mapId = button.dataset.mapBuilderLoad;
      if (mapId) {
        loadCatalogMap(mapId);
      }
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-map-builder-mode]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const mode = checkbox.dataset.mapBuilderMode as "elimination" | "control_relay" | "breakthrough";
      withUpdatedDraft((draftToUpdate) => {
        const supportedModes = checkbox.checked
          ? [...draftToUpdate.supportedModes, mode]
          : draftToUpdate.supportedModes.filter((entry) => entry !== mode);
        return {
          ...draftToUpdate,
          supportedModes: supportedModes.length > 0 ? Array.from(new Set(supportedModes)) : ["elimination"],
        };
      });
      renderMapBuilderScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-map-builder-x][data-map-builder-y]").forEach((button) => {
    button.addEventListener("click", () => {
      const x = Number(button.dataset.mapBuilderX);
      const y = Number(button.dataset.mapBuilderY);
      applyBuilderCellAction(x, y);
    });
  });
}
