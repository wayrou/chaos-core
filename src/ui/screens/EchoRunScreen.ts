import { getGameState, updateGameState } from "../../state/gameStore";
import {
  abandonActiveEchoRun,
  applyEchoDraftChoice,
  clearActiveEchoRun,
  getActiveEchoRun,
  getEchoModifierDef,
  getEchoResultsSummary,
  launchActiveEchoEncounterBattle,
  selectEchoMapNode,
  rerollActiveEchoChoices,
  startEchoRunSession,
} from "../../core/echoRuns";
import { getAllStarterEquipment } from "../../core/equipment";
import { enableAutosave, triggerAutosave } from "../../core/saveSystem";
import type { EchoRewardChoice, EchoRunNode, EchoUnitDraftOption } from "../../core/types";
import { showConfirmDialog } from "../components/confirmDialog";

const echoDraftPreviewByStage = new Map<string, string>();
const echoMapSelectionByStratum = new Map<string, string>();
const echoMapViewportByStratum = new Map<string, { x: number; y: number; zoom: number }>();

const ECHO_MAP_MIN_ZOOM = 0.7;
const ECHO_MAP_MAX_ZOOM = 1.65;
const ECHO_MAP_DEFAULT_ZOOM = 1;
const ECHO_MAP_PAN_SPEED = 18;

let echoMapAnimationFrame: number | null = null;
let echoMapKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
let echoMapKeyupHandler: ((event: KeyboardEvent) => void) | null = null;
let echoMapWheelHandler: ((event: WheelEvent) => void) | null = null;
let echoRunEscapeHandler: ((event: KeyboardEvent) => void) | null = null;
let echoMapPressedKeys = new Set<string>();
let echoMapShiftHeld = false;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getEchoPreviewStageKey(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  return `${run.id}:${run.stage}:${run.encounterNumber}`;
}

function getEchoMapSelectionKey(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  return `${run.id}:map:${run.currentStratum}`;
}

function getEchoMapViewportKey(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  return `${run.id}:viewport:${run.currentStratum}`;
}

function getEchoMapViewportState(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): { x: number; y: number; zoom: number } {
  return echoMapViewportByStratum.get(getEchoMapViewportKey(run)) ?? { x: 0, y: 70, zoom: ECHO_MAP_DEFAULT_ZOOM };
}

function setEchoMapViewportState(run: NonNullable<ReturnType<typeof getActiveEchoRun>>, state: { x: number; y: number; zoom: number }): void {
  echoMapViewportByStratum.set(getEchoMapViewportKey(run), state);
}

function cleanupEchoMapInteractions(): void {
  if (echoMapAnimationFrame !== null) {
    cancelAnimationFrame(echoMapAnimationFrame);
    echoMapAnimationFrame = null;
  }
  if (echoMapKeydownHandler) {
    window.removeEventListener("keydown", echoMapKeydownHandler);
    echoMapKeydownHandler = null;
  }
  if (echoMapKeyupHandler) {
    window.removeEventListener("keyup", echoMapKeyupHandler);
    echoMapKeyupHandler = null;
  }
  if (echoMapWheelHandler) {
    window.removeEventListener("wheel", echoMapWheelHandler);
    echoMapWheelHandler = null;
  }
  if (echoRunEscapeHandler) {
    window.removeEventListener("keydown", echoRunEscapeHandler);
    echoRunEscapeHandler = null;
  }
  echoMapPressedKeys = new Set<string>();
  echoMapShiftHeld = false;
}

function clampEchoMapViewport(
  state: { x: number; y: number; zoom: number },
  viewportEl: HTMLElement,
  boardWidth: number,
  boardHeight: number,
): { x: number; y: number; zoom: number } {
  const zoom = clampNumber(state.zoom, ECHO_MAP_MIN_ZOOM, ECHO_MAP_MAX_ZOOM);
  const scaledWidth = boardWidth * zoom;
  const scaledHeight = boardHeight * zoom;
  const maxX = Math.max(120, (scaledWidth - viewportEl.clientWidth) / 2 + 120);
  const maxY = Math.max(120, (scaledHeight - viewportEl.clientHeight) / 2 + 120);
  return {
    x: clampNumber(state.x, -maxX, maxX),
    y: clampNumber(state.y, -maxY, maxY),
    zoom,
  };
}

function applyEchoMapViewport(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): void {
  const viewportEl = document.getElementById("echoRunMapViewport") as HTMLElement | null;
  const canvasEl = document.getElementById("echoRunMapCanvas") as HTMLElement | null;
  const zoomLabelEl = document.getElementById("echoRunMapZoomLabel");
  if (!viewportEl || !canvasEl) {
    return;
  }

  const boardWidth = Number(canvasEl.dataset.boardWidth ?? "0");
  const boardHeight = Number(canvasEl.dataset.boardHeight ?? "0");
  if (!boardWidth || !boardHeight) {
    return;
  }

  const nextState = clampEchoMapViewport(getEchoMapViewportState(run), viewportEl, boardWidth, boardHeight);
  setEchoMapViewportState(run, nextState);
  canvasEl.style.transform = `translate(-50%, -50%) translate(${nextState.x}px, ${nextState.y}px) scale(${nextState.zoom})`;
  if (zoomLabelEl) {
    zoomLabelEl.textContent = `${Math.round(nextState.zoom * 100)}%`;
  }
}

