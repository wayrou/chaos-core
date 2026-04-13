import {
  createAtlasOperation,
  getAtlasFloorMaps,
} from "../../core/atlasSystem";
import { AtlasFloorMap, AtlasTheaterSummary, GameState } from "../../core/types";
import { ensureOperationHasTheater, getTheaterStarterResources } from "../../core/theaterSystem";
import { getGameState, updateGameState } from "../../state/gameStore";
import { createEmptyResourceWallet, RESOURCE_KEYS } from "../../core/resources";
import { renderLoadoutScreen } from "./LoadoutScreen";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";

const ATLAS_MAP_SIZE = 760;
const ATLAS_CENTER = ATLAS_MAP_SIZE / 2;
const ATLAS_RING_BASE = 138;
const ATLAS_RING_STEP = 116;
const ATLAS_RING_WIDTH = 92;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mergeTheaterStarterReserve(
  currentResources: GameState["resources"],
): GameState["resources"] {
  const reserve = getTheaterStarterResources();
  const merged = createEmptyResourceWallet();
  RESOURCE_KEYS.forEach((key) => {
    merged[key] = Math.max(currentResources[key], reserve[key]);
  });
  return merged;
}

function polarToCartesian(radius: number, angleDeg: number): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: ATLAS_CENTER + (Math.cos(radians) * radius),
    y: ATLAS_CENTER + (Math.sin(radians) * radius),
  };
}