function setupEchoMapInteractions(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): void {
  cleanupEchoMapInteractions();
  applyEchoMapViewport(run);

  const viewportEl = document.getElementById("echoRunMapViewport") as HTMLElement | null;
  const canvasEl = document.getElementById("echoRunMapCanvas") as HTMLElement | null;
  if (!viewportEl || !canvasEl) {
    return;
  }

  const boardWidth = Number(canvasEl.dataset.boardWidth ?? "0");
  const boardHeight = Number(canvasEl.dataset.boardHeight ?? "0");
  if (!boardWidth || !boardHeight) {
    return;
  }

  const updateLoop = () => {
    const activeState = { ...getEchoMapViewportState(run) };
    const speed = echoMapShiftHeld ? ECHO_MAP_PAN_SPEED * 1.8 : ECHO_MAP_PAN_SPEED;
    let didMove = false;

    if (echoMapPressedKeys.has("w") || echoMapPressedKeys.has("arrowup")) {
      activeState.y += speed;
      didMove = true;
    }
    if (echoMapPressedKeys.has("s") || echoMapPressedKeys.has("arrowdown")) {
      activeState.y -= speed;
      didMove = true;
    }
    if (echoMapPressedKeys.has("a") || echoMapPressedKeys.has("arrowleft")) {
      activeState.x += speed;
      didMove = true;
    }
    if (echoMapPressedKeys.has("d") || echoMapPressedKeys.has("arrowright")) {
      activeState.x -= speed;
      didMove = true;
    }

    if (didMove) {
      setEchoMapViewportState(run, activeState);
      applyEchoMapViewport(run);
    }

    echoMapAnimationFrame = window.requestAnimationFrame(updateLoop);
  };

  echoMapKeydownHandler = (event: KeyboardEvent) => {
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }
    if (event.key === "Shift") {
      echoMapShiftHeld = true;
      return;
    }
    const normalized = event.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(normalized)) {
      return;
    }
    event.preventDefault();
    echoMapPressedKeys.add(normalized);
  };

  echoMapKeyupHandler = (event: KeyboardEvent) => {
    if (event.key === "Shift") {
      echoMapShiftHeld = false;
      return;
    }
    echoMapPressedKeys.delete(event.key.toLowerCase());
  };

  echoMapWheelHandler = (event: WheelEvent) => {
    if (!viewportEl.contains(event.target as Node)) {
      return;
    }
    event.preventDefault();
    const state = getEchoMapViewportState(run);
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setEchoMapViewportState(run, {
      ...state,
      zoom: clampNumber(state.zoom + delta, ECHO_MAP_MIN_ZOOM, ECHO_MAP_MAX_ZOOM),
    });
    applyEchoMapViewport(run);
  };

  window.addEventListener("keydown", echoMapKeydownHandler);
  window.addEventListener("keyup", echoMapKeyupHandler);
  window.addEventListener("wheel", echoMapWheelHandler, { passive: false });

  const zoomInBtn = document.getElementById("echoRunMapZoomInBtn");
  zoomInBtn?.addEventListener("click", () => {
    const state = getEchoMapViewportState(run);
    setEchoMapViewportState(run, {
      ...state,
      zoom: clampNumber(state.zoom + 0.12, ECHO_MAP_MIN_ZOOM, ECHO_MAP_MAX_ZOOM),
    });
    applyEchoMapViewport(run);
  });

  const zoomOutBtn = document.getElementById("echoRunMapZoomOutBtn");
  zoomOutBtn?.addEventListener("click", () => {
    const state = getEchoMapViewportState(run);
    setEchoMapViewportState(run, {
      ...state,
      zoom: clampNumber(state.zoom - 0.12, ECHO_MAP_MIN_ZOOM, ECHO_MAP_MAX_ZOOM),
    });
    applyEchoMapViewport(run);
  });

  const resetBtn = document.getElementById("echoRunMapResetBtn");
  resetBtn?.addEventListener("click", () => {
    setEchoMapViewportState(run, { x: 0, y: 70, zoom: ECHO_MAP_DEFAULT_ZOOM });
    applyEchoMapViewport(run);
  });

  echoMapAnimationFrame = window.requestAnimationFrame(updateLoop);
}

function getSelectedEchoPreviewChoice(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): EchoRewardChoice | null {
  const unitChoices = run.draftChoices.filter((choice) => choice.unitOption);
  if (unitChoices.length === 0) {
    return null;
  }

  const stageKey = getEchoPreviewStageKey(run);
  const savedId = echoDraftPreviewByStage.get(stageKey);
  const matched = savedId ? unitChoices.find((choice) => choice.id === savedId) ?? null : null;
  if (matched) {
    return matched;
  }

  const fallback = unitChoices[0] ?? null;
  if (fallback) {
    echoDraftPreviewByStage.set(stageKey, fallback.id);
  }
  return fallback;
}

function setSelectedEchoPreviewChoice(run: NonNullable<ReturnType<typeof getActiveEchoRun>>, choiceId: string): void {
  echoDraftPreviewByStage.set(getEchoPreviewStageKey(run), choiceId);
}

function getEchoMapNodeState(
  node: EchoRunNode,
  run: NonNullable<ReturnType<typeof getActiveEchoRun>>,
): {
  isAvailable: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  isObscured: boolean;
  stateLabel: string;
} {
  const isAvailable = run.availableNodeIds.includes(node.id);
  const isCompleted = run.completedNodeIds.includes(node.id);
  const isCurrent = run.currentNodeId === node.id || run.pendingNodeId === node.id;
  const isObscured = !isAvailable && !isCompleted && !isCurrent;
  const stateLabel = isCompleted
    ? "Cleared"
    : isCurrent
      ? "Current Route"
      : isAvailable
        ? "Reachable"
        : node.stratum === run.currentStratum
          ? "Obscured"
          : "Future";

  return {
    isAvailable,
    isCompleted,
    isCurrent,
    isObscured,
    stateLabel,
  };
}

function getSelectedEchoMapNode(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): EchoRunNode | null {
  const currentNodes = Object.values(run.nodesById).filter((node) => node.stratum === run.currentStratum);
  if (currentNodes.length === 0) {
    return null;
  }

  const selectionKey = getEchoMapSelectionKey(run);
  const savedId = echoMapSelectionByStratum.get(selectionKey);
  const matched = savedId ? currentNodes.find((node) => node.id === savedId) ?? null : null;
  if (matched) {
    return matched;
  }

  const fallback = currentNodes.find((node) => getEchoMapNodeState(node, run).isCurrent)
    ?? currentNodes.find((node) => getEchoMapNodeState(node, run).isAvailable)
    ?? currentNodes[0]
    ?? null;

  if (fallback) {
    echoMapSelectionByStratum.set(selectionKey, fallback.id);
  }
  return fallback;
}

function setSelectedEchoMapNode(run: NonNullable<ReturnType<typeof getActiveEchoRun>>, nodeId: string): void {
  echoMapSelectionByStratum.set(getEchoMapSelectionKey(run), nodeId);
}

function getEchoMapNodeGlyph(nodeType: EchoRunNode["nodeType"], obscured: boolean): string {
  if (obscured) {
    return "?";
  }
  switch (nodeType) {
    case "support":
      return "+";
    case "elite":
      return "!";
    case "boss":
      return "B";
    case "boss_chain_a":
      return "I";
    case "boss_chain_b":
      return "II";
    case "milestone":
      return "M";
    case "encounter":
    default:
      return "o";
  }
}

function getEchoMapNodeShape(nodeType: EchoRunNode["nodeType"]): string {
  switch (nodeType) {
    case "support":
      return "square";
    case "elite":
      return "diamond";
    case "boss":
    case "boss_chain_a":
    case "boss_chain_b":
      return "hex";
    case "milestone":
      return "pill";
    case "encounter":
    default:
      return "circle";
  }
}

function getEchoMapNodeActionLabel(node: EchoRunNode): string {
  return node.nodeType === "support" || node.nodeType === "milestone" ? "ACCESS NODE" : "ENGAGE NODE";
}

function getEchoMapAnchors(count: number): number[] {
  if (count <= 1) {
    return [0.5];
  }
  if (count === 2) {
    return [0.34, 0.66];
  }
  if (count === 3) {
    return [0.2, 0.5, 0.8];
  }
  return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1));
}

function getEchoLayerLabel(layer: number, totalLayers: number, layerNodes: EchoRunNode[]): string {
  if (layer === 1) {
    return "Entry";
  }
  if (layer === totalLayers) {
    return "Milestone";
  }
  const hasBoss = layerNodes.some((node) => node.nodeType === "boss" || node.nodeType === "boss_chain_a" || node.nodeType === "boss_chain_b");
  if (hasBoss) {
    return "Boss";
  }
  const hasElite = layerNodes.some((node) => node.nodeType === "elite");
  if (hasElite) {
    return "Pressure";
  }
  const hasSupport = layerNodes.some((node) => node.nodeType === "support");
  if (hasSupport) {
    return "Support";
  }
  return `Layer ${layer.toString().padStart(2, "0")}`;
}

function formatEchoEquipmentLabel(equipmentId: string | null, slotLabel: string): string {
  if (!equipmentId) {
    return `${slotLabel}: None`;
  }
  const equipment = getAllStarterEquipment()[equipmentId];
  return `${slotLabel}: ${equipment?.name ?? equipmentId}`;
}

function renderEchoUnitDraftPreview(unit: EchoUnitDraftOption): string {
  const affinityLines = Object.entries(unit.affinities ?? {})
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .map(([key, value]) => `
      <div class="echo-run-draft-preview__affinity-row">
        <span>${key.toUpperCase()}</span>
        <strong>${Math.round(Number(value) * 100)}%</strong>
      </div>
    `)
    .join("");

  const loadoutLines = [
    formatEchoEquipmentLabel(unit.loadout.primaryWeapon, "Primary"),
    formatEchoEquipmentLabel(unit.loadout.secondaryWeapon, "Secondary"),
    formatEchoEquipmentLabel(unit.loadout.helmet, "Helmet"),
    formatEchoEquipmentLabel(unit.loadout.chestpiece, "Chest"),
    formatEchoEquipmentLabel(unit.loadout.accessory1, "Accessory I"),
    formatEchoEquipmentLabel(unit.loadout.accessory2, "Accessory II"),
  ];

  return `
    <aside class="echo-run-draft-preview" aria-label="Draft unit preview">
      <div class="echo-run-draft-preview__kicker">FULL UNIT READOUT</div>
      <h3 class="echo-run-draft-preview__title">${unit.name}</h3>
      <div class="echo-run-draft-preview__meta">${unit.baseClass.toUpperCase()} // PWR ${unit.pwr} // ${unit.pwrBand.toUpperCase()} BAND</div>
      <div class="echo-run-tag-row">
        ${unit.affinityLean.map((entry) => `<span class="echo-run-tag">${entry.toUpperCase()}</span>`).join("")}
      </div>
      <div class="echo-run-draft-preview__trait">${unit.traitLabel ?? "Adaptive draft frame"}</div>

      <div class="echo-run-draft-preview__section">
        <div class="echo-run-draft-preview__section-title">Stats</div>
        <div class="echo-run-draft-preview__stats">
          <div class="echo-run-draft-preview__stat"><span>HP</span><strong>${unit.stats.maxHp}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>ATK</span><strong>${unit.stats.atk}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>DEF</span><strong>${unit.stats.def}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>AGI</span><strong>${unit.stats.agi}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>ACC</span><strong>${unit.stats.acc}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>PWR</span><strong>${unit.pwr}</strong></div>
        </div>
      </div>

      <div class="echo-run-draft-preview__section">
        <div class="echo-run-draft-preview__section-title">Gear</div>
        <div class="echo-run-draft-preview__loadout">
          ${loadoutLines.map((line) => `<div class="echo-run-draft-preview__loadout-row">${line}</div>`).join("")}
        </div>
      </div>

      <div class="echo-run-draft-preview__section">
        <div class="echo-run-draft-preview__section-title">Affinities</div>
        <div class="echo-run-draft-preview__affinities">
          ${affinityLines}
        </div>
      </div>
    </aside>
  `;
}

function syncEchoScreenState(): void {
  updateGameState((prev) => ({
    ...prev,
    phase: "echo",
    currentBattle: null,
  }));
}