function describeSectorPath(
  innerRadius: number,
  outerRadius: number,
  centerAngleDeg: number,
  slotCount: number,
): string {
  const sectorSweep = (360 / slotCount) * 0.82;
  const startAngle = centerAngleDeg - (sectorSweep / 2);
  const endAngle = centerAngleDeg + (sectorSweep / 2);
  const largeArcFlag = sectorSweep > 180 ? 1 : 0;
  const startOuter = polarToCartesian(outerRadius, startAngle);
  const endOuter = polarToCartesian(outerRadius, endAngle);
  const endInner = polarToCartesian(innerRadius, endAngle);
  const startInner = polarToCartesian(innerRadius, startAngle);

  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function getFloorRing(floor: AtlasFloorMap): { inner: number; outer: number } {
  const inner = ATLAS_RING_BASE + (floor.ringIndex * ATLAS_RING_STEP);
  return {
    inner,
    outer: inner + ATLAS_RING_WIDTH,
  };
}

function getSelectedTheater(floors: AtlasFloorMap[], state: GameState): AtlasTheaterSummary {
  const persistedSelection = state.uiLayout?.atlasSelectedTheaterId ?? null;
  const selectedFromState = persistedSelection
    ? floors.flatMap((floor) => floor.theaters).find((theater) => theater.theaterId === persistedSelection) ?? null
    : null;
  if (selectedFromState?.discovered) {
    return selectedFromState;
  }

  const currentFloorSelection = floors
    .find((floor) => floor.isCurrentFloor)
    ?.theaters.find((theater) => theater.operationAvailable)
    ?? floors.find((floor) => floor.isCurrentFloor)?.theaters[0];

  return currentFloorSelection ?? floors[0].theaters[0];
}

function normalizeAtlasFloorStates(
  floors: AtlasFloorMap[],
  state: GameState,
): AtlasFloorMap[] {
  const activeTheaterId = state.operation?.atlasTheaterId ?? state.uiLayout?.atlasSelectedTheaterId ?? null;
  return floors.map((floor) => ({
    ...floor,
    theaters: floor.theaters.map((theater) => ({
      ...theater,
      currentState: !theater.discovered
        ? "undiscovered"
        : !floor.isCurrentFloor
          ? "cold"
          : activeTheaterId === theater.theaterId
            ? "active"
            : "warm",
    })),
  }));
}

function persistAtlasSelection(theaterId: string): void {
  updateGameState((prev) => ({
    ...prev,
    phase: "atlas",
    uiLayout: {
      ...prev.uiLayout,
      atlasSelectedTheaterId: theaterId,
    },
  }));
}

function renderSectorChip(theater: AtlasTheaterSummary, floor: AtlasFloorMap, selectedTheaterId: string): string {
  const ring = getFloorRing(floor);
  const chipPoint = polarToCartesian((ring.inner + ring.outer) / 2, theater.angleDeg);
  return `
    <button
      class="atlas-sector-chip atlas-sector-chip--${theater.currentState}${theater.theaterId === selectedTheaterId ? " atlas-sector-chip--selected" : ""}"
      type="button"
      data-atlas-select-id="${theater.theaterId}"
      style="left:${chipPoint.x.toFixed(1)}px;top:${chipPoint.y.toFixed(1)}px;"
    >
      <span class="atlas-sector-chip__sector">${escapeHtml(theater.sectorLabel)}</span>
      <span class="atlas-sector-chip__zone">${escapeHtml(theater.zoneName)}</span>
    </button>
  `;
}

function renderSectorPath(theater: AtlasTheaterSummary, floor: AtlasFloorMap, selectedTheaterId: string): string {
  const ring = getFloorRing(floor);
  return `
    <path
      class="atlas-sector-path atlas-sector-path--${theater.currentState}${theater.theaterId === selectedTheaterId ? " atlas-sector-path--selected" : ""}"
      data-atlas-path-id="${theater.theaterId}"
      d="${describeSectorPath(ring.inner, ring.outer, theater.angleDeg, theater.radialSlotCount)}"
    ></path>
  `;
}

function renderFloorBadge(floor: AtlasFloorMap): string {
  const ring = getFloorRing(floor);
  const labelPoint = polarToCartesian(ring.inner - 20, -90);
  return `
    <div
      class="atlas-floor-badge${floor.isCurrentFloor ? " atlas-floor-badge--current" : ""}"
      style="left:${labelPoint.x.toFixed(1)}px;top:${labelPoint.y.toFixed(1)}px;"
    >
      ${escapeHtml(floor.floorLabel)}
    </div>
  `;
}

function renderAtlasMap(floors: AtlasFloorMap[], selectedTheaterId: string): string {
  const ringMarkup = floors
    .map((floor) => {
      const ring = getFloorRing(floor);
      return `
        <circle class="atlas-ring atlas-ring--inner" cx="${ATLAS_CENTER}" cy="${ATLAS_CENTER}" r="${ring.inner}"></circle>
        <circle class="atlas-ring atlas-ring--outer" cx="${ATLAS_CENTER}" cy="${ATLAS_CENTER}" r="${ring.outer}"></circle>
      `;
    })
    .join("");

  const sectorMarkup = floors
    .map((floor) => floor.theaters.map((theater) => renderSectorPath(theater, floor, selectedTheaterId)).join(""))
    .join("");

  const chipMarkup = floors
    .map((floor) => floor.theaters.map((theater) => renderSectorChip(theater, floor, selectedTheaterId)).join(""))
    .join("");

  const badgeMarkup = floors.map((floor) => renderFloorBadge(floor)).join("");

  return `
    <div class="atlas-map-stage">
      <svg class="atlas-map-svg" viewBox="0 0 ${ATLAS_MAP_SIZE} ${ATLAS_MAP_SIZE}" aria-hidden="true">
        <circle class="atlas-ring atlas-ring--haven-scan" cx="${ATLAS_CENTER}" cy="${ATLAS_CENTER}" r="84"></circle>
        <circle class="atlas-ring atlas-ring--haven-scan" cx="${ATLAS_CENTER}" cy="${ATLAS_CENTER}" r="112"></circle>
        ${ringMarkup}
        ${sectorMarkup}
      </svg>
      <div class="atlas-haven-core">
        <span class="atlas-haven-core__label">HAVEN</span>
        <span class="atlas-haven-core__sub">CENTER ANCHOR</span>
      </div>
      ${badgeMarkup}
      ${chipMarkup}
    </div>
  `;
}

function getFloorQuickSelectTarget(floor: AtlasFloorMap, selectedTheaterId: string): string | null {
  if (floor.theaters.some((theater) => theater.theaterId === selectedTheaterId)) {
    return selectedTheaterId;
  }

  return floor.theaters.find((theater) => theater.operationAvailable)?.theaterId
    ?? floor.theaters[0]?.theaterId
    ?? null;
}

function renderFloorQuickList(floors: AtlasFloorMap[], selectedTheater: AtlasTheaterSummary): string {
  const buttons = floors
    .map((floor) => {
      const targetTheaterId = getFloorQuickSelectTarget(floor, selectedTheater.theaterId);
      const theaterCount = floor.theaters.length;
      return `
        <button
          class="atlas-floor-quick-btn${floor.floorOrdinal === selectedTheater.floorOrdinal ? " atlas-floor-quick-btn--selected" : ""}${floor.isCurrentFloor ? " atlas-floor-quick-btn--current" : ""}"
          type="button"
          data-atlas-floor-ordinal="${floor.floorOrdinal}"
          data-atlas-floor-target="${targetTheaterId ?? ""}"
          ${targetTheaterId ? "" : "disabled"}
        >
          <span class="atlas-floor-quick-btn__label">${escapeHtml(floor.floorLabel)}</span>
          <span class="atlas-floor-quick-btn__meta">${theaterCount} sector${theaterCount === 1 ? "" : "s"}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div class="atlas-detail-panel-copy atlas-detail-panel-copy--floor-list">
      <div class="atlas-detail-copy-label">Quick Floor Select</div>
      <div class="atlas-floor-quick-list">
        ${buttons}
      </div>
    </div>
  `;
}

function renderDetailPanel(floors: AtlasFloorMap[], selectedTheater: AtlasTheaterSummary): string {
  const operationLabel = selectedTheater.operationAvailable
    ? `AVAILABLE // ${selectedTheater.operationCodename ?? "DEPLOYABLE"}`
    : "STANDBY // NO CURRENT OPERATION";

  return `
    <div class="atlas-detail-card">
      <div class="atlas-detail-eyebrow">SELECTED THEATER</div>
      ${renderFloorQuickList(floors, selectedTheater)}
      <h2 class="atlas-detail-title">${escapeHtml(selectedTheater.zoneName)}</h2>
      <div class="atlas-detail-location">${escapeHtml(selectedTheater.sectorLabel)} // ${escapeHtml(selectedTheater.floorLabel)}</div>

      <div class="atlas-detail-pill atlas-detail-pill--${selectedTheater.currentState}">
        ${escapeHtml(selectedTheater.currentState.toUpperCase())}
      </div>

      <div class="atlas-detail-grid">
        <div class="atlas-detail-stat"><span>Recommended PWR</span><strong>${selectedTheater.recommendedPwr}</strong></div>
        <div class="atlas-detail-stat"><span>Secured Rooms</span><strong>${selectedTheater.securedRooms} / ${selectedTheater.totalKnownRooms}</strong></div>
        <div class="atlas-detail-stat"><span>Active C.O.R.E.s</span><strong>${selectedTheater.activeCores}</strong></div>
        <div class="atlas-detail-stat"><span>Threat Level</span><strong>${escapeHtml(selectedTheater.threatLevel)}</strong></div>
        <div class="atlas-detail-stat"><span>Uplink Root</span><strong>${escapeHtml(selectedTheater.uplinkRoomId)}</strong></div>
        <div class="atlas-detail-stat"><span>Outward Depth</span><strong>${selectedTheater.outwardDepth}</strong></div>
      </div>

      <div class="atlas-detail-panel-copy">
        <div class="atlas-detail-copy-label">Passive Effect</div>
        <p>${escapeHtml(selectedTheater.passiveEffectText)}</p>
      </div>

      <div class="atlas-detail-panel-copy">
        <div class="atlas-detail-copy-label">Operation Status</div>
        <p>${escapeHtml(operationLabel)}</p>
      </div>

      <button
        class="atlas-launch-btn"
        id="atlasLaunchBtn"
        type="button"
        ${selectedTheater.operationAvailable ? "" : "disabled"}
      >
        ${selectedTheater.operationAvailable ? "LAUNCH OPERATION" : "NO OPERATION AVAILABLE"}
      </button>
    </div>
  `;
}

function launchTheaterOperation(theater: AtlasTheaterSummary): void {
  const operation = createAtlasOperation(theater.theaterId);
  if (!operation) {
    alert("No operation is currently staged for this theater.");
    return;
  }

  console.log("[ATLAS] operation launched", theater.theaterId, operation.id);

  unregisterBaseCampReturnHotkey("atlas-screen");
  updateGameState((prev) => ({
    ...prev,
    operation: ensureOperationHasTheater(operation),
    phase: "loadout",
    resources: mergeTheaterStarterReserve(prev.resources),
    uiLayout: {
      ...prev.uiLayout,
      atlasSelectedTheaterId: theater.theaterId,
    },
  }));

  renderLoadoutScreen();
}

export function renderAtlasScreen(returnTo: BaseCampReturnTo = "esc"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const floors = normalizeAtlasFloorStates(getAtlasFloorMaps(), state);
  if (floors.length === 0) {
    root.innerHTML = `<div class="atlas-root"><div class="atlas-empty">No discovered theaters are currently available.</div></div>`;
    return;
  }

  const selectedTheater = getSelectedTheater(floors, state);

  if (state.phase !== "atlas" || state.uiLayout?.atlasSelectedTheaterId !== selectedTheater.theaterId) {
    persistAtlasSelection(selectedTheater.theaterId);
  }

  console.log("[ATLAS] screen mounted", selectedTheater.theaterId);

  root.innerHTML = `
    <div class="atlas-root town-screen town-screen--hub ard-noise">
      <div class="atlas-card">
        <header class="atlas-header">
          <div class="atlas-header-copy">
            <div class="atlas-header-kicker">HAVEN STRATEGIC NODE</div>
            <h1 class="atlas-header-title">A.T.L.A.S. // ADAPTIVE THEATER LOGISTICS AND SURVEY</h1>
            <p class="atlas-header-subtitle">Discovered theaters are rendered as HAVEN-relative floor sectors. Launches begin from the uplink room nearest the center anchor.</p>
          </div>
          <button class="atlas-back-btn" id="atlasBackBtn" type="button">${getBaseCampReturnLabel(returnTo, { esc: "E.S.C.", field: "FIELD MODE" })}</button>
        </header>

        <div class="atlas-body">
          <section class="atlas-map-panel">
            ${renderAtlasMap(floors, selectedTheater.theaterId)}
          </section>
          <aside class="atlas-side-panel">
            ${renderDetailPanel(floors, selectedTheater)}
          </aside>
        </div>
      </div>
    </div>
  `;

  root.querySelector<HTMLButtonElement>("#atlasBackBtn")?.addEventListener("click", () => {
    unregisterBaseCampReturnHotkey("atlas-screen");
    returnFromBaseCampScreen(returnTo);
  });

  root.querySelectorAll<HTMLElement>("[data-atlas-select-id]").forEach((element) => {
    element.addEventListener("click", () => {
      const theaterId = element.dataset.atlasSelectId;
      if (!theaterId) return;
      console.log("[ATLAS] theater selected", theaterId);
      persistAtlasSelection(theaterId);
      renderAtlasScreen(returnTo);
    });
  });

  root.querySelectorAll<SVGPathElement>("[data-atlas-path-id]").forEach((element) => {
    element.addEventListener("click", () => {
      const theaterId = element.dataset.atlasPathId;
      if (!theaterId) return;
      console.log("[ATLAS] theater selected", theaterId);
      persistAtlasSelection(theaterId);
      renderAtlasScreen(returnTo);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-atlas-floor-target]").forEach((element) => {
    element.addEventListener("click", () => {
      const theaterId = element.dataset.atlasFloorTarget;
      if (!theaterId) return;
      console.log("[ATLAS] floor selected", element.dataset.atlasFloorOrdinal, theaterId);
      persistAtlasSelection(theaterId);
      renderAtlasScreen(returnTo);
    });
  });

  root.querySelector<HTMLButtonElement>("#atlasLaunchBtn")?.addEventListener("click", () => {
    launchTheaterOperation(selectedTheater);
  });

  registerBaseCampReturnHotkey("atlas-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".atlas-root",
  });
}

export default renderAtlasScreen;