function launchEchoBattleFromScreen(): boolean {
  const battle = launchActiveEchoEncounterBattle();
  if (!battle) {
    return false;
  }

  updateGameState((prev) => ({
    ...prev,
    phase: "battle",
    currentBattle: battle,
  }));
  void triggerAutosave(getGameState());

  import("./BattleScreen").then(({ renderBattleScreen }) => {
    renderBattleScreen();
  });
  return true;
}

function leaveEchoRunsToMainMenu(): void {
  clearActiveEchoRun();
  enableAutosave(() => getGameState());
  updateGameState((prev) => ({
    ...prev,
    phase: "shell",
    currentBattle: null,
  }));
  import("./MainMenuScreen").then(({ renderMainMenu }) => {
    renderMainMenu();
  });
}

function returnToEchoRunTitleScreen(): void {
  import("./EchoRunTitleScreen").then(({ renderEchoRunTitleScreen }) => {
    renderEchoRunTitleScreen();
  });
}

function exitEchoRunToTitleScreen(): void {
  cleanupEchoMapInteractions();
  returnToEchoRunTitleScreen();
}

function setupEchoRunEscapeShortcut(): void {
  if (echoRunEscapeHandler) {
    window.removeEventListener("keydown", echoRunEscapeHandler);
  }
  echoRunEscapeHandler = (event: KeyboardEvent) => {
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    exitEchoRunToTitleScreen();
  };
  window.addEventListener("keydown", echoRunEscapeHandler);
}

function renderUnitSummaryCard(unitId: string, run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  const unit = run.unitsById[unitId];
  if (!unit) {
    return "";
  }

  const affinityPairs = Object.entries(unit.affinities ?? {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 2)
    .map(([key]) => key.toUpperCase());
  const classLabel = String((unit as any).classId ?? unit.unitClass ?? "unit").toUpperCase();

  return `
    <div class="echo-run-summary-card">
      <div class="echo-run-summary-card__title">${unit.name}</div>
      <div class="echo-run-summary-card__meta">${classLabel} | PWR ${unit.pwr ?? "?"} | HP ${unit.hp}/${unit.maxHp}</div>
      <div class="echo-run-tag-row">
        ${affinityPairs.map((tag) => `<span class="echo-run-tag">${tag}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderFieldSummary(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  if (run.fields.length === 0) {
    return `<div class="echo-run-empty">No Echo Fields drafted yet.</div>`;
  }

  return run.fields.map((field) => `
    <div class="echo-run-summary-card echo-run-summary-card--field">
      <div class="echo-run-summary-card__title">${field.name}</div>
      <div class="echo-run-summary-card__meta">LV ${field.level}/${field.maxLevel} | RADIUS ${field.radius}</div>
      <div class="echo-run-summary-card__copy">${field.effectLabel} | ${field.description}</div>
    </div>
  `).join("");
}

function renderModifierSummary(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  if (run.tacticalModifiers.length === 0) {
    return `<div class="echo-run-empty">No tactical modifiers drafted yet.</div>`;
  }

  return run.tacticalModifiers.map((modifier) => {
    const def = getEchoModifierDef(modifier.defId);
    return `
      <div class="echo-run-summary-card echo-run-summary-card--modifier">
        <div class="echo-run-summary-card__title">${def?.name ?? modifier.defId}</div>
        <div class="echo-run-summary-card__meta">${(def?.trigger ?? "proc").replace(/_/g, " ").toUpperCase()}</div>
        <div class="echo-run-summary-card__copy">${def?.description ?? "Run-scoped tactical modifier."}</div>
      </div>
    `;
  }).join("");
}

function renderEchoSidebarPanels(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  return `
    <section class="echo-run-panel">
      <div class="echo-run-panel__title">Draft Squad</div>
      ${run.squadUnitIds.length > 0 ? run.squadUnitIds.map((unitId) => renderUnitSummaryCard(unitId, run)).join("") : `<div class="echo-run-empty">No drafted units yet.</div>`}
    </section>
    <section class="echo-run-panel">
      <div class="echo-run-panel__title">Echo Fields</div>
      ${renderFieldSummary(run)}
    </section>
    <section class="echo-run-panel">
      <div class="echo-run-panel__title">Tactical Modifiers</div>
      ${renderModifierSummary(run)}
    </section>
    ${run.lastEncounterSummary ? `
      <section class="echo-run-panel echo-run-panel--summary">
        <div class="echo-run-panel__title">Last Encounter</div>
        <div class="echo-run-summary-stat"><span>Type</span><strong>${run.lastEncounterSummary.encounterType.toUpperCase()}</strong></div>
        <div class="echo-run-summary-stat"><span>Score</span><strong>+${run.lastEncounterSummary.scoreGained}</strong></div>
        <div class="echo-run-summary-stat"><span>Rerolls</span><strong>+${run.lastEncounterSummary.rerollsEarned}</strong></div>
        <div class="echo-run-summary-stat"><span>Field Triggers</span><strong>${run.lastEncounterSummary.fieldTriggerCount}</strong></div>
      </section>
    ` : ""}
  `;
}

function renderChoiceCard(
  choice: NonNullable<ReturnType<typeof getActiveEchoRun>>["draftChoices"][number],
  options: { isPreviewed: boolean },
): string {
  const unit = choice.unitOption;
  const field = choice.fieldDefinition;
  const modifierDef = getEchoModifierDef(choice.modifierDefId);
  const recovery = choice.recoveryOption;
  const training = choice.trainingOption;

  let detailBlock = `
    <div class="echo-run-choice-card__detail">
      <div class="echo-run-choice-card__line">${(modifierDef?.trigger ?? "proc").replace(/_/g, " ").toUpperCase()}</div>
      <div class="echo-run-choice-card__line">${modifierDef?.description ?? choice.description}</div>
    </div>
  `;

  if (unit) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">${unit.baseClass.toUpperCase()} | ${unit.pwrBand.toUpperCase()} BAND</div>
        <div class="echo-run-choice-card__line">Lean: ${unit.affinityLean.map((entry) => entry.toUpperCase()).join(" / ")}</div>
        <div class="echo-run-choice-card__line">${unit.traitLabel ?? "Adaptive draft frame"}</div>
      </div>
    `;
  } else if (field) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">LEVEL ${field.level} | RADIUS ${field.radius}</div>
        <div class="echo-run-choice-card__line">${field.effectLabel}</div>
        <div class="echo-run-choice-card__line">${field.description}</div>
      </div>
    `;
  } else if (recovery) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">${recovery.name.toUpperCase()}</div>
        <div class="echo-run-choice-card__line">${recovery.description}</div>
        ${recovery.rerollsGranted ? `<div class="echo-run-choice-card__line">+${recovery.rerollsGranted} REROLL</div>` : ""}
      </div>
    `;
  } else if (training) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">${training.name.toUpperCase()}</div>
        <div class="echo-run-choice-card__line">${training.description}</div>
        <div class="echo-run-choice-card__line">TEAM-WIDE +${training.amount} ${training.stat.toUpperCase()}</div>
      </div>
    `;
  }

  return `
    <article class="echo-run-choice-card echo-run-choice-card--${choice.lane}${options.isPreviewed ? " echo-run-choice-card--previewed" : ""}">
      <div class="echo-run-choice-card__lane">${choice.lane.replace(/_/g, " ").toUpperCase()}</div>
      <div class="echo-run-choice-card__title">${choice.title}</div>
      <div class="echo-run-choice-card__subtitle">${choice.subtitle}</div>
      <div class="echo-run-choice-card__copy">${choice.description}</div>
      ${detailBlock}
      ${unit ? `<button class="echo-run-choice-card__inspect" type="button" data-echo-preview-id="${choice.id}">UNIT INFO</button>` : ""}
      <button class="echo-run-choice-card__button" type="button" data-echo-choice-id="${choice.id}">SELECT</button>
    </article>
  `;
}

function renderMapNodeCard(
  node: EchoRunNode,
  run: NonNullable<ReturnType<typeof getActiveEchoRun>>,
): string {
  const nodeState = getEchoMapNodeState(node, run);
  const title = nodeState.isObscured ? "Unknown Contact" : node.title;
  const subtitle = nodeState.isObscured ? "Route signature unavailable" : node.subtitle;
  const meta = nodeState.isObscured ? "Advance deeper to resolve this node." : `Tier ${node.dangerTier} // ${node.rewardBias}`;
  const glyph = getEchoMapNodeGlyph(node.nodeType, nodeState.isObscured);
  const shape = getEchoMapNodeShape(node.nodeType);

  return `
    <button
      class="echo-run-map-node echo-run-map-node--${node.nodeType}${nodeState.isAvailable ? " echo-run-map-node--available" : ""}${nodeState.isCompleted ? " echo-run-map-node--completed" : ""}${nodeState.isCurrent ? " echo-run-map-node--current" : ""}${nodeState.isObscured ? " echo-run-map-node--obscured" : ""}"
      type="button"
      data-echo-map-select="${node.id}"
      aria-label="${title}"
    >
      <span class="echo-run-map-node__shape echo-run-map-node__shape--${shape}">
        <span class="echo-run-map-node__glyph">${glyph}</span>
      </span>
      <span class="echo-run-map-node__state">${nodeState.stateLabel}</span>
      <span class="echo-run-map-node__title">${title}</span>
      <span class="echo-run-map-node__subtitle">${subtitle}</span>
      <span class="echo-run-map-node__meta">${meta}</span>
    </button>
  `;
}

function renderMapStage(
  run: NonNullable<ReturnType<typeof getActiveEchoRun>>,
  stageTitle: string,
  stageCopy: string,
): string {
  const currentStratumNodes = Object.values(run.nodesById)
    .filter((node) => node.stratum === run.currentStratum)
    .sort((left, right) => left.layer - right.layer || left.branchIndex - right.branchIndex);

  const grouped = new Map<number, EchoRunNode[]>();
  currentStratumNodes.forEach((node) => {
    const bucket = grouped.get(node.layer) ?? [];
    bucket.push(node);
    grouped.set(node.layer, bucket);
  });

  const layerEntries = Array.from(grouped.entries()).sort((left, right) => left[0] - right[0]);
  const maxLayer = layerEntries[layerEntries.length - 1]?.[0] ?? 1;
  const boardWidth = 1700;
  const boardHeight = Math.max(1280, 420 + maxLayer * 190);
  const paddingX = 180;
  const paddingY = 150;
  const innerWidth = boardWidth - paddingX * 2;
  const innerHeight = boardHeight - paddingY * 2;
  const positions = new Map<string, { x: number; y: number }>();

  layerEntries.forEach(([layer, nodes]) => {
    const anchors = getEchoMapAnchors(nodes.length);
    const sway = nodes.length === 1 ? 0 : ((layer % 2 === 0) ? 0.025 : -0.025);
    nodes.forEach((node, index) => {
      const anchor = clampNumber(anchors[index] + sway * (index - ((nodes.length - 1) / 2)), 0.12, 0.88);
      const progress = maxLayer <= 1 ? 0 : (layer - 1) / (maxLayer - 1);
      const x = paddingX + anchor * innerWidth;
      const y = boardHeight - paddingY - progress * innerHeight;
      positions.set(node.id, { x, y });
    });
  });

  const selectedNode = getSelectedEchoMapNode(run);
  const selectedNodeState = selectedNode ? getEchoMapNodeState(selectedNode, run) : null;
  const selectedNodeTitle = !selectedNode
    ? "No Route Selected"
    : selectedNodeState?.isObscured
      ? "Unknown Contact"
      : selectedNode.title;
  const selectedNodeSubtitle = !selectedNode
    ? "No data"
    : selectedNodeState?.isObscured
      ? "Route signature unavailable"
      : selectedNode.subtitle;
  const selectedNodeDescription = !selectedNode
    ? "Select a node to inspect the current route."
    : selectedNodeState?.isObscured
      ? "This contact sits beyond current route intel. Clear reachable nodes to resolve its exact function."
      : selectedNode.description;
  const selectedNodeMeta = !selectedNode
    ? "No target available."
    : selectedNodeState?.isObscured
      ? "Data obscured // deeper route required"
      : `Tier ${selectedNode.dangerTier} // ${selectedNode.rewardBias}`;
  const selectedNodeTypeLabel = !selectedNode
    ? "NO NODE"
    : selectedNodeState?.isObscured
      ? "UNKNOWN CONTACT"
      : selectedNode.nodeType.replace(/_/g, " ").toUpperCase();

  const connectionSvg = run.edges
    .filter((edge) => {
      const fromNode = run.nodesById[edge.fromNodeId];
      const toNode = run.nodesById[edge.toNodeId];
      return fromNode?.stratum === run.currentStratum && toNode?.stratum === run.currentStratum;
    })
    .map((edge) => {
      const from = positions.get(edge.fromNodeId);
      const to = positions.get(edge.toNodeId);
      const fromNode = run.nodesById[edge.fromNodeId];
      const toNode = run.nodesById[edge.toNodeId];
      if (!from || !to || !fromNode || !toNode) {
        return "";
      }
      const fromState = getEchoMapNodeState(fromNode, run);
      const toState = getEchoMapNodeState(toNode, run);
      const controlY = (from.y + to.y) / 2;
      const selectedConnection = selectedNode && (selectedNode.id === fromNode.id || selectedNode.id === toNode.id);
      const connectionClass = fromState.isCompleted && (toState.isCompleted || toState.isCurrent)
        ? "echo-run-map-connection--cleared"
        : fromState.isCurrent || fromState.isAvailable || toState.isAvailable || toState.isCurrent
          ? "echo-run-map-connection--reachable"
          : toState.isObscured
            ? "echo-run-map-connection--obscured"
            : "echo-run-map-connection--idle";
      return `
        <path
          class="echo-run-map-connection ${connectionClass}${selectedConnection ? " echo-run-map-connection--selected" : ""}"
          d="M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${from.x.toFixed(1)} ${controlY.toFixed(1)}, ${to.x.toFixed(1)} ${controlY.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}"
        />
      `;
    })
    .join("");

  const layerMarkers = layerEntries
    .map(([layer, nodes]) => {
      const sample = nodes[0];
      const point = sample ? positions.get(sample.id) : null;
      if (!point) {
        return "";
      }
      const layerObscured = nodes.every((node) => getEchoMapNodeState(node, run).isObscured);
      return `
        <div class="echo-run-map-layer-marker${layerObscured ? " echo-run-map-layer-marker--obscured" : ""}" style="top:${((point.y / boardHeight) * 100).toFixed(2)}%;">
          ${layerObscured ? "Obscured Layer" : getEchoLayerLabel(layer, maxLayer, nodes)}
        </div>
      `;
    })
    .join("");

  const nodesHtml = currentStratumNodes
    .map((node) => {
      const point = positions.get(node.id);
      if (!point) {
        return "";
      }
      const isSelected = selectedNode?.id === node.id;
      return `
        <div class="echo-run-map-node-wrap${isSelected ? " echo-run-map-node-wrap--selected" : ""}" style="left:${((point.x / boardWidth) * 100).toFixed(2)}%; top:${((point.y / boardHeight) * 100).toFixed(2)}%;">
          ${renderMapNodeCard(node, run)}
        </div>
      `;
    })
    .join("");

  return `
    <section class="echo-run-map-scene">
      <div class="echo-run-map-viewport" id="echoRunMapViewport">
        <div
          class="echo-run-map-canvas"
          id="echoRunMapCanvas"
          data-board-width="${boardWidth}"
          data-board-height="${boardHeight}"
        >
          <div class="echo-run-map-board" style="width:${boardWidth}px; height:${boardHeight}px;">
            <div class="echo-run-map-board__grid" aria-hidden="true"></div>
            <svg class="echo-run-map-board__routes" viewBox="0 0 ${boardWidth} ${boardHeight}" preserveAspectRatio="none" aria-hidden="true">
              ${connectionSvg}
            </svg>
            <div class="echo-run-map-board__markers">
              ${layerMarkers}
            </div>
            <div class="echo-run-map-board__nodes">
              ${nodesHtml}
            </div>
          </div>
        </div>
      </div>

      <section class="echo-run-map-window echo-run-map-window--command">
        <div class="echo-run-map-window__kicker">S/COM_OS // ECHO ROUTE</div>
        <h2 class="echo-run-map-window__title">${stageTitle}</h2>
        <p class="echo-run-map-window__copy">${stageCopy}</p>
        <div class="echo-run-map-window__actions">
          <button class="echo-run-secondary-btn" type="button" data-echo-return-title="true">ECHO TITLE</button>
          <button class="echo-run-secondary-btn" type="button" id="echoRunAbandonBtn">ABANDON RUN</button>
        </div>
      </section>

      <aside class="echo-run-map-window-stack echo-run-map-window-stack--left">
        ${renderEchoSidebarPanels(run)}
      </aside>

      <section class="echo-run-map-window echo-run-map-window--status">
        <div class="echo-run-map-window__kicker">Route State</div>
        <div class="echo-run-map-window__actions echo-run-map-window__actions--tight">
          <button class="echo-run-secondary-btn" type="button" data-echo-return-title="true">BACK TO ECHO TITLE</button>
        </div>
        <div class="echo-run-map-stage__summary">
          <div class="echo-run-meta-chip"><span>Boss Chains</span><strong>${run.bossChainsCleared}</strong></div>
          <div class="echo-run-meta-chip"><span>Milestones</span><strong>${run.milestonesReached}</strong></div>
          <div class="echo-run-meta-chip"><span>Reachable Nodes</span><strong>${run.availableNodeIds.length}</strong></div>
        </div>
        <div class="echo-run-map-zoom-controls">
          <button class="echo-run-secondary-btn echo-run-map-zoom-controls__btn" type="button" id="echoRunMapZoomOutBtn">-</button>
          <div class="echo-run-map-zoom-controls__label" id="echoRunMapZoomLabel">100%</div>
          <button class="echo-run-secondary-btn echo-run-map-zoom-controls__btn" type="button" id="echoRunMapZoomInBtn">+</button>
          <button class="echo-run-secondary-btn echo-run-map-zoom-controls__reset" type="button" id="echoRunMapResetBtn">RESET VIEW</button>
        </div>
      </section>

      <section class="echo-run-map-window echo-run-map-window--detail echo-run-map-detail${selectedNodeState?.isObscured ? " echo-run-map-detail--obscured" : ""}">
        <div class="echo-run-map-detail__copy">
          <div class="echo-run-map-detail__kicker">${selectedNodeState?.stateLabel ?? "No Route"} // ${selectedNodeTypeLabel}</div>
          <h3 class="echo-run-map-detail__title">${selectedNodeTitle}</h3>
          <div class="echo-run-map-detail__subtitle">${selectedNodeSubtitle}</div>
          <div class="echo-run-map-detail__meta">${selectedNodeMeta}</div>
          <p class="echo-run-map-detail__description">${selectedNodeDescription}</p>
        </div>
        <div class="echo-run-map-detail__actions">
          ${selectedNode ? `
            <button
              class="echo-run-choice-card__button echo-run-map-detail__button"
              type="button"
              data-echo-node-id="${selectedNode.id}"
              ${selectedNodeState?.isAvailable ? "" : "disabled"}
            >
              ${getEchoMapNodeActionLabel(selectedNode)}
            </button>
          ` : ""}
          ${selectedNode && !selectedNodeState?.isAvailable ? `
            <div class="echo-run-map-detail__hint">
              ${selectedNodeState?.isObscured ? "Clear a reachable route to resolve this contact." : "This route is not unlocked yet."}
            </div>
          ` : ""}
        </div>
      </section>

      <div class="echo-run-map-hud-hint">
        WASD / ARROW KEYS TO PAN<br />MOUSE WHEEL OR +/- TO ZOOM
      </div>
    </section>
  `;
}

function renderEchoResults(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  const summary = getEchoResultsSummary();
  const lastSummary = run.lastEncounterSummary;

  return `
    <section class="echo-run-results">
      <div class="echo-run-results__hero">
        <div class="echo-run-results__kicker">S/COM_OS // ECHO SUMMARY</div>
        <h1 class="echo-run-results__title">RUN COMPLETE</h1>
        <p class="echo-run-results__copy">The simulation has ended. Draft state is ready to be discarded or restarted from zero.</p>
      </div>
      <div class="echo-run-results__grid">
        <div class="echo-run-results__item"><span>Total Score</span><strong>${summary?.totalScore ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Encounters Cleared</span><strong>${summary?.encountersCleared ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Units Drafted</span><strong>${summary?.unitsDrafted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Units Lost</span><strong>${summary?.unitsLost ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Fields Drafted</span><strong>${summary?.fieldsDrafted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Field Upgrades</span><strong>${summary?.fieldsUpgraded ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Modifiers Drafted</span><strong>${summary?.tacticalModifiersDrafted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Challenges Completed</span><strong>${summary?.challengesCompleted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Milestones</span><strong>${run.milestonesReached}</strong></div>
        <div class="echo-run-results__item"><span>Boss Chains</span><strong>${run.bossChainsCleared}</strong></div>
      </div>
      ${lastSummary ? `
        <div class="echo-run-results__last">
          <div class="echo-run-results__last-title">FINAL ENCOUNTER</div>
          <div class="echo-run-results__last-copy">
            Encounter ${lastSummary.encounterNumber} | ${lastSummary.encounterType.toUpperCase()} |
            ${lastSummary.challengeCompleted ? "Challenge complete" : lastSummary.challengeFailed ? "Challenge missed" : "No challenge"}
          </div>
        </div>
      ` : ""}
      <div class="echo-run-results__actions">
        <button class="echo-run-primary-btn" type="button" id="echoRunRestartBtn">START NEW ECHO RUN</button>
        <button class="echo-run-secondary-btn" type="button" data-echo-return-title="true">RETURN TO ECHO TITLE</button>
        <button class="echo-run-secondary-btn" type="button" id="echoRunReturnMenuBtn">RETURN TO MAIN MENU</button>
      </div>
    </section>
  `;
}

export function renderEchoRunScreen(): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const run = getActiveEchoRun();
  if (!run) {
    leaveEchoRunsToMainMenu();
    return;
  }

  syncEchoScreenState();
  cleanupEchoMapInteractions();

  const stageTitle = run.stage === "initial_units"
    ? "Initial Unit Draft"
    : run.stage === "initial_field"
      ? "Initial Echo Field"
      : run.stage === "map"
        ? `Stratum ${run.currentStratum} Route Map`
        : run.stage === "milestone"
          ? `Milestone ${run.currentStratum}`
      : run.stage === "reward"
        ? "Reward Draft"
        : "Results";

  const stageCopy = run.stage === "initial_units"
    ? "Choose three temporary operators to build your starting draft squad."
    : run.stage === "initial_field"
      ? "Choose an initial Echo Field"
      : run.stage === "map"
        ? "Select one reachable node. Support nodes resolve immediately, while encounter nodes launch a battle."
        : run.stage === "milestone"
          ? "Choose one milestone package, then continue into the next endless stratum."
      : run.stage === "reward"
        ? "Pick exactly one reward lane and keep the run moving."
      : "The simulation is over. Nothing here carries into story progression.";

  const selectedPreviewChoice = getSelectedEchoPreviewChoice(run);
  const shouldShowDraftStage = run.stage === "initial_units" || run.stage === "initial_field" || run.stage === "reward" || run.stage === "milestone";
  const previewRailContent = selectedPreviewChoice?.unitOption
    ? `
      <aside class="echo-run-preview-rail" aria-label="Full unit readout">
        ${renderEchoUnitDraftPreview(selectedPreviewChoice.unitOption)}
      </aside>
    `
    : "";
  if (run.stage === "map") {
    app.innerHTML = `
      <div class="echo-run-root echo-run-root--map">
        ${renderMapStage(run, stageTitle, stageCopy)}
      </div>
    `;
    setupEchoMapInteractions(run);
  } else {
  const mainContent = run.stage === "results"
    ? renderEchoResults(run)
    : `
        <section class="echo-run-choice-stage">
          <div class="echo-run-choice-stage__header">
            <div class="echo-run-choice-stage__title">${stageTitle}</div>
            <div class="echo-run-choice-stage__actions">
              ${run.stage === "reward" ? `
                <button class="echo-run-secondary-btn" type="button" id="echoRunRerollBtn" ${run.rerolls <= 0 ? "disabled" : ""}>REROLL (${run.rerolls})</button>
              ` : ""}
              <button class="echo-run-secondary-btn" type="button" data-echo-return-title="true">ECHO TITLE</button>
              <button class="echo-run-secondary-btn" type="button" id="echoRunAbandonBtn">ABANDON RUN</button>
            </div>
          </div>
          <div class="echo-run-choice-stage__body">
            <div class="echo-run-choice-grid">
              ${run.draftChoices.map((choice) => renderChoiceCard(choice, {
                isPreviewed: selectedPreviewChoice?.id === choice.id,
              })).join("")}
            </div>
          </div>
        </section>
      `;

  app.innerHTML = `
    <div class="echo-run-root">
      <div class="echo-run-shell">
        <header class="echo-run-header">
          <div>
            <div class="echo-run-header__kicker">S/COM_OS // ECHO RUNS</div>
            <h1 class="echo-run-header__title">${stageTitle}</h1>
            <p class="echo-run-header__copy">${stageCopy}</p>
          </div>
          <div class="echo-run-header__meta">
            <button class="echo-run-secondary-btn echo-run-header__back-btn" type="button" data-echo-return-title="true">BACK TO ECHO TITLE</button>
            <div class="echo-run-meta-chip"><span>Encounter</span><strong>${run.encounterNumber}</strong></div>
            <div class="echo-run-meta-chip"><span>Rerolls</span><strong>${run.rerolls}</strong></div>
            <div class="echo-run-meta-chip"><span>Score</span><strong>${run.totalScore}</strong></div>
          </div>
        </header>

        <div class="echo-run-body${previewRailContent ? " echo-run-body--with-preview" : ""}">
          <aside class="echo-run-sidebar">
            ${renderEchoSidebarPanels(run)}
          </aside>

          <main class="echo-run-main">
            ${mainContent}
          </main>

          ${previewRailContent}
        </div>
      </div>
    </div>
  `;
  }

  if (shouldShowDraftStage) {
    document.querySelectorAll<HTMLElement>("[data-echo-choice-id]").forEach((button) => {
      button.onclick = () => {
        const choiceId = button.getAttribute("data-echo-choice-id");
        if (!choiceId) {
          return;
        }
        applyEchoDraftChoice(choiceId);
        renderEchoRunScreen();
      };
    });

    document.querySelectorAll<HTMLElement>("[data-echo-preview-id]").forEach((button) => {
      button.onclick = () => {
        const choiceId = button.getAttribute("data-echo-preview-id");
        if (!choiceId) {
          return;
        }
        setSelectedEchoPreviewChoice(run, choiceId);
        renderEchoRunScreen();
      };
    });
  }

  document.querySelectorAll<HTMLElement>("[data-echo-map-select]").forEach((button) => {
    button.onclick = () => {
      const nodeId = button.getAttribute("data-echo-map-select");
      if (!nodeId) {
        return;
      }
      setSelectedEchoMapNode(run, nodeId);
      renderEchoRunScreen();
    };
  });

  document.querySelectorAll<HTMLElement>("[data-echo-node-id]").forEach((button) => {
    button.onclick = () => {
      const nodeId = button.getAttribute("data-echo-node-id");
      if (!nodeId) {
        return;
      }
      const result = selectEchoMapNode(nodeId);
      if (result === "battle") {
        launchEchoBattleFromScreen();
        return;
      }
      renderEchoRunScreen();
    };
  });

  document.querySelectorAll<HTMLElement>('[data-echo-return-title="true"]').forEach((button) => {
    button.onclick = () => {
      exitEchoRunToTitleScreen();
    };
  });

  const rerollBtn = document.getElementById("echoRunRerollBtn");
  if (rerollBtn) {
    rerollBtn.onclick = () => {
      rerollActiveEchoChoices();
      renderEchoRunScreen();
    };
  }

  const abandonBtn = document.getElementById("echoRunAbandonBtn");
  if (abandonBtn) {
    abandonBtn.onclick = async () => {
      if (!(await showConfirmDialog({
        title: "ABANDON ECHO RUN",
        message: "Abandon this Echo Run and move straight to the results summary?",
        confirmLabel: "ABANDON",
        variant: "danger",
        restoreFocusSelector: "#echoRunAbandonBtn",
      }))) {
        return;
      }
      abandonActiveEchoRun();
      renderEchoRunScreen();
    };
  }

  const restartBtn = document.getElementById("echoRunRestartBtn");
  if (restartBtn) {
    restartBtn.onclick = () => {
      startEchoRunSession();
      renderEchoRunScreen();
    };
  }

  const returnMenuBtn = document.getElementById("echoRunReturnMenuBtn");
  if (returnMenuBtn) {
    returnMenuBtn.onclick = () => {
      leaveEchoRunsToMainMenu();
    };
  }

  setupEchoRunEscapeShortcut();
}

export default renderEchoRunScreen;
