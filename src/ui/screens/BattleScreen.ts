// src/ui/screens/BattleScreen.ts
// Battle screen with unit panel + weapon window alongside hand at bottom

import { getGameState, updateGameState } from "../../state/gameStore";
import { markCurrentOperationRoomVisited, renderActiveOperationSurface } from "./activeOperationFlow";
import { recordBattleVictory, syncCampaignToGameState, getActiveRun } from "../../core/campaignManager";
const renderOperationMap = renderActiveOperationSurface; // Alias for compatibility
import { addCardsToLibrary } from "../../core/gearWorkbench";
import { getUnlockableById } from "../../core/unlockables";
import { handleKeyDown as handlePlayerInputKeyDown, handleKeyUp as handlePlayerInputKeyUp, getPlayerInput } from "../../core/playerInput";
import { type BattleCameraViewPreset, EchoBattleContext, EchoFieldPlacement, PlayerId, SESSION_PLAYER_SLOTS, SquadBattleTurnState, SessionPlayerSlot } from "../../core/types";
import {
  getBattleStateById,
  getMountedOrActiveBattleState,
  mountBattleContextById,
  mountBattleState,
  replaceBattleStateById,
} from "../../core/session";

import {
  applyStrain,
  BattleState,
  advanceTurn,
  canUnitInteract,
  createTestBattleForCurrentParty,
  evaluateBattleOutcome,
  getEffectivePlacedUnitIds,
  getPlacementTilesForUnit,
  getSquadObjectiveControlSide,
  getUnitInteractionObject,
  updateUnitWeaponState,
  interactWithMapObject,
  moveUnit,
  performEnemyTurn,
  BASE_STRAIN_THRESHOLD,
  BattleUnitState,
  isOverStrainThreshold,
  placeUnit,
  quickPlaceUnits,
  confirmPlacement,
  removePlacedUnit as unplaceBattleUnit,
  setPlacementSelectedUnit as selectBattlePlacementUnit,
  getBattleUnitEquippedWeaponId,
  getEquippedWeapon,
  getMovePath,
  getReachableMovementTiles,
  getUnitMovementRange,
  Vec2,
} from "../../core/battle";
import { hasLineOfSight } from "../../core/lineOfSight";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { createTrainingBattle } from "../../core/trainingBattle";
import { getAllStarterEquipment } from "../../core/equipment";
import { getResolvedBattleCard, toCoreCard } from "../../core/cardCatalog";
import { getBattleUnitPortraitPath } from "../../core/portraits";
import { renderWeaponWindow as renderSharedWeaponWindow } from "../components/weaponWindow";
import { updateQuestProgress } from "../../quests/questManager";
import { trackBattleSurvival } from "../../core/affinityBattle";
import { getPlayerControllerLabel, grantSessionResources } from "../../core/session";
import {
  applyTheaterBattleOutcome,
  applyTheaterOperationFailure,
  hasTheaterOperation,
} from "../../core/theaterSystem";
import {
  clearControllerContext,
  getControllerActionLabel,
  registerControllerContext,
  setControllerMode,
  updateFocusableElements,
} from "../../core/controllerSupport";
import { returnFromBaseCampScreen, type BaseCampReturnTo } from "./baseCampReturn";
import { showSystemPing } from "../components/systemPing";
import { showTutorialCalloutSequence } from "../components/tutorialCallout";
import { playPlaceholderSfx, setMusicCue } from "../../core/audioSystem";
import { awardStatTokens, STAT_LONG_LABEL, STAT_SHORT_LABEL } from "../../core/statTokens";
import { createEmptyResourceWallet } from "../../core/resources";
import {
  deriveBattleFeedback,
  subscribeToFeedback,
  triggerFeedback,
  type FeedbackPosition,
  type FeedbackRequest,
} from "../../core/feedback";
import { BattleSceneController } from "../battle3d/BattleSceneController";
import { createBattleBoardSnapshot } from "../battle3d/snapshot";
import type { BattleBoardPick, BattleBoardPoint } from "../battle3d/types";
// Mount system imports
import { isUnitMounted } from "../../core/battle";
import { getMountById as getMountDefinition } from "../../core/mounts";
import { handleCardPlay } from "../../core/cardHandler";
import {
  applyBattleConsumable,
  getBattleConsumableTargetIds,
  getOwnedConsumableEntries,
} from "../../core/consumableActions";
import {
  abandonActiveEchoRun,
  commitEchoEncounterVictory,
  finalizeEchoRunFromBattleDefeat,
  summarizeEchoEncounter,
} from "../../core/echoRuns";
import {
  applySquadMatchCommand,
  loadSquadMatchState,
  saveSquadMatchState,
  serializeSquadMatchSnapshot,
} from "../../core/squadOnline";
import {
  saveLobbyState,
  setLobbySkirmishIntermission,
  updateLobbySkirmishSnapshot,
} from "../../core/multiplayerLobby";
import {
  createSquadBattlePayload,
  createSquadBattleCommandPayload,
  createRuntimeBattleCommandPayload,
  getSquadBattleResultReason,
  getSquadBattleWinnerSlots,
  parseRuntimeBattleCommandPayload,
  parseSquadBattleCommandPayload,
  type SquadBattleCommand,
} from "../../core/squadBattle";
import {
  isTauriSquadTransportAvailable,
  sendSquadTransportMessage,
} from "../../core/squadOnlineTransport";
import {
  fieldPatch,
  fullReload,
  getWeaponCardBlockReason,
  getWeaponCardModifierSnapshot,
  getWeaponClutches,
  quickReload,
  toggleWeaponClutch,
  ventWeapon,
} from "../../core/weaponSystem";

let isAnimatingEnemyTurn = false;
let lastBattleStatPingKey: string | null = null;
let battleResultGateKey: string | null = null;
let battleResultInputUnlockAtMs = 0;
let lastBattleAudioStateKey: string | null = null;
let pendingAutoBattleStepTimerId: number | null = null;
let pendingAutoBattleStepDueAtMs = 0;
let cleanupBattleFeedbackListener: (() => void) | null = null;
let battleHitStopUntilMs = 0;
let battleHitStopTimerId: number | null = null;
let battleSceneController: BattleSceneController | null = null;
const BATTLE_VIEW_SLOT_COUNT = 2;
const DEFAULT_BATTLE_VIEW_PRESETS: BattleCameraViewPreset[] = [
  {
    orbitYaw: Math.PI / 4,
    orbitPitch: 0.82,
    orbitDistance: 13,
    zoomFactor: 1.3,
    focusX: 0,
    focusY: 0.45,
    focusZ: 0,
    hasManualPan: false,
  },
  {
    orbitYaw: (Math.PI * 3) / 4,
    orbitPitch: 0.82,
    orbitDistance: 13,
    zoomFactor: 1.3,
    focusX: 0,
    focusY: 0.45,
    focusZ: 0,
    hasManualPan: false,
  },
];
let battleViewPresetCache: Record<string, BattleCameraViewPreset> | null = null;
let battleActiveViewIndexCache: number | null = null;
let battleViewPersistTimerId: number | null = null;
let battleLastAppliedViewSignature: string | null = null;

type BattleAutoMode = "manual" | "undaring" | "daring";

function clampBattleViewIndex(index: number): number {
  return Math.max(0, Math.min(BATTLE_VIEW_SLOT_COUNT - 1, index));
}

function getBattleViewStorageKey(index: number): string {
  return String(clampBattleViewIndex(index));
}

function cloneBattleViewPreset(preset: BattleCameraViewPreset): BattleCameraViewPreset {
  return { ...preset };
}

function getDefaultBattleViewPreset(index: number): BattleCameraViewPreset {
  return cloneBattleViewPreset(DEFAULT_BATTLE_VIEW_PRESETS[clampBattleViewIndex(index)] ?? DEFAULT_BATTLE_VIEW_PRESETS[0]);
}

function normalizeBattleViewPreset(
  preset: Partial<BattleCameraViewPreset> | undefined,
  index: number,
): BattleCameraViewPreset {
  const fallback = getDefaultBattleViewPreset(index);
  const safeNumber = (value: number | undefined, fallbackValue: number): number => (
    typeof value === "number" && Number.isFinite(value) ? value : fallbackValue
  );

  return {
    orbitYaw: safeNumber(preset?.orbitYaw, fallback.orbitYaw),
    orbitPitch: Math.max(0.35, Math.min(1.25, safeNumber(preset?.orbitPitch, fallback.orbitPitch))),
    orbitDistance: Math.max(4.5, Math.min(30, safeNumber(preset?.orbitDistance, fallback.orbitDistance))),
    zoomFactor: Math.max(0.6, Math.min(1.6, safeNumber(preset?.zoomFactor, fallback.zoomFactor))),
    focusX: safeNumber(preset?.focusX, fallback.focusX),
    focusY: safeNumber(preset?.focusY, fallback.focusY),
    focusZ: safeNumber(preset?.focusZ, fallback.focusZ),
    hasManualPan: typeof preset?.hasManualPan === "boolean" ? preset.hasManualPan : fallback.hasManualPan,
  };
}

function readStoredBattleViewPresets(state = getGameState()): Record<string, BattleCameraViewPreset> {
  const savedPresets = state.uiLayout?.battleViewPresets ?? {};
  return Object.fromEntries(
    Array.from({ length: BATTLE_VIEW_SLOT_COUNT }, (_, index) => {
      const key = getBattleViewStorageKey(index);
      return [key, normalizeBattleViewPreset(savedPresets[key], index)];
    }),
  ) as Record<string, BattleCameraViewPreset>;
}

function readActiveBattleViewIndex(state = getGameState()): number {
  return clampBattleViewIndex(state.uiLayout?.battleActiveViewIndex ?? 0);
}

function ensureBattleViewPresetCache(state = getGameState()): void {
  if (battleViewPresetCache && battleActiveViewIndexCache !== null) {
    return;
  }

  battleViewPresetCache = readStoredBattleViewPresets(state);
  battleActiveViewIndexCache = readActiveBattleViewIndex(state);
}

function getCachedBattleViewPresets(state = getGameState()): Record<string, BattleCameraViewPreset> {
  ensureBattleViewPresetCache(state);
  return battleViewPresetCache ?? readStoredBattleViewPresets(state);
}

function getActiveBattleViewIndex(state = getGameState()): number {
  ensureBattleViewPresetCache(state);
  return battleActiveViewIndexCache ?? readActiveBattleViewIndex(state);
}

function getActiveBattleViewPreset(state = getGameState()): BattleCameraViewPreset {
  const activeIndex = getActiveBattleViewIndex(state);
  const presets = getCachedBattleViewPresets(state);
  return cloneBattleViewPreset(presets[getBattleViewStorageKey(activeIndex)] ?? getDefaultBattleViewPreset(activeIndex));
}

function areBattleViewPresetsEqual(a: BattleCameraViewPreset, b: BattleCameraViewPreset): boolean {
  return a.orbitYaw === b.orbitYaw
    && a.orbitPitch === b.orbitPitch
    && a.orbitDistance === b.orbitDistance
    && a.zoomFactor === b.zoomFactor
    && a.focusX === b.focusX
    && a.focusY === b.focusY
    && a.focusZ === b.focusZ
    && a.hasManualPan === b.hasManualPan;
}

function cloneBattleViewPresetRecord(presets: Record<string, BattleCameraViewPreset>): Record<string, BattleCameraViewPreset> {
  return Object.fromEntries(
    Object.entries(presets).map(([key, preset]) => [key, cloneBattleViewPreset(preset)]),
  ) as Record<string, BattleCameraViewPreset>;
}

function flushBattleViewPresetState(): void {
  if (battleViewPersistTimerId !== null) {
    window.clearTimeout(battleViewPersistTimerId);
    battleViewPersistTimerId = null;
  }

  if (!battleViewPresetCache || battleActiveViewIndexCache === null) {
    return;
  }

  const currentState = getGameState();
  const storedActiveIndex = readActiveBattleViewIndex(currentState);
  const storedPresets = readStoredBattleViewPresets(currentState);
  const nextPresets = cloneBattleViewPresetRecord(battleViewPresetCache);
  const isSame =
    storedActiveIndex === battleActiveViewIndexCache
    && Array.from({ length: BATTLE_VIEW_SLOT_COUNT }, (_, index) => {
      const key = getBattleViewStorageKey(index);
      return areBattleViewPresetsEqual(
        storedPresets[key] ?? getDefaultBattleViewPreset(index),
        nextPresets[key] ?? getDefaultBattleViewPreset(index),
      );
    }).every(Boolean);

  if (isSame) {
    return;
  }

  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      battleActiveViewIndex: battleActiveViewIndexCache ?? 0,
      battleViewPresets: cloneBattleViewPresetRecord(nextPresets),
    },
  }));
}

function scheduleBattleViewPresetStatePersist(): void {
  if (battleViewPersistTimerId !== null) {
    window.clearTimeout(battleViewPersistTimerId);
  }

  battleViewPersistTimerId = window.setTimeout(() => {
    battleViewPersistTimerId = null;
    flushBattleViewPresetState();
  }, 220);
}

function captureActiveBattleViewPreset(view: BattleCameraViewPreset, persist = true): void {
  ensureBattleViewPresetCache();
  const activeIndex = getActiveBattleViewIndex();
  const presetKey = getBattleViewStorageKey(activeIndex);
  const normalizedPreset = normalizeBattleViewPreset(view, activeIndex);

  if (!battleViewPresetCache) {
    battleViewPresetCache = readStoredBattleViewPresets();
  }

  battleViewPresetCache[presetKey] = normalizedPreset;
  battleZoom = normalizedPreset.zoomFactor;

  if (persist) {
    scheduleBattleViewPresetStatePersist();
  }
}

function resetBattleViewPresetSessionState(): void {
  flushBattleViewPresetState();
  battleViewPresetCache = null;
  battleActiveViewIndexCache = null;
  battleLastAppliedViewSignature = null;
}

function activateBattleViewPreset(viewIndex: number): void {
  if (battleSceneController) {
    captureActiveBattleViewPreset(battleSceneController.getViewState(), false);
  }

  ensureBattleViewPresetCache();
  battleActiveViewIndexCache = clampBattleViewIndex(viewIndex);
  battleLastAppliedViewSignature = null;
  flushBattleViewPresetState();
  renderBattleScreen();
}

type AutoBattleCardOption = {
  cardIndex: number;
  card: Card;
  targetId: string;
  score: number;
  distance: number;
};

type AutoBattleMoveOption = {
  destination: Vec2;
  path: Vec2[];
  score: number;
};

type BattleExitConfirmState = "abandon-echo" | null;

function getBattleReturnTarget(battle: BattleState | null | undefined): BaseCampReturnTo | "operation" | "menu" | "map_builder" {
  const returnTo = (battle as any)?.returnTo;
  return returnTo === "field" || returnTo === "esc" || returnTo === "basecamp" || returnTo === "operation" || returnTo === "menu" || returnTo === "map_builder"
    ? returnTo
    : "operation";
}

function getEchoContext(battle: BattleState | null | undefined): EchoBattleContext | null {
  return battle?.modeContext?.kind === "echo" ? battle.modeContext.echo ?? null : null;
}

function isEchoBattle(battle: BattleState | null | undefined): boolean {
  return battle?.modeContext?.kind === "echo";
}

function isSquadBattle(battle: BattleState | null | undefined): boolean {
  return battle?.modeContext?.kind === "squad";
}

function getBattleUnitAutoMode(unit: BattleUnitState | null | undefined): BattleAutoMode {
  if (!unit) {
    return "manual";
  }
  if (unit.autoBattleMode === "manual" || unit.autoBattleMode === "undaring" || unit.autoBattleMode === "daring") {
    return unit.autoBattleMode;
  }
  return unit.autoBattle ? "daring" : "manual";
}

function normalizeBattleUnitAutoState(unit: BattleUnitState): BattleUnitState {
  const legacyUnit = unit as BattleUnitState & { autoBattle?: boolean };
  const { autoBattle, ...rest } = legacyUnit;
  return {
    ...rest,
    autoBattleMode: getBattleUnitAutoMode(unit),
  };
}

function clearPendingAutoBattleStep(): void {
  if (pendingAutoBattleStepTimerId !== null) {
    window.clearTimeout(pendingAutoBattleStepTimerId);
    pendingAutoBattleStepTimerId = null;
  }
  pendingAutoBattleStepDueAtMs = 0;
}

function requestAutoBattleStep(delayMs = 250): void {
  const runAtMs = performance.now() + delayMs;
  if (pendingAutoBattleStepTimerId !== null && pendingAutoBattleStepDueAtMs <= runAtMs + 4) {
    return;
  }

  clearPendingAutoBattleStep();
  pendingAutoBattleStepDueAtMs = runAtMs;
  pendingAutoBattleStepTimerId = window.setTimeout(() => {
    pendingAutoBattleStepTimerId = null;
    pendingAutoBattleStepDueAtMs = 0;
    runAutoBattleTurnStep();
  }, delayMs);
}

function isBattleUnitAutoControlled(
  battle: BattleState | null | undefined,
  unit: BattleUnitState | null | undefined,
): boolean {
  return Boolean(
    battle
    && unit
    && !isSquadBattle(battle)
    && canLocalControlBattleUnit(battle, unit)
    && isLocalBattleTurn(battle, unit)
    && getBattleUnitAutoMode(unit) !== "manual",
  );
}

function syncPendingAutoBattleStep(activeUnit: BattleUnitState | undefined): void {
  if (
    !isBattleUnitAutoControlled(localBattleState, activeUnit)
    || !localBattleState
    || localBattleState.phase === "victory"
    || localBattleState.phase === "defeat"
    || isAnimatingEnemyTurn
    || hasActiveBattleAnimation()
  ) {
    clearPendingAutoBattleStep();
    return;
  }

  requestAutoBattleStep(250);
}

function getSquadContext(battle: BattleState | null | undefined) {
  return battle?.modeContext?.kind === "squad" ? battle.modeContext.squad ?? null : null;
}

function getSquadObjective(battle: BattleState | null | undefined) {
  return getSquadContext(battle)?.objective ?? null;
}

function getSquadObjectiveStatusLabel(battle: BattleState): string {
  const objective = getSquadObjective(battle);
  if (!objective) {
    return "";
  }
  if (objective.kind === "extraction") {
    if (objective.winnerSide === "friendly") {
      return "HOST EXTRACTION COMPLETE";
    }
    if (objective.winnerSide === "enemy") {
      return "OPPOSITION EXTRACTION COMPLETE";
    }
    if (objective.controllingSide === "friendly") {
      return "HOST EXTRACTION REGISTERED";
    }
    if (objective.controllingSide === "enemy") {
      return "OPPOSITION EXTRACTION REGISTERED";
    }
    const extractionTiles = objective.extractionTiles ?? battle.objectiveZones?.extraction ?? [];
    const anyFriendlyOnExtraction = Object.values(battle.units).some((unit) =>
      !unit.isEnemy
      && unit.hp > 0
      && unit.pos
      && extractionTiles.some((tile) => tile.x === unit.pos!.x && tile.y === unit.pos!.y),
    );
    const anyEnemyOnExtraction = Object.values(battle.units).some((unit) =>
      unit.isEnemy
      && unit.hp > 0
      && unit.pos
      && extractionTiles.some((tile) => tile.x === unit.pos!.x && tile.y === unit.pos!.y),
    );
    if (anyFriendlyOnExtraction || anyEnemyOnExtraction) {
      return "EXTRACTION WINDOW CONTESTED";
    }
    return "EXTRACTION WINDOW OPEN";
  }
  if (objective.kind === "breakthrough") {
    if (objective.winnerSide === "friendly") {
      return "HOST BREACH CONFIRMED";
    }
    if (objective.winnerSide === "enemy") {
      return "OPPOSITION BREACH CONFIRMED";
    }
    if (objective.controllingSide === "friendly") {
      return "HOST EXTRACTION REGISTERED";
    }
    if (objective.controllingSide === "enemy") {
      return "OPPOSITION EXTRACTION REGISTERED";
    }
    return "BREACH LANES ACTIVE";
  }
  if (objective.winnerSide === "friendly") {
    return "HOST LINE SECURED";
  }
  if (objective.winnerSide === "enemy") {
    return "OPPOSITION SECURED";
  }
  const liveControlSide = getSquadObjectiveControlSide(battle);
  if (liveControlSide === "friendly") {
    return "HOST HOLDING RELAY";
  }
  if (liveControlSide === "enemy") {
    return "OPPOSITION HOLDING RELAY";
  }
  const anyFriendlyOnRelay = Object.values(battle.units).some((unit) =>
    !unit.isEnemy
    && unit.hp > 0
    && unit.pos
    && objective.controlTiles.some((tile) => tile.x === unit.pos!.x && tile.y === unit.pos!.y),
  );
  const anyEnemyOnRelay = Object.values(battle.units).some((unit) =>
    unit.isEnemy
    && unit.hp > 0
    && unit.pos
    && objective.controlTiles.some((tile) => tile.x === unit.pos!.x && tile.y === unit.pos!.y),
  );
  if (anyFriendlyOnRelay || anyEnemyOnRelay) {
    return "RELAY CONTESTED";
  }
  return "RELAY NEUTRAL";
}

function normalizeSessionPlayerSlot(value: string | null | undefined): SessionPlayerSlot {
  if (value && SESSION_PLAYER_SLOTS.includes(value as SessionPlayerSlot)) {
    return value as SessionPlayerSlot;
  }
  return "P1";
}

function getLocalSquadSlot(battle: BattleState | null | undefined): SessionPlayerSlot {
  const match = loadSquadMatchState();
  if (match?.localSlot && SESSION_PLAYER_SLOTS.includes(match.localSlot)) {
    return match.localSlot;
  }
  return getSquadContext(battle)?.hostSlot ?? "P1";
}

function getLocalCoopOperationsSlot(): SessionPlayerSlot {
  return SESSION_PLAYER_SLOTS.find((slot) =>
    getGameState().session.players?.[slot]?.presence === "local"
    && getGameState().session.players?.[slot]?.connected,
  ) ?? "P1";
}

function isCoopOperationsBattle(battle: BattleState | null | undefined): boolean {
  return Boolean(
    battle
    && !isSquadBattle(battle)
    && getGameState().session.mode === "coop_operations",
  );
}

function getBattleInputPlayerId(battle: BattleState | null | undefined, unit: BattleUnitState | null | undefined): PlayerId {
  if (isSquadBattle(battle) && getGameState().session.authorityRole === "client") {
    return "P1";
  }
  if (isCoopOperationsBattle(battle)) {
    return "P1";
  }
  return normalizeSessionPlayerSlot(unit?.controller ?? "P1") === "P2" ? "P2" : "P1";
}

function isHostileBattleUnit(attacker: BattleUnitState | null | undefined, target: BattleUnitState | null | undefined): boolean {
  return Boolean(attacker && target && attacker.isEnemy !== target.isEnemy);
}

function isAlliedBattleUnit(source: BattleUnitState | null | undefined, target: BattleUnitState | null | undefined): boolean {
  return Boolean(source && target && source.isEnemy === target.isEnemy);
}

function canLocalControlBattleUnit(battle: BattleState | null | undefined, unit: BattleUnitState | null | undefined): boolean {
  if (!battle || !unit || unit.hp <= 0) {
    return false;
  }

  if (isSquadBattle(battle)) {
    return normalizeSessionPlayerSlot(unit.controller ?? "P1") === getLocalSquadSlot(battle);
  }

  if (isCoopOperationsBattle(battle)) {
    return !unit.isEnemy && normalizeSessionPlayerSlot(unit.controller ?? "P1") === getLocalCoopOperationsSlot();
  }

  if (unit.isEnemy) {
    return false;
  }

  const playerId = getBattleInputPlayerId(battle, unit);
  const currentPlayer = getGameState().players[playerId];
  return Boolean(currentPlayer?.active);
}

function isLocalBattleTurn(battle: BattleState | null | undefined, unit: BattleUnitState | null | undefined): boolean {
  if (!battle || !unit) {
    return false;
  }
  if (battle.phase === "placement" || battle.phase === "victory" || battle.phase === "defeat") {
    return false;
  }
  return canLocalControlBattleUnit(battle, unit);
}

function shouldAutoResolveBattleState(state: BattleState): boolean {
  if (isSquadBattle(state) || state.phase === "victory" || state.phase === "defeat") {
    return false;
  }
  const activeUnit = state.activeUnitId ? state.units[state.activeUnitId] ?? null : null;
  return Boolean(activeUnit?.isEnemy);
}

function buildSquadTurnStateSnapshot(battle: BattleState): SquadBattleTurnState {
  return {
    unitId: battle.activeUnitId ?? null,
    hasMoved: turnState.hasMoved,
    hasCommittedMove: turnState.hasCommittedMove,
    hasActed: turnState.hasActed,
    movementOnlyAfterAttack: turnState.movementOnlyAfterAttack,
    movementRemaining: turnState.movementRemaining,
    originalPosition: turnState.originalPosition ? { ...turnState.originalPosition } : null,
    isFacingSelection: turnState.isFacingSelection,
  };
}

function withBattleTurnStateSnapshot(battle: BattleState): BattleState {
  if (!battle.modeContext) {
    return battle;
  }

  const turnStateSnapshot = buildSquadTurnStateSnapshot(battle);
  const squadContext = getSquadContext(battle);
  return {
    ...battle,
    modeContext: {
      ...battle.modeContext,
      turnState: turnStateSnapshot,
      squad: squadContext
        ? {
            ...squadContext,
            turnState: turnStateSnapshot,
          }
        : battle.modeContext.squad,
    },
  };
}

function restoreTurnStateFromBattle(battle: BattleState | null | undefined): void {
  const serialized = battle?.modeContext?.turnState ?? getSquadContext(battle)?.turnState ?? null;
  if (battle && serialized && serialized.unitId === (battle.activeUnitId ?? null)) {
    turnState = {
      hasMoved: serialized.hasMoved,
      hasCommittedMove: serialized.hasCommittedMove,
      hasActed: serialized.hasActed,
      movementOnlyAfterAttack: Boolean(serialized.movementOnlyAfterAttack),
      movementRemaining: serialized.movementRemaining,
      originalPosition: serialized.originalPosition ? { ...serialized.originalPosition } : null,
      isFacingSelection: serialized.isFacingSelection,
    };
    return;
  }

  resetTurnStateForUnit(battle?.activeUnitId ? battle.units[battle.activeUnitId] ?? null : null, battle ?? localBattleState);
}

function isRemoteSquadClientTurn(battle: BattleState | null | undefined, unit: BattleUnitState | null | undefined): boolean {
  return Boolean(
    battle
    && unit
    && isSquadBattle(battle)
    && getGameState().session.authorityRole === "client"
    && isLocalBattleTurn(battle, unit),
  );
}

function isRemoteCoopClientTurn(battle: BattleState | null | undefined, unit: BattleUnitState | null | undefined): boolean {
  return Boolean(
    battle
    && unit
    && isCoopOperationsBattle(battle)
    && getGameState().session.authorityRole === "client"
    && isLocalBattleTurn(battle, unit),
  );
}

function isRemoteNetworkClientTurn(battle: BattleState | null | undefined, unit: BattleUnitState | null | undefined): boolean {
  return isRemoteSquadClientTurn(battle, unit) || isRemoteCoopClientTurn(battle, unit);
}

async function sendLocalSquadBattleCommand(command: SquadBattleCommand): Promise<void> {
  if (!localBattleState || !isRemoteSquadClientTurn(localBattleState, localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null)) {
    return;
  }

  const match = loadSquadMatchState();
  if (!match || !isTauriSquadTransportAvailable()) {
    return;
  }

  await sendSquadTransportMessage(
    "battle_command",
    createSquadBattleCommandPayload(match, localBattleState, command),
    null,
  );
}

async function sendLocalCoopBattleCommand(command: SquadBattleCommand): Promise<void> {
  if (
    !localBattleState
    || !isCoopOperationsBattle(localBattleState)
    || getGameState().session.authorityRole !== "client"
    || !isTauriSquadTransportAvailable()
  ) {
    return;
  }

  await sendSquadTransportMessage(
    "lobby_command",
    JSON.stringify({
      type: "coop_battle_command",
      payload: createRuntimeBattleCommandPayload(localBattleState, command),
    }),
    null,
  );
}

async function sendLocalNetworkBattleCommand(command: SquadBattleCommand): Promise<void> {
  if (localBattleState && isSquadBattle(localBattleState)) {
    await sendLocalSquadBattleCommand(command);
    return;
  }
  await sendLocalCoopBattleCommand(command);
}

async function sendLocalSquadPlacementCommand(command: SquadBattleCommand): Promise<void> {
  if (
    !localBattleState
    || !isSquadBattle(localBattleState)
    || localBattleState.phase !== "placement"
    || getGameState().session.authorityRole !== "client"
  ) {
    return;
  }

  const match = loadSquadMatchState();
  if (!match || !isTauriSquadTransportAvailable()) {
    return;
  }

  await sendSquadTransportMessage(
    "battle_command",
    createSquadBattleCommandPayload(match, localBattleState, command),
    null,
  );
}

async function sendLocalCoopPlacementCommand(command: SquadBattleCommand): Promise<void> {
  if (
    !localBattleState
    || !isCoopOperationsBattle(localBattleState)
    || localBattleState.phase !== "placement"
    || getGameState().session.authorityRole !== "client"
    || !isTauriSquadTransportAvailable()
  ) {
    return;
  }

  await sendSquadTransportMessage(
    "lobby_command",
    JSON.stringify({
      type: "coop_battle_command",
      payload: createRuntimeBattleCommandPayload(localBattleState, command),
    }),
    null,
  );
}

async function sendLocalNetworkPlacementCommand(command: SquadBattleCommand): Promise<void> {
  if (localBattleState && isSquadBattle(localBattleState)) {
    await sendLocalSquadPlacementCommand(command);
    return;
  }
  await sendLocalCoopPlacementCommand(command);
}

function escapeBattleText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSquadMatchWinnerLabel(battle: BattleState | null | undefined): string {
  const match = loadSquadMatchState();
  const winnerSlots = match?.result?.winnerSlots ?? (battle ? getSquadBattleWinnerSlots(battle) : []);
  const slotCallsigns = battle?.modeContext?.kind === "squad" ? battle.modeContext.squad?.slotCallsigns ?? null : null;
  const winnerNames = winnerSlots
    .map((slot) => slotCallsigns?.[slot] ?? match?.members?.[slot]?.callsign ?? slot)
    .filter(Boolean);
  return winnerNames.join(", ") || "Battle authority";
}

function getSquadBattleOutcomeTitle(battle: BattleState): string {
  if (battle.phase === "victory") {
    return "MATCH LOCKED";
  }
  if (battle.phase === "defeat") {
    return "MATCH DECIDED";
  }
  return "SKIRMISH ENGAGEMENT";
}

function getSquadBattleOutcomeCopy(battle: BattleState): string {
  return getSquadBattleResultReason(battle);
}

function getLocalPlacementColumn(battle: BattleState): number {
  const localSpawnTiles = isSquadBattle(battle) && getGameState().session.authorityRole === "client"
    ? battle.spawnZones?.enemySpawn ?? []
    : battle.spawnZones?.friendlySpawn ?? [];
  if (localSpawnTiles.length > 0) {
    return localSpawnTiles[0].x;
  }
  if (isSquadBattle(battle) && getGameState().session.authorityRole === "client") {
    return battle.gridWidth - 1;
  }
  return 0;
}

function getLocalPlacementTiles(battle: BattleState): Vec2[] {
  const placementUnits = getLocalPlacementUnits(battle);
  const sampleUnit = placementUnits[0];
  if (!sampleUnit) {
    return [];
  }
  return getPlacementTilesForUnit(battle, sampleUnit);
}

function getLocalPlacementUnits(battle: BattleState): BattleUnitState[] {
  if (isSquadBattle(battle)) {
    return Object.values(battle.units).filter((unit) => canLocalControlBattleUnit(battle, unit));
  }
  return Object.values(battle.units).filter((unit) => !unit.isEnemy);
}

function getSkirmishPlacementCounts(battle: BattleState): { friendly: number; enemy: number } {
  const effectivePlacedUnitIds = getEffectivePlacedUnitIds(battle);
  if (effectivePlacedUnitIds.length <= 0) {
    return { friendly: 0, enemy: 0 };
  }

  return effectivePlacedUnitIds.reduce((counts, unitId) => {
    const unit = battle.units[unitId];
    if (!unit) {
      return counts;
    }
    if (unit.isEnemy) {
      counts.enemy += 1;
    } else {
      counts.friendly += 1;
    }
    return counts;
  }, { friendly: 0, enemy: 0 });
}

function toLocalUnitOwnership(slot: SessionPlayerSlot | undefined): PlayerId | undefined {
  if (slot === "P1" || slot === "P2") {
    return slot;
  }
  return undefined;
}

function updateEchoBattleContext(
  battle: BattleState,
  updater: (echoContext: EchoBattleContext) => EchoBattleContext,
): BattleState {
  const echoContext = getEchoContext(battle);
  if (!echoContext) {
    return battle;
  }

  return {
    ...battle,
    modeContext: {
      ...battle.modeContext,
      kind: "echo",
      echo: updater(echoContext),
    },
  };
}

function setEchoPlacementMode(battle: BattleState, placementMode: EchoBattleContext["placementMode"]): BattleState {
  return updateEchoBattleContext(battle, (echoContext) => ({
    ...echoContext,
    placementMode,
    selectedFieldDraftId: placementMode === "fields"
      ? (echoContext.selectedFieldDraftId ?? echoContext.availableFields[0]?.draftId ?? null)
      : echoContext.selectedFieldDraftId,
  }));
}

function selectEchoPlacementField(battle: BattleState, draftId: string): BattleState {
  return updateEchoBattleContext(battle, (echoContext) => ({
    ...echoContext,
    selectedFieldDraftId: draftId,
  }));
}

function upsertEchoFieldPlacement(battle: BattleState, draftId: string, pos: Vec2): BattleState {
  return updateEchoBattleContext(battle, (echoContext) => {
    const field = echoContext.availableFields.find((entry) => entry.draftId === draftId);
    if (!field) {
      return echoContext;
    }

    const nextPlacements = echoContext.fieldPlacements.filter((placement) => placement.draftId !== draftId);
    const nextPlacement: EchoFieldPlacement = {
      draftId: field.draftId,
      fieldId: field.id,
      x: pos.x,
      y: pos.y,
      radius: field.radius,
      level: field.level,
    };
    nextPlacements.push(nextPlacement);

    return {
      ...echoContext,
      fieldPlacements: nextPlacements,
      selectedFieldDraftId: draftId,
    };
  });
}

function getUnplacedEchoFields(battle: BattleState | null | undefined) {
  const echoContext = getEchoContext(battle);
  if (!echoContext) {
    return [];
  }

  const placedDraftIds = new Set(echoContext.fieldPlacements.map((placement) => placement.draftId));
  return echoContext.availableFields.filter((field) => !placedDraftIds.has(field.draftId));
}

function renderBattleReturnDestination(returnTo: BaseCampReturnTo | "operation" | "menu" | "map_builder"): void {
  if (returnTo === "operation") {
    renderOperationMap();
    return;
  }
  if (returnTo === "menu") {
    import("./MainMenuScreen").then(({ renderMainMenu }) => {
      void renderMainMenu();
    });
    return;
  }
  if (returnTo === "map_builder") {
    import("./MapBuilderScreen").then(({ renderMapBuilderScreen }) => {
      renderMapBuilderScreen();
    });
    return;
  }
  returnFromBaseCampScreen(returnTo);
}

function returnFromBattle(battle: BattleState | null | undefined): void {
  if (isSquadBattle(battle)) {
    updateGameState((prev) => ({
      ...prev,
      currentBattle: null,
      phase: "shell",
    }));
    import("./CommsArrayScreen").then(({ renderActiveSkirmishScreen }) => {
      renderActiveSkirmishScreen("basecamp");
    });
    return;
  }

  const returnTo = getBattleReturnTarget(battle);
  renderBattleReturnDestination(returnTo);
}

function syncBattleResultInputGate(battle: BattleState): void {
  if (battle.phase !== "victory" && battle.phase !== "defeat") {
    battleResultGateKey = null;
    battleResultInputUnlockAtMs = 0;
    return;
  }

  const nextGateKey = `${battle.id}:${battle.phase}:${battle.turnCount}`;
  if (battleResultGateKey === nextGateKey) {
    return;
  }

  battleResultGateKey = nextGateKey;
  battleResultInputUnlockAtMs = performance.now() + 350;
}

function isBattleResultInputReady(): boolean {
  return battleResultInputUnlockAtMs <= 0 || performance.now() >= battleResultInputUnlockAtMs;
}

function lockResultButtonUntilReady(button: HTMLElement | null): void {
  if (!button || isBattleResultInputReady()) {
    return;
  }

  if (button instanceof HTMLButtonElement) {
    button.disabled = true;
  }
  button.style.pointerEvents = "none";

  const unlockDelayMs = Math.max(0, battleResultInputUnlockAtMs - performance.now());
  window.setTimeout(() => {
    if (!document.body.contains(button)) {
      return;
    }
    if (button instanceof HTMLButtonElement) {
      button.disabled = false;
    }
    button.style.pointerEvents = "auto";
  }, unlockDelayMs);
}

function syncBattleAudioState(battle: BattleState): void {
  const battleId = String((battle as { id?: string }).id ?? battle.roomId ?? "battle");
  let stateKey = `${battleId}:live`;

  if (battle.phase === "victory") {
    stateKey = `${battleId}:victory`;
  } else if (battle.phase === "defeat") {
    stateKey = `${battleId}:defeat`;
  }

  if (lastBattleAudioStateKey === stateKey) {
    return;
  }

  lastBattleAudioStateKey = stateKey;

  if (battle.phase === "victory") {
    playPlaceholderSfx("battle-victory");
    return;
  }

  if (battle.phase === "defeat") {
    playPlaceholderSfx("battle-defeat");
    return;
  }

  playPlaceholderSfx("battle-start");
}

// Card type definition
interface Card {
  id: string;
  name: string;
  type: "core" | "class" | "equipment" | "gambit";
  target: "enemy" | "ally" | "self" | "tile";
  strainCost: number;
  range: number;
  description: string;
  damage?: number;
  healing?: number;
  defBuff?: number;
  atkBuff?: number;
  effects?: any[];
  sourceEquipmentId?: string;
  weaponRules?: import("../../core/weaponData").WeaponCardRules;
  isChaosCard?: boolean;
  chaosCardsToCreate?: string[];
}

// CARD DATABASE - Based on GDD
const CARD_DATABASE: Record<string, Card> = {
  // CORE CARDS
  "core_move_plus": { id: "core_move_plus", name: "Move+", type: "core", target: "self", strainCost: 3, range: 0, description: "Move 2 extra tiles this turn." },
  "core_basic_attack": { id: "core_basic_attack", name: "Basic Attack", type: "core", target: "enemy", strainCost: 2, range: 1, description: "Deal weapon damage to adjacent enemy.", damage: 0 },
  "core_aid": { id: "core_aid", name: "Aid", type: "core", target: "ally", strainCost: 3, range: 2, description: "Restore 3 HP to nearby ally.", healing: 3 },
  "core_overwatch": { id: "core_overwatch", name: "Overwatch", type: "core", target: "self", strainCost: 3, range: 0, description: "Attack enemy that enters range." },
  "core_guard": { id: "core_guard", name: "Guard", type: "core", target: "self", strainCost: 3, range: 0, description: "Gain +2 DEF until next turn.", defBuff: 2 },
  "core_wait": { id: "core_wait", name: "Wait", type: "core", target: "self", strainCost: 3, range: 0, description: "End turn. Reduce strain by 2." },

  // ELM RECURVE BOW (Range 3-6)
  "card_pinpoint_shot": { id: "card_pinpoint_shot", name: "Pinpoint Shot", type: "equipment", target: "enemy", strainCost: 3, range: 6, description: "Deal 4 damage; +1 ACC.", damage: 4 },
  "card_warning_shot": { id: "card_warning_shot", name: "Warning Shot", type: "equipment", target: "enemy", strainCost: 3, range: 6, description: "Target suffers -2 ACC for 1 turn.", damage: 1 },
  "card_defensive_draw": { id: "card_defensive_draw", name: "Defensive Draw", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+1 DEF and +1 ACC until next attack.", defBuff: 1 },

  // HUNTER'S COIF
  "card_quick_shot": { id: "card_quick_shot", name: "Quick Shot", type: "equipment", target: "enemy", strainCost: 3, range: 5, description: "Deal 3 damage.", damage: 3 },
  "card_tracking_shot": { id: "card_tracking_shot", name: "Tracking Shot", type: "equipment", target: "enemy", strainCost: 3, range: 4, description: "Reveal target movement for 1 turn.", damage: 2 },
  "card_predators_brace": { id: "card_predators_brace", name: "Predator's Brace", type: "equipment", target: "self", strainCost: 3, range: 0, description: "First attacker loses 1 DEF.", defBuff: 1 },

  // HUNTER'S VEST
  "card_quiver_barrage": { id: "card_quiver_barrage", name: "Quiver Barrage", type: "equipment", target: "enemy", strainCost: 2, range: 4, description: "Three attacks, 2 damage each.", damage: 6 },
  "card_camouflage": { id: "card_camouflage", name: "Camouflage", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+3 ACC on next ranged attack." },
  "card_camouflage_guard": { id: "card_camouflage_guard", name: "Camouflage Guard", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+2 DEF if attacked at range.", defBuff: 2 },

  // HUNTER'S TALISMAN
  "card_hunters_pounce": { id: "card_hunters_pounce", name: "Hunter's Pounce", type: "equipment", target: "enemy", strainCost: 3, range: 2, description: "Deal 4 damage if target moved this turn.", damage: 4 },
  "card_scent_mark": { id: "card_scent_mark", name: "Scent Mark", type: "equipment", target: "enemy", strainCost: 3, range: 4, description: "Reveal target location for 2 turns.", damage: 1 },
  "card_trackers_guard": { id: "card_trackers_guard", name: "Tracker's Guard", type: "equipment", target: "self", strainCost: 3, range: 0, description: "Reveal first attacker on map.", defBuff: 1 },

  // EAGLE EYE LENS
  "card_spotters_shot": { id: "card_spotters_shot", name: "Spotter's Shot", type: "equipment", target: "enemy", strainCost: 3, range: 6, description: "Deal 4 damage; mark for +1 damage.", damage: 4 },
  "card_target_paint": { id: "card_target_paint", name: "Target Paint", type: "equipment", target: "enemy", strainCost: 3, range: 6, description: "Allies deal +1 damage to target this turn.", damage: 1 },
  "card_farsight_guard": { id: "card_farsight_guard", name: "Farsight Guard", type: "equipment", target: "self", strainCost: 3, range: 0, description: "Ignore overwatch this turn." },

  // FLEETFOOT ANKLET
  "card_flying_kick": { id: "card_flying_kick", name: "Flying Kick", type: "equipment", target: "enemy", strainCost: 3, range: 2, description: "Deal 3 damage; pass through target tile.", damage: 3 },
  "card_speed_burst": { id: "card_speed_burst", name: "Speed Burst", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+2 movement this turn." },
  "card_swift_guard": { id: "card_swift_guard", name: "Swift Guard", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+2 movement and +1 DEF this turn.", defBuff: 1 },

  // RANGER'S HOOD
  "card_aimed_strike": { id: "card_aimed_strike", name: "Aimed Strike", type: "equipment", target: "enemy", strainCost: 3, range: 4, description: "Deal 3 damage with +1 ACC.", damage: 3 },
  "card_hunters_mark": { id: "card_hunters_mark", name: "Hunter's Mark", type: "equipment", target: "enemy", strainCost: 3, range: 5, description: "Mark target; next ranged attack deals +2 damage.", damage: 1 },
  "card_hide_in_shadows": { id: "card_hide_in_shadows", name: "Hide in Shadows", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+2 AGI, untargetable at range for 1 turn." },

  // LEATHER JERKIN
  "card_knife_toss": { id: "card_knife_toss", name: "Knife Toss", type: "equipment", target: "enemy", strainCost: 3, range: 3, description: "Deal 2 damage; +1 AGI next turn.", damage: 2 },
  "card_quick_roll": { id: "card_quick_roll", name: "Quick Roll", type: "equipment", target: "self", strainCost: 2, range: 0, description: "Move 1 tile as free action." },
  "card_light_guard": { id: "card_light_guard", name: "Light Guard", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+1 DEF and +1 AGI until next turn.", defBuff: 1 },

  // SHADOW CLOAK
  "card_ambush_slash": { id: "card_ambush_slash", name: "Ambush Slash", type: "equipment", target: "enemy", strainCost: 2, range: 1, description: "Deal 5 damage if undetected at turn start.", damage: 5 },
  "card_fade": { id: "card_fade", name: "Fade", type: "equipment", target: "self", strainCost: 3, range: 0, description: "Untargetable by ranged attacks until next turn." },
  "card_shade_guard": { id: "card_shade_guard", name: "Shade Guard", type: "equipment", target: "self", strainCost: 3, range: 0, description: "Untargetable if you don't move this turn." },

  // CLASS - RANGER
  "class_pinning_shot": { id: "class_pinning_shot", name: "Pinning Shot", type: "class", target: "enemy", strainCost: 2, range: 5, description: "Immobilize enemy for 1 turn.", damage: 2 },
  "class_volley": { id: "class_volley", name: "Volley", type: "class", target: "enemy", strainCost: 3, range: 6, description: "Deal light damage to all enemies in range.", damage: 3 },
  "class_scouts_mark": { id: "class_scouts_mark", name: "Scout's Mark", type: "class", target: "self", strainCost: 3, range: 0, description: "Reveal all enemies and traps in range." },

  // CLASS - SQUIRE
  "class_power_slash": { id: "class_power_slash", name: "Power Slash", type: "class", target: "enemy", strainCost: 2, range: 1, description: "Deal heavy melee damage.", damage: 6 },
  "class_shield_wall": { id: "class_shield_wall", name: "Shield Wall", type: "class", target: "self", strainCost: 3, range: 0, description: "All allies gain +2 DEF for 1 turn.", defBuff: 2 },
  "class_rally_cry": { id: "class_rally_cry", name: "Rally Cry", type: "class", target: "self", strainCost: 2, range: 0, description: "All allies gain +2 ATK for 2 turns.", atkBuff: 2 },

  // IRON LONGSWORD
  "card_cleave": { id: "card_cleave", name: "Cleave", type: "equipment", target: "enemy", strainCost: 3, range: 1, description: "Deal 3 damage to up to 3 adjacent enemies.", damage: 3 },
  "card_parry_readiness": { id: "card_parry_readiness", name: "Parry Readiness", type: "equipment", target: "self", strainCost: 3, range: 0, description: "Cancel next attack against you.", defBuff: 3 },
  "card_guarded_stance": { id: "card_guarded_stance", name: "Guarded Stance", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+2 DEF until your next turn.", defBuff: 2 },

  // STEEL SIGNET RING
  "card_knuckle_jab": { id: "card_knuckle_jab", name: "Knuckle Jab", type: "equipment", target: "enemy", strainCost: 3, range: 1, description: "Deal 2 damage and push target 1 tile.", damage: 2 },
  "card_mark_of_command": { id: "card_mark_of_command", name: "Mark of Command", type: "equipment", target: "self", strainCost: 3, range: 0, description: "All allies gain +1 ACC next turn." },
  "card_signet_shield": { id: "card_signet_shield", name: "Signet Shield", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+1 DEF and +1 LUK until next turn.", defBuff: 1 },

  // IRONGUARD HELM
  "card_headbutt": { id: "card_headbutt", name: "Headbutt", type: "equipment", target: "enemy", strainCost: 3, range: 1, description: "Deal 2 damage and stun for 1 turn.", damage: 2 },
  "card_shield_sight": { id: "card_shield_sight", name: "Shield Sight", type: "equipment", target: "self", strainCost: 3, range: 0, description: "Ignore flanking penalties until next turn." },
  "card_shield_headbutt": { id: "card_shield_headbutt", name: "Shield Headbutt", type: "equipment", target: "enemy", strainCost: 3, range: 1, description: "Stun target for 1 turn.", damage: 1 },

  // STEELPLATE CUIRASS
  "card_shoulder_charge": { id: "card_shoulder_charge", name: "Shoulder Charge", type: "equipment", target: "enemy", strainCost: 3, range: 1, description: "Deal 3 damage; push target 1 tile.", damage: 3 },
  "card_fortify": { id: "card_fortify", name: "Fortify", type: "equipment", target: "self", strainCost: 3, range: 0, description: "Immunity to knockback until next turn.", defBuff: 1 },
  "card_fortress_form": { id: "card_fortress_form", name: "Fortress Form", type: "equipment", target: "self", strainCost: 3, range: 0, description: "+3 DEF but -1 movement this turn.", defBuff: 3 },
};

function getCardById(id: string): Card | null {
  const directDbCard = CARD_DATABASE[id];
  const normalized = id.toLowerCase().replace(/-/g, "_");
  const normalizedDbCard = CARD_DATABASE[normalized];
  const resolvedCatalogCard = getResolvedBattleCard(id);
  const dbCard = directDbCard || normalizedDbCard || null;

  if (resolvedCatalogCard && dbCard) {
    const mergedEffects = [...(resolvedCatalogCard.effects || [])];
    if (typeof dbCard.damage === "number" && dbCard.damage > 0 && !mergedEffects.some((effect: any) => effect.type === "damage")) {
      mergedEffects.push({ type: "damage", amount: dbCard.damage });
    }
    if (typeof dbCard.healing === "number" && dbCard.healing > 0 && !mergedEffects.some((effect: any) => effect.type === "heal")) {
      mergedEffects.push({ type: "heal", amount: dbCard.healing });
    }
    if (typeof dbCard.defBuff === "number" && dbCard.defBuff > 0 && !mergedEffects.some((effect: any) => effect.type === "def_up")) {
      mergedEffects.push({ type: "def_up", amount: dbCard.defBuff, duration: 1 });
    }
    if (typeof dbCard.atkBuff === "number" && dbCard.atkBuff > 0 && !mergedEffects.some((effect: any) => effect.type === "atk_up")) {
      mergedEffects.push({ type: "atk_up", amount: dbCard.atkBuff, duration: 1 });
    }

    return {
      ...resolvedCatalogCard,
      ...dbCard,
      description: resolvedCatalogCard.description,
      effects: mergedEffects,
    };
  }

  if (resolvedCatalogCard) {
    return {
      ...resolvedCatalogCard,
      effects: resolvedCatalogCard.effects,
    };
  }
  if (dbCard) return dbCard;
  return null;
}

function fallbackGetCardById(id: string): Card {
  const cleanId = id.replace(/^(core_|class_|equip_|card_|gambit_|equipment_)/, "").replace(/_/g, " ");
  const name = cleanId.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  let type: Card["type"] = "equipment";
  if (id.startsWith("core_")) type = "core";
  if (id.startsWith("class_")) type = "class";
  if (id.startsWith("gambit_")) type = "gambit";
  let target: Card["target"] = "enemy";
  let range = 5;
  let damage: number | undefined = 3;
  const lower = name.toLowerCase();
  if (lower.includes("guard") || lower.includes("stance") || lower.includes("draw") || lower.includes("brace") || lower.includes("hide") || lower.includes("fade") || lower.includes("roll") || lower.includes("burst") || lower.includes("overwatch") || lower.includes("wait") || lower.includes("form")) {
    target = "self";
    range = 0;
    damage = undefined;
  } else if (lower.includes("aid") || lower.includes("heal")) {
    target = "ally";
    range = 2;
    damage = undefined;
  } else if (lower.includes("slash") || lower.includes("strike") || lower.includes("attack") || lower.includes("stab") || lower.includes("jab") || lower.includes("charge") || lower.includes("headbutt")) {
    range = 1;
  }
  const description =
    target === "self"
      ? "Gain +2 DEF until next turn."
      : target === "ally"
        ? "Restore 3 HP to an ally."
        : `Deal ${damage ?? 3} damage.`;
  return { id, name, type, target, strainCost: 3, range, damage, description };
}

function renderWeaponWindow(unit: BattleUnitState | undefined): string {
  try {
    if (!unit) {
      return `<div class="weapon-window weapon-window--empty"><div class="weapon-window-title">NO WEAPON</div></div>`;
    }
    const resolvedWeaponId = getBattleUnitEquippedWeaponId(unit);
    const state = getGameState();
    const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
    const weapon = getEquippedWeapon(unit, equipmentById);

    if (!weapon) {
      return resolvedWeaponId
        ? `<div class="weapon-window weapon-window--empty"><div class="weapon-window-title">UNKNOWN WEAPON</div></div>`
        : `<div class="weapon-window weapon-window--empty"><div class="weapon-window-title">NO WEAPON</div></div>`;
    }
    const combatInstability = Boolean(localBattleState?.theaterBonuses?.combatInstability);
    const overheatSeverity = localBattleState?.theaterBonuses?.overheatSeverity ?? 0;
    const obscurationActive = Boolean(
      localBattleState?.theaterBonuses?.obscurationActive
      ?? localBattleState?.theaterBonuses?.smokeObscured,
    );
    const obscurationSeverity = localBattleState?.theaterBonuses?.obscurationSeverity
      ?? localBattleState?.theaterBonuses?.smokeSeverity
      ?? 0;
    const obscurationLabel = localBattleState?.theaterBonuses?.obscurationLabel ?? "Smoke Obscuration";
    const obscurationSuppressesRanged = Boolean(
      localBattleState?.theaterBonuses?.obscurationSuppressesRanged
      ?? localBattleState?.theaterBonuses?.smokeObscured,
    );
    const enemyIntelScrambled = Boolean(localBattleState?.theaterBonuses?.enemyIntelScrambled);
    const enemyIntelScrambleLabel = localBattleState?.theaterBonuses?.enemyIntelScrambleLabel ?? "Telemetry Static";
    const burningRoom = Boolean(localBattleState?.theaterBonuses?.burningRoom);
    const burnSeverity = localBattleState?.theaterBonuses?.burnSeverity ?? 0;
    const supplyFireRisk = Boolean(localBattleState?.theaterBonuses?.supplyFireRisk);
    const instabilityWarning = combatInstability ? `
      Combat Instability Active // Room Overheat L${overheatSeverity > 0 ? overheatSeverity : 1} // Heat Accelerated
    ` : null;
    const obscurationWarning = obscurationActive ? `
      ${obscurationLabel} Active // Move -${Math.max(1, obscurationSeverity)}${obscurationSuppressesRanged ? " // Ranged Fire Suppressed" : ""}
    ` : null;
    const intelWarning = enemyIntelScrambled ? `
      ${enemyIntelScrambleLabel} Active // Enemy Telemetry Scrambled
    ` : null;
    const riskWarning = supplyFireRisk ? `
      Volatile Supply Load // Fire Risk Elevated
    ` : null;
    const fireWarning = burningRoom ? `
      Room Fire Active // Ambient Thermal Damage Each Turn${burnSeverity >= 2 ? " // Ignition Pressure Rising" : ""}
    ` : null;
    const combinedWarning = [instabilityWarning, obscurationWarning, intelWarning, riskWarning, fireWarning]
      .map((warning) => warning?.replace(/\s+/g, " ").trim() ?? "")
      .filter(Boolean)
      .join(" // ");

    const selectedCard =
      selectedCardIndex !== null && unit.hand[selectedCardIndex]
        ? resolveCard(unit.hand[selectedCardIndex])
        : null;
    const selectedCardHint =
      selectedCard && unit.weaponState
        ? getWeaponCardBlockReason(unit.weaponState, weapon, selectedCard.weaponRules ?? null)
        : null;

    return renderSharedWeaponWindow(
      weapon,
      unit.weaponState ?? {
        equipmentId: weapon.id,
        currentHeat: unit.weaponHeat ?? 0,
        currentAmmo: weapon.ammoMax ?? 0,
        wear: unit.weaponWear ?? 0,
        nodes: { 1: "ok", 2: "ok", 3: "ok", 4: "ok", 5: "ok", 6: "ok" },
        activeClutchIds: [],
        queuedModifier: { strainDelta: 0, accuracyDelta: 0, damageDelta: 0 },
        jammedTurnsRemaining: 0,
        disabledTurnsRemaining: 0,
        weaponCardLockTurnsRemaining: 0,
        skipAttackTurnsRemaining: 0,
        maxHeatPenalty: 0,
        totalHeatRemovedThisTurn: 0,
        firstWeaponCardPlayedThisTurn: false,
        allowMoveAfterAttack: false,
        isJammed: false,
        clutchActive: Boolean(unit.clutchActive),
        doubleClutchActive: false,
      },
      {
        instabilityWarning: combinedWarning || null,
        cardDisabledHint: selectedCardHint ? `SELECTED CARD LOCKED // ${selectedCardHint.toUpperCase()}` : null,
      },
    );
  } catch (err) {
    console.error(`[RENDER] Error in renderWeaponWindow:`, err);
    return `<div class="weapon-window-error">ERROR: ${err}</div>`;
  }
}

// ============================================================================
// STATE MANAGEMENT - Store movement in battle state itself
// ============================================================================

let localBattleState: BattleState | null = null;
let selectedCardIndex: number | null = null;
let hoveredTile: { x: number; y: number } | null = null;
let battleControllerCursor: { x: number; y: number } | null = null;
let cleanupBattleControllerContext: (() => void) | null = null;
let battleControllerActiveNodeId: BattleHudNodeId = "hand";
let selectedManageUnitId: string | null = null;
let battleExitConfirmState: BattleExitConfirmState = null;

function isBattleRootMounted(): boolean {
  return Boolean(document.querySelector(".battle-root"));
}

async function broadcastSquadBattleState(battle: BattleState): Promise<void> {
  const match = loadSquadMatchState();
  if (!match || !isSquadBattle(battle)) {
    return;
  }

  if (!isTauriSquadTransportAvailable() || match.transportState !== "hosting") {
    return;
  }

  await sendSquadTransportMessage("battle_snapshot", createSquadBattlePayload(match, battle), null);
}

async function finalizeSquadBattleMatchResult(battle: BattleState): Promise<void> {
  const match = loadSquadMatchState();
  if (!match || match.phase === "result" || !isSquadBattle(battle)) {
    return;
  }

  const winnerSlots = getSquadBattleWinnerSlots(battle);
  if (winnerSlots.length <= 0) {
    return;
  }

  const nextMatch = applySquadMatchCommand(match, {
    type: "complete_match",
    winnerSlots,
    reason: getSquadBattleResultReason(battle),
  });
  if (!nextMatch) {
    return;
  }

  saveSquadMatchState(nextMatch);
  let nextLobby = getGameState().lobby;
  if (nextLobby?.activity.kind === "skirmish") {
    const hasNextRound = Boolean(
      nextLobby.activity.skirmish.playlist.rounds[nextLobby.activity.skirmish.currentRoundIndex + 1],
    );
    nextLobby = hasNextRound
      ? setLobbySkirmishIntermission(nextLobby, nextMatch)
      : updateLobbySkirmishSnapshot(nextLobby, nextMatch);
    saveLobbyState(nextLobby);
    updateGameState((state) => ({
      ...state,
      lobby: nextLobby,
    }));
  }
  if (isTauriSquadTransportAvailable() && nextMatch.transportState === "hosting") {
    await sendSquadTransportMessage("snapshot", serializeSquadMatchSnapshot(nextMatch), null);
    if (nextLobby) {
      await sendSquadTransportMessage("lobby_snapshot", JSON.stringify(nextLobby), null);
    }
  }
}

export function applyExternalBattleState(
  battle: BattleState | null,
  renderMode: "always" | "if_mounted" = "if_mounted",
): void {
  if (!battle) {
    resetBattleUiSessionState();
    return;
  }

  updateGameState((state) => mountBattleState(state, battle));
  const previousActiveUnitId = localBattleState?.activeUnitId ?? null;
  const previousTurnCount = localBattleState?.turnCount ?? null;
  localBattleState = battle;
  if (
    previousActiveUnitId !== localBattleState.activeUnitId
    || previousTurnCount !== localBattleState.turnCount
  ) {
    selectedCardIndex = null;
    hoveredTile = null;
  }
  restoreTurnStateFromBattle(localBattleState);
  if (renderMode === "always" || isBattleRootMounted()) {
    renderBattleScreen();
  }
}

// Zoom state for the battle grid
let battleZoom = 1.3; // Increased default zoom for better visibility
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;

// ============================================================================
// FFTA-STYLE MOVEMENT ANIMATION SYSTEM
// ============================================================================

// Debug flag for movement instrumentation
const DEBUG_MOVEMENT = false;
const BATTLE_TILE_SIZE_PX = 75;
const BATTLE_TILE_GAP_PX = 4;
const BATTLE_GRID_PADDING_PX = 12;
const ATTACK_BUMP_DURATION_MS = 220;
const ATTACK_BUMP_DISTANCE_PX = 18;
const ATTACK_TARGET_REACT_DISTANCE_PX = 10;

interface MovingUnitAnim {
  unitId: string;
  path: Vec2[];        // includes start and end
  currentStep: number;  // current segment index (0 = first step)
  progress: number;     // 0..1 interpolation in current segment
  msPerTile: number;    // milliseconds per tile
  active: boolean;
  startTime: number;    // timestamp when animation started
  lastUpdateTime: number; // timestamp of last frame
  movingElement: HTMLElement | null; // Reference to the moving DOM element
  unitData: BattleUnitState; // Store unit data for rendering
}

let activeMovementAnim: MovingUnitAnim | null = null;
let animationFrameId: number | null = null;

interface AttackBumpAnim {
  attackerId: string;
  targetId: string;
  attackerElement: HTMLElement | null;
  targetElement: HTMLElement | null;
  attackerBaseX: number;
  attackerBaseY: number;
  targetBaseX: number;
  targetBaseY: number;
  dirX: number;
  dirY: number;
  durationMs: number;
  startTime: number;
  lastUpdateTime: number;
  active: boolean;
  impactTriggered: boolean;
}

let activeAttackBumpAnim: AttackBumpAnim | null = null;
let attackAnimationFrameId: number | null = null;

// PERSISTENT ANIMATION CONTAINER - survives DOM replacement
let persistentAnimationContainer: HTMLElement | null = null;

/**
 * Get or create the persistent animation container
 * This container is attached to the battle grid and survives re-renders
 */
function getOrCreateAnimationContainer(): HTMLElement | null {
  // Try to find existing container first
  if (persistentAnimationContainer && document.body.contains(persistentAnimationContainer)) {
    return persistentAnimationContainer;
  }

  // Find the battle grid container
  const gridContainer = getBattleGridContainer();
  if (!gridContainer) {
    console.error(`[ANIMATION] Grid container not found for animation container`);
    return null;
  }

  // Create or find animation container
  let animContainer = gridContainer.querySelector('.battle-animation-container') as HTMLElement;
  if (!animContainer) {
    animContainer = document.createElement('div');
    animContainer.className = 'battle-animation-container';
    animContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2000;
      overflow: visible;
    `;
    gridContainer.appendChild(animContainer);
  }

  persistentAnimationContainer = animContainer;
  return animContainer;
}

function getBattleTileCenterPx(pos: Vec2): { x: number; y: number } {
  const projected = battleSceneController?.projectTileToOverlay(pos.x, pos.y);
  if (projected) {
    return projected;
  }
  return {
    x: BATTLE_GRID_PADDING_PX + pos.x * (BATTLE_TILE_SIZE_PX + BATTLE_TILE_GAP_PX) + BATTLE_TILE_SIZE_PX / 2,
    y: BATTLE_GRID_PADDING_PX + pos.y * (BATTLE_TILE_SIZE_PX + BATTLE_TILE_GAP_PX) + BATTLE_TILE_SIZE_PX / 2,
  };
}

function getBattleGridContainer(): HTMLElement | null {
  return document.getElementById("battleGridContainer") as HTMLElement | null;
}

function getBattleBoardHost(): HTMLElement | null {
  return document.getElementById("battleBoard3dHost") as HTMLElement | null;
}

function getBattleSceneControllerInstance(): BattleSceneController {
  if (!battleSceneController) {
    battleSceneController = new BattleSceneController();
  }
  return battleSceneController;
}

function getOriginalBattleUnitElement(unitId: string): HTMLElement | null {
  void unitId;
  return null;
}

function setOriginalBattleUnitHidden(unitId: string, hidden: boolean): void {
  void unitId;
  void hidden;
}

function getBattleFeedbackLayer(): HTMLElement | null {
  const overlays = document.getElementById("battleBoardOverlay") as HTMLElement | null;
  if (!overlays) {
    return null;
  }

  let layer = overlays.querySelector(".battle-feedback-layer") as HTMLElement | null;
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "battle-feedback-layer";
    overlays.appendChild(layer);
  }

  return layer;
}

function getBattleFeedbackPoint(position: FeedbackPosition | undefined): { x: number; y: number } | null {
  if (!position || position.space !== "battle-tile") {
    return null;
  }

  return battleSceneController?.projectTileToOverlay(position.x, position.y) ?? null;
}

function queueBattleFeedbackElement(
  element: HTMLElement,
  durationMs: number,
  layer: HTMLElement,
): void {
  layer.appendChild(element);
  window.setTimeout(() => {
    element.classList.add("battle-feedback-element--exit");
    window.setTimeout(() => {
      element.remove();
    }, 220);
  }, durationMs);
}

function applyBattleHitStop(durationMs: number): void {
  battleHitStopUntilMs = Math.max(battleHitStopUntilMs, performance.now() + durationMs);
  const root = document.querySelector(".battle-root") as HTMLElement | null;
  if (!root) {
    return;
  }

  root.classList.add("battle-root--hitstop");
  if (battleHitStopTimerId !== null) {
    window.clearTimeout(battleHitStopTimerId);
  }
  battleHitStopTimerId = window.setTimeout(() => {
    const remainingMs = Math.max(0, battleHitStopUntilMs - performance.now());
    if (remainingMs > 6) {
      battleHitStopTimerId = window.setTimeout(() => {
        root.classList.remove("battle-root--hitstop");
        battleHitStopTimerId = null;
      }, remainingMs);
      return;
    }
    root.classList.remove("battle-root--hitstop");
    battleHitStopTimerId = null;
  }, durationMs);
}

function getBattleHitStopRemainingMs(): number {
  return Math.max(0, battleHitStopUntilMs - performance.now());
}

function pulseBattleElement(selector: string, className: string, durationMs: number): void {
  const element = document.querySelector(selector) as HTMLElement | null;
  if (!element) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => {
    element.classList.remove(className);
  }, durationMs);
}

function applyBattleWeaponFeedback(request: FeedbackRequest): void {
  const unitId = String(request.meta?.["unitId"] ?? request.meta?.["actorId"] ?? "");
  const activeUnit = localBattleState?.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null;
  if (!activeUnit || !unitId || activeUnit.id !== unitId) {
    return;
  }

  const effectKind = String(request.meta?.["kind"] ?? "");
  if (request.type === "weapon_heat") {
    const zone = String(request.meta?.["zone"] ?? "warning");
    pulseBattleElement(
      ".battle-weapon-panel .weapon-stat-bar-fill--heat",
      zone === "critical" ? "weapon-stat-bar-fill--pulse-critical" : "weapon-stat-bar-fill--pulse-warning",
      zone === "critical" ? 860 : 680,
    );
    return;
  }

  if (request.type === "weapon_overheat") {
    pulseBattleElement(".battle-weapon-panel .weapon-window", "weapon-window--overheat-spike", 880);
    pulseBattleElement(".battle-weapon-panel .weapon-stat-bar-fill--heat", "weapon-stat-bar-fill--pulse-critical", 920);
    return;
  }

  if (request.type === "weapon_node_damage") {
    const nodeId = String(request.meta?.["nodeId"] ?? "");
    if (nodeId) {
      pulseBattleElement(
        `.battle-weapon-panel .weapon-node[data-node="${nodeId}"]`,
        "weapon-node--feedback-hit",
        780,
      );
    }
    return;
  }

  if (effectKind === "ammo-tick") {
    pulseBattleElement(".battle-weapon-panel .weapon-stat-bar-fill--ammo", "weapon-stat-bar-fill--pulse-ammo", 420);
    return;
  }

  if (effectKind === "clutch-toggle") {
    pulseBattleElement(".battle-weapon-panel .weapon-window", "weapon-window--clutch-pulse", 580);
    pulseBattleElement(".battle-weapon-panel .weapon-clutch-btn--active", "weapon-clutch-btn--feedback-active", 520);
    return;
  }

  if (effectKind === "reload") {
    pulseBattleElement(".battle-weapon-panel .weapon-stat-bar-fill--ammo", "weapon-stat-bar-fill--pulse-ammo", 540);
    pulseBattleElement(".battle-weapon-panel .weapon-window", "weapon-window--feedback-confirm", 420);
    return;
  }

  if (effectKind === "patch") {
    pulseBattleElement(".battle-weapon-panel .weapon-window", "weapon-window--feedback-confirm", 420);
    return;
  }

  if (effectKind === "vent") {
    pulseBattleElement(".battle-weapon-panel .weapon-window", "weapon-window--feedback-warning", 680);
  }
}

function renderBattleFeedbackRequest(request: FeedbackRequest): void {
  const layer = getBattleFeedbackLayer();
  if (!layer) {
    return;
  }

  const point = getBattleFeedbackPoint(request.position);
  if (!point) {
    applyBattleWeaponFeedback(request);
    return;
  }

  const centerX = point.x;
  const centerY = point.y;

  if (
    request.type === "hit"
    || request.type === "heal"
    || request.type === "crit"
    || request.type === "miss"
    || request.type === "warning"
    || request.type === "strain"
  ) {
    const textFlavor = request.type === "warning" && String(request.meta?.["kind"] ?? "") === "ammo-tick"
      ? "ammo"
      : request.type;
    const textEl = document.createElement("div");
    textEl.className = `battle-feedback-element floating-combat-text floating-combat-text--${textFlavor}`;
    textEl.textContent = request.text ?? request.type.toUpperCase();
    textEl.style.left = `${centerX}px`;
    textEl.style.top = `${centerY}px`;
    queueBattleFeedbackElement(textEl, request.type === "strain" ? 980 : 860, layer);
  }

  if (
    request.type === "hit"
    || request.type === "crit"
    || request.type === "weapon_node_damage"
    || request.type === "weapon_overheat"
  ) {
    const flashFlavor = request.type === "crit"
      ? "crit"
      : request.type === "weapon_overheat"
        ? "overheat"
        : request.type === "weapon_node_damage"
          ? "node"
          : "hit";
    const flashEl = document.createElement("div");
    flashEl.className = `battle-feedback-element battle-impact-flash battle-impact-flash--${flashFlavor}`;
    flashEl.style.left = `${centerX}px`;
    flashEl.style.top = `${centerY}px`;
    queueBattleFeedbackElement(flashEl, 220, layer);
  }

  if (request.type === "hit" || request.type === "crit") {
    applyBattleHitStop(request.type === "crit" ? 68 : 52);
    triggerScreenShake(request.type === "crit" ? 2 : request.intensity >= 2 ? 1.5 : 1);
  } else if (request.type === "weapon_overheat") {
    triggerScreenShake(2.4);
  }

  if (request.type === "strain") {
    const battleUnitId = String(request.meta?.["unitId"] ?? "");
    if (battleUnitId) {
      battleSceneController?.triggerUnitPulse(battleUnitId);
    }
  }

  applyBattleWeaponFeedback(request);
}

function ensureBattleFeedbackListener(): void {
  if (cleanupBattleFeedbackListener) {
    return;
  }

  cleanupBattleFeedbackListener = subscribeToFeedback((request) => {
    if (!document.querySelector(".battle-root")) {
      return;
    }

    const battleRelated = request.position?.space === "battle-tile" || request.source === "battle" || request.source === "weapon";
    if (!battleRelated) {
      return;
    }

    renderBattleFeedbackRequest(request);
  });
}

function createAnimatedBattleUnitElement(unit: BattleUnitState, extraClass: string): HTMLElement {
  const movingUnit = document.createElement("div");
  const side = unit.isEnemy ? "battle-unit--enemy" : "battle-unit--ally";
  const truncName = unit.name.length > 8 ? unit.name.slice(0, 8) + "…" : unit.name;
  const portraitPath = getBattleUnitPortraitPath(unit.id, unit.baseUnitId);
  const facing = unit.facing ?? (unit.isEnemy ? "west" : "east");

  movingUnit.className = `battle-unit battle-unit--simple ${side} ${extraClass}`.trim();
  movingUnit.setAttribute("data-unit-id", unit.id);
  movingUnit.setAttribute("data-animating", "true");
  movingUnit.setAttribute("data-facing", facing);
  movingUnit.innerHTML = `
    <div class="battle-unit-portrait-wrapper">
      <div class="battle-unit-portrait">
        <img src="${portraitPath}" alt="${unit.name}" class="battle-unit-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
      </div>
      <div class="battle-unit-info-overlay">
        <div class="battle-unit-name">${truncName}</div>
        <div class="battle-unit-hp">HP ${unit.hp}/${unit.maxHp}</div>
      </div>
    </div>
  `;

  movingUnit.style.position = "absolute";
  movingUnit.style.pointerEvents = "none";
  movingUnit.style.opacity = "1";
  movingUnit.style.visibility = "visible";
  movingUnit.style.display = "flex";
  movingUnit.style.width = "auto";
  movingUnit.style.height = "auto";
  movingUnit.style.transform = "translate(-50%, -50%)";
  movingUnit.style.transition = "none";
  movingUnit.style.willChange = "left, top, transform";
  movingUnit.style.zIndex = "2000";
  movingUnit.style.background = "none";
  movingUnit.style.border = "none";
  movingUnit.style.padding = "0";
  movingUnit.style.margin = "0";
  movingUnit.style.boxShadow = "none";

  const children = movingUnit.querySelectorAll("*");
  children.forEach((child: Element) => {
    const el = child as HTMLElement;
    if (el.classList.contains("battle-unit-portrait")) {
      el.style.background = "rgba(0,0,0,0.4)";
    } else if (el.classList.contains("battle-unit-info-overlay")) {
      el.style.background = "rgba(0,0,0,0.7)";
    } else {
      el.style.background = "none";
    }
    el.style.border = "none";
    el.style.boxShadow = "none";
  });

  return movingUnit;
}

function hasActiveBattleAnimation(): boolean {
  return Boolean(
    battleSceneController?.hasActiveAnimations()
    || (activeMovementAnim && activeMovementAnim.active)
    || (activeAttackBumpAnim && activeAttackBumpAnim.active)
  );
}

function setBattleZoom(z: number) {
  battleZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  battleSceneController?.setZoomFactor(battleZoom);
}

function zoomIn() {
  setBattleZoom(battleZoom + ZOOM_STEP);
}

function zoomOut() {
  setBattleZoom(battleZoom - ZOOM_STEP);
}

// These are stored PER UNIT in an extended battle state
interface TurnState {
  hasMoved: boolean;
  hasCommittedMove: boolean; // True after clicking a tile - hides green until undo
  hasActed: boolean; // True after playing a card - ends the turn for this unit
  movementOnlyAfterAttack: boolean;
  movementRemaining: number;
  originalPosition: { x: number; y: number } | null;
  isFacingSelection: boolean; // True when selecting final facing before ending turn
}
let turnState: TurnState = { hasMoved: false, hasCommittedMove: false, hasActed: false, movementOnlyAfterAttack: false, movementRemaining: 0, originalPosition: null, isFacingSelection: false };

function cloneTurnState(current: TurnState = turnState): TurnState {
  return {
    hasMoved: current.hasMoved,
    hasCommittedMove: current.hasCommittedMove,
    hasActed: current.hasActed,
    movementOnlyAfterAttack: current.movementOnlyAfterAttack,
    movementRemaining: current.movementRemaining,
    originalPosition: current.originalPosition ? { ...current.originalPosition } : null,
    isFacingSelection: current.isFacingSelection,
  };
}

type BattleHudNodeId = "console" | "intel" | "placement" | "unit" | "weapon" | "manage" | "consumables" | "hand";

type BattleHudNodeLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  zIndex: number;
};

type BattleHudNodeDefinition = {
  title: string;
  kicker: string;
  minWidth: number;
  minHeight: number;
  resizable: boolean;
  restoreLabel: string;
};

type BattleHudColorTheme = {
  key: string;
  vars: Record<string, string>;
};

const BATTLE_HUD_MARGIN_X = 18;
const BATTLE_HUD_TOP_SAFE = 94;
const BATTLE_HUD_BOTTOM_SAFE = 22;
const BATTLE_HUD_DRAG_THRESHOLD_PX = 6;
const BATTLE_HAND_GRID_MIN_WIDTH = 720;
const BATTLE_HAND_GRID_MIN_HEIGHT = 500;
const BATTLE_HUD_NODE_ORDER: BattleHudNodeId[] = ["console", "intel", "placement", "unit", "weapon", "manage", "consumables", "hand"];
const BATTLE_HUD_COLOR_THEMES: BattleHudColorTheme[] = [
  {
    key: "amber",
    vars: {
      "--all-nodes-panel-bg": "#4d3f34",
      "--all-nodes-panel-hover-bg": "#6b5d4f",
      "--all-nodes-border": "#7a5a32",
      "--all-nodes-border-hover": "#a87c45",
      "--all-nodes-surface-bg": "#2d2c2a",
      "--all-nodes-surface-border": "rgba(168, 124, 69, 0.28)",
      "--all-nodes-accent": "#ffcc6e",
      "--all-nodes-accent-soft": "rgba(255, 204, 110, 0.14)",
      "--all-nodes-text": "#e8e4dc",
      "--all-nodes-muted": "#8d7a67",
      "--all-nodes-glow": "rgba(168, 124, 69, 0.28)",
      "--all-nodes-focus": "#ffcc6e",
    },
  },
  {
    key: "violet",
    vars: {
      "--all-nodes-panel-bg": "#463a4f",
      "--all-nodes-panel-hover-bg": "#5e4d69",
      "--all-nodes-border": "#8967ff",
      "--all-nodes-border-hover": "#c0b3ff",
      "--all-nodes-surface-bg": "#26222d",
      "--all-nodes-surface-border": "rgba(192, 179, 255, 0.32)",
      "--all-nodes-accent": "#cdbfff",
      "--all-nodes-accent-soft": "rgba(192, 179, 255, 0.16)",
      "--all-nodes-text": "#eee8f7",
      "--all-nodes-muted": "#9a8eb2",
      "--all-nodes-glow": "rgba(192, 179, 255, 0.26)",
      "--all-nodes-focus": "#d8cfff",
    },
  },
  {
    key: "verdant",
    vars: {
      "--all-nodes-panel-bg": "#34463d",
      "--all-nodes-panel-hover-bg": "#466050",
      "--all-nodes-border": "#5f9b7a",
      "--all-nodes-border-hover": "#84c59b",
      "--all-nodes-surface-bg": "#1f2c26",
      "--all-nodes-surface-border": "rgba(132, 197, 155, 0.3)",
      "--all-nodes-accent": "#a8e0b4",
      "--all-nodes-accent-soft": "rgba(132, 197, 155, 0.16)",
      "--all-nodes-text": "#edf4ef",
      "--all-nodes-muted": "#8a9d91",
      "--all-nodes-glow": "rgba(132, 197, 155, 0.24)",
      "--all-nodes-focus": "#b7efc3",
    },
  },
  {
    key: "teal",
    vars: {
      "--all-nodes-panel-bg": "#2f4650",
      "--all-nodes-panel-hover-bg": "#3f6170",
      "--all-nodes-border": "#4f8b93",
      "--all-nodes-border-hover": "#73b5bf",
      "--all-nodes-surface-bg": "#1d2b30",
      "--all-nodes-surface-border": "rgba(115, 181, 191, 0.28)",
      "--all-nodes-accent": "#9ed8de",
      "--all-nodes-accent-soft": "rgba(115, 181, 191, 0.16)",
      "--all-nodes-text": "#e5f0f2",
      "--all-nodes-muted": "#86999d",
      "--all-nodes-glow": "rgba(115, 181, 191, 0.24)",
      "--all-nodes-focus": "#b2e4e8",
    },
  },
  {
    key: "oxide",
    vars: {
      "--all-nodes-panel-bg": "#4e362f",
      "--all-nodes-panel-hover-bg": "#67463d",
      "--all-nodes-border": "#b0684c",
      "--all-nodes-border-hover": "#d68d6b",
      "--all-nodes-surface-bg": "#2b201d",
      "--all-nodes-surface-border": "rgba(214, 141, 107, 0.28)",
      "--all-nodes-accent": "#ffc0a4",
      "--all-nodes-accent-soft": "rgba(214, 141, 107, 0.18)",
      "--all-nodes-text": "#f0e5e0",
      "--all-nodes-muted": "#a28a7e",
      "--all-nodes-glow": "rgba(214, 141, 107, 0.24)",
      "--all-nodes-focus": "#ffd0b8",
    },
  },
  {
    key: "moss",
    vars: {
      "--all-nodes-panel-bg": "#404733",
      "--all-nodes-panel-hover-bg": "#575f45",
      "--all-nodes-border": "#7f9161",
      "--all-nodes-border-hover": "#a6ba85",
      "--all-nodes-surface-bg": "#252a20",
      "--all-nodes-surface-border": "rgba(166, 186, 133, 0.28)",
      "--all-nodes-accent": "#d2e3ad",
      "--all-nodes-accent-soft": "rgba(166, 186, 133, 0.17)",
      "--all-nodes-text": "#eef0e5",
      "--all-nodes-muted": "#949880",
      "--all-nodes-glow": "rgba(166, 186, 133, 0.22)",
      "--all-nodes-focus": "#e1efbf",
    },
  },
  {
    key: "steel",
    vars: {
      "--all-nodes-panel-bg": "#384047",
      "--all-nodes-panel-hover-bg": "#4a555e",
      "--all-nodes-border": "#70818d",
      "--all-nodes-border-hover": "#9aaab5",
      "--all-nodes-surface-bg": "#20262b",
      "--all-nodes-surface-border": "rgba(154, 170, 181, 0.28)",
      "--all-nodes-accent": "#d5e0e8",
      "--all-nodes-accent-soft": "rgba(154, 170, 181, 0.16)",
      "--all-nodes-text": "#edf1f4",
      "--all-nodes-muted": "#96a2ab",
      "--all-nodes-glow": "rgba(154, 170, 181, 0.22)",
      "--all-nodes-focus": "#e4edf3",
    },
  },
];
const BATTLE_HUD_COLOR_THEME_KEYS = BATTLE_HUD_COLOR_THEMES.map((theme) => theme.key);
const BATTLE_HUD_COLOR_THEME_MAP = new Map(BATTLE_HUD_COLOR_THEMES.map((theme) => [theme.key, theme]));
const BATTLE_HUD_NODE_DEFS: Record<BattleHudNodeId, BattleHudNodeDefinition> = {
  console: {
    title: "Engagement Feed",
    kicker: "S/COM_OS // LIVE LOG",
    minWidth: 340,
    minHeight: 140,
    resizable: true,
    restoreLabel: "FEED",
  },
  intel: {
    title: "Enemy Intel",
    kicker: "COMMS // HOSTILE TELEMETRY",
    minWidth: 320,
    minHeight: 220,
    resizable: true,
    restoreLabel: "INTEL",
  },
  placement: {
    title: "Unit Placement",
    kicker: "DEPLOYMENT // STAGING",
    minWidth: 340,
    minHeight: 340,
    resizable: true,
    restoreLabel: "DEPLOY",
  },
  unit: {
    title: "Active Unit",
    kicker: "TACTICAL STATUS",
    minWidth: 280,
    minHeight: 220,
    resizable: true,
    restoreLabel: "UNIT",
  },
  weapon: {
    title: "Weapon Link",
    kicker: "LOADOUT STATUS",
    minWidth: 260,
    minHeight: 220,
    resizable: true,
    restoreLabel: "WEAPON",
  },
  manage: {
    title: "Manage Units",
    kicker: "TACTICAL ROSTER",
    minWidth: 420,
    minHeight: 300,
    resizable: true,
    restoreLabel: "UNITS",
  },
  consumables: {
    title: "Consumables",
    kicker: "FIELD ITEMS // FREE USE",
    minWidth: 320,
    minHeight: 240,
    resizable: true,
    restoreLabel: "ITEMS",
  },
  hand: {
    title: "Hand Console",
    kicker: "TACTICAL HAND",
    minWidth: 480,
    minHeight: 392,
    resizable: true,
    restoreLabel: "HAND",
  },
};

let battleHudLayouts: Record<BattleHudNodeId, BattleHudNodeLayout> | null = null;
let battleHudResizeHandler: (() => void) | null = null;
let battleHudZCounter = 40;
let battleHudNodeColors: Record<BattleHudNodeId, string> | null = null;
let isBattleHudPointerInteraction = false;
let battleHudMouseDownHandler: ((event: MouseEvent) => void) | null = null;
let battleHudMouseMoveHandler: ((event: MouseEvent) => void) | null = null;
let battleHudMouseUpHandler: (() => void) | null = null;
let battleHudOverlayClickHandler: ((event: MouseEvent) => void) | null = null;
let battleHudPreviousUserSelect = "";
let activeBattleHudSession: {
  nodeId: BattleHudNodeId;
  mode: "drag" | "resize";
  startX: number;
  startY: number;
  startLayout: BattleHudNodeLayout;
  active: boolean;
} | null = null;
let battleHudOverlayRoot: HTMLElement | null = null;

// ============================================================================
// PAN STATE & CONTROLS (for WASD grid panning)
// ============================================================================

interface BattlePanState {
  x: number;
  y: number;
  keysPressed: Set<string>;
  shiftPressed: boolean;
}

let battlePanState: BattlePanState = {
  x: 0,
  y: 0,
  keysPressed: new Set(),
  shiftPressed: false,
};

let battlePanAnimationFrame: number | null = null;
let battleKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let battleKeyupHandler: ((e: KeyboardEvent) => void) | null = null;

// UI panel visibility state
let uiPanelsMinimized = false;

// Endless battle mode state
let isEndlessBattleMode = false;
let endlessBattleCount = 0;

const BATTLE_PAN_SPEED = 4;
const BATTLE_PAN_KEYS = new Set(["w", "a", "s", "d", "W", "A", "S", "D", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

function cleanupBattlePanHandlers(): void {
  isBattleHudPointerInteraction = Boolean(activeBattleHudSession);
  if (battleKeydownHandler) {
    window.removeEventListener("keydown", battleKeydownHandler);
    battleKeydownHandler = null;
  }
  if (battleKeyupHandler) {
    window.removeEventListener("keyup", battleKeyupHandler);
    battleKeyupHandler = null;
  }
  if (battlePanAnimationFrame) {
    cancelAnimationFrame(battlePanAnimationFrame);
    battlePanAnimationFrame = null;
  }
  battlePanState.keysPressed.clear();
  battlePanState.shiftPressed = false;
  cleanupBattleHudWindowListener();
}

function setupBattlePanHandlers(): void {
  cleanupBattlePanHandlers();

  // Preserve the current camera position across battle rerenders.
  battlePanState = {
    x: battlePanState.x,
    y: battlePanState.y,
    keysPressed: new Set(),
    shiftPressed: false,
  };

  battleKeydownHandler = (e: KeyboardEvent) => {
    // Update player input system
    handlePlayerInputKeyDown(e);

    // Track shift key for speed boost
    if (e.key === "Shift" || e.key === "ShiftLeft" || e.key === "ShiftRight") {
      battlePanState.shiftPressed = true;
    }

    // Handle facing selection first (if active, arrow keys select facing instead of panning)
    if (turnState.isFacingSelection && localBattleState) {
      const activeUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null;
      if (activeUnit && canLocalControlBattleUnit(localBattleState, activeUnit)) {
        const playerInput = getPlayerInput(getBattleInputPlayerId(localBattleState, activeUnit));
        let newFacing: "north" | "south" | "east" | "west" | null = null;

        if (playerInput.up) {
          newFacing = "north";
        } else if (playerInput.down) {
          newFacing = "south";
        } else if (playerInput.left) {
          newFacing = "west";
        } else if (playerInput.right) {
          newFacing = "east";
        }

        if (newFacing) {
          e.preventDefault();
          if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
            void sendLocalNetworkBattleCommand({
              type: "end_turn",
              unitId: activeUnit.id,
              facing: newFacing,
            });
            turnState.isFacingSelection = false;
            renderBattleScreen();
            return;
          }

          // Update facing, then end the turn using that final orientation
          const newUnits = { ...localBattleState.units };
          newUnits[activeUnit.id] = { ...newUnits[activeUnit.id], facing: newFacing };
          const newState = { ...localBattleState, units: newUnits };
          setBattleState(newState);
          finalizeBattleHudEndTurn(newState);
          return;
        }
      }
    }

    if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
      if (e.key.toLowerCase() === "q") {
        e.preventDefault();
        battleSceneController?.adjustOrbit(-0.14, 0);
        return;
      }
      if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        battleSceneController?.adjustOrbit(0.14, 0);
        return;
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        battleSceneController?.adjustOrbit(0, 0.08);
        return;
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        battleSceneController?.adjustOrbit(0, -0.08);
        return;
      }
    }

    if (!BATTLE_PAN_KEYS.has(e.key)) return;

    // Don't pan if typing in an input
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }

    e.preventDefault();
    battlePanState.keysPressed.add(e.key.toLowerCase());

    if (!battlePanAnimationFrame) {
      startBattlePanLoop();
    }
  };

  battleKeyupHandler = (e: KeyboardEvent) => {
    // Update player input system
    handlePlayerInputKeyUp(e);

    // Track shift key release
    if (e.key === "Shift" || e.key === "ShiftLeft" || e.key === "ShiftRight") {
      battlePanState.shiftPressed = false;
    }

    battlePanState.keysPressed.delete(e.key.toLowerCase());

    // Also handle arrow keys
    const arrowToWasd: Record<string, string> = {
      "arrowup": "w",
      "arrowleft": "a",
      "arrowdown": "s",
      "arrowright": "d",
    };
    const mapped = arrowToWasd[e.key.toLowerCase()];
    if (mapped) {
      battlePanState.keysPressed.delete(mapped);
    }
  };

  window.addEventListener("keydown", battleKeydownHandler);
  window.addEventListener("keyup", battleKeyupHandler);
}

function startBattlePanLoop(): void {
  const update = () => {
    let dx = 0;
    let dy = 0;

    // Apply speed multiplier when shift is held
    const speedMultiplier = battlePanState.shiftPressed ? 2.5 : 1;
    const currentSpeed = BATTLE_PAN_SPEED * speedMultiplier;

    if (battlePanState.keysPressed.has("w") || battlePanState.keysPressed.has("arrowup")) dy += currentSpeed;
    if (battlePanState.keysPressed.has("s") || battlePanState.keysPressed.has("arrowdown")) dy -= currentSpeed;
    if (battlePanState.keysPressed.has("a") || battlePanState.keysPressed.has("arrowleft")) dx -= currentSpeed;
    if (battlePanState.keysPressed.has("d") || battlePanState.keysPressed.has("arrowright")) dx += currentSpeed;

    if (dx !== 0 || dy !== 0) {
      battlePanState.x += dx;
      battlePanState.y += dy;
      battleSceneController?.panScreen(-dx, -dy);
    }

    if (battlePanState.keysPressed.size > 0) {
      battlePanAnimationFrame = requestAnimationFrame(update);
    } else {
      battlePanAnimationFrame = null;
    }
  };

  battlePanAnimationFrame = requestAnimationFrame(update);
}

function resetBattlePan(): void {
  battlePanState.x = 0;
  battlePanState.y = 0;
  battlePanState.keysPressed.clear();
  battlePanState.shiftPressed = false;
  const focusUnit = localBattleState?.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null;
  battleSceneController?.focusTile(focusUnit?.pos ?? hoveredTile);
}

function resetBattleUiSessionState(): void {
  clearPendingAutoBattleStep();
  battleExitConfirmState = null;
  localBattleState = null;
  lastBattleStatPingKey = null;
  selectedCardIndex = null;
  hoveredTile = null;
  selectedManageUnitId = null;
  resetTurnStateForUnit(null);
  resetBattlePan();
  uiPanelsMinimized = false;
  battleSceneController?.setViewChangeHandler(null);
  resetBattleViewPresetSessionState();
  battleSceneController?.dispose();
  battleSceneController = null;
}

function getBattlePartyUnits(battle: BattleState): BattleUnitState[] {
  return Object.values(battle.units)
    .filter((unit) => isSquadBattle(battle) ? canLocalControlBattleUnit(battle, unit) : !unit.isEnemy)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSelectedManageUnit(battle: BattleState): BattleUnitState | null {
  const partyUnits = getBattlePartyUnits(battle);
  if (partyUnits.length === 0) {
    selectedManageUnitId = null;
    return null;
  }

  const activePlayerUnit = battle.activeUnitId ? battle.units[battle.activeUnitId] : null;
  const preferredId = selectedManageUnitId
    ?? (activePlayerUnit && canLocalControlBattleUnit(battle, activePlayerUnit) ? activePlayerUnit.id : null)
    ?? partyUnits[0].id;
  const selectedUnit = partyUnits.find((unit) => unit.id === preferredId) ?? partyUnits[0];
  selectedManageUnitId = selectedUnit.id;
  return selectedUnit;
}

function formatBattlePosition(unit: BattleUnitState): string {
  if (!unit.pos) {
    return unit.hp <= 0 ? "Downed" : "Reserve";
  }

  return `(${unit.pos.x + 1}, ${unit.pos.y + 1})`;
}

function formatBattleEquipmentName(
  equipmentId: string | null | undefined,
  equipmentById: Record<string, any>,
): string {
  if (!equipmentId) {
    return "None";
  }

  return equipmentById[equipmentId]?.name ?? equipmentId;
}

function syncBattleConsumableUsageToGameState(
  nextBattle: BattleState,
  nextConsumables: Record<string, number>,
  targetId: string | null,
  healedAmount: number,
): void {
  updateGameState((state) => {
    const nextUnitsById = { ...state.unitsById };
    if (targetId && healedAmount > 0) {
      const battleUnit = nextBattle.units[targetId];
      const rosterUnitId = battleUnit?.baseUnitId ?? targetId;
      const rosterUnit = nextUnitsById[rosterUnitId];
      if (rosterUnit) {
        nextUnitsById[rosterUnitId] = {
          ...rosterUnit,
          hp: Math.min(rosterUnit.maxHp, rosterUnit.hp + healedAmount),
        };
      }
    }

    return {
      ...state,
      consumables: nextConsumables,
      unitsById: nextUnitsById,
      currentBattle: nextBattle,
    };
  });
}

function toggleUiPanels(): void {
  uiPanelsMinimized = !uiPanelsMinimized;

  const unitPanel = document.querySelector(".battle-unit-panel") as HTMLElement;
  const weaponPanel = document.querySelector(".battle-weapon-panel") as HTMLElement;
  const handFloating = document.querySelector(".battle-hand-floating") as HTMLElement;
  const consoleOverlay = document.querySelector(".scrollink-console-overlay") as HTMLElement;
  const battleNodes = document.querySelectorAll<HTMLElement>(".battle-node");
  const dock = document.querySelector(".battle-node-dock") as HTMLElement | null;
  const toggleBtn = document.getElementById("toggleUiBtn");

  if (unitPanel) {
    unitPanel.style.transform = uiPanelsMinimized ? "translateY(100%)" : "translateY(0)";
    unitPanel.style.opacity = uiPanelsMinimized ? "0" : "1";
    unitPanel.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }

  if (weaponPanel) {
    weaponPanel.style.transform = uiPanelsMinimized ? "translateY(100%)" : "translateY(0)";
    weaponPanel.style.opacity = uiPanelsMinimized ? "0" : "1";
    weaponPanel.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }

  if (handFloating) {
    handFloating.style.transform = uiPanelsMinimized ? "translateY(100%)" : "translateY(0)";
    handFloating.style.opacity = uiPanelsMinimized ? "0" : "1";
    handFloating.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }

  if (consoleOverlay) {
    consoleOverlay.style.transform = uiPanelsMinimized ? "translateX(-100%)" : "translateX(0)";
    consoleOverlay.style.opacity = uiPanelsMinimized ? "0" : "1";
    consoleOverlay.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }

  battleNodes.forEach((node) => {
    node.style.transform = uiPanelsMinimized ? "translateY(100%)" : "translateY(0)";
    node.style.opacity = uiPanelsMinimized ? "0" : "1";
    node.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  });

  if (dock) {
    dock.style.transform = uiPanelsMinimized ? "translateY(100%)" : "translateY(0)";
    dock.style.opacity = uiPanelsMinimized ? "0" : "1";
    dock.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }

  if (toggleBtn) {
    toggleBtn.textContent = uiPanelsMinimized ? "👁 SHOW UI" : "👁 HIDE UI";
    toggleBtn.classList.toggle("battle-toggle-btn--active", uiPanelsMinimized);
  }
}

function triggerScreenShake(intensity = 1): void {
  const container = document.querySelector(".battle-root") as HTMLElement | null;
  if (!container) {
    return;
  }

  const normalized = Math.max(0.8, Math.min(2.8, intensity));
  container.style.setProperty("--battle-shake-scale", normalized.toFixed(2));
  container.classList.remove("screen-shake");
  void container.offsetWidth;
  container.classList.add("screen-shake");

  window.setTimeout(() => {
    container.classList.remove("screen-shake");
  }, 380);
}

function showFloatingText(text: string, type: "damage" | "heal" | "crit", x: number, y: number) {
  const layer = getBattleFeedbackLayer();
  const point = battleSceneController?.projectTileToOverlay(x, y);
  if (!layer || !point) return;

  const el = document.createElement("div");
  el.className = `floating-combat-text floating-combat-text--${type}`;
  el.textContent = text;
  el.style.left = `${point.x}px`;
  el.style.top = `${point.y}px`;
  layer.appendChild(el);

  setTimeout(() => {
    if (el.parentNode === layer) {
      layer.removeChild(el);
    }
  }, 1500);
}

function setBattleState(newState: BattleState) {
  const previousBattle = localBattleState;
  const previousActiveUnitId = localBattleState?.activeUnitId ?? null;
  const previousTurnCount = localBattleState?.turnCount ?? null;
  const newLogTail = previousBattle ? newState.log.slice(previousBattle.log.length) : newState.log;

  // Validate all unit positions before setting state
  const validatedUnits: Record<string, BattleUnitState> = {};

  for (const [unitId, rawUnit] of Object.entries(newState.units)) {
    const unit = normalizeBattleUnitAutoState(rawUnit);
    if (unit.pos) {
      // Validate position is within bounds
      if (unit.pos.x < 0 || unit.pos.x >= newState.gridWidth ||
        unit.pos.y < 0 || unit.pos.y >= newState.gridHeight) {
        console.error("[BATTLE_STATE] Invalid unit position detected!", {
          unitId,
          pos: unit.pos,
          bounds: { width: newState.gridWidth, height: newState.gridHeight }
        });
        // Remove invalid position (unit will need to be repositioned)
        validatedUnits[unitId] = { ...unit, pos: null };
        continue;
      }

      // Validate position is an integer
      if (!Number.isInteger(unit.pos.x) || !Number.isInteger(unit.pos.y)) {
        console.error("[BATTLE_STATE] Non-integer unit position!", {
          unitId,
          pos: unit.pos
        });
        // Round to nearest integer
        validatedUnits[unitId] = {
          ...unit,
          pos: {
            x: Math.round(unit.pos.x),
            y: Math.round(unit.pos.y)
          }
        };
        continue;
      }
    }

    validatedUnits[unitId] = unit;
  }

  // Check for duplicate positions
  const positionMap = new Map<string, string>();
  for (const [unitId, unit] of Object.entries(validatedUnits)) {
    if (unit.pos && unit.hp > 0) {
      const key = `${unit.pos.x},${unit.pos.y}`;
      const existingUnitId = positionMap.get(key);
      if (existingUnitId && existingUnitId !== unitId) {
        console.error("[BATTLE_STATE] Duplicate unit positions detected!", {
          unit1: existingUnitId,
          unit2: unitId,
          pos: unit.pos
        });
        // Keep the first unit, remove position from the second
        validatedUnits[unitId] = { ...unit, pos: null };
      } else {
        positionMap.set(key, unitId);
      }
    }
  }

  // Re-sync turn order: Only units that have a position (and HP > 0) should be in the turn order
  // This ensures that if we stripped a position above, the unit won't cause AI loops
  const validatedTurnOrder = newState.turnOrder.filter(unitId => {
    const unit = validatedUnits[unitId];
    return unit && unit.pos && unit.hp > 0;
  });

  localBattleState = {
    ...newState,
    units: validatedUnits,
    turnOrder: validatedTurnOrder
  };

  const nextActiveUnitId = localBattleState.activeUnitId ?? null;
  const didTurnAdvance =
    previousActiveUnitId !== nextActiveUnitId
    || previousTurnCount !== localBattleState.turnCount;

  if (didTurnAdvance) {
    selectedCardIndex = null;
    hoveredTile = null;
    resetTurnStateForUnit(nextActiveUnitId ? localBattleState.units[nextActiveUnitId] ?? null : null, localBattleState);
  }

  if (isSquadBattle(localBattleState) || isCoopOperationsBattle(localBattleState)) {
    localBattleState = withBattleTurnStateSnapshot(localBattleState);
  }

  deriveBattleFeedback(previousBattle, localBattleState, newLogTail).forEach((request) => {
    triggerFeedback(request);
  });

  const committedBattleState = localBattleState;
  if (!committedBattleState) {
    return;
  }

  updateGameState((state) => replaceBattleStateById(state, committedBattleState.id, committedBattleState));

  if (isSquadBattle(committedBattleState)) {
    void broadcastSquadBattleState(committedBattleState);
    if (committedBattleState.phase === "victory" || committedBattleState.phase === "defeat") {
      void finalizeSquadBattleMatchResult(committedBattleState);
    }
  }
}

function resetTurnStateForUnit(unit: BattleUnitState | null, battle: BattleState | null = localBattleState) {
  const movementRange = unit ? getUnitMovementRange(unit, battle) : 3;
  turnState = {
    hasMoved: false,
    hasCommittedMove: false,
    hasActed: false,
    movementOnlyAfterAttack: false,
    movementRemaining: movementRange,
    originalPosition: null,
    isFacingSelection: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cleanupBattleHudWindowListener(): void {
  if (battleHudResizeHandler) {
    window.removeEventListener("resize", battleHudResizeHandler);
    battleHudResizeHandler = null;
  }
}

function endBattleHudInteractionSession(): void {
  if (battleHudPreviousUserSelect) {
    document.body.style.userSelect = battleHudPreviousUserSelect;
    battleHudPreviousUserSelect = "";
  }

  activeBattleHudSession = null;
  isBattleHudPointerInteraction = false;
}

function cleanupBattleHudInteractionListeners(): void {
  if (battleHudMouseDownHandler) {
    window.removeEventListener("mousedown", battleHudMouseDownHandler, true);
    battleHudMouseDownHandler = null;
  }
  if (battleHudMouseMoveHandler) {
    window.removeEventListener("mousemove", battleHudMouseMoveHandler);
    battleHudMouseMoveHandler = null;
  }
  if (battleHudMouseUpHandler) {
    window.removeEventListener("mouseup", battleHudMouseUpHandler);
    window.removeEventListener("blur", battleHudMouseUpHandler);
    battleHudMouseUpHandler = null;
  }
  if (battleHudOverlayClickHandler) {
    window.removeEventListener("click", battleHudOverlayClickHandler, true);
    battleHudOverlayClickHandler = null;
  }
  endBattleHudInteractionSession();
}

function ensureBattleHudOverlayRoot(): HTMLElement {
  if (battleHudOverlayRoot?.isConnected) {
    return battleHudOverlayRoot;
  }

  battleHudOverlayRoot = document.createElement("div");
  battleHudOverlayRoot.className = "battle-hud-overlay-root";
  document.body.appendChild(battleHudOverlayRoot);
  return battleHudOverlayRoot;
}

function cleanupBattleHudOverlayRoot(): void {
  if (battleHudOverlayRoot?.parentElement) {
    battleHudOverlayRoot.parentElement.removeChild(battleHudOverlayRoot);
  }
  battleHudOverlayRoot = null;
}

function teardownBattleHud(): void {
  clearPendingAutoBattleStep();
  cleanupBattleHudInteractionListeners();
  cleanupBattleHudWindowListener();
  cleanupBattleHudOverlayRoot();
  battleHudLayouts = null;
  battleHudNodeColors = null;
  battleHudZCounter = 40;
}

function createDefaultBattleHudLayouts(): Record<BattleHudNodeId, BattleHudNodeLayout> {
  const viewportWidth = window.innerWidth || 1440;
  const viewportHeight = window.innerHeight || 900;
  const consoleWidth = clamp(Math.round(viewportWidth * 0.28), 360, 520);
  const consoleHeight = clamp(Math.round(viewportHeight * 0.18), 148, 220);
  const intelWidth = clamp(Math.round(viewportWidth * 0.26), 320, 420);
  const intelHeight = clamp(Math.round(viewportHeight * 0.28), 220, 320);
  const unitWidth = clamp(Math.round(viewportWidth * 0.21), 292, 340);
  const weaponWidth = clamp(Math.round(viewportWidth * 0.19), 272, 320);
  const consumablesWidth = clamp(Math.round(viewportWidth * 0.22), 320, 420);
  const consumablesHeight = clamp(Math.round(viewportHeight * 0.3), 250, 360);
  const placementWidth = clamp(Math.round(viewportWidth * 0.24), 340, 420);
  const placementHeight = clamp(Math.round(viewportHeight * 0.52), 360, 620);
  const manageWidth = clamp(Math.round(viewportWidth * 0.34), 460, 640);
  const manageHeight = clamp(Math.round(viewportHeight * 0.44), 320, 560);
  const handWidth = clamp(viewportWidth - unitWidth - weaponWidth - 112, 520, 860);
  const handHeight = clamp(Math.round(viewportHeight * 0.4), 392, 440);
  const topY = Math.max(viewportHeight - handHeight - BATTLE_HUD_BOTTOM_SAFE, BATTLE_HUD_TOP_SAFE);
  const sideHeight = clamp(handHeight - 112, 236, 290);
  const handX = clamp(
    Math.round((viewportWidth - handWidth) / 2),
    BATTLE_HUD_MARGIN_X,
    Math.max(BATTLE_HUD_MARGIN_X, viewportWidth - handWidth - BATTLE_HUD_MARGIN_X),
  );
  const weaponX = clamp(
    viewportWidth - weaponWidth - BATTLE_HUD_MARGIN_X,
    BATTLE_HUD_MARGIN_X,
    Math.max(BATTLE_HUD_MARGIN_X, viewportWidth - weaponWidth - BATTLE_HUD_MARGIN_X),
  );
  const manageX = clamp(
    viewportWidth - manageWidth - BATTLE_HUD_MARGIN_X,
    BATTLE_HUD_MARGIN_X,
    Math.max(BATTLE_HUD_MARGIN_X, viewportWidth - manageWidth - BATTLE_HUD_MARGIN_X),
  );
  const manageY = clamp(
    BATTLE_HUD_TOP_SAFE + 28,
    BATTLE_HUD_TOP_SAFE,
    Math.max(BATTLE_HUD_TOP_SAFE, viewportHeight - manageHeight - BATTLE_HUD_BOTTOM_SAFE),
  );
  const intelX = clamp(
    viewportWidth - intelWidth - BATTLE_HUD_MARGIN_X,
    BATTLE_HUD_MARGIN_X,
    Math.max(BATTLE_HUD_MARGIN_X, viewportWidth - intelWidth - BATTLE_HUD_MARGIN_X),
  );
  const intelY = clamp(
    BATTLE_HUD_TOP_SAFE,
    BATTLE_HUD_TOP_SAFE,
    Math.max(BATTLE_HUD_TOP_SAFE, viewportHeight - intelHeight - BATTLE_HUD_BOTTOM_SAFE),
  );
  const placementX = clamp(
    viewportWidth - placementWidth - BATTLE_HUD_MARGIN_X,
    BATTLE_HUD_MARGIN_X,
    Math.max(BATTLE_HUD_MARGIN_X, viewportWidth - placementWidth - BATTLE_HUD_MARGIN_X),
  );
  const placementY = clamp(
    BATTLE_HUD_TOP_SAFE + 28,
    BATTLE_HUD_TOP_SAFE,
    Math.max(BATTLE_HUD_TOP_SAFE, viewportHeight - placementHeight - BATTLE_HUD_BOTTOM_SAFE),
  );
  const consumablesX = clamp(
    BATTLE_HUD_MARGIN_X,
    BATTLE_HUD_MARGIN_X,
    Math.max(BATTLE_HUD_MARGIN_X, viewportWidth - consumablesWidth - BATTLE_HUD_MARGIN_X),
  );
  const consumablesY = clamp(
    BATTLE_HUD_TOP_SAFE + consoleHeight + 18,
    BATTLE_HUD_TOP_SAFE,
    Math.max(BATTLE_HUD_TOP_SAFE, viewportHeight - consumablesHeight - BATTLE_HUD_BOTTOM_SAFE),
  );

  return {
    console: { x: BATTLE_HUD_MARGIN_X, y: BATTLE_HUD_TOP_SAFE, width: consoleWidth, height: consoleHeight, minimized: false, zIndex: 40 },
    intel: { x: intelX, y: intelY, width: intelWidth, height: intelHeight, minimized: false, zIndex: 41 },
    placement: { x: placementX, y: placementY, width: placementWidth, height: placementHeight, minimized: false, zIndex: 42 },
    unit: { x: BATTLE_HUD_MARGIN_X, y: topY, width: unitWidth, height: sideHeight, minimized: false, zIndex: 43 },
    weapon: { x: weaponX, y: topY, width: weaponWidth, height: sideHeight, minimized: false, zIndex: 44 },
    manage: { x: manageX, y: manageY, width: manageWidth, height: manageHeight, minimized: true, zIndex: 45 },
    consumables: { x: consumablesX, y: consumablesY, width: consumablesWidth, height: consumablesHeight, minimized: false, zIndex: 46 },
    hand: { x: handX, y: topY, width: handWidth, height: handHeight, minimized: false, zIndex: 47 },
  };
}

function normalizeBattleHudLayout(nodeId: BattleHudNodeId, layout: BattleHudNodeLayout, defaults: Record<BattleHudNodeId, BattleHudNodeLayout>): BattleHudNodeLayout {
  const viewportWidth = window.innerWidth || 1440;
  const viewportHeight = window.innerHeight || 900;
  const definition = BATTLE_HUD_NODE_DEFS[nodeId];
  const fallback = defaults[nodeId];
  const maxWidth = Math.max(viewportWidth - (BATTLE_HUD_MARGIN_X * 2), 160);
  const maxHeight = Math.max(viewportHeight - BATTLE_HUD_TOP_SAFE - BATTLE_HUD_BOTTOM_SAFE, 160);
  const minWidth = Math.min(definition.minWidth, maxWidth);
  const minHeight = Math.min(definition.minHeight, maxHeight);
  const width = clamp(Math.round(layout.width || fallback.width), minWidth, maxWidth);
  const height = clamp(Math.round(layout.height || fallback.height), minHeight, maxHeight);
  const x = clamp(Math.round(layout.x ?? fallback.x), BATTLE_HUD_MARGIN_X, Math.max(BATTLE_HUD_MARGIN_X, viewportWidth - width - BATTLE_HUD_MARGIN_X));
  const y = clamp(Math.round(layout.y ?? fallback.y), BATTLE_HUD_TOP_SAFE, Math.max(BATTLE_HUD_TOP_SAFE, viewportHeight - height - BATTLE_HUD_BOTTOM_SAFE));

  return {
    x,
    y,
    width,
    height,
    minimized: Boolean(layout.minimized),
    zIndex: layout.zIndex || fallback.zIndex,
  };
}

function ensureBattleHudLayouts(): Record<BattleHudNodeId, BattleHudNodeLayout> {
  const defaults = createDefaultBattleHudLayouts();
  if (!battleHudLayouts) {
    battleHudLayouts = {
      console: normalizeBattleHudLayout("console", defaults.console, defaults),
      intel: normalizeBattleHudLayout("intel", defaults.intel, defaults),
      placement: normalizeBattleHudLayout("placement", defaults.placement, defaults),
      unit: normalizeBattleHudLayout("unit", defaults.unit, defaults),
      weapon: normalizeBattleHudLayout("weapon", defaults.weapon, defaults),
      manage: normalizeBattleHudLayout("manage", defaults.manage, defaults),
      consumables: normalizeBattleHudLayout("consumables", defaults.consumables, defaults),
      hand: normalizeBattleHudLayout("hand", defaults.hand, defaults),
    };
    battleHudZCounter = Math.max(...Object.values(defaults).map((layout) => layout.zIndex));
    return battleHudLayouts;
  }

  battleHudLayouts = {
    console: normalizeBattleHudLayout("console", battleHudLayouts.console ?? defaults.console, defaults),
    intel: normalizeBattleHudLayout("intel", battleHudLayouts.intel ?? defaults.intel, defaults),
    placement: normalizeBattleHudLayout("placement", battleHudLayouts.placement ?? defaults.placement, defaults),
    unit: normalizeBattleHudLayout("unit", battleHudLayouts.unit ?? defaults.unit, defaults),
    weapon: normalizeBattleHudLayout("weapon", battleHudLayouts.weapon ?? defaults.weapon, defaults),
    manage: normalizeBattleHudLayout("manage", battleHudLayouts.manage ?? defaults.manage, defaults),
    consumables: normalizeBattleHudLayout("consumables", battleHudLayouts.consumables ?? defaults.consumables, defaults),
    hand: normalizeBattleHudLayout("hand", battleHudLayouts.hand ?? defaults.hand, defaults),
  };
  battleHudZCounter = Math.max(...Object.values(battleHudLayouts).map((layout) => layout.zIndex), battleHudZCounter);
  return battleHudLayouts;
}

function getDefaultBattleHudColorKey(nodeId: BattleHudNodeId): string {
  switch (nodeId) {
    case "console":
      return "steel";
    case "intel":
      return "amber";
    case "placement":
      return "steel";
    case "unit":
      return "violet";
    case "weapon":
      return "amber";
    case "manage":
      return "steel";
    case "consumables":
      return "verdant";
    case "hand":
      return "teal";
    default:
      return "violet";
  }
}

function ensureBattleHudNodeColors(): Record<BattleHudNodeId, string> {
  if (!battleHudNodeColors) {
    battleHudNodeColors = {
      console: getDefaultBattleHudColorKey("console"),
      intel: getDefaultBattleHudColorKey("intel"),
      placement: getDefaultBattleHudColorKey("placement"),
      unit: getDefaultBattleHudColorKey("unit"),
      weapon: getDefaultBattleHudColorKey("weapon"),
      manage: getDefaultBattleHudColorKey("manage"),
      consumables: getDefaultBattleHudColorKey("consumables"),
      hand: getDefaultBattleHudColorKey("hand"),
    };
  }

  BATTLE_HUD_NODE_ORDER.forEach((nodeId) => {
    const colorKey = battleHudNodeColors?.[nodeId];
    if (!colorKey || !BATTLE_HUD_COLOR_THEME_MAP.has(colorKey)) {
      battleHudNodeColors![nodeId] = getDefaultBattleHudColorKey(nodeId);
    }
  });

  return battleHudNodeColors;
}

function getBattleHudThemeStyle(nodeId: BattleHudNodeId): string {
  const colorKey = ensureBattleHudNodeColors()[nodeId];
  const theme = BATTLE_HUD_COLOR_THEME_MAP.get(colorKey) ?? BATTLE_HUD_COLOR_THEMES[0];
  return Object.entries(theme.vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function getBattleHandLayoutMode(layout = ensureBattleHudLayouts().hand): "fan" | "grid" {
  return layout.width >= BATTLE_HAND_GRID_MIN_WIDTH && layout.height >= BATTLE_HAND_GRID_MIN_HEIGHT
    ? "grid"
    : "fan";
}

function applyBattleHudNodeTheme(nodeId: BattleHudNodeId, node?: HTMLElement | null): void {
  const targetNode = node ?? document.querySelector<HTMLElement>(`.battle-node[data-battle-node-id="${nodeId}"]`);
  if (!targetNode) return;

  const colorKey = ensureBattleHudNodeColors()[nodeId];
  const theme = BATTLE_HUD_COLOR_THEME_MAP.get(colorKey) ?? BATTLE_HUD_COLOR_THEMES[0];
  targetNode.dataset.colorKey = colorKey;
  Object.entries(theme.vars).forEach(([key, value]) => {
    targetNode.style.setProperty(key, value);
  });
}

function syncBattleHandNodeLayoutMode(node?: HTMLElement | null): void {
  const handNode = node ?? document.querySelector<HTMLElement>(`.battle-node[data-battle-node-id="hand"]`);
  if (!handNode) return;

  const layoutMode = getBattleHandLayoutMode();
  const handContainer = handNode.querySelector<HTMLElement>("#battleHandContainer");
  const handRow = handNode.querySelector<HTMLElement>(".hand-cards-row-floating");

  handNode.dataset.handLayout = layoutMode;
  handNode.classList.toggle("battle-node--hand-grid", layoutMode === "grid");
  handContainer?.classList.toggle("battle-hand-node--grid", layoutMode === "grid");
  handContainer?.classList.toggle("battle-hand-node--fan", layoutMode === "fan");
  handRow?.classList.toggle("hand-cards-row-floating--grid", layoutMode === "grid");
  handRow?.classList.toggle("hand-cards-row-floating--fan", layoutMode === "fan");
}

function cycleBattleHudNodeColor(nodeId: BattleHudNodeId): void {
  const colors = ensureBattleHudNodeColors();
  const currentKey = colors[nodeId] ?? getDefaultBattleHudColorKey(nodeId);
  const currentIndex = BATTLE_HUD_COLOR_THEME_KEYS.indexOf(currentKey);
  const nextKey = BATTLE_HUD_COLOR_THEME_KEYS[(currentIndex + 1 + BATTLE_HUD_COLOR_THEME_KEYS.length) % BATTLE_HUD_COLOR_THEME_KEYS.length];
  colors[nodeId] = nextKey;
}

function applyBattleHudNodeFrame(nodeId: BattleHudNodeId): void {
  const layouts = ensureBattleHudLayouts();
  const node = document.querySelector<HTMLElement>(`.battle-node[data-battle-node-id="${nodeId}"]`);
  if (!node) return;
  const layout = layouts[nodeId];
  node.style.left = `${layout.x}px`;
  node.style.top = `${layout.y}px`;
  node.style.width = `${layout.width}px`;
  node.style.height = `${layout.height}px`;
  node.style.zIndex = `${layout.zIndex}`;
  if (nodeId === "unit") {
    const widthScale = layout.width / 292;
    const heightScale = layout.height / 236;
    const scale = clamp((widthScale * 0.45) + (heightScale * 0.55), 1, 1.42);
    node.style.setProperty("--battle-unit-scale", scale.toFixed(3));
  } else {
    node.style.removeProperty("--battle-unit-scale");
  }
  applyBattleHudNodeTheme(nodeId, node);
  if (nodeId === "hand") {
    syncBattleHandNodeLayoutMode(node);
  }
}

function bringBattleHudNodeToFront(nodeId: BattleHudNodeId): void {
  const layouts = ensureBattleHudLayouts();
  layouts[nodeId] = {
    ...layouts[nodeId],
    zIndex: ++battleHudZCounter,
  };
  applyBattleHudNodeFrame(nodeId);
}

function setBattleHudNodeMinimized(nodeId: BattleHudNodeId, minimized: boolean): void {
  const layouts = ensureBattleHudLayouts();
  layouts[nodeId] = {
    ...layouts[nodeId],
    minimized,
    zIndex: minimized ? layouts[nodeId].zIndex : ++battleHudZCounter,
  };
}

function rerenderBattleHudOnly(): void {
  if (!localBattleState) return;
  const activeUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : undefined;
  const isPlayerTurn = Boolean(activeUnit && isLocalBattleTurn(localBattleState, activeUnit));
  const isPlacementPhase = localBattleState.phase === "placement";
  syncBattleHudOverlay(localBattleState, activeUnit, isPlayerTurn, isPlacementPhase);
}

function handleBattleHudColorCycle(nodeId: BattleHudNodeId): void {
  cycleBattleHudNodeColor(nodeId);
  rerenderBattleHudOnly();
}

function handleBattleHudMinimize(nodeId: BattleHudNodeId): void {
  setBattleHudNodeMinimized(nodeId, true);
  renderBattleScreen();
}

function handleBattleHudRestore(nodeId: BattleHudNodeId): void {
  setBattleHudNodeMinimized(nodeId, false);
  renderBattleScreen();
}

function renderBattleHudNode(nodeId: BattleHudNodeId, bodyHtml: string, extraClasses = ""): string {
  const layout = ensureBattleHudLayouts()[nodeId];
  if (layout.minimized) {
    return "";
  }

  const definition = BATTLE_HUD_NODE_DEFS[nodeId];
  const nodeClass = `battle-node battle-node--${nodeId}${extraClasses ? ` ${extraClasses}` : ""}`;
  const colorKey = ensureBattleHudNodeColors()[nodeId];
  const themeStyle = getBattleHudThemeStyle(nodeId);
  return `
    <section
      class="${nodeClass}"
      data-battle-node-id="${nodeId}"
      data-color-key="${colorKey}"
      style="left:${layout.x}px; top:${layout.y}px; width:${layout.width}px; height:${layout.height}px; z-index:${layout.zIndex}; ${themeStyle}; ${uiPanelsMinimized ? "transform: translateY(100%); opacity: 0; pointer-events: none;" : ""}"
    >
      <header class="battle-node__header" data-battle-node-grip="${nodeId}">
        <div class="battle-node__header-copy">
          <div class="battle-node__kicker">${definition.kicker}</div>
          <div class="battle-node__title">${definition.title}</div>
        </div>
        <div class="battle-node__actions">
          <button class="battle-node__color" type="button" data-battle-node-color="${nodeId}" aria-label="Change color for ${definition.title}">
            <span class="battle-node__color-dot" aria-hidden="true"></span>
          </button>
          <button class="battle-node__minimize" type="button" data-battle-node-minimize="${nodeId}" aria-label="Minimize ${definition.title}">_</button>
        </div>
      </header>
      <div class="battle-node__body battle-node__body--${nodeId}">
        ${bodyHtml}
      </div>
      ${definition.resizable ? `<button class="battle-node__resize" type="button" data-battle-node-resize="${nodeId}" aria-label="Resize ${definition.title}"></button>` : ""}
    </section>
  `;
}

function renderBattleHudDock(visibleNodeIds: BattleHudNodeId[] = BATTLE_HUD_NODE_ORDER): string {
  const layouts = ensureBattleHudLayouts();
  const minimizedIds = visibleNodeIds.filter((nodeId) => layouts[nodeId].minimized);
  if (minimizedIds.length === 0) {
    return "";
  }

  return `
    <div class="battle-node-dock" style="${uiPanelsMinimized ? "transform: translateY(100%); opacity: 0; pointer-events: none;" : ""}">
      ${minimizedIds.map((nodeId) => `
        <button class="battle-node-dock__item" type="button" data-battle-node-restore="${nodeId}" aria-label="Restore ${BATTLE_HUD_NODE_DEFS[nodeId].title}">
          <span class="battle-node-dock__kicker">${BATTLE_HUD_NODE_DEFS[nodeId].restoreLabel}</span>
          <span class="battle-node-dock__label">${BATTLE_HUD_NODE_DEFS[nodeId].title}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function getVisibleBattleHudNodeIdsForController(
  battle: BattleState,
  isPlacementPhase: boolean,
): BattleHudNodeId[] {
  const visibleNodeIds: BattleHudNodeId[] = ["console", "manage"];
  if (battle.theaterBonuses?.detailedEnemyIntel) {
    visibleNodeIds.push("intel");
  }
  if (isPlacementPhase) {
    visibleNodeIds.push("placement");
  } else {
    visibleNodeIds.push("unit", "weapon", "consumables", "hand");
  }
  return visibleNodeIds;
}

function getDefaultBattleControllerCursor(
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  isPlacementPhase: boolean,
): { x: number; y: number } {
  if (battleControllerCursor
    && battleControllerCursor.x >= 0
    && battleControllerCursor.x < battle.gridWidth
    && battleControllerCursor.y >= 0
    && battleControllerCursor.y < battle.gridHeight) {
    return battleControllerCursor;
  }

  if (hoveredTile
    && hoveredTile.x >= 0
    && hoveredTile.x < battle.gridWidth
    && hoveredTile.y >= 0
    && hoveredTile.y < battle.gridHeight) {
    return hoveredTile;
  }

  if (isPlacementPhase && battle.placementState) {
    const placementTiles = getLocalPlacementTiles(battle);
    if (placementTiles.length > 0) {
      return placementTiles[Math.min(Math.floor(placementTiles.length / 2), placementTiles.length - 1)];
    }
    const placementColumn = getLocalPlacementColumn(battle);
    return {
      x: placementColumn,
      y: Math.min(battle.gridHeight - 1, Math.max(0, Math.floor(battle.gridHeight / 2))),
    };
  }

  if (activeUnit?.pos) {
    return { x: activeUnit.pos.x, y: activeUnit.pos.y };
  }

  return { x: 0, y: 0 };
}

function syncBattleControllerCursor(
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  isPlacementPhase: boolean,
): void {
  battleControllerCursor = getDefaultBattleControllerCursor(battle, activeUnit, isPlacementPhase);
  hoveredTile = battleControllerCursor ? { ...battleControllerCursor } : null;
}

function moveBattleControllerCursor(
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  direction: "up" | "down" | "left" | "right",
  isPlacementPhase: boolean,
): void {
  if (turnState.isFacingSelection && activeUnit?.pos) {
    const nextFacingTile =
      direction === "up"
        ? { x: activeUnit.pos.x, y: Math.max(0, activeUnit.pos.y - 1) }
        : direction === "down"
          ? { x: activeUnit.pos.x, y: Math.min(battle.gridHeight - 1, activeUnit.pos.y + 1) }
          : direction === "left"
            ? { x: Math.max(0, activeUnit.pos.x - 1), y: activeUnit.pos.y }
            : { x: Math.min(battle.gridWidth - 1, activeUnit.pos.x + 1), y: activeUnit.pos.y };
    handleBattleBoardActionPick(nextFacingTile, battle, activeUnit, Boolean(activeUnit && isLocalBattleTurn(battle, activeUnit)));
    return;
  }

  const currentCursor = getDefaultBattleControllerCursor(battle, activeUnit, isPlacementPhase);
  const nextCursor = { ...currentCursor };
  if (direction === "up") nextCursor.y = Math.max(0, nextCursor.y - 1);
  if (direction === "down") nextCursor.y = Math.min(battle.gridHeight - 1, nextCursor.y + 1);
  if (direction === "left") nextCursor.x = Math.max(0, nextCursor.x - 1);
  if (direction === "right") nextCursor.x = Math.min(battle.gridWidth - 1, nextCursor.x + 1);
  battleControllerCursor = nextCursor;
  hoveredTile = nextCursor;
  renderBattleScreen();
}

function clickBattleControllerCursorTile(): void {
  if (!battleControllerCursor || !localBattleState) {
    return;
  }

  const activeUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : undefined;
  if (localBattleState.phase === "placement") {
    const isClientNetworkPlacement = Boolean(
      (isSquadBattle(localBattleState) || isCoopOperationsBattle(localBattleState))
      && getGameState().session.authorityRole === "client",
    );
    handleBattleBoardPlacementPick(battleControllerCursor, localBattleState, isClientNetworkPlacement);
    return;
  }
  handleBattleBoardActionPick(
    battleControllerCursor,
    localBattleState,
    activeUnit,
    Boolean(activeUnit && isLocalBattleTurn(localBattleState, activeUnit)),
  );
}

function cycleBattleControllerSelectedCard(step: 1 | -1, activeUnit: BattleUnitState | undefined): boolean {
  if (!activeUnit || activeUnit.hand.length <= 0) {
    return false;
  }
  if (isBattleUnitAutoControlled(localBattleState, activeUnit)) {
    return false;
  }

  if (selectedCardIndex === null) {
    selectedCardIndex = step > 0 ? 0 : activeUnit.hand.length - 1;
  } else {
    selectedCardIndex = (selectedCardIndex + step + activeUnit.hand.length) % activeUnit.hand.length;
  }
  renderBattleScreen();
  return true;
}

function getBattlePrimaryResultButton(): HTMLElement | null {
  const resultButtonIds = [
    "claimRewardsBtn",
    "trainingContinueBtn",
    "echoContinueBtn",
    "echoResultsBtn",
    "retryRoomBtn",
    "defeatReturnBtn",
    "returnToBaseBtn",
    "rematchBtn",
    "changeSettingsBtn",
  ];

  for (const buttonId of resultButtonIds) {
    const button = document.getElementById(buttonId) as HTMLElement | null;
    if (button && !button.hasAttribute("disabled")) {
      return button;
    }
  }

  return null;
}

function cycleBattleControllerHudNode(
  step: 1 | -1,
  battle: BattleState,
  isPlacementPhase: boolean,
): void {
  const visibleNodeIds = getVisibleBattleHudNodeIdsForController(battle, isPlacementPhase);
  const minimizedNodeIds = Object.entries(ensureBattleHudLayouts())
    .filter(([nodeId, layout]) => layout.minimized && visibleNodeIds.includes(nodeId as BattleHudNodeId))
    .map(([nodeId]) => nodeId as BattleHudNodeId);
  const nodeOrder = [...visibleNodeIds, ...minimizedNodeIds];
  if (nodeOrder.length <= 0) {
    return;
  }

  const currentIndex = Math.max(0, nodeOrder.indexOf(battleControllerActiveNodeId));
  battleControllerActiveNodeId = nodeOrder[(currentIndex + step + nodeOrder.length) % nodeOrder.length];
  bringBattleHudNodeToFront(battleControllerActiveNodeId);
  renderBattleScreen();
}

function moveBattleControllerHudNode(
  nodeId: BattleHudNodeId,
  delta: { x?: number; y?: number; width?: number; height?: number },
): void {
  const layouts = ensureBattleHudLayouts();
  layouts[nodeId] = normalizeBattleHudLayout(nodeId, {
    ...layouts[nodeId],
    minimized: false,
    x: layouts[nodeId].x + (delta.x ?? 0),
    y: layouts[nodeId].y + (delta.y ?? 0),
    width: layouts[nodeId].width + (delta.width ?? 0),
    height: layouts[nodeId].height + (delta.height ?? 0),
    zIndex: ++battleHudZCounter,
  }, createDefaultBattleHudLayouts());
  applyBattleHudNodeFrame(nodeId);
}

function handleBattleControllerLayoutAction(
  action: string,
  battle: BattleState,
  isPlacementPhase: boolean,
): boolean {
  switch (action) {
    case "tabPrev":
    case "prevUnit":
      cycleBattleControllerHudNode(-1, battle, isPlacementPhase);
      return true;
    case "tabNext":
    case "nextUnit":
      cycleBattleControllerHudNode(1, battle, isPlacementPhase);
      return true;
    case "moveUp":
      moveBattleControllerHudNode(battleControllerActiveNodeId, { y: -28 });
      return true;
    case "moveDown":
      moveBattleControllerHudNode(battleControllerActiveNodeId, { y: 28 });
      return true;
    case "moveLeft":
      moveBattleControllerHudNode(battleControllerActiveNodeId, { x: -28 });
      return true;
    case "moveRight":
      moveBattleControllerHudNode(battleControllerActiveNodeId, { x: 28 });
      return true;
    case "zoomIn":
      moveBattleControllerHudNode(battleControllerActiveNodeId, { width: 28, height: 22 });
      return true;
    case "zoomOut":
      moveBattleControllerHudNode(battleControllerActiveNodeId, { width: -28, height: -22 });
      return true;
    case "windowPrimary": {
      const layout = ensureBattleHudLayouts()[battleControllerActiveNodeId];
      if (layout.minimized) {
        handleBattleHudRestore(battleControllerActiveNodeId);
      } else {
        handleBattleHudMinimize(battleControllerActiveNodeId);
      }
      return true;
    }
    case "windowSecondary":
      handleBattleHudColorCycle(battleControllerActiveNodeId);
      return true;
    default:
      return false;
  }
}

function handleBattleControllerCursorAction(
  action: string,
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  isPlacementPhase: boolean,
): boolean {
  if (battle.phase === "victory" || battle.phase === "defeat") {
    if (action === "confirm") {
      getBattlePrimaryResultButton()?.click();
      return true;
    }
    if (action === "cancel") {
      setControllerMode("focus");
      updateFocusableElements();
      return true;
    }
  }

  switch (action) {
    case "moveUp":
      moveBattleControllerCursor(battle, activeUnit, "up", isPlacementPhase);
      return true;
    case "moveDown":
      moveBattleControllerCursor(battle, activeUnit, "down", isPlacementPhase);
      return true;
    case "moveLeft":
      moveBattleControllerCursor(battle, activeUnit, "left", isPlacementPhase);
      return true;
    case "moveRight":
      moveBattleControllerCursor(battle, activeUnit, "right", isPlacementPhase);
      return true;
    case "confirm":
      clickBattleControllerCursorTile();
      return true;
    case "zoomIn":
      zoomIn();
      return true;
    case "zoomOut":
      zoomOut();
      return true;
    case "endTurn":
      if (!isPlacementPhase) {
        handleBattleHudEndTurn();
        return true;
      }
      return false;
    case "tabPrev":
    case "prevUnit":
      return cycleBattleControllerSelectedCard(-1, activeUnit);
    case "tabNext":
    case "nextUnit":
      return cycleBattleControllerSelectedCard(1, activeUnit);
    case "cancel":
      if (selectedCardIndex !== null) {
        selectedCardIndex = null;
        renderBattleScreen();
        return true;
      }
      setControllerMode("focus");
      updateFocusableElements();
      return true;
    default:
      return false;
  }
}

function renderBattleConsoleFeed(battle: BattleState): string {
  return `
    <div class="battle-console-node">
      <div class="battle-console-node__body scrollink-console-body" id="battleLog">
        ${battle.log.slice(-8).map((line) => `<div class="scrollink-console-line">${line}</div>`).join("")}
      </div>
      <div class="battle-console-node__cli" aria-hidden="true">
        <span class="battle-console-node__prompt">Q.U.A.C.&gt;</span>
        <span class="battle-console-node__input">enter command...</span>
        <span class="battle-console-node__caret">_</span>
      </div>
    </div>
  `;
}

function renderBattleEnemyIntelNode(battle: BattleState): string {
  const enemyUnits = Object.values(battle.units)
    .filter((unit) => unit.isEnemy)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (enemyUnits.length <= 0) {
    return `
      <div class="battle-intel-node battle-intel-node--empty">
        <div class="battle-intel-node__empty">No hostile telemetry is available.</div>
      </div>
    `;
  }

  return `
    <div class="battle-intel-node">
      <div class="battle-intel-node__intro">100 BW comms lock resolved. Enemy combat statistics remain visible until you minimize this node.</div>
      <div class="battle-intel-node__list">
        ${enemyUnits.map((unit) => `
          <article class="battle-intel-card ${unit.hp <= 0 ? "battle-intel-card--down" : ""}">
            <div class="battle-intel-card__top">
              <div>
                <div class="battle-intel-card__name">${unit.name}</div>
                <div class="battle-intel-card__class">${((unit as any).classId ?? "hostile").toString().toUpperCase()}</div>
              </div>
              <div class="battle-intel-card__status">${unit.hp > 0 ? "TRACKED" : "DOWN"}</div>
            </div>
            <div class="battle-intel-card__stats">
              <span>HP ${unit.hp}/${unit.maxHp}</span>
              <span>ATK ${unit.atk}</span>
              <span>DEF ${unit.def}</span>
              <span>AGI ${unit.agi}</span>
              <span>MOV ${getUnitMovementRange(unit)}</span>
              <span>STRAIN ${unit.strain}/${(unit as any).maxStrain ?? BASE_STRAIN_THRESHOLD}</span>
            </div>
            <div class="battle-intel-card__meta">
              <span>${formatBattlePosition(unit)}</span>
              <span>${formatBattleEquipmentName(getBattleUnitEquippedWeaponId(unit), ((getGameState() as any).equipmentById || getAllStarterEquipment()) as Record<string, any>)}</span>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderBattleConsumablesNode(battle: BattleState, isPlayerTurn: boolean | undefined): string {
  const entries = getOwnedConsumableEntries(getGameState().consumables);
  if (entries.length <= 0) {
    return `
      <div class="battle-consumables-node battle-consumables-node--empty">
        <div class="battle-consumables-node__intro">Consumables do not cost cards, movement, or end-turn input.</div>
        <div class="battle-consumables-empty">No consumables are currently stocked in the forward locker.</div>
      </div>
    `;
  }

  const interactionLocked = !isPlayerTurn || battle.phase !== "player_turn";
  const interactionText = interactionLocked
    ? "Consumables unlock during friendly turns."
    : "Use any stocked consumable during this friendly turn.";

  return `
    <div class="battle-consumables-node">
      <div class="battle-consumables-node__intro">${interactionText}</div>
      <div class="battle-consumables-list">
        ${entries.map((entry) => {
          const targets = getBattleConsumableTargetIds(battle, entry.id)
            .map((unitId) => battle.units[unitId])
            .filter((unit): unit is BattleUnitState => Boolean(unit))
            .sort((left, right) => {
              if (left.isEnemy !== right.isEnemy) {
                return left.isEnemy ? 1 : -1;
              }
              if (battle.activeUnitId === left.id) return -1;
              if (battle.activeUnitId === right.id) return 1;
              return left.name.localeCompare(right.name);
            });
          return `
            <article class="battle-consumable-card">
              <div class="battle-consumable-card__top">
                <div>
                  <div class="battle-consumable-card__name">${entry.definition.name}</div>
                  <div class="battle-consumable-card__desc">${entry.definition.description}</div>
                </div>
                <div class="battle-consumable-card__qty">x${entry.quantity}</div>
              </div>
              <div class="battle-consumable-card__targets">
                ${targets.length > 0
                  ? targets.map((unit) => {
                      const disabled = interactionLocked || unit.hp <= 0;
                      return `
                        <button
                          class="battle-consumable-target ${unit.isEnemy ? "battle-consumable-target--enemy" : ""}"
                          type="button"
                          data-battle-consumable-use="${entry.id}"
                          data-battle-consumable-target="${unit.id}"
                          ${disabled ? "disabled" : ""}
                        >
                          <span class="battle-consumable-target__name">${unit.name}</span>
                          <span class="battle-consumable-target__meta">${unit.isEnemy ? "HOSTILE" : `HP ${unit.hp}/${unit.maxHp}`}</span>
                        </button>
                      `;
                    }).join("")
                  : `<div class="battle-consumable-card__empty">No valid target is available right now.</div>`}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderBattleHud(
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  isPlayerTurn: boolean | undefined,
  isPlacementPhase: boolean,
): string {
  ensureBattleHudLayouts();
  const handClasses = activeUnit && activeUnit.strain > BASE_STRAIN_THRESHOLD ? "battle-node--strained" : "";
  const handLayoutMode = getBattleHandLayoutMode();
  const visibleNodeIds: BattleHudNodeId[] = ["console", "manage"];
  if (battle.theaterBonuses?.detailedEnemyIntel) {
    visibleNodeIds.push("intel");
  }
  if (isPlacementPhase) {
    visibleNodeIds.push("placement");
  }
  if (!isPlacementPhase) {
    visibleNodeIds.push("unit", "weapon", "consumables", "hand");
  }

  return `
    ${renderBattleHudNode("console", renderBattleConsoleFeed(battle))}
    ${battle.theaterBonuses?.detailedEnemyIntel ? renderBattleHudNode("intel", renderBattleEnemyIntelNode(battle)) : ""}
    ${isPlacementPhase ? renderBattleHudNode("placement", renderPlacementUI(battle)) : ""}
    ${!isPlacementPhase ? renderBattleHudNode("unit", renderUnitPanel(activeUnit)) : ""}
    ${!isPlacementPhase ? renderBattleHudNode("weapon", renderWeaponWindow(activeUnit)) : ""}
    ${renderBattleHudNode("manage", renderManageUnitsPanel(battle))}
    ${!isPlacementPhase ? renderBattleHudNode("consumables", renderBattleConsumablesNode(battle, isPlayerTurn)) : ""}
    ${!isPlacementPhase ? renderBattleHudNode(
      "hand",
      `<div class="battle-hand-node battle-hand-node--${handLayoutMode} ${activeUnit && activeUnit.strain > BASE_STRAIN_THRESHOLD ? "battle-hand-node--strained" : ""}" id="battleHandContainer">${renderHandPanel(activeUnit, isPlayerTurn, handLayoutMode)}</div>`,
      handClasses,
    ) : ""}
    ${renderBattleHudDock(visibleNodeIds)}
  `;
}

function syncBattleHudOverlay(
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  isPlayerTurn: boolean | undefined,
  isPlacementPhase: boolean,
): void {
  const overlayRoot = ensureBattleHudOverlayRoot();
  if (!activeBattleHudSession) {
    overlayRoot.innerHTML = renderBattleHud(battle, activeUnit, isPlayerTurn, isPlacementPhase);
  }
  attachBattleHudNodeInteractions(overlayRoot);
  syncBattleHandNodeLayoutMode(overlayRoot.querySelector<HTMLElement>(`.battle-node[data-battle-node-id="hand"]`));
}

function setupBattleHudResizeListener(): void {
  cleanupBattleHudWindowListener();
  battleHudResizeHandler = () => {
    const appRoot = document.getElementById("app");
    if (!appRoot?.querySelector(".battle-root")) {
      cleanupBattleHudWindowListener();
      return;
    }

    ensureBattleHudLayouts();
    renderBattleScreen();
  };
  window.addEventListener("resize", battleHudResizeHandler);
}

function attachBattleHudNodeInteractions(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-battle-node-minimize]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = button.dataset.battleNodeMinimize as BattleHudNodeId | undefined;
      if (!nodeId) return;
      handleBattleHudMinimize(nodeId);
    };
  });

  root.querySelectorAll<HTMLElement>("[data-battle-node-color]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = button.dataset.battleNodeColor as BattleHudNodeId | undefined;
      if (!nodeId) return;
      handleBattleHudColorCycle(nodeId);
    };
  });

  root.querySelectorAll<HTMLElement>("[data-battle-node-restore]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = button.dataset.battleNodeRestore as BattleHudNodeId | undefined;
      if (!nodeId) return;
      handleBattleHudRestore(nodeId);
    };
  });

  if (battleHudMouseDownHandler || battleHudMouseMoveHandler || battleHudMouseUpHandler) {
    return;
  }

  battleHudMouseDownHandler = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const node = target.closest<HTMLElement>(".battle-node[data-battle-node-id]");
    if (!node) return;
    const nodeId = node.dataset.battleNodeId as BattleHudNodeId | undefined;
    if (!nodeId) return;

    bringBattleHudNodeToFront(nodeId);

    if (target.closest("[data-battle-node-minimize], [data-battle-node-color]")) {
      return;
    }

    const resizeHandle = target.closest<HTMLElement>("[data-battle-node-resize]");
    const grip = target.closest<HTMLElement>("[data-battle-node-grip]");
    const mode: "drag" | "resize" | null = resizeHandle
      ? "resize"
      : grip
        ? "drag"
        : null;

    if (!mode) return;
    if (mode === "resize" && !BATTLE_HUD_NODE_DEFS[nodeId].resizable) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    battleHudPreviousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    activeBattleHudSession = {
      nodeId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startLayout: { ...ensureBattleHudLayouts()[nodeId] },
      active: false,
    };
    isBattleHudPointerInteraction = true;
  };

  battleHudMouseMoveHandler = (event: MouseEvent) => {
    if (!activeBattleHudSession) return;

    const { nodeId, mode, startX, startY, startLayout } = activeBattleHudSession;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!activeBattleHudSession.active && Math.hypot(dx, dy) < BATTLE_HUD_DRAG_THRESHOLD_PX) {
      return;
    }

    activeBattleHudSession.active = true;
    const layouts = ensureBattleHudLayouts();
    layouts[nodeId] = normalizeBattleHudLayout(nodeId, {
      ...layouts[nodeId],
      x: mode === "drag" ? startLayout.x + dx : startLayout.x,
      y: mode === "drag" ? startLayout.y + dy : startLayout.y,
      width: mode === "resize" ? startLayout.width + dx : startLayout.width,
      height: mode === "resize" ? startLayout.height + dy : startLayout.height,
    }, createDefaultBattleHudLayouts());
    applyBattleHudNodeFrame(nodeId);
  };

  battleHudMouseUpHandler = () => {
    if (!activeBattleHudSession) {
      return;
    }
    endBattleHudInteractionSession();
  };

  window.addEventListener("mousedown", battleHudMouseDownHandler, true);
  window.addEventListener("mousemove", battleHudMouseMoveHandler);
  window.addEventListener("mouseup", battleHudMouseUpHandler);
  window.addEventListener("blur", battleHudMouseUpHandler);
}

/**
 * Get elevation for a tile from battle state
 */
// function getTileElevation(battle: BattleState, x: number, y: number): number {
//   const tile = battle.tiles.find(t => t.pos.x === x && t.pos.y === y);
//   return tile?.elevation ?? 0;
// }

// Removed calculateOriginOffset - no longer needed for simple grid

/**
 * Completely rewritten movement animation system
 * Ensures smooth, consistent animations for all units
 */
function startMovementAnimation(
  unitId: string,
  path: Vec2[],
  battle: BattleState,
  onComplete: () => void
): void {
  if (battleSceneController) {
    if (!path || path.length < 2 || !battle.units[unitId]) {
      onComplete();
      return;
    }
    battleSceneController.animateUnitMove(
      unitId,
      path,
      Math.max(180, (path.length - 1) * 200),
      onComplete,
    );
    return;
  }

  // Validate inputs
  if (!path || path.length < 2) {
    if (DEBUG_MOVEMENT) console.log(`[MOVEMENT] No movement needed for ${unitId}`);
    onComplete();
    return;
  }

  if (!battle.units[unitId]) {
    console.error(`[MOVEMENT] Unit ${unitId} not found in battle state`);
    onComplete();
    return;
  }

  if (DEBUG_MOVEMENT) {
    console.log(`[MOVEMENT] Starting animation for unit ${unitId}`);
    console.log(`[MOVEMENT] Path:`, path.map(p => `(${p.x},${p.y})`).join(' -> '));
  }

  // Stop any existing animation
  stopMovementAnimation();

  // Get unit data
  const unit = battle.units[unitId];
  if (!unit) {
    console.error(`[MOVEMENT] Unit ${unitId} not found`);
    onComplete();
    return;
  }

  // Get or create persistent animation container
  const animContainer = getOrCreateAnimationContainer();
  if (!animContainer) {
    console.error(`[MOVEMENT] Failed to get animation container`);
    onComplete();
    return;
  }

  setOriginalBattleUnitHidden(unitId, true);

  const movingUnit = createAnimatedBattleUnitElement(unit, "battle-unit--moving");

  // Get unit portrait path
  const portraitPath = getBattleUnitPortraitPath(unit.id, unit.baseUnitId);
  const truncName = unit.name.length > 8 ? unit.name.slice(0, 8) + "…" : unit.name;

  // Build unit HTML
  movingUnit.innerHTML = `
    <div class="battle-unit-portrait-wrapper">
      <div class="battle-unit-portrait">
        <img src="${portraitPath}" alt="${unit.name}" class="battle-unit-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
      </div>
      <div class="battle-unit-info-overlay">
        <div class="battle-unit-name">${truncName}</div>
        <div class="battle-unit-hp">HP ${unit.hp}/${unit.maxHp}</div>
      </div>
    </div>
  `;

  // Set up moving unit styles
  movingUnit.style.position = 'absolute';
  movingUnit.style.pointerEvents = 'none';
  movingUnit.style.opacity = '1';
  movingUnit.style.visibility = 'visible';
  movingUnit.style.display = 'flex';
  movingUnit.style.width = 'auto';
  movingUnit.style.height = 'auto';
  movingUnit.style.transform = 'translate(-50%, -50%)';
  movingUnit.style.transition = 'none';
  movingUnit.style.willChange = 'left, top';
  movingUnit.style.zIndex = '2000';
  movingUnit.style.background = 'none';
  movingUnit.style.border = 'none';
  movingUnit.style.padding = '0';
  movingUnit.style.margin = '0';
  movingUnit.style.boxShadow = 'none';

  // Remove backgrounds from children
  const children = movingUnit.querySelectorAll('*');
  children.forEach((child: Element) => {
    const el = child as HTMLElement;
    if (el.classList.contains('battle-unit-portrait')) {
      el.style.background = 'rgba(0,0,0,0.4)'; // Keep dark background for portrait
    } else if (el.classList.contains('battle-unit-info-overlay')) {
      el.style.background = 'rgba(0,0,0,0.7)'; // Keep dark background for info
    } else {
      el.style.background = 'none';
    }
    el.style.border = 'none';
    el.style.boxShadow = 'none';
  });

  // Calculate initial position (start of path)
  const TILE_SIZE = 75;
  const GRID_PADDING = 12;
  const GAP = 4;
  const startPos = path[0];
  const startX = GRID_PADDING + startPos.x * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const startY = GRID_PADDING + startPos.y * (TILE_SIZE + GAP) + TILE_SIZE / 2;

  // Set initial position
  movingUnit.style.left = `${startX}px`;
  movingUnit.style.top = `${startY}px`;

  // Add to animation container (persistent, survives re-renders)
  animContainer.appendChild(movingUnit);

  // Create animation state
  activeMovementAnim = {
    unitId,
    path,
    currentStep: 0,
    progress: 0,
    msPerTile: 200, // 200ms per tile for smooth movement
    active: true,
    startTime: performance.now(),
    lastUpdateTime: performance.now(),
    movingElement: movingUnit,
    unitData: unit, // Store unit data
  };

  if (DEBUG_MOVEMENT) {
    console.log(`[MOVEMENT] Animation started for ${unitId}, element created and added to container`);
  }

  // Start animation loop immediately
  animationFrameId = requestAnimationFrame(() => animateMovement(battle, onComplete));
}

/**
 * Main animation loop - updates every frame
 */
function animateMovement(battle: BattleState, onComplete: () => void): void {
  if (!activeMovementAnim || !activeMovementAnim.active || !activeMovementAnim.movingElement) {
    animationFrameId = null;
    if (activeMovementAnim && !activeMovementAnim.active) {
      onComplete();
    }
    return;
  }

  const anim = activeMovementAnim;
  const now = performance.now();
  const deltaMs = Math.min(now - anim.lastUpdateTime, 100); // Clamp to prevent large jumps
  anim.lastUpdateTime = now;

  if (getBattleHitStopRemainingMs() > 0) {
    animationFrameId = requestAnimationFrame(() => animateMovement(battle, onComplete));
    return;
  }

  // Validate path
  if (!anim.path || anim.path.length < 2 || anim.currentStep < 0 || anim.currentStep >= anim.path.length - 1) {
    console.error(`[MOVEMENT] Invalid animation state`, anim);
    stopMovementAnimation();
    onComplete();
    return;
  }

  // Update progress
  const progressStep = deltaMs / anim.msPerTile;
  anim.progress += progressStep;

  // Move to next segment if current one is complete
  while (anim.progress >= 1.0 && anim.currentStep < anim.path.length - 1) {
    anim.progress -= 1.0;
    anim.currentStep++;

    if (DEBUG_MOVEMENT && anim.currentStep < anim.path.length) {
      const tile = anim.path[anim.currentStep];
      console.log(`[MOVEMENT] Entered tile (${tile.x}, ${tile.y})`);
    }
  }

  // Check if animation is complete
  if (anim.currentStep >= anim.path.length - 1) {
    // Animation complete
    const finalPos = anim.path[anim.path.length - 1];
    if (DEBUG_MOVEMENT) {
      console.log(`[MOVEMENT] Animation complete for ${anim.unitId}, final position: (${finalPos.x}, ${finalPos.y})`);
    }
    stopMovementAnimation();
    onComplete();
    return;
  }

  // Calculate current position
  const from = anim.path[anim.currentStep];
  const to = anim.path[anim.currentStep + 1];

  const TILE_SIZE = 75;
  const GRID_PADDING = 12;
  const GAP = 4;

  const fromX = GRID_PADDING + from.x * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const fromY = GRID_PADDING + from.y * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const toX = GRID_PADDING + to.x * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const toY = GRID_PADDING + to.y * (TILE_SIZE + GAP) + TILE_SIZE / 2;

  // Apply easing (ease-in-out)
  const easedProgress = anim.progress < 0.5
    ? 2 * anim.progress * anim.progress
    : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;
  const clampedProgress = Math.max(0, Math.min(1, easedProgress));

  // Interpolate position
  const currentX = fromX + (toX - fromX) * clampedProgress;
  const currentY = fromY + (toY - fromY) * clampedProgress;

  // Update DOM element position
  if (anim.movingElement) {
    anim.movingElement.style.left = `${currentX}px`;
    anim.movingElement.style.top = `${currentY}px`;
  }

  // Continue animation loop
  animationFrameId = requestAnimationFrame(() => animateMovement(battle, onComplete));
}

// renderMovingUnit function removed - animation is now handled directly in animateMovement

/**
 * Stop movement animation and clean up
 */
function stopMovementAnimation(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (activeMovementAnim) {
    const unitId = activeMovementAnim.unitId;

    if (DEBUG_MOVEMENT) {
      console.log(`[MOVEMENT] Stopping animation for ${unitId}`);
    }

    // Remove moving unit element using stored reference
    if (activeMovementAnim.movingElement) {
      try {
        activeMovementAnim.movingElement.remove();
      } catch (e) {
        console.warn(`[MOVEMENT] Error removing moving element:`, e);
      }
      activeMovementAnim.movingElement = null;
    }

    // Also try to find and remove from animation container
    const animContainer = getOrCreateAnimationContainer();
    if (animContainer) {
      const movingUnit = animContainer.querySelector(`[data-unit-id="${unitId}"][data-animating="true"]`) as HTMLElement;
      if (movingUnit) {
        try {
          movingUnit.remove();
        } catch (e) {
          console.warn(`[MOVEMENT] Error removing from container:`, e);
        }
      }
    }

    // Show original unit again (will be re-rendered in final position)
    setOriginalBattleUnitHidden(unitId, false);

    // Clear animation state
    activeMovementAnim.active = false;
    activeMovementAnim = null;
  }

  // Remove debug overlay
  const debugEl = document.getElementById('movement-debug');
  if (debugEl) {
    debugEl.remove();
  }
}

function stopAttackBumpAnimation(restoreOriginalUnits = true): void {
  if (attackAnimationFrameId !== null) {
    cancelAnimationFrame(attackAnimationFrameId);
    attackAnimationFrameId = null;
  }

  if (!activeAttackBumpAnim) {
    return;
  }

  const { attackerId, targetId, attackerElement, targetElement } = activeAttackBumpAnim;

  try {
    attackerElement?.remove();
  } catch (error) {
    console.warn("[BATTLE] Failed to remove attacker bump element", error);
  }

  try {
    targetElement?.remove();
  } catch (error) {
    console.warn("[BATTLE] Failed to remove target bump element", error);
  }

  if (restoreOriginalUnits) {
    setOriginalBattleUnitHidden(attackerId, false);
    setOriginalBattleUnitHidden(targetId, false);
  }

  activeAttackBumpAnim.active = false;
  activeAttackBumpAnim = null;
}

function animateAttackBump(onComplete: () => void): void {
  if (!activeAttackBumpAnim || !activeAttackBumpAnim.active) {
    attackAnimationFrameId = null;
    return;
  }

  const anim = activeAttackBumpAnim;
  const now = performance.now();
  const deltaMs = Math.min(now - anim.lastUpdateTime, 100);
  anim.lastUpdateTime = now;
  if (getBattleHitStopRemainingMs() > 0) {
    anim.startTime += deltaMs;
    attackAnimationFrameId = requestAnimationFrame(() => animateAttackBump(onComplete));
    return;
  }

  const elapsedMs = now - anim.startTime;
  const progress = Math.max(0, Math.min(1, elapsedMs / anim.durationMs));
  const impactProgress = Math.min(progress / 0.56, 1);
  const recoveryProgress = progress <= 0.56 ? 0 : Math.min((progress - 0.56) / 0.44, 1);
  const forwardWave = Math.sin(impactProgress * Math.PI * 0.5);
  const recoilWave = recoveryProgress > 0
    ? Math.sin(recoveryProgress * Math.PI) * 0.28
    : 0;

  if (!anim.impactTriggered && progress >= 0.5) {
    anim.impactTriggered = true;
    triggerScreenShake(1.3);
    anim.attackerElement?.classList.add("battle-unit--attack-bump-impact");
    anim.targetElement?.classList.add("battle-unit--attack-bump-impact");
  }

  const attackerOffset = ATTACK_BUMP_DISTANCE_PX * forwardWave - ATTACK_BUMP_DISTANCE_PX * 0.55 * recoilWave;
  const targetOffset = ATTACK_TARGET_REACT_DISTANCE_PX * forwardWave + ATTACK_TARGET_REACT_DISTANCE_PX * 0.4 * recoilWave;

  if (anim.attackerElement) {
    anim.attackerElement.style.left = `${anim.attackerBaseX + anim.dirX * attackerOffset}px`;
    anim.attackerElement.style.top = `${anim.attackerBaseY + anim.dirY * attackerOffset}px`;
  }

  if (anim.targetElement) {
    anim.targetElement.style.left = `${anim.targetBaseX - anim.dirX * targetOffset}px`;
    anim.targetElement.style.top = `${anim.targetBaseY - anim.dirY * targetOffset}px`;
  }

  if (progress >= 1) {
    stopAttackBumpAnimation(false);
    onComplete();
    return;
  }

  attackAnimationFrameId = requestAnimationFrame(() => animateAttackBump(onComplete));
}

function shouldUseAttackBumpAnimation(
  attacker: BattleUnitState | null | undefined,
  target: BattleUnitState | null | undefined,
  targetCard: Card | null | undefined
): boolean {
  if (!attacker || !target || !attacker.pos || !target.pos) {
    return false;
  }

  if (attacker.id === target.id || attacker.isEnemy === target.isEnemy) {
    return false;
  }

  if (targetCard && targetCard.target !== "enemy") {
    return false;
  }

  return getDistance(attacker.pos.x, attacker.pos.y, target.pos.x, target.pos.y) <= 1;
}

function startAttackBumpAnimation(
  battle: BattleState,
  attackerId: string,
  targetId: string,
  onComplete: () => void
): void {
  if (battleSceneController) {
    battleSceneController.animateAttackBump(attackerId, targetId, ATTACK_BUMP_DURATION_MS, onComplete);
    return;
  }

  const attacker = battle.units[attackerId];
  const target = battle.units[targetId];
  if (!attacker || !target || !attacker.pos || !target.pos) {
    onComplete();
    return;
  }

  const distance = getDistance(attacker.pos.x, attacker.pos.y, target.pos.x, target.pos.y);
  if (distance > 1) {
    onComplete();
    return;
  }

  const animContainer = getOrCreateAnimationContainer();
  if (!animContainer) {
    onComplete();
    return;
  }

  stopAttackBumpAnimation();

  setOriginalBattleUnitHidden(attackerId, true);
  setOriginalBattleUnitHidden(targetId, true);

  const attackerElement = createAnimatedBattleUnitElement(attacker, "battle-unit--attack-bump");
  const targetElement = createAnimatedBattleUnitElement(target, "battle-unit--attack-bump");

  const attackerCenter = getBattleTileCenterPx(attacker.pos);
  const targetCenter = getBattleTileCenterPx(target.pos);
  attackerElement.style.left = `${attackerCenter.x}px`;
  attackerElement.style.top = `${attackerCenter.y}px`;
  attackerElement.style.zIndex = "2100";
  targetElement.style.left = `${targetCenter.x}px`;
  targetElement.style.top = `${targetCenter.y}px`;
  targetElement.style.zIndex = "2090";

  animContainer.appendChild(attackerElement);
  animContainer.appendChild(targetElement);

  const deltaX = target.pos.x - attacker.pos.x;
  const deltaY = target.pos.y - attacker.pos.y;
  const length = Math.hypot(deltaX, deltaY) || 1;

  activeAttackBumpAnim = {
    attackerId,
    targetId,
    attackerElement,
    targetElement,
    attackerBaseX: attackerCenter.x,
    attackerBaseY: attackerCenter.y,
    targetBaseX: targetCenter.x,
    targetBaseY: targetCenter.y,
    dirX: deltaX / length,
    dirY: deltaY / length,
    durationMs: ATTACK_BUMP_DURATION_MS,
    startTime: performance.now(),
    lastUpdateTime: performance.now(),
    active: true,
    impactTriggered: false,
  };

  attackAnimationFrameId = requestAnimationFrame(() => animateAttackBump(onComplete));
}

function inferEnemyAttackAnimationTarget(previousState: BattleState, nextState: BattleState, attackerId: string): string | null {
  const attacker = previousState.units[attackerId];
  if (!attacker || !attacker.pos || attacker.hp <= 0) {
    return null;
  }

  let bestTargetId: string | null = null;
  let bestScore = 0;

  for (const [unitId, previousUnit] of Object.entries(previousState.units)) {
    if (unitId === attackerId || previousUnit.hp <= 0 || previousUnit.isEnemy === attacker.isEnemy || !previousUnit.pos) {
      continue;
    }

    const distance = getDistance(attacker.pos.x, attacker.pos.y, previousUnit.pos.x, previousUnit.pos.y);
    if (distance > 1) {
      continue;
    }

    const nextUnit = nextState.units[unitId];
    const nextHp = nextUnit?.hp ?? 0;
    const damageTaken = Math.max(0, previousUnit.hp - nextHp);
    const wasRemoved = !nextUnit || nextHp <= 0;
    const score = damageTaken + (wasRemoved ? 1000 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestTargetId = unitId;
    }
  }

  return bestTargetId;
}

function getUnitsArray(battle: BattleState): BattleUnitState[] {
  return Object.values(battle.units);
}

function getHiddenAnimatedUnitIds(): Set<string> {
  const hiddenIds = new Set<string>();

  if (activeMovementAnim && activeMovementAnim.active) {
    hiddenIds.add(activeMovementAnim.unitId);
  }

  if (activeAttackBumpAnim && activeAttackBumpAnim.active) {
    hiddenIds.add(activeAttackBumpAnim.attackerId);
    hiddenIds.add(activeAttackBumpAnim.targetId);
  }

  return hiddenIds;
}

function resolveCard(cardId: string | Card): Card {
  if (typeof cardId !== "string") return cardId as Card;
  return getCardById(cardId) ?? fallbackGetCardById(cardId);
}

function resolveHandCards(hand: (string | Card)[]): Card[] {
  return hand.map(resolveCard);
}

/**
 * Calculate effective range for a card, applying class abilities like Far Shot
 */
function getEffectiveCardRange(card: Card, unit: BattleUnitState): number {
  let range = card.range ?? 1;

  // Apply Far Shot ability: Rangers get +1 range on bow attack cards
  // Check both target (from BattleScreen Card type) and targetType (from core Card type) for compatibility
  // Also check card name/ID to catch basic attack and other attack cards
  const isAttackCard =
    card.target === "enemy" ||
    (card as any).targetType === "enemy" ||
    card.id === "core_basic_attack" ||
    card.name.toLowerCase().includes("attack") ||
    card.name.toLowerCase().includes("shot") ||
    card.name.toLowerCase().includes("strike");

  if (unit && unit.classId === "ranger" && isAttackCard) {
    const equipmentById = getAllStarterEquipment();
    const weapon = getEquippedWeapon(unit, equipmentById);
    if (weapon && weapon.weaponType === "bow") {
      range += 1;
    }
  }

  if (unit.weaponState) {
    const equipmentById = (getGameState() as any).equipmentById || getAllStarterEquipment();
    const weapon = getEquippedWeapon(unit, equipmentById);
    if (weapon && card.weaponRules) {
      const modifiers = getWeaponCardModifierSnapshot(unit.weaponState, weapon, card.weaponRules);
      if (modifiers.rangeOverride !== null) {
        range = modifiers.rangeOverride;
      } else {
        range += modifiers.rangeDelta;
      }
      range += modifiers.moveBeforeAttackTiles;
    }
  }

  return range;
}

function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function isStrainLockedCard(card: Card, activeUnit: BattleUnitState | undefined): boolean {
  return Boolean(activeUnit && card.type === "core" && isOverStrainThreshold(activeUnit));
}

function getBattleCardDisabledReason(card: Card, activeUnit: BattleUnitState | undefined): string | null {
  if (!activeUnit) {
    return null;
  }
  if (isStrainLockedCard(card, activeUnit)) {
    return "Strain lock";
  }

  const equipmentById = (getGameState() as any).equipmentById || getAllStarterEquipment();
  const weapon = getEquippedWeapon(activeUnit, equipmentById);
  if (!activeUnit.weaponState || !weapon || !card.weaponRules) {
    return null;
  }

  if (
    card.weaponRules.sourceWeaponId !== "__equipped_weapon__" &&
    card.weaponRules.sourceWeaponId !== weapon.id
  ) {
    return null;
  }

  return getWeaponCardBlockReason(activeUnit.weaponState, weapon, card.weaponRules ?? null);
}

function canCardTargetUnit(card: Card, activeUnit: BattleUnitState, targetUnit: BattleUnitState, distance: number): boolean {
  if (getBattleCardDisabledReason(card, activeUnit)) {
    return false;
  }
  const effectiveRange = getEffectiveCardRange(card, activeUnit);
  const requiresLineOfSight = effectiveRange > 1 && Boolean(activeUnit.pos && targetUnit.pos);
  const hasTargetLineOfSight = !requiresLineOfSight || !localBattleState || !activeUnit.pos || !targetUnit.pos
    ? true
    : hasLineOfSight(activeUnit.pos, targetUnit.pos, localBattleState);
  if (card.target === "enemy") {
    return isHostileBattleUnit(activeUnit, targetUnit) && distance <= effectiveRange && hasTargetLineOfSight;
  }
  if (card.target === "ally") {
    return isAlliedBattleUnit(activeUnit, targetUnit) && (distance <= effectiveRange || effectiveRange === 0) && hasTargetLineOfSight;
  }
  if (card.target === "self") {
    return targetUnit.id === activeUnit.id;
  }
  return false;
}

function getFacingFromDelta(
  dx: number,
  dy: number,
  currentFacing: "north" | "south" | "east" | "west" = "east",
): "north" | "south" | "east" | "west" {
  if (dx === 0 && dy === 0) {
    return currentFacing;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "east" : "west";
  }
  return dy > 0 ? "south" : "north";
}

function getFacingTowardPosition(
  from: Vec2 | null | undefined,
  to: Vec2 | null | undefined,
  currentFacing: "north" | "south" | "east" | "west" = "east",
): "north" | "south" | "east" | "west" {
  if (!from || !to) {
    return currentFacing;
  }
  return getFacingFromDelta(to.x - from.x, to.y - from.y, currentFacing);
}

function getHostileUnitsForBattleUnit(
  battle: BattleState,
  unit: BattleUnitState,
  fromPos: Vec2 | null = unit.pos,
): BattleUnitState[] {
  if (!fromPos) {
    return [];
  }
  return Object.values(battle.units).filter((candidate) =>
    candidate.hp > 0
    && Boolean(candidate.pos)
    && isHostileBattleUnit(unit, candidate),
  );
}

function getNearestHostileUnit(
  battle: BattleState,
  unit: BattleUnitState,
  fromPos: Vec2 | null = unit.pos,
): BattleUnitState | null {
  if (!fromPos) {
    return null;
  }

  let nearest: BattleUnitState | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const hostile of getHostileUnitsForBattleUnit(battle, unit, fromPos)) {
    if (!hostile.pos) {
      continue;
    }
    const distance = getDistance(fromPos.x, fromPos.y, hostile.pos.x, hostile.pos.y);
    if (distance < nearestDistance) {
      nearest = hostile;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function countAdjacentHostiles(
  battle: BattleState,
  unit: BattleUnitState,
  fromPos: Vec2 | null = unit.pos,
): number {
  if (!fromPos) {
    return 0;
  }
  return getHostileUnitsForBattleUnit(battle, unit, fromPos)
    .filter((hostile) => hostile.pos && getDistance(fromPos.x, fromPos.y, hostile.pos.x, hostile.pos.y) <= 1)
    .length;
}

function scoreAutoBattleCardOption(
  battle: BattleState,
  unit: BattleUnitState,
  simulatedUnit: BattleUnitState,
  card: Card,
  targetUnit: BattleUnitState,
  distance: number,
  mode: Exclude<BattleAutoMode, "manual">,
): number {
  const name = card.name.toLowerCase();
  const description = (card.description ?? "").toLowerCase();
  const damage = Math.max(0, Number(card.damage ?? 0));
  const healing = Math.max(0, Number(card.healing ?? 0));
  const defBuff = Math.max(0, Number(card.defBuff ?? 0));
  const atkBuff = Math.max(0, Number(card.atkBuff ?? 0));
  const missingHp = Math.max(0, (targetUnit.maxHp ?? 0) - (targetUnit.hp ?? 0));
  const missingSelfHp = Math.max(0, (unit.maxHp ?? 0) - (unit.hp ?? 0));
  const adjacentHostiles = countAdjacentHostiles(battle, simulatedUnit, simulatedUnit.pos);
  const isWaitCard = card.id === "core_wait" || name.includes("wait");
  const isEnemyCard = card.target === "enemy";
  const isHealingCard = healing > 0 || name.includes("aid") || name.includes("heal") || name.includes("restore");
  const isDefensiveCard =
    defBuff > 0
    || name.includes("guard")
    || name.includes("fortify")
    || name.includes("shield")
    || name.includes("camouflage")
    || name.includes("fade")
    || name.includes("hide")
    || description.includes("untargetable");
  const isDebuffCard =
    name.includes("mark")
    || name.includes("pin")
    || name.includes("stun")
    || name.includes("tracking")
    || name.includes("warning")
    || description.includes("immobilize")
    || description.includes("stun")
    || description.includes("reveal");
  const isMobilityCard =
    name.includes("move")
    || name.includes("speed")
    || name.includes("roll")
    || name.includes("burst")
    || description.includes("movement")
    || description.includes("move ");

  if (isWaitCard) {
    return -200;
  }

  let score = 0;
  if (isEnemyCard) {
    score += 82 + damage * 14;
    score += isDebuffCard ? (mode === "undaring" ? 18 : 10) : 0;
    score += targetUnit.hp <= Math.max(1, damage) ? 54 : 0;
    score += mode === "daring"
      ? Math.max(0, 6 - distance) * 7 + (distance <= 1 ? 18 : 0)
      : (distance > 1 ? 16 : -12) - adjacentHostiles * 4;
    if (!damage && isDebuffCard) {
      score += 12;
    }
    return score;
  }

  if (isHealingCard) {
    const healNeed = targetUnit.id === unit.id ? missingSelfHp : missingHp;
    score += healing * 12 + healNeed * 4;
    score += mode === "undaring" ? 28 : 10;
  }

  if (defBuff > 0) {
    score += defBuff * 11 + adjacentHostiles * 8;
    score += mode === "undaring" ? 20 : 6;
  }

  if (atkBuff > 0) {
    score += atkBuff * 9;
    score += mode === "daring" ? 16 : 6;
  }

  if (isDefensiveCard && defBuff <= 0) {
    score += mode === "undaring" ? 20 : 8;
  }

  if (isDebuffCard && !isEnemyCard) {
    score += mode === "undaring" ? 12 : 6;
  }

  if (isMobilityCard) {
    score += mode === "daring" ? 16 : 8;
  }

  if (card.target === "ally" && targetUnit.id !== unit.id) {
    score += mode === "undaring" ? 10 : 4;
  }

  if (score <= 0) {
    score += description.length > 0 ? 2 : 0;
  }

  return score;
}

function getAutoBattleCardOptionsForPosition(
  battle: BattleState,
  unit: BattleUnitState,
  mode: Exclude<BattleAutoMode, "manual">,
  position: Vec2 | null = unit.pos,
  enemyOnly = false,
): AutoBattleCardOption[] {
  if (!position) {
    return [];
  }

  const simulatedUnit: BattleUnitState = {
    ...unit,
    pos: { ...position },
  };
  const options: AutoBattleCardOption[] = [];
  const potentialTargets = Object.values(battle.units).filter((candidate) =>
    candidate.hp > 0
    && (candidate.pos || candidate.id === unit.id),
  );

  for (let cardIndex = 0; cardIndex < unit.hand.length; cardIndex += 1) {
    const card = resolveCard(unit.hand[cardIndex]);
    if (enemyOnly && card.target !== "enemy") {
      continue;
    }
    if (isStrainLockedCard(card, simulatedUnit)) {
      continue;
    }

    for (const targetUnit of potentialTargets) {
      const targetPos = targetUnit.id === unit.id ? position : targetUnit.pos;
      if (!targetPos) {
        continue;
      }
      const distance = targetUnit.id === unit.id
        ? 0
        : getDistance(position.x, position.y, targetPos.x, targetPos.y);
      if (!canCardTargetUnit(card, simulatedUnit, targetUnit, distance)) {
        continue;
      }

      const score = scoreAutoBattleCardOption(battle, unit, simulatedUnit, card, targetUnit, distance, mode);
      options.push({
        cardIndex,
        card,
        targetId: targetUnit.id,
        score,
        distance,
      });
    }
  }

  options.sort((left, right) => right.score - left.score);
  return options;
}

function chooseBestAutoBattleCardOption(
  battle: BattleState,
  unit: BattleUnitState,
  mode: Exclude<BattleAutoMode, "manual">,
  position: Vec2 | null = unit.pos,
  enemyOnly = false,
): AutoBattleCardOption | null {
  const options = getAutoBattleCardOptionsForPosition(battle, unit, mode, position, enemyOnly);
  if (options.length <= 0) {
    return null;
  }
  return options[0].score > 0 ? options[0] : null;
}

function chooseBestAutoBattleMoveOption(
  battle: BattleState,
  unit: BattleUnitState,
  mode: Exclude<BattleAutoMode, "manual">,
): AutoBattleMoveOption | null {
  if (!unit.pos || turnState.hasCommittedMove || turnState.movementRemaining <= 0) {
    return null;
  }

  const origin = turnState.originalPosition ?? unit.pos;
  const reachable = getReachableMovementTiles(battle, unit, origin);
  const currentNearest = getNearestHostileUnit(battle, unit, unit.pos);
  const currentNearestDistance = currentNearest?.pos
    ? getDistance(unit.pos.x, unit.pos.y, currentNearest.pos.x, currentNearest.pos.y)
    : Number.POSITIVE_INFINITY;
  let bestOption: AutoBattleMoveOption | null = null;

  reachable.forEach((key) => {
    const [xValue, yValue] = key.split(",");
    const destination = {
      x: Number.parseInt(xValue ?? "", 10),
      y: Number.parseInt(yValue ?? "", 10),
    };
    if (!Number.isInteger(destination.x) || !Number.isInteger(destination.y)) {
      return;
    }
    if (destination.x === unit.pos!.x && destination.y === unit.pos!.y) {
      return;
    }

    const path = getMovePath(battle, unit.pos!, destination, turnState.movementRemaining);
    if (path.length < 2) {
      return;
    }

    const stepCost = path.length - 1;
    const followupAttack = chooseBestAutoBattleCardOption(battle, unit, mode, destination, true);
    let score = Number.NEGATIVE_INFINITY;

    if (followupAttack) {
      score = 620 + followupAttack.score - stepCost * 4;
      if (mode === "daring") {
        score += Math.max(0, 5 - followupAttack.distance) * 8;
      } else if (followupAttack.distance > 1) {
        score += 18;
      }
    } else {
      const nearestAfterMove = getNearestHostileUnit(battle, unit, destination);
      if (!nearestAfterMove?.pos) {
        return;
      }
      const nearestDistance = getDistance(destination.x, destination.y, nearestAfterMove.pos.x, nearestAfterMove.pos.y);
      const improvement = Number.isFinite(currentNearestDistance) ? currentNearestDistance - nearestDistance : 0;
      const adjacentHostiles = countAdjacentHostiles(battle, unit, destination);
      score = mode === "daring"
        ? improvement * 36 - nearestDistance * 4 - stepCost * 3 + (nearestDistance <= 1 ? 24 : 0)
        : improvement * 20 - Math.abs(nearestDistance - 2) * 12 - stepCost * 2 - adjacentHostiles * 18;
    }

    if (!bestOption || score > bestOption.score) {
      bestOption = {
        destination,
        path,
        score,
      };
    }
  });

  const resolvedBestOption: AutoBattleMoveOption | null = bestOption;
  const resolvedBestScore = resolvedBestOption
    ? (resolvedBestOption as AutoBattleMoveOption).score
    : Number.NEGATIVE_INFINITY;
  if (resolvedBestScore > 0 && resolvedBestOption) {
    return resolvedBestOption;
  }
  return null;
}

// ============================================================================
// CUSTOM playCard that uses our card database
// ============================================================================

function playCardFromScreen(
  state: BattleState,
  unitId: string,
  cardIndex: number,
  targetId: string
): BattleState {
  const unit = state.units[unitId];
  const target = state.units[targetId];

  if (!unit || !target) {
    return { ...state, log: [...state.log, "SLK//ERROR :: Invalid unit or target."] };
  }

  const cardIdOrObj = unit.hand[cardIndex];
  if (!cardIdOrObj) {
    return { ...state, log: [...state.log, "SLK//ERROR :: No card at index " + cardIndex] };
  }

  const card = resolveCard(cardIdOrObj);
  if (isStrainLockedCard(card, unit)) {
    return { ...state, log: [...state.log, `SLK//STRAIN :: ${unit.name} is over the strain threshold. Core cards are locked.`] };
  }
  const coreCard = toCoreCard({
    ...card,
    effects: card.effects || [],
  } as any);

  const targetPos = target.pos ?? unit.pos;
  if (!targetPos) {
    return { ...state, log: [...state.log, "SLK//ERROR :: Target has no valid position."] };
  }

  const resolvedState = handleCardPlay(state, coreCard, unit, targetPos, target);
  if (!resolvedState) {
    return { ...state, log: [...state.log, `SLK//ERROR :: ${card.name} could not be resolved.`] };
  }

  return resolvedState;
}

function didCardResolve(previousState: BattleState, nextState: BattleState, unitId: string): boolean {
  const previousUnit = previousState.units[unitId];
  const nextUnit = nextState.units[unitId];
  if (!previousUnit || !nextUnit) {
    return false;
  }

  const didHandChange =
    nextUnit.hand.length !== previousUnit.hand.length ||
    nextUnit.hand.some((cardId, index) => cardId !== previousUnit.hand[index]);

  return didHandChange || nextUnit.strain !== previousUnit.strain || nextState.activeUnitId !== previousState.activeUnitId;
}

function normalizeBattleCardToken(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isMovementBoostCard(card: Card | null | undefined): boolean {
  if (!card) {
    return false;
  }

  const normalizedId = normalizeBattleCardToken(card.id);
  const normalizedName = normalizeBattleCardToken(card.name);
  if (normalizedId === "core_move_plus" || normalizedName === "move") {
    return true;
  }

  return card.target === "self"
    && (card.effects || []).some((effect: any) => effect.type === "move" && Number(effect.tiles ?? effect.amount ?? 0) > 0);
}

function updateTurnStateAfterCardPlay(
  previousState: BattleState,
  nextState: BattleState,
  unitId: string,
  playedCard?: Card | null,
): boolean {
  if (!didCardResolve(previousState, nextState, unitId)) {
    return false;
  }

  if (nextState.activeUnitId && nextState.activeUnitId !== unitId) {
    const nextUnit = nextState.units[nextState.activeUnitId] ?? null;
    resetTurnStateForUnit(nextUnit, nextState);
  } else {
    const nextUnit = nextState.units[unitId] ?? null;
    if (nextUnit && isMovementBoostCard(playedCard) && nextUnit.pos) {
      const origin = turnState.originalPosition ?? nextUnit.pos;
      const totalCost = getDistance(origin.x, origin.y, nextUnit.pos.x, nextUnit.pos.y);
      turnState.hasActed = true;
      turnState.movementOnlyAfterAttack = true;
      turnState.hasCommittedMove = false;
      turnState.hasMoved = totalCost > 0;
      turnState.movementRemaining = Math.max(0, getUnitMovementRange(nextUnit, nextState) - totalCost);
    } else {
      turnState.hasActed = true;
      turnState.movementOnlyAfterAttack = Boolean(nextState.units[unitId]?.weaponState?.allowMoveAfterAttack);
    }
  }

  return true;
}

function queueAutoBattleStepForBattleState(state: BattleState, delayMs = 40): void {
  const activeUnit = state.activeUnitId ? state.units[state.activeUnitId] : undefined;
  if (isBattleUnitAutoControlled(state, activeUnit)) {
    requestAutoBattleStep(delayMs);
    return;
  }
  clearPendingAutoBattleStep();
}

function executeLocalBattleCardPlay(
  unitId: string,
  cardIndex: number,
  targetUnitId: string,
  autoFollowupDelayMs = 40,
): void {
  const actingUnit = localBattleState?.units[unitId];
  if (!localBattleState || !actingUnit) {
    return;
  }

  animatePlayedCard(cardIndex, () => {
    if (!localBattleState) {
      return;
    }

    const freshActiveUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null;
    if (!freshActiveUnit || freshActiveUnit.id !== unitId) {
      renderBattleScreen();
      return;
    }

    const targetUnit = localBattleState.units[targetUnitId] ?? null;
    const facing = getFacingTowardPosition(freshActiveUnit.pos, targetUnit?.pos, freshActiveUnit.facing ?? "east");
    let stateWithFacing = localBattleState;
    if (facing !== freshActiveUnit.facing) {
      stateWithFacing = {
        ...localBattleState,
        units: {
          ...localBattleState.units,
          [freshActiveUnit.id]: {
            ...freshActiveUnit,
            facing,
          },
        },
      };
    }

    const playedCard = freshActiveUnit.hand[cardIndex] ? resolveCard(freshActiveUnit.hand[cardIndex]) : null;
    const shouldAnimateAttack = shouldUseAttackBumpAnimation(freshActiveUnit, targetUnit, playedCard);
    let nextState = playCardFromScreen(stateWithFacing, freshActiveUnit.id, cardIndex, targetUnitId);
    updateTurnStateAfterCardPlay(stateWithFacing, nextState, freshActiveUnit.id, playedCard);
    selectedCardIndex = null;
    nextState = evaluateBattleOutcome(nextState);

    const finalizeResolvedAction = () => {
      setBattleState(nextState);

      if (nextState.phase === "victory" || nextState.phase === "defeat") {
        clearPendingAutoBattleStep();
        renderBattleScreen();
        return;
      }

      if (shouldAutoResolveBattleState(nextState)) {
        clearPendingAutoBattleStep();
        renderBattleScreen();
        requestAnimationFrame(() => runEnemyTurnsAnimated(nextState));
        return;
      }

      renderBattleScreen();
      queueAutoBattleStepForBattleState(nextState, autoFollowupDelayMs);
    };

    if (shouldAnimateAttack) {
      startAttackBumpAnimation(stateWithFacing, freshActiveUnit.id, targetUnitId, finalizeResolvedAction);
      return;
    }

    finalizeResolvedAction();
  });
}

function executeLocalBattleMove(
  unitId: string,
  path: Vec2[],
  autoFollowupDelayMs = 40,
): void {
  if (!localBattleState || hasActiveBattleAnimation()) {
    return;
  }
  if (turnState.hasActed && !turnState.movementOnlyAfterAttack) {
    return;
  }

  const activeUnit = localBattleState.units[unitId];
  if (!activeUnit?.pos || path.length < 2) {
    return;
  }

  if (!turnState.hasMoved) {
    turnState.originalPosition = { x: activeUnit.pos.x, y: activeUnit.pos.y };
  }

  const originX = turnState.originalPosition?.x ?? activeUnit.pos.x;
  const originY = turnState.originalPosition?.y ?? activeUnit.pos.y;
  const maxMove = getUnitMovementRange(activeUnit);
  const finalPos = path[path.length - 1];
  const totalCost = getDistance(originX, originY, finalPos.x, finalPos.y);
  if (totalCost > maxMove) {
    return;
  }

  turnState.movementRemaining = Math.max(0, maxMove - totalCost);
  turnState.hasMoved = true;
  turnState.hasCommittedMove = true;

  const previousStep = path[path.length - 2];
  const newFacing = getFacingFromDelta(
    finalPos.x - previousStep.x,
    finalPos.y - previousStep.y,
    activeUnit.facing ?? "east",
  );
  const currentState = localBattleState;

  startMovementAnimation(unitId, path, currentState, () => {
    if (localBattleState && (localBattleState.phase === "victory" || localBattleState.phase === "defeat")) {
      clearPendingAutoBattleStep();
      renderBattleScreen();
      return;
    }

    const stateAtCompletion = localBattleState || currentState;
    if (stateAtCompletion.phase === "victory" || stateAtCompletion.phase === "defeat") {
      clearPendingAutoBattleStep();
      renderBattleScreen();
      return;
    }

    let nextState = moveUnit(stateAtCompletion, unitId, finalPos);
    nextState = evaluateBattleOutcome(nextState);
    if (nextState.phase === "victory" || nextState.phase === "defeat") {
      setBattleState(nextState);
      clearPendingAutoBattleStep();
      renderBattleScreen();
      return;
    }

    const movedUnit = nextState.units[unitId];
    if (!movedUnit || !movedUnit.pos || movedUnit.pos.x !== finalPos.x || movedUnit.pos.y !== finalPos.y) {
      const fixedUnits = { ...nextState.units };
      fixedUnits[unitId] = {
        ...fixedUnits[unitId],
        pos: { ...finalPos },
      };
      nextState = { ...nextState, units: fixedUnits };
    }

    nextState = {
      ...nextState,
      units: {
        ...nextState.units,
        [unitId]: {
          ...nextState.units[unitId],
          facing: newFacing,
        },
      },
    };

    setBattleState(nextState);
    window.setTimeout(() => {
      renderBattleScreen();
      queueAutoBattleStepForBattleState(nextState, autoFollowupDelayMs);
    }, 10);
  });
}

function handleAutoBattleEndTurn(): void {
  if (
    !localBattleState
    || localBattleState.phase === "victory"
    || localBattleState.phase === "defeat"
    || hasActiveBattleAnimation()
  ) {
    clearPendingAutoBattleStep();
    return;
  }

  const activeUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null;
  if (!activeUnit || !isLocalBattleTurn(localBattleState, activeUnit)) {
    clearPendingAutoBattleStep();
    return;
  }

  if (!activeUnit.pos) {
    clearPendingAutoBattleStep();
    finalizeBattleHudEndTurn(localBattleState);
    return;
  }

  const nearestHostile = getNearestHostileUnit(localBattleState, activeUnit, activeUnit.pos);
  const facing = getFacingTowardPosition(activeUnit.pos, nearestHostile?.pos, activeUnit.facing ?? "east");
  const stateToAdvance = facing === activeUnit.facing
    ? localBattleState
    : {
      ...localBattleState,
      units: {
        ...localBattleState.units,
        [activeUnit.id]: {
          ...activeUnit,
          facing,
        },
      },
    };

  turnState.isFacingSelection = false;
  selectedCardIndex = null;
  clearPendingAutoBattleStep();
  finalizeBattleHudEndTurn(stateToAdvance);
}

function setBattleUnitAutoMode(unitId: string, mode: BattleAutoMode): void {
  if (!localBattleState) {
    return;
  }

  const unit = localBattleState.units[unitId];
  if (!unit) {
    return;
  }

  const nextState: BattleState = {
    ...localBattleState,
    units: {
      ...localBattleState.units,
      [unitId]: {
        ...normalizeBattleUnitAutoState(unit),
        autoBattleMode: mode,
      },
    },
  };

  if (localBattleState.activeUnitId === unitId && mode !== "manual") {
    selectedCardIndex = null;
  }

  if (mode === "manual") {
    clearPendingAutoBattleStep();
  }

  setBattleState(nextState);
  renderBattleScreen();
  queueAutoBattleStepForBattleState(nextState, 250);
}

function runAutoBattleTurnStep(): void {
  if (
    !localBattleState
    || localBattleState.phase === "victory"
    || localBattleState.phase === "defeat"
  ) {
    clearPendingAutoBattleStep();
    return;
  }

  if (isAnimatingEnemyTurn || hasActiveBattleAnimation()) {
    queueAutoBattleStepForBattleState(localBattleState, 80);
    return;
  }

  const activeUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null;
  if (!activeUnit || !isBattleUnitAutoControlled(localBattleState, activeUnit)) {
    clearPendingAutoBattleStep();
    return;
  }

  const mode = getBattleUnitAutoMode(activeUnit);
  if (mode === "manual") {
    clearPendingAutoBattleStep();
    return;
  }

  selectedCardIndex = null;

  if (turnState.isFacingSelection || turnState.hasActed) {
    handleAutoBattleEndTurn();
    return;
  }

  const cardOption = chooseBestAutoBattleCardOption(localBattleState, activeUnit, mode);
  if (cardOption) {
    executeLocalBattleCardPlay(activeUnit.id, cardOption.cardIndex, cardOption.targetId, 40);
    return;
  }

  const moveOption = chooseBestAutoBattleMoveOption(localBattleState, activeUnit, mode);
  if (moveOption) {
    executeLocalBattleMove(activeUnit.id, moveOption.path, 40);
    return;
  }

  handleAutoBattleEndTurn();
}

function getCurrentBattleForNetworkCommand(): BattleState | null {
  const state = getGameState();
  const preferredBattleId =
    state.session.activeBattleId
    ?? state.currentBattle?.id
    ?? localBattleState?.id
    ?? null;
  const currentBattle =
    getMountedOrActiveBattleState(state)
    ?? getBattleStateById(state, preferredBattleId)
    ?? localBattleState
    ?? null;
  if (!currentBattle) {
    return null;
  }
  if (preferredBattleId && (state.currentBattle?.id !== preferredBattleId || state.session.activeBattleId !== preferredBattleId)) {
    updateGameState((currentState) => mountBattleContextById(currentState, preferredBattleId));
  } else if (!state.currentBattle || state.currentBattle.id !== currentBattle.id) {
    updateGameState((currentState) => mountBattleState(currentState, currentBattle));
  }
  localBattleState = currentBattle;
  restoreTurnStateFromBattle(currentBattle);
  return currentBattle;
}

function getCurrentSquadBattleForCommand(): BattleState | null {
  const currentBattle = getCurrentBattleForNetworkCommand();
  if (!currentBattle || !isSquadBattle(currentBattle)) {
    return null;
  }
  return currentBattle;
}

function shouldRenderBattleAfterCommand(battleId: string): boolean {
  return isBattleRootMounted() && localBattleState?.id === battleId;
}

function resolveBattleForCommandTarget(battleId: string | null | undefined): BattleState | null {
  const state = getGameState();
  return (battleId ? getBattleStateById(state, battleId) : null)
    ?? getMountedOrActiveBattleState(state)
    ?? localBattleState
    ?? null;
}

function runEnemyTurnsHeadless(state: BattleState): BattleState {
  if (state.phase === "victory" || state.phase === "defeat") {
    return state;
  }
  let currentState = state;
  let safety = 0;
  while (safety < 20 && shouldAutoResolveBattleState(currentState)) {
    currentState = performEnemyTurn(currentState);
    currentState = evaluateBattleOutcome(currentState);
    safety += 1;
    if (currentState.phase === "victory" || currentState.phase === "defeat") {
      break;
    }
  }
  const active = currentState.activeUnitId ? currentState.units[currentState.activeUnitId] ?? null : null;
  if (active && currentState.phase !== "victory" && currentState.phase !== "defeat") {
    resetTurnStateForUnit(active, currentState);
  }
  return currentState;
}

function applyCommandToTargetBattle(
  battleId: string | null | undefined,
  callback: (battle: BattleState, shouldRender: boolean) => void,
): void {
  const targetBattle = resolveBattleForCommandTarget(battleId);
  if (!targetBattle) {
    return;
  }
  const previousLocalBattleState = localBattleState;
  const previousTurnState = cloneTurnState();
  const isMountedTarget = localBattleState?.id === targetBattle.id;
  if (!isMountedTarget) {
    localBattleState = targetBattle;
    restoreTurnStateFromBattle(targetBattle);
  }
  try {
    callback(targetBattle, shouldRenderBattleAfterCommand(targetBattle.id));
  } finally {
    if (!isMountedTarget) {
      localBattleState = previousLocalBattleState;
      turnState = previousTurnState;
    }
  }
}

function commitRemoteBattleState(nextState: BattleState, shouldRender: boolean): void {
  setBattleState(nextState);
  if (shouldRender) {
    renderBattleScreen();
  }
}

function resolveCommandActiveUnit(battle: BattleState, sourceSlot: SessionPlayerSlot, unitId: string): BattleUnitState | null {
  if (!battle.activeUnitId || battle.activeUnitId !== unitId) {
    return null;
  }
  const activeUnit = battle.units[battle.activeUnitId] ?? null;
  if (!activeUnit) {
    return null;
  }
  return normalizeSessionPlayerSlot(activeUnit.controller ?? "P1") === sourceSlot ? activeUnit : null;
}

function applyRemoteBattleCommandToCurrentBattle(
  battle: BattleState,
  sourceSlot: SessionPlayerSlot,
  command: SquadBattleCommand,
  shouldRender = true,
): void {
  if (battle.phase === "placement") {
    if (command.type === "quick_place") {
      const nextState = quickPlaceUnits(battle, toLocalUnitOwnership(sourceSlot));
      commitRemoteBattleState(nextState, shouldRender);
      return;
    }

    if (
      command.type === "select_placement_unit"
      || command.type === "place_unit"
      || command.type === "remove_placed_unit"
    ) {
      const unit = battle.units[command.unitId] ?? null;
      if (!unit || normalizeSessionPlayerSlot(unit.controller ?? "P1") !== sourceSlot) {
        return;
      }

      if (command.type === "select_placement_unit") {
        const nextState = selectBattlePlacementUnit(battle, command.unitId);
        commitRemoteBattleState(nextState, shouldRender);
        return;
      }

      if (command.type === "remove_placed_unit") {
        const nextState = unplaceBattleUnit(battle, command.unitId);
        commitRemoteBattleState(nextState, shouldRender);
        return;
      }

      const nextState = placeUnit(battle, command.unitId, { x: command.x, y: command.y });
      commitRemoteBattleState(nextState, shouldRender);
      return;
    }

    return;
  }

  if (
    command.type === "quick_place"
    || command.type === "select_placement_unit"
    || command.type === "place_unit"
    || command.type === "remove_placed_unit"
  ) {
    return;
  }

  const activeUnit = resolveCommandActiveUnit(battle, sourceSlot, command.unitId);
  if (!activeUnit) {
    return;
  }

  if (command.type === "move_unit") {
    if (!activeUnit.pos || (turnState.hasActed && !turnState.movementOnlyAfterAttack) || turnState.hasCommittedMove || turnState.isFacingSelection) {
      return;
    }

    if (
      command.x < 0
      || command.x >= battle.gridWidth
      || command.y < 0
      || command.y >= battle.gridHeight
    ) {
      return;
    }

    if (!turnState.hasMoved) {
      turnState.originalPosition = { x: activeUnit.pos.x, y: activeUnit.pos.y };
    }

    const originX = turnState.originalPosition?.x ?? activeUnit.pos.x;
    const originY = turnState.originalPosition?.y ?? activeUnit.pos.y;
    const maxMove = getUnitMovementRange(activeUnit, battle);
    const path = getMovePath(
      battle,
      { x: activeUnit.pos.x, y: activeUnit.pos.y },
      { x: command.x, y: command.y },
      maxMove,
    );

    if (path.length < 2) {
      return;
    }

    const pathEnd = path[path.length - 1];
    if (pathEnd.x !== command.x || pathEnd.y !== command.y) {
      return;
    }

    const totalCost = getDistance(originX, originY, command.x, command.y);
    if (totalCost > maxMove) {
      return;
    }

    turnState.movementRemaining = Math.max(0, maxMove - totalCost);
    turnState.hasMoved = true;
    turnState.hasCommittedMove = true;

    const finalStep = path[path.length - 1];
    const previousStep = path[path.length - 2];
    let newFacing: "north" | "south" | "east" | "west" = activeUnit.facing ?? "east";
    const dx = finalStep.x - previousStep.x;
    const dy = finalStep.y - previousStep.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      newFacing = dx > 0 ? "east" : "west";
    } else {
      newFacing = dy > 0 ? "south" : "north";
    }

    let nextState = moveUnit(battle, activeUnit.id, { x: command.x, y: command.y });
    const movedUnit = nextState.units[activeUnit.id];
    if (movedUnit) {
      nextState = {
        ...nextState,
        units: {
          ...nextState.units,
          [activeUnit.id]: {
            ...movedUnit,
            facing: newFacing,
          },
        },
      };
    }
    nextState = evaluateBattleOutcome(nextState);
    commitRemoteBattleState(nextState, shouldRender);
    return;
  }

  if (command.type === "undo_move") {
    if (!turnState.hasCommittedMove || turnState.hasActed || !turnState.originalPosition) {
      return;
    }

    const originalPosition = { ...turnState.originalPosition };
    turnState.movementRemaining = getUnitMovementRange(activeUnit, battle);
    turnState.hasMoved = false;
    turnState.hasCommittedMove = false;
    turnState.originalPosition = null;

    const nextState = {
      ...battle,
      units: {
        ...battle.units,
        [activeUnit.id]: {
          ...activeUnit,
          pos: originalPosition,
        },
      },
      log: [...battle.log, `SLK//UNDO :: ${activeUnit.name} returns to original position.`],
    };

    commitRemoteBattleState(nextState, shouldRender);
    return;
  }

  if (command.type === "play_card") {
    if (turnState.hasActed) {
      return;
    }
    const targetUnit = battle.units[command.targetUnitId] ?? null;
    const cardIdOrObj = activeUnit.hand[command.cardIndex];
    if (!targetUnit || !cardIdOrObj || !activeUnit.pos || !targetUnit.pos) {
      return;
    }

    const card = resolveCard(cardIdOrObj);
    const distance = getDistance(activeUnit.pos.x, activeUnit.pos.y, targetUnit.pos.x, targetUnit.pos.y);
    if (!canCardTargetUnit(card, activeUnit, targetUnit, distance)) {
      return;
    }

    let facing = activeUnit.facing ?? "east";
    if (command.targetUnitId !== activeUnit.id) {
      const dx = targetUnit.pos.x - activeUnit.pos.x;
      const dy = targetUnit.pos.y - activeUnit.pos.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        facing = dx > 0 ? "east" : "west";
      } else {
        facing = dy > 0 ? "south" : "north";
      }
    }

    let stateWithFacing = battle;
    if (facing !== activeUnit.facing) {
      stateWithFacing = {
        ...battle,
        units: {
          ...battle.units,
          [activeUnit.id]: {
            ...activeUnit,
            facing,
          },
        },
      };
    }

    let nextState = playCardFromScreen(stateWithFacing, activeUnit.id, command.cardIndex, command.targetUnitId);
    updateTurnStateAfterCardPlay(stateWithFacing, nextState, activeUnit.id, card);
    selectedCardIndex = null;
    nextState = evaluateBattleOutcome(nextState);

    if (shouldAutoResolveBattleState(nextState)) {
      if (shouldRender) {
        setBattleState(nextState);
        requestAnimationFrame(() => runEnemyTurnsAnimated(nextState));
      } else {
        commitRemoteBattleState(runEnemyTurnsHeadless(nextState), false);
      }
      return;
    }

    commitRemoteBattleState(nextState, shouldRender);
    return;
  }

  if (command.type === "end_turn") {
    turnState.isFacingSelection = false;
    selectedCardIndex = null;

    let stateToAdvance = battle;
    if (command.facing) {
      stateToAdvance = {
        ...battle,
        units: {
          ...battle.units,
          [activeUnit.id]: {
            ...activeUnit,
            facing: command.facing,
          },
        },
      };
    }

    const nextState = advanceTurn(stateToAdvance);
    if (shouldAutoResolveBattleState(nextState)) {
      if (shouldRender) {
        runEnemyTurnsAnimated(nextState);
      } else {
        commitRemoteBattleState(runEnemyTurnsHeadless(nextState), false);
      }
      return;
    }

    commitRemoteBattleState(nextState, shouldRender);
  }
}

export function applyRemoteSquadBattleCommand(sourceSlot: SessionPlayerSlot, payload: string): void {
  const parsedPayload = parseSquadBattleCommandPayload(payload);
  if (!parsedPayload) {
    return;
  }
  applyCommandToTargetBattle(parsedPayload.battleId, (battle, shouldRender) => {
    if (!isSquadBattle(battle)) {
      return;
    }
    if (parsedPayload.matchId !== getSquadContext(battle)?.matchId || parsedPayload.battleId !== battle.id) {
      return;
    }
    applyRemoteBattleCommandToCurrentBattle(battle, sourceSlot, parsedPayload.command, shouldRender);
  });
}

export function applyRemoteCoopBattleCommand(sourceSlot: SessionPlayerSlot, payload: string): void {
  const parsedPayload = parseRuntimeBattleCommandPayload(payload);
  if (!parsedPayload) {
    return;
  }
  applyCommandToTargetBattle(parsedPayload.battleId, (battle, shouldRender) => {
    if (isSquadBattle(battle) || !isCoopOperationsBattle(battle) || battle.id !== parsedPayload.battleId) {
      return;
    }
    applyRemoteBattleCommandToCurrentBattle(battle, sourceSlot, parsedPayload.command, shouldRender);
  });
}

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderBattleScreen() {
  setMusicCue("battle");
  const app = document.getElementById("app");
  if (!app) return;
  document.body.setAttribute("data-screen", "battle");
  cleanupBattleControllerContext?.();
  cleanupBattleControllerContext = null;

  const state = getGameState();

  // CRITICAL: If animation is active, preserve the animation container
  // We'll restore it after rendering
  let preservedAnimationContainer: HTMLElement | null = null;
  let preservedGridContainer: HTMLElement | null = null;
  if (hasActiveBattleAnimation() && persistentAnimationContainer) {
    preservedAnimationContainer = persistentAnimationContainer;
    preservedGridContainer = preservedAnimationContainer.parentElement as HTMLElement;
    if (DEBUG_MOVEMENT) {
      console.log(`[RENDER] Preserving animation container during active battle animation`);
    }
  }

  // Initialize battle if needed
  if (!localBattleState) {
    selectedManageUnitId = null;
    resetBattlePan();

    const mountedBattle = getMountedOrActiveBattleState(state);
    if (mountedBattle) {
      if (!state.currentBattle || state.currentBattle.id !== mountedBattle.id) {
        updateGameState((currentState) => mountBattleState(currentState, mountedBattle));
      }
      localBattleState = mountedBattle;
      console.log(`[BATTLE] Using mounted battle with ${Object.values(mountedBattle.units).filter((u: any) => u.isEnemy).length} enemies`);
    } else {
      // Fallback to test battle (legacy/debug path)
      console.warn("[BATTLE] No currentBattle in state, falling back to test battle with 2 enemies");
      const newBattle = createTestBattleForCurrentParty(state);
      if (!newBattle) {
        clearControllerContext();
        teardownBattleHud();
        app.innerHTML = `<div class="battle-root"><div class="battle-card"><p>Error: No party members.</p><button id="backBtn">BACK</button></div></div>`;
        document.getElementById("backBtn")?.addEventListener("click", () => renderOperationMap());
        return;
      }
      localBattleState = newBattle;
    }
    // Initialize turn state for first unit
    restoreTurnStateFromBattle(localBattleState);

    // Initial trigger for enemy turn if starting unit is an enemy
    if (shouldAutoResolveBattleState(localBattleState)) {
      console.log("[BATTLE] Starting enemy turn sequence on initialization");
      requestAnimationFrame(() => runEnemyTurnsAnimated(localBattleState!));
    }
  }

  if (localBattleState) {
    syncBattleAudioState(localBattleState);
  }

  const battle = localBattleState as BattleState;
  syncBattleResultInputGate(battle);
  maybeShowBattleStatPing(battle);
  const activeUnit = battle.activeUnitId ? battle.units[battle.activeUnitId] : undefined;
  const isPlayerTurn = Boolean(activeUnit && isLocalBattleTurn(battle, activeUnit));
  const isPlacementPhase = battle.phase === "placement";
  const visibleBattleHudNodeIds = getVisibleBattleHudNodeIdsForController(battle, isPlacementPhase);
  if (!visibleBattleHudNodeIds.includes(battleControllerActiveNodeId)) {
    battleControllerActiveNodeId = visibleBattleHudNodeIds[0] ?? "console";
  }
  const phase = battle.phase;
  syncBattleControllerCursor(battle, activeUnit, isPlacementPhase);
  const battleControllerPanHint = `${getControllerActionLabel("moveUp")} / ${getControllerActionLabel("moveLeft")}`;
  const battleControllerZoomHint = `${getControllerActionLabel("zoomOut")} / ${getControllerActionLabel("zoomIn")}`;
  const echoContext = getEchoContext(battle);
  if (battleExitConfirmState && !echoContext) {
    battleExitConfirmState = null;
  }
  const squadObjective = getSquadObjective(battle);
  const roomLabelBase = isEndlessBattleMode
    ? `ENDLESS MODE — BATTLE ${endlessBattleCount}`
    : (state.operation?.currentRoomId ?? "ROOM_START");
  const roomLabel = echoContext
    ? `ECHO RUN // ENCOUNTER ${echoContext.encounterNumber}`
    : roomLabelBase;
  const exitButtonLabel = isEndlessBattleMode
    ? "EXIT ENDLESS"
    : echoContext
      ? "ABANDON ECHO"
      : "EXIT BATTLE";
  const showDebugAutoWinButton = !isPlacementPhase
    && battle.phase !== "victory"
    && battle.phase !== "defeat"
    && !isSquadBattle(battle)
    && !isCoopOperationsBattle(battle);
  const activeBattleViewIndex = getActiveBattleViewIndex(state);

  app.innerHTML = `
    <div class="battle-root battle-root--${phase}">
      <!-- Battle grid as full-screen background -->
      <div class="battle-grid-background">
        ${renderBattleGrid(battle, selectedCardIndex, activeUnit, isPlacementPhase)}
      </div>
      
      <!-- Header overlay at top -->
      <div class="battle-header-overlay">
        <div class="battle-header-left">
          <div class="battle-title">${isEndlessBattleMode ? '∞ ' : ''}${battle.defenseObjective ? '🛡️ DEFENSE' : squadObjective ? '◎ SKIRMISH OBJECTIVE' : 'ENGAGEMENT'} – ${roomLabel}</div>
          <div class="battle-subtitle">${isPlacementPhase ? "PLACEMENT PHASE" : `TURN ${battle.turnCount}`} • GRID ${battle.gridWidth}×${battle.gridHeight}</div>
          ${battle.defenseObjective ? renderDefenseObjectiveHeader(battle.defenseObjective) : ""}
          ${squadObjective ? renderSkirmishObjectiveHeader(battle) : ""}
          ${renderEchoChallengeHeader(echoContext)}
        </div>
        <div class="battle-header-right">
          ${!isPlacementPhase ? `
            <div class="battle-active-info">
              <div class="battle-active-label">ACTIVE UNIT</div>
              <div class="battle-active-value">${activeUnit?.name ?? "—"}</div>
            </div>
          ` : ""}
          <div class="battle-view-switcher" aria-label="Battle camera view switcher">
            <span class="battle-view-switcher-label">VIEW</span>
            <button class="battle-view-switcher-btn${activeBattleViewIndex === 0 ? " battle-view-switcher-btn--active" : ""}" type="button" data-battle-view-index="0">1</button>
            <span class="battle-view-switcher-separator">|</span>
            <button class="battle-view-switcher-btn${activeBattleViewIndex === 1 ? " battle-view-switcher-btn--active" : ""}" type="button" data-battle-view-index="1">2</button>
          </div>
          <div class="battle-pan-controls">
            <div class="battle-pan-hint">
              <span class="battle-pan-keys">WASD / ARROWS / ${battleControllerPanHint}</span> to pan • <span class="battle-pan-keys">${battleControllerZoomHint}</span> to zoom • <span class="battle-pan-keys">Q / E</span> orbit • <span class="battle-pan-keys">R / F</span> tilt
            </div>
            <button class="battle-pan-reset" id="resetBattlePanBtn">⟳ CENTER</button>
          </div>
          <button class="battle-toggle-btn ${uiPanelsMinimized ? 'battle-toggle-btn--active' : ''}" id="toggleUiBtn">
            ${uiPanelsMinimized ? '👁 SHOW UI' : '👁 HIDE UI'}
          </button>
          <div class="battle-header-actions">
            ${showDebugAutoWinButton ? `<button class="battle-debug-autowin-btn" id="debugAutoWinBtn">DEBUG AUTO-WIN</button>` : ""}
            <button class="battle-back-btn" id="exitBattleBtn">${exitButtonLabel}</button>
          </div>
        </div>
      </div>
      ${renderBattleResultOverlay(battle)}
      ${renderBattleExitConfirmModal(battle)}
    </div>
  `;

  if (phase === "placement") {
    showTutorialCalloutSequence([
      {
        id: "tutorial_battle_placement",
        title: "Deployment Phase",
        message: "Place your squad before the first live turn starts.",
        detail: "Use the highlighted placement tiles to set your opener, then confirm deployment to hand initiative over to the battle loop.",
        channel: "tutorial-battle-placement",
      },
    ]);
  }

  if (phase !== "victory" && phase !== "defeat") {
    showTutorialCalloutSequence([
      {
        id: "tutorial_battle_cards_strain",
        title: "Cards And Strain",
        message: "Cards define your unit actions, while strain is the pressure system that keeps turns from spiraling forever.",
        detail: "Play the hand you need, then watch each unit's strain meter. Pushing beyond the safe threshold is possible, but it carries risk.",
        channel: "tutorial-battle-cards",
      },
    ]);
  }

  // CRITICAL: Restore animation container if it was preserved
  if (preservedAnimationContainer && preservedGridContainer) {
    const newGridContainer = getBattleGridContainer();
    if (newGridContainer) {
      let existingContainer = newGridContainer.querySelector('.battle-animation-container') as HTMLElement;

      if (existingContainer) {
        // Move preserved children to existing container
        while (preservedAnimationContainer.firstChild) {
          existingContainer.appendChild(preservedAnimationContainer.firstChild);
        }
        persistentAnimationContainer = existingContainer;
        if (DEBUG_MOVEMENT) {
          console.log(`[RENDER] Merged animation container children into existing container`);
        }
      } else {
        // No existing container, append preserved one
        newGridContainer.appendChild(preservedAnimationContainer);
        persistentAnimationContainer = preservedAnimationContainer;
        if (DEBUG_MOVEMENT) {
          console.log(`[RENDER] Restored animation container after render`);
        }
      }
    } else {
      console.warn(`[RENDER] Could not find new grid container to restore animation container`);
    }
  } else {
    const gridContainer = getBattleGridContainer();
    if (gridContainer) {
      const animContainer = gridContainer.querySelector('.battle-animation-container') as HTMLElement;
      if (animContainer) {
        persistentAnimationContainer = animContainer;
      }
    }

    if (!hasActiveBattleAnimation()) {
      const animContainer = getOrCreateAnimationContainer();
      if (animContainer && animContainer.children.length === 0) {
        persistentAnimationContainer = animContainer;
      }
    }
  }

  ensureBattleFeedbackListener();
  syncBattleHudOverlay(battle, activeUnit, isPlayerTurn, isPlacementPhase);

  // Setup pan handlers and attach event listeners
  setupBattlePanHandlers();
  // Use requestAnimationFrame to ensure DOM is fully ready, especially for victory overlay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      attachBattleListeners();
      cleanupBattleControllerContext = registerControllerContext({
        id: "battle",
        defaultMode: battleExitConfirmState ? "focus" : "cursor",
        focusRoot: () => document.querySelector(".battle-root"),
        focusSelector: battleExitConfirmState ? "#battleExitConfirmModal button:not([disabled])" : undefined,
        defaultFocusSelector: battleExitConfirmState ? "#battleExitConfirmAcceptBtn" : "#exitBattleBtn",
        onCursorAction: battleExitConfirmState ? undefined : (action) => handleBattleControllerCursorAction(action, battle, activeUnit, isPlacementPhase),
        onLayoutAction: battleExitConfirmState ? undefined : (action) => handleBattleControllerLayoutAction(action, battle, isPlacementPhase),
        onFocusAction: (action) => {
          if (battleExitConfirmState && action === "cancel") {
            closeBattleExitConfirm();
            return true;
          }
          if (action === "cancel") {
            setControllerMode("cursor");
            updateFocusableElements();
            return true;
          }
          return false;
        },
        getDebugState: () => ({
          hovered: battleControllerCursor ? `${battleControllerCursor.x},${battleControllerCursor.y}` : "none",
          window: battleControllerActiveNodeId,
          x: battleControllerCursor?.x,
          y: battleControllerCursor?.y,
          focus: activeUnit?.name ?? battle.phase,
        }),
      });
      updateFocusableElements();

      syncPendingAutoBattleStep(activeUnit);

    });
  });
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

/**
 * Get icon for mount type (used in battle UI)
 */
function getMountIconForType(mountType: string): string {
  const icons: Record<string, string> = {
    horse: "&#127943;", // Horse racing emoji
    warhorse: "&#9876;", // Crossed swords (represents war)
    lizard: "&#129422;", // Lizard emoji
    mechanical: "&#9881;", // Gear emoji
    beast: "&#128058;", // Wolf emoji
    bird: "&#128038;", // Bird emoji
  };
  return icons[mountType] || "&#128052;"; // Default horse face
}

function maybeShowBattleStatPing(battle: BattleState): void {
  if (battle.phase !== "victory") {
    lastBattleStatPingKey = null;
    return;
  }

  if (isEchoBattle(battle)) {
    lastBattleStatPingKey = null;
    return;
  }

  const statReward = Math.max(0, battle.rewards?.squadXp ?? 0);
  if (statReward <= 0) return;

  const pingKey = `${battle.id}:${battle.phase}:${statReward}`;
  if (lastBattleStatPingKey === pingKey) return;

  lastBattleStatPingKey = pingKey;
  showSystemPing({
    type: "success",
    title: STAT_SHORT_LABEL,
    message: `+${statReward} ${STAT_SHORT_LABEL} secured`,
    detail: STAT_LONG_LABEL,
    durationMs: 2400,
    channel: "battle-stat-reward",
    replaceChannel: true,
  });
}

/**
 * Render segmented strain ring SVG around portrait
 */
function renderStrainMeter(currentStrain: number, maxStrain: number): string {
  const safeMax = Math.max(maxStrain, 1);
  const segmentCount = clamp(safeMax, 6, 12);
  const safeRemaining = Math.max(safeMax - currentStrain, 0);
  const isOver = currentStrain > safeMax;
  const filledSegments = Math.min(currentStrain, segmentCount);

  return `
    <div class="battle-strain-focus ${isOver ? "battle-strain-focus--over" : ""}">
      <div class="battle-strain-ring" role="img" aria-label="Strain ${currentStrain} out of ${safeMax}">
        ${Array.from({ length: segmentCount }).map((_, index) => {
          const angle = (360 / segmentCount) * index;
          const segmentClass = index < filledSegments
            ? (isOver ? "battle-strain-segment--over" : "battle-strain-segment--active")
            : "battle-strain-segment--idle";
          return `<span class="battle-strain-segment ${segmentClass}" style="transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-52px);"></span>`;
        }).join("")}
        <div class="battle-strain-core">
          <span class="battle-strain-core__label">STRAIN</span>
          <span class="battle-strain-core__value">${currentStrain}<small>/${safeMax}</small></span>
          <span class="battle-strain-core__status ${isOver ? "battle-strain-core__status--over" : ""}">
            ${isOver ? "OVERLOAD" : `${safeRemaining} SAFE`}
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderUnitPanel(activeUnit: BattleUnitState | undefined): string {
  try {
    if (!activeUnit || !canLocalControlBattleUnit(localBattleState, activeUnit)) {
      return `<div class="unit-panel-empty"><div class="unit-panel-empty-text">NO ACTIVE UNIT</div></div>`;
    }
    const hp = activeUnit.hp ?? 0;
    const maxHp = activeUnit.maxHp ?? 1;

    // Use maxStrain if available, otherwise fallback to BASE_STRAIN_THRESHOLD
    const maxStrain = (activeUnit as any).maxStrain ?? BASE_STRAIN_THRESHOLD;
    const currentStrain = activeUnit.strain ?? 0;
    const maxMove = getUnitMovementRange(activeUnit, localBattleState) || 1;
    const movePct = (turnState.movementRemaining / maxMove) * 100;
    const autoBattleMode = getBattleUnitAutoMode(activeUnit);
    // const portraitSize = 160; // Doubled size
    const _portraitPath = getBattleUnitPortraitPath(activeUnit.id, activeUnit.baseUnitId);

    // Show which player controls this unit
    // const controller = activeUnit.controller || "P1";
    // const state = getGameState();
    // const player = state.players[controller as PlayerId];
    // const controllerColor = player?.color || "#ff8a00";
    // const controllerLabel = controller === "P1" ? "PLAYER 1" : "PLAYER 2";

    // Check if unit is mounted and get mount info
    const isMounted = isUnitMounted(activeUnit);
    const mountDef = isMounted && activeUnit.mountId ? getMountDefinition(activeUnit.mountId) : null;
    const mountIcon = mountDef ? getMountIconForType(mountDef.mountType) : "";

    return `
      <div class="unit-panel-hero">
        <div class="unit-panel-header">
          <div class="unit-panel-portrait" style="width: 52px; height: 52px; flex-shrink: 0; position: relative; border: 1px solid var(--bronze-dark); border-radius: 3px; background: rgba(0,0,0,0.3);">
            <img src="${_portraitPath}" alt="${activeUnit.name}" class="unit-panel-portrait-img" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
            ${isMounted ? `<span class="unit-panel-mount-badge" title="${mountDef?.name || 'Mounted'}" style="font-size: 0.6rem;">${mountIcon}</span>` : ""}
          </div>
          <div class="unit-panel-header-text">
            <div class="unit-panel-label">ACTIVE UNIT</div>
            <div class="unit-panel-name">${activeUnit.name}</div>
            <div class="unit-panel-class" style="font-size: 0.55rem; color: var(--bronze); opacity: 0.6;">${(activeUnit as any).classId?.toUpperCase() || "UNIT"}</div>
            <div class="unit-panel-class" style="font-size: 0.55rem; color: var(--bronze); opacity: 0.82;">${getPlayerControllerLabel((activeUnit.controller ?? "P1") as PlayerId)}</div>
          </div>
        </div>
        ${renderStrainMeter(currentStrain, maxStrain)}
      </div>
      <div class="unit-panel-stats">
        <div class="unit-stat-row">
          <span class="unit-stat-label">HP</span>
          <div class="unit-stat-bar">
            <div class="unit-stat-bar-track">
              <div class="unit-stat-bar-fill unit-stat-bar-fill--hp" style="width:${(hp / maxHp) * 100}%;"></div>
            </div>
            <span class="unit-stat-value" style="color: var(--slk-green);">${hp}/${maxHp}</span>
          </div>
        </div>
        <div class="unit-stat-row">
          <span class="unit-stat-label">MOV</span>
          <div class="unit-stat-bar">
            <div class="unit-stat-bar-track">
              <div class="unit-stat-bar-fill unit-stat-bar-fill--move" style="width:${movePct}%"></div>
            </div>
            <span class="unit-stat-value" style="color: var(--slk-teal);">${turnState.movementRemaining}/${maxMove}</span>
          </div>
        </div>
        <div class="unit-stat-row unit-stat-row--inline" style="gap: 4px; margin-top: 4px; flex-wrap: wrap;">
          <div class="unit-stat-chip" style="font-size: 0.55rem; padding: 2px 6px; background: rgba(0,0,0,0.3); border: 1px solid var(--bronze-dark); border-radius: 2px; color: var(--slk-amber);">ATK ${activeUnit.atk}</div>
          <div class="unit-stat-chip" style="font-size: 0.55rem; padding: 2px 6px; background: rgba(0,0,0,0.3); border: 1px solid var(--bronze-dark); border-radius: 2px; color: var(--slk-sky);">DEF ${activeUnit.def}</div>
          <div class="unit-stat-chip" style="font-size: 0.55rem; padding: 2px 6px; background: rgba(0,0,0,0.3); border: 1px solid var(--bronze-dark); border-radius: 2px; color: var(--slk-violet);">AGI ${activeUnit.agi}</div>
        </div>
        ${activeUnit.statuses && activeUnit.statuses.length > 0 ? `
        <div class="unit-status-effects" style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
          ${activeUnit.statuses.map((s: any) => `
            <div class="unit-status-chip" title="${s.type.toUpperCase()} (${s.duration}T)" style="font-size: 0.5rem; padding: 1px 4px; background: var(--bg-surface-elevated); border: 1px solid var(--slk-neon-red); color: var(--slk-neon-red); border-radius: 2px;">
              ${s.type.toUpperCase()} ${s.duration}
            </div>
          `).join('')}
        </div>
        ` : ''}
        ${localBattleState && !isSquadBattle(localBattleState) ? `
        <div class="unit-panel-auto-control">
          <div class="unit-panel-auto-label">AUTO-BATTLE</div>
          <div class="unit-panel-auto-options" role="group" aria-label="Auto battle mode">
            ${(["manual", "undaring", "daring"] as BattleAutoMode[]).map((mode) => `
              <button
                type="button"
                class="unit-panel-auto-btn ${autoBattleMode === mode ? "is-active" : ""}"
                data-battle-auto-mode="${mode}"
                data-unit-id="${activeUnit.id}"
              >
                ${mode.toUpperCase()}
              </button>
            `).join("")}
          </div>
        </div>
        ` : ""}
      </div>
    `;
  } catch (err) {
    console.error(`[RENDER] Error in renderUnitPanel:`, err);
    return `<div class="unit-panel-error">ERROR: ${err}</div>`;
  }
}

function renderHandPanel(
  activeUnit: BattleUnitState | undefined,
  isPlayerTurn: boolean | undefined,
  layoutMode: "fan" | "grid" = getBattleHandLayoutMode(),
): string {
  try {
    const hand = resolveHandCards(activeUnit?.hand ?? []);
    const autoControlled = Boolean(activeUnit && isBattleUnitAutoControlled(localBattleState, activeUnit));
    const canUndoMove = Boolean(isPlayerTurn && !autoControlled && turnState.hasCommittedMove && !turnState.hasActed);
    const interactable = localBattleState && activeUnit ? getUnitInteractionObject(localBattleState, activeUnit) : null;
    return `
      <div class="hand-header-floating">
        <div class="hand-info">
          <span class="hand-label">HAND</span>
          <span class="hand-count">${hand.length} CARDS</span>
        </div>
        <div class="hand-meters">
          <div class="hand-counter">
            <span class="hand-counter-label">Deck:</span>
            <span class="hand-counter-value">${activeUnit?.drawPile?.length ?? 0}</span>
          </div>
          <div class="hand-counter">
            <span class="hand-counter-label">Discard:</span>
            <span class="hand-counter-value">${activeUnit?.discardPile?.length ?? 0}</span>
          </div>
        </div>
        <div class="hand-actions">
          <button class="battle-undo-btn" id="undoMoveBtn" ${canUndoMove ? "" : "disabled"}>UNDO MOVE</button>
          <button class="battle-endturn-btn" id="interactBtn" ${!isPlayerTurn || autoControlled || !interactable ? "disabled" : ""}>${interactable ? `INTERACT // ${interactable.type.replace(/_/g, " ").toUpperCase()}` : "INTERACT"}</button>
          <button class="battle-endturn-btn" id="endTurnBtn" ${!isPlayerTurn || autoControlled ? "disabled" : ""}>END TURN</button>
        </div>
      </div>
      <div class="hand-cards-row-floating hand-cards-row-floating--${layoutMode}">${renderHandCards(hand, isPlayerTurn, activeUnit)}</div>
    `;
  } catch (err) {
    console.error(`[RENDER] Error in renderHandPanel:`, err);
    return `<div class="hand-panel-error">ERROR: ${err}</div>`;
  }
}

function renderHandCards(hand: Card[], isPlayerTurn: boolean | undefined, activeUnit: BattleUnitState | undefined): string {
  if (hand.length === 0) return `<div class="hand-empty">No cards in hand</div>`;

  const total = hand.length;
  const maxAngle = Math.min(total * 4, 20);

  return hand.map((card, i) => {
    const sel = selectedCardIndex === i;
    const step = total > 1 ? maxAngle / (total - 1) : 0;
    const angle = total > 1 ? -maxAngle / 2 + step * i : 0;
    const yOff = Math.abs(angle) * 0.5;
    const disabledReason = getBattleCardDisabledReason(card, activeUnit);
    const strainLocked = disabledReason === "Strain lock";
    const autoControlled = Boolean(activeUnit && isBattleUnitAutoControlled(localBattleState, activeUnit));
    const disabledClass = !isPlayerTurn || Boolean(disabledReason) || autoControlled ? "battle-cardui--disabled" : "";
    const chaosClass = card.isChaosCard ? "battle-cardui--chaos" : "";

    // Card type icon
    const icon = card.isChaosCard ? "✦" : card.type === "core" ? "◆" : card.type === "class" ? "★" : card.type === "gambit" ? "⚡" : "⚔";

    // Card type label for badge
    const typeLabel = card.isChaosCard ? "CHAOS" : card.type === "core" ? "CORE" : card.type === "class" ? "CLASS" : card.type === "gambit" ? "GAMBIT" : "ATK";

    // Calculate effective range for display (includes Far Shot bonus)
    const effectiveRange = activeUnit ? getEffectiveCardRange(card, activeUnit) : card.range ?? 1;
    const equipmentById = (getGameState() as any).equipmentById || getAllStarterEquipment();
    const weapon = activeUnit ? getEquippedWeapon(activeUnit, equipmentById) : null;
    const weaponMeta: string[] = [];
    if (weapon && activeUnit?.weaponState && card.weaponRules) {
      if (
        card.weaponRules.sourceWeaponId === "__equipped_weapon__" ||
        card.weaponRules.sourceWeaponId === weapon.id
      ) {
        const modifiers = getWeaponCardModifierSnapshot(activeUnit.weaponState, weapon, card.weaponRules);
        if (card.weaponRules.ammoCost > 0) {
          weaponMeta.push(`AM ${card.weaponRules.ammoCost}`);
        }
        if (card.weaponRules.heatDelta > 0) {
          weaponMeta.push(`HEAT +${card.weaponRules.heatDelta}`);
        } else if (card.weaponRules.heatDelta < 0) {
          weaponMeta.push(`COOL ${Math.abs(card.weaponRules.heatDelta)}`);
        }
        if (activeUnit.weaponState.activeClutchIds.length > 0) {
          const clutchMap = new Map(getWeaponClutches(weapon).map((clutch) => [clutch.id, clutch.label]));
          const activeLabels = activeUnit.weaponState.activeClutchIds
            .map((clutchId) => clutchMap.get(clutchId))
            .filter((label): label is string => Boolean(label));
          if (activeLabels.length > 0) {
            weaponMeta.push(`CLUTCH ${activeLabels.join("/")}`);
          }
        }
        if (modifiers.damageDelta !== 0 || modifiers.accuracyDelta !== 0) {
          weaponMeta.push(
            `${modifiers.damageDelta !== 0 ? `DMG ${modifiers.damageDelta > 0 ? "+" : ""}${modifiers.damageDelta}` : ""}${modifiers.damageDelta !== 0 && modifiers.accuracyDelta !== 0 ? " // " : ""}${modifiers.accuracyDelta !== 0 ? `ACC ${modifiers.accuracyDelta > 0 ? "+" : ""}${modifiers.accuracyDelta}` : ""}`,
          );
        }
      }
    }

    return `
      <div class="battle-card-slot" style="--fan-rotate:${angle}deg;--fan-translateY:${yOff}px;z-index:${i + 1};" data-card-index="${i}">
        <div class="battle-cardui ${sel ? "battle-cardui--selected" : ""} ${disabledClass} ${chaosClass} ${strainLocked ? "battle-cardui--strain-locked" : ""}" data-card-index="${i}">
          <!-- Strain Cost Circle - Top Left -->
          <div class="hs-card-cost">${card.strainCost}</div>
          
          <!-- Card Type Badge - Top Right -->
          <div class="hs-card-type">${typeLabel}</div>
          
          <!-- Card Art Frame -->
          <div class="hs-card-art">
            <span class="hs-card-art-glyph">${icon}</span>
          </div>
          
          <!-- Card Name Banner -->
          <div class="hs-card-name-banner">
            <div class="hs-card-name">${card.name}</div>
          </div>
          ${disabledReason ? `<div class="hs-card-lock">${disabledReason.toUpperCase()}</div>` : ""}
          
          <!-- Card Description -->
          <div class="hs-card-desc">${card.description}</div>
          ${weaponMeta.length > 0 ? `<div class="hs-card-desc" style="font-size:0.56rem;color:rgba(187,255,247,0.8);">${weaponMeta.join(" // ")}</div>` : ""}
          
          <!-- Card Footer - Target/Range -->
          <div class="hs-card-footer">
            <span class="hs-card-stat">${card.target.toUpperCase()}</span>
            ${effectiveRange > 0 ? `<span class="hs-card-stat">R${effectiveRange}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderManageUnitsPanel(battle: BattleState): string {
  const partyUnits = getBattlePartyUnits(battle);
  const selectedUnit = getSelectedManageUnit(battle);
  const state = getGameState();
  const equipmentById = ((state as any).equipmentById || getAllStarterEquipment()) as Record<string, any>;

  if (!selectedUnit) {
    return `
      <div class="battle-manage-node battle-manage-node--empty">
        <div class="battle-manage-node__intro">View-only squad telemetry for the current battle.</div>
        <div class="battle-manage-empty">No allied units are available for this battle.</div>
      </div>
    `;
  }

  const maxStrain = (selectedUnit as any).maxStrain ?? BASE_STRAIN_THRESHOLD;
  const selectedWeapon = getEquippedWeapon(selectedUnit, equipmentById);
  const statuses = selectedUnit.statuses ?? [];

  return `
    <div class="battle-manage-node">
      <div class="battle-manage-node__intro">View-only mid-battle roster access. Loadouts are locked until the engagement ends.</div>
      <div class="battle-manage-body">
        <div class="battle-manage-list">
          ${partyUnits.map((unit) => {
            const portraitPath = getBattleUnitPortraitPath(unit.id, unit.baseUnitId);
            const rowStatuses = unit.statuses ?? [];
            const rowMaxStrain = (unit as any).maxStrain ?? BASE_STRAIN_THRESHOLD;
            const isSelected = unit.id === selectedUnit.id;
            const isActive = battle.activeUnitId === unit.id;
            return `
              <button
                class="battle-manage-unit-row ${isSelected ? "battle-manage-unit-row--selected" : ""}"
                data-battle-manage-unit-id="${unit.id}"
                type="button"
              >
                <div class="battle-manage-unit-portrait">
                  <img src="${portraitPath}" alt="${unit.name}" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
                </div>
                <div class="battle-manage-unit-summary">
                  <div class="battle-manage-unit-row-top">
                    <span class="battle-manage-unit-name">${unit.name}</span>
                    ${isActive ? `<span class="battle-manage-unit-badge">ACTIVE</span>` : ""}
                  </div>
                  <div class="battle-manage-unit-row-meta">
                    <span>HP ${unit.hp}/${unit.maxHp}</span>
                    <span>STRAIN ${unit.strain}/${rowMaxStrain}</span>
                    <span>POS ${formatBattlePosition(unit)}</span>
                  </div>
                  <div class="battle-manage-unit-row-meta battle-manage-unit-row-meta--minor">
                    <span>ATK ${unit.atk}</span>
                    <span>DEF ${unit.def}</span>
                    <span>AGI ${unit.agi}</span>
                    <span>MOV ${getUnitMovementRange(unit)}</span>
                  </div>
                  <div class="battle-manage-unit-statusline">
                    ${rowStatuses.length > 0
                      ? rowStatuses.map((status: any) => `<span class="battle-manage-status-chip">${status.type.toUpperCase()} ${status.duration}</span>`).join("")
                      : `<span class="battle-manage-status-chip battle-manage-status-chip--muted">NO STATUS EFFECTS</span>`}
                  </div>
                </div>
              </button>
            `;
          }).join("")}
        </div>
        <div class="battle-manage-detail">
          <div class="battle-manage-detail-hero">
            <div class="battle-manage-detail-portrait">
              <img
                src="${getBattleUnitPortraitPath(selectedUnit.id, selectedUnit.baseUnitId)}"
                alt="${selectedUnit.name}"
                onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';"
              />
            </div>
            <div class="battle-manage-detail-copy">
              <div class="battle-manage-detail-name">${selectedUnit.name}</div>
              <div class="battle-manage-detail-class">${((selectedUnit as any).classId ?? "unit").toString().toUpperCase()}</div>
              <div class="battle-manage-detail-note">
                ${battle.activeUnitId === selectedUnit.id ? "Currently taking the active turn." : `${getPlayerControllerLabel((selectedUnit.controller ?? "P1") as PlayerId)} controls this unit.`}
              </div>
            </div>
          </div>
          <div class="battle-manage-stat-grid">
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Hit Points</div>
              <div class="battle-manage-stat-value">${selectedUnit.hp} / ${selectedUnit.maxHp}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Strain</div>
              <div class="battle-manage-stat-value">${selectedUnit.strain} / ${maxStrain}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Movement</div>
              <div class="battle-manage-stat-value">${getUnitMovementRange(selectedUnit)}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Position</div>
              <div class="battle-manage-stat-value">${formatBattlePosition(selectedUnit)}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Attack / Defense</div>
              <div class="battle-manage-stat-value">${selectedUnit.atk} / ${selectedUnit.def}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Agility</div>
              <div class="battle-manage-stat-value">${selectedUnit.agi}</div>
            </div>
          </div>
          <div class="battle-manage-detail-section">
            <div class="battle-manage-detail-section-title">Battle Loadout</div>
            <div class="battle-manage-loadout-grid">
              <div class="battle-manage-loadout-row"><span>Weapon</span><span>${selectedWeapon?.name ?? formatBattleEquipmentName(selectedUnit.loadout?.weapon, equipmentById)}</span></div>
              <div class="battle-manage-loadout-row"><span>Helmet</span><span>${formatBattleEquipmentName(selectedUnit.loadout?.helmet, equipmentById)}</span></div>
              <div class="battle-manage-loadout-row"><span>Chestpiece</span><span>${formatBattleEquipmentName(selectedUnit.loadout?.chestpiece, equipmentById)}</span></div>
              <div class="battle-manage-loadout-row"><span>Accessory 1</span><span>${formatBattleEquipmentName(selectedUnit.loadout?.accessory1, equipmentById)}</span></div>
              <div class="battle-manage-loadout-row"><span>Accessory 2</span><span>${formatBattleEquipmentName(selectedUnit.loadout?.accessory2, equipmentById)}</span></div>
            </div>
          </div>
          <div class="battle-manage-detail-section">
            <div class="battle-manage-detail-section-title">Battle Readout</div>
            <div class="battle-manage-loadout-grid">
              <div class="battle-manage-loadout-row"><span>Hand</span><span>${selectedUnit.hand?.length ?? 0} cards</span></div>
              <div class="battle-manage-loadout-row"><span>Draw Pile</span><span>${selectedUnit.drawPile?.length ?? 0} cards</span></div>
              <div class="battle-manage-loadout-row"><span>Discard Pile</span><span>${selectedUnit.discardPile?.length ?? 0} cards</span></div>
              <div class="battle-manage-loadout-row"><span>Status Effects</span><span>${statuses.length > 0 ? statuses.map((status: any) => `${status.type.toUpperCase()} ${status.duration}`).join(", ") : "None"}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPlacementUI(battle: BattleState): string {
  const placementState = battle.placementState;
  if (!placementState) return "";

  const echoContext = getEchoContext(battle);
  const isEchoFieldMode = echoContext?.placementMode === "fields";
  const placementUnits = getLocalPlacementUnits(battle);
  const placedUnitIdSet = new Set(getEffectivePlacedUnitIds(battle));
  const placementCapacity = Math.min(placementState.maxUnitsPerSide, placementUnits.length);
  const unplacedUnits = placementUnits.filter(
    (unit) => !placedUnitIdSet.has(unit.id)
  );
  const placedCount = placementUnits.filter((unit) => placedUnitIdSet.has(unit.id)).length;
  const unplacedFields = getUnplacedEchoFields(battle);
  const isSkirmishBattle = isSquadBattle(battle);
  const isClientSkirmishView = isSkirmishBattle && getGameState().session.authorityRole === "client";
  const placementColumn = getLocalPlacementColumn(battle);
  const placementTiles = getLocalPlacementTiles(battle);
  const placementEdgeLabel = placementColumn === 0 ? "left" : "right";
  const placementCounts = getSkirmishPlacementCounts(battle);
  const canConfirm = isEchoFieldMode
    ? placedCount > 0 && unplacedFields.length === 0
    : isSkirmishBattle
      ? !isClientSkirmishView
        && placementCounts.friendly > 0
        && placementCounts.enemy > 0
      : placedCount > 0;
  const theaterBonuses = battle.theaterBonuses;
  const obscurationActive = Boolean(theaterBonuses?.obscurationActive ?? theaterBonuses?.smokeObscured);
  const obscurationSeverity = theaterBonuses?.obscurationSeverity
    ?? theaterBonuses?.smokeSeverity
    ?? 0;
  const obscurationLabel = (theaterBonuses?.obscurationLabel ?? "Smoke Obscuration").toUpperCase();
  const obscurationSuppressesRanged = Boolean(
    theaterBonuses?.obscurationSuppressesRanged
    ?? theaterBonuses?.smokeObscured,
  );
  const enemyIntelScrambled = Boolean(theaterBonuses?.enemyIntelScrambled);
  const enemyIntelScrambleLabel = (theaterBonuses?.enemyIntelScrambleLabel ?? "Telemetry Static").toUpperCase();
  const allyStartStatusType = theaterBonuses?.allyStartStatusType?.toUpperCase() ?? null;
  const allyStartStatusDuration = theaterBonuses?.allyStartStatusDuration ?? 0;
  const allyStartStatusLabel = (theaterBonuses?.allyStartStatusLabel ?? theaterBonuses?.regionMechanicLabel ?? "DEPLOYMENT").toUpperCase();
  const enemyStartStatusType = theaterBonuses?.enemyStartStatusType?.toUpperCase() ?? null;
  const enemyStartStatusDuration = theaterBonuses?.enemyStartStatusDuration ?? 0;
  const enemyStartStatusLabel = (theaterBonuses?.enemyStartStatusLabel ?? theaterBonuses?.regionMechanicLabel ?? "HOSTILES").toUpperCase();
  const theaterBonusBlock = theaterBonuses
    ? `
        <div class="placement-theater-briefing">
          <div class="placement-theater-briefing__title">SQUAD BRIEFING // ${(theaterBonuses.squadDisplayName ?? theaterBonuses.squadId.toUpperCase()).toUpperCase()}</div>
          ${theaterBonuses.regionName ? `<div class="placement-theater-briefing__row">
            <span>Region Active</span>
            <strong>${theaterBonuses.regionName.toUpperCase()} // ${(theaterBonuses.regionVariantLabel ?? "ACTIVE").toUpperCase()}</strong>
          </div>` : ""}
          ${theaterBonuses.factionTag ? `<div class="placement-theater-briefing__row">
            <span>Faction</span>
            <strong>${theaterBonuses.factionTag.toUpperCase()}</strong>
          </div>` : ""}
          <div class="placement-theater-briefing__row">
            <span>Hostiles</span>
            <strong>${theaterBonuses.enemyPreview.length > 0 ? theaterBonuses.enemyPreview.join(", ") : enemyIntelScrambled ? "Telemetry scrambled" : "Telemetry unavailable"}</strong>
          </div>
          ${theaterBonuses.regionRuleSummary ? `<div class="placement-theater-briefing__note placement-theater-briefing__note--region">${(theaterBonuses.regionMechanicLabel ?? "REGION RULE").toUpperCase()} // ${theaterBonuses.regionRuleSummary}</div>` : ""}
          ${theaterBonuses.detailedEnemyIntel ? `<div class="placement-theater-briefing__note">Enemy Intel window active for this assault.</div>` : ""}
          ${enemyIntelScrambled ? `<div class="placement-theater-briefing__note">${enemyIntelScrambleLabel} // HOSTILE TELEMETRY SCRAMBLED</div>` : ""}
          ${allyStartStatusType ? `<div class="placement-theater-briefing__note">${allyStartStatusLabel} // SQUAD STARTS ${allyStartStatusType} FOR ${allyStartStatusDuration} ROUND${allyStartStatusDuration === 1 ? "" : "S"}</div>` : ""}
          ${enemyStartStatusType ? `<div class="placement-theater-briefing__note">${enemyStartStatusLabel} // HOSTILES START ${enemyStartStatusType} FOR ${enemyStartStatusDuration} ROUND${enemyStartStatusDuration === 1 ? "" : "S"}</div>` : ""}
          ${theaterBonuses.overheating ? `<div class="placement-theater-briefing__note">ROOM OVERHEAT ACTIVE // STRAIN x2 // WEAPON HEAT ACCELERATED</div>` : ""}
          ${!theaterBonuses.overheating && theaterBonuses.combatInstability ? `<div class="placement-theater-briefing__note">COMBAT INSTABILITY ACTIVE // MECHANICAL WEAPONS HEAT FASTER</div>` : ""}
          ${obscurationActive ? `<div class="placement-theater-briefing__note">${obscurationLabel} ACTIVE // MOVE -${Math.max(1, obscurationSeverity)}${obscurationSuppressesRanged ? " // RANGED FIRE SUPPRESSED" : ""}</div>` : ""}
          ${theaterBonuses.burningRoom ? `<div class="placement-theater-briefing__note">ROOM FIRE ACTIVE // AMBIENT FIRE DAMAGE EACH TURN${(theaterBonuses.burnSeverity ?? 0) >= 2 ? " // IGNITION PRESSURE RISING" : ""}</div>` : ""}
          ${theaterBonuses.supplyFireRisk ? `<div class="placement-theater-briefing__note">VOLATILE SUPPLY LOAD // FIRE RISK ELEVATED</div>` : ""}
        </div>
      `
    : "";

  const echoFieldBlock = echoContext
    ? `
        <div class="battle-echo-placement-briefing">
          <div class="battle-echo-placement-briefing__title">ECHO MODE // ${echoContext.encounterType.toUpperCase()}</div>
          ${echoContext.activeChallenge ? `<div class="battle-echo-placement-briefing__copy">${echoContext.activeChallenge.description}</div>` : ""}
        </div>
      `
    : "";

  if (isEchoFieldMode && echoContext) {
    const placedFieldDraftIds = new Set(echoContext!.fieldPlacements.map((placement) => placement.draftId));
    return `
      <div class="battle-placement-panel battle-placement-panel--node">
        <div class="placement-header">
          <div class="placement-title">ECHO FIELD PLACEMENT</div>
          <div class="placement-subtitle">Place every drafted field on the grid before deployment.</div>
        </div>
        ${theaterBonusBlock}
        ${echoFieldBlock}
        <div class="placement-info">
          <div class="placement-stats">
            <span>Placed Units: ${placedCount}/${placementCapacity}</span>
            <span>Fields Remaining: ${unplacedFields.length}</span>
          </div>
          <div class="placement-units-list">
            <div class="placement-units-label">Drafted Echo Fields:</div>
            ${echoContext.availableFields.map((field) => {
              const isPlaced = placedFieldDraftIds.has(field.draftId);
              const isSelected = echoContext.selectedFieldDraftId === field.draftId;
              return `
                <div class="placement-field-item ${isPlaced ? "placement-field-item--placed" : ""} ${isSelected ? "placement-field-item--selected" : ""}" data-echo-field-draft-id="${field.draftId}">
                  <span>${field.name}</span>
                  <span class="placement-field-meta">LV ${field.level} • R${field.radius}</span>
                  ${isPlaced ? '<span class="placement-status">PLACED</span>' : '<span class="placement-status">READY</span>'}
                </div>
              `;
            }).join("")}
          </div>
        </div>
        <div class="placement-actions">
          <button class="battle-quick-place-btn" id="editUnitPlacementBtn">EDIT UNITS</button>
          <button class="battle-confirm-btn ${canConfirm ? "" : "battle-confirm-btn--disabled"}" id="confirmPlacementBtn" ${!canConfirm ? "disabled" : ""}>DEPLOY</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="battle-placement-panel battle-placement-panel--node">
      <div class="placement-header">
        <div class="placement-title">UNIT PLACEMENT</div>
        <div class="placement-subtitle">${
          placementTiles.length > 0
            ? `Deploy on the authored spawn tiles (${placementTiles.length} available).`
            : `Place your units on the ${placementEdgeLabel} edge (x=${placementColumn})`
        }</div>
      </div>
      ${theaterBonusBlock}
      ${echoFieldBlock}
      <div class="placement-info">
        <div class="placement-stats">
          <span>Placed: ${placedCount}/${placementCapacity}</span>
          <span>Unplaced: ${unplacedUnits.length}</span>
          ${isSkirmishBattle ? `<span>Host / Remote: ${placementCounts.friendly} / ${placementCounts.enemy}</span>` : ""}
        </div>
        <div class="placement-units-list">
          <div class="placement-units-label">${isSkirmishBattle ? "Assigned Units (click to select, then place on your edge):" : "Party Units (click to select, then place on grid):"}</div>
          ${placementUnits.map((u) => {
            const isPlaced = placedUnitIdSet.has(u.id);
            const isSelected = placementState.selectedUnitId === u.id;
            return `
              <div class="placement-unit-item ${isPlaced ? "placement-unit-item--placed" : ""} ${isSelected ? "placement-unit-item--selected" : ""}" 
                   data-unit-id="${u.id}" 
                   data-placed="${isPlaced}">
                <span>${u.name}</span>
                <span class="placement-field-meta">${(u.controller ?? "P1").toString().toUpperCase()}</span>
                ${isPlaced ? '<span class="placement-status">✓ PLACED</span>' : '<span class="placement-status">AVAILABLE</span>'}
                ${isSelected ? '<span class="placement-selected-indicator">→ SELECTED</span>' : ''}
              </div>
            `;
          }).join("")}
        </div>
      </div>
      <div class="placement-actions">
        <button class="battle-quick-place-btn" id="quickPlaceBtn">QUICK PLACE</button>
        <button class="battle-confirm-btn ${canConfirm ? "" : "battle-confirm-btn--disabled"}" id="confirmPlacementBtn" ${!canConfirm ? "disabled" : ""}>${isClientSkirmishView ? "HOST DEPLOYS" : "CONFIRM"}</button>
      </div>
    </div>
  `;
}

/*
  if (isEchoFieldMode && echoContext) {
    const placedFieldDraftIds = new Set(echoContext!.fieldPlacements.map((placement) => placement.draftId));

    return `
      <div class="battle-placement-overlay">
        <div class="battle-placement-panel">
          <div class="placement-header">
            <div class="placement-title">ECHO FIELD PLACEMENT</div>
            <div class="placement-subtitle">Place every drafted field on the grid before deployment.</div>
          </div>
          ${theaterBonusBlock}
          ${echoFieldBlock}
          <div class="placement-info">
            <div class="placement-stats">
              <span>Placed Units: ${placedCount}/${placementState!.maxUnitsPerSide}</span>
              <span>Fields Remaining: ${unplacedFields.length}</span>
            </div>
            <div class="placement-units-list">
              <div class="placement-units-label">Drafted Echo Fields:</div>
              ${echoContext!.availableFields.map((field) => {
                const isPlaced = placedFieldDraftIds.has(field.draftId);
                const isSelected = echoContext!.selectedFieldDraftId === field.draftId;
                return `
                  <div class="placement-field-item ${isPlaced ? 'placement-field-item--placed' : ''} ${isSelected ? 'placement-field-item--selected' : ''}" data-echo-field-draft-id="${field.draftId}">
                    <span>${field.name}</span>
                    <span class="placement-field-meta">LV ${field.level} • R${field.radius}</span>
                    ${isPlaced ? '<span class="placement-status">PLACED</span>' : '<span class="placement-status">READY</span>'}
                  </div>
                `;
              }).join("")}
            </div>
          </div>
          <div class="placement-actions">
            <button class="battle-quick-place-btn" id="editUnitPlacementBtn">EDIT UNITS</button>
            <button class="battle-confirm-btn ${canConfirm ? '' : 'battle-confirm-btn--disabled'}" id="confirmPlacementBtn" ${!canConfirm ? 'disabled' : ''}>DEPLOY</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="battle-placement-overlay">
      <div class="battle-placement-panel">
        <div class="placement-header">
          <div class="placement-title">UNIT PLACEMENT</div>
          <div class="placement-subtitle">Place units on the left edge (x=0)</div>
        </div>
        ${theaterBonusBlock}
        ${echoFieldBlock}
        <div class="placement-info">
          <div class="placement-stats">
            <span>Placed: ${placedCount}/${placementState!.maxUnitsPerSide}</span>
            <span>Unplaced: ${unplacedUnits.length}</span>
          </div>
          <div class="placement-units-list">
            <div class="placement-units-label">Party Units (click to select, then place on grid):</div>
            ${friendlyUnits.map(u => {
    const isPlaced = placementState!.placedUnitIds.includes(u.id);
    const isSelected = placementState!.selectedUnitId === u.id;
    return `
                <div class="placement-unit-item ${isPlaced ? 'placement-unit-item--placed' : ''} ${isSelected ? 'placement-unit-item--selected' : ''}" 
                     data-unit-id="${u.id}" 
                     data-placed="${isPlaced}">
                  <span>${u.name}</span>
                  <span class="placement-field-meta">${(u.controller ?? "P1").toString().toUpperCase()}</span>
                  ${isPlaced ? '<span class="placement-status">✓ PLACED</span>' : '<span class="placement-status">AVAILABLE</span>'}
                  ${isSelected ? '<span class="placement-selected-indicator">→ SELECTED</span>' : ''}
                </div>
              `;
  }).join("")}
          </div>
        </div>
        <div class="placement-actions">
          <button class="battle-quick-place-btn" id="quickPlaceBtn">QUICK PLACE</button>
          <button class="battle-confirm-btn ${canConfirm ? '' : 'battle-confirm-btn--disabled'}" id="confirmPlacementBtn" ${!canConfirm ? 'disabled' : ''}>CONFIRM</button>
        </div>
      </div>
    </div>
  `;
}

*/

interface BattleBoardRenderState {
  moveTiles: Set<string>;
  attackTiles: Set<string>;
  facingTiles: Set<string>;
  placementTiles: Set<string>;
  hiddenUnitIds: Set<string>;
  echoPlacements: EchoFieldPlacement[];
  echoPlacementMode: "units" | "fields" | null;
  selectedEchoFieldDraftId: string | null;
  focusTile: { x: number; y: number } | null;
}

let currentBattleBoardRenderState: BattleBoardRenderState | null = null;

function computeBattleBoardRenderState(
  battle: BattleState,
  selectedCardIdx: number | null,
  activeUnit: BattleUnitState | undefined,
  isPlacementPhase: boolean,
): BattleBoardRenderState {
  const units = getUnitsArray(battle);
  const echoContext = getEchoContext(battle);
  const moveOpts = new Set<string>();
  const atkOpts = new Set<string>();
  const facingTiles = new Set<string>();
  const placementTiles = new Set<string>();

  if (
    activeUnit
    && canLocalControlBattleUnit(battle, activeUnit)
    && activeUnit.pos
    && !isPlacementPhase
    && !turnState.isFacingSelection
    && !isBattleUnitAutoControlled(battle, activeUnit)
  ) {
    const ux = activeUnit.pos.x;
    const uy = activeUnit.pos.y;

    let selectedCard: Card | null = null;
    if (selectedCardIdx !== null && activeUnit.hand[selectedCardIdx]) {
      selectedCard = resolveCard(activeUnit.hand[selectedCardIdx]);
    }

    if (selectedCard) {
      if (selectedCard.target === "self") {
        atkOpts.add(`${ux},${uy}`);
      } else {
        units
          .filter((unit) => unit.hp > 0 && unit.pos)
          .forEach((unit) => {
            const dist = getDistance(ux, uy, unit.pos!.x, unit.pos!.y);
            if (canCardTargetUnit(selectedCard!, activeUnit, unit, dist)) {
              atkOpts.add(`${unit.pos!.x},${unit.pos!.y}`);
            }
          });
      }
    } else if (!turnState.hasCommittedMove && turnState.movementRemaining > 0) {
      const originX = turnState.originalPosition?.x ?? ux;
      const originY = turnState.originalPosition?.y ?? uy;
      const reachable = getReachableMovementTiles(battle, activeUnit, { x: originX, y: originY });
      reachable.forEach(key => moveOpts.add(key));
    }
  }

  if (turnState.isFacingSelection && activeUnit && activeUnit.pos) {
    const { x, y } = activeUnit.pos;
    if (x > 0) facingTiles.add(`${x - 1},${y}`);
    if (x < battle.gridWidth - 1) facingTiles.add(`${x + 1},${y}`);
    if (y > 0) facingTiles.add(`${x},${y - 1}`);
    if (y < battle.gridHeight - 1) facingTiles.add(`${x},${y + 1}`);
  }

  const hiddenUnitIds = getHiddenAnimatedUnitIds();
  const echoPlacements = echoContext?.fieldPlacements ?? [];
  const echoPlacementMode = echoContext?.placementMode ?? null;
  const selectedEchoFieldDraftId = echoContext?.selectedFieldDraftId ?? null;
  const isEchoFieldPlacementMode = isPlacementPhase && echoPlacementMode === "fields";
  const sessionState = getGameState().session;
  const isSquadPlacement = isPlacementPhase && battle.modeContext?.kind === "squad" && !isEchoFieldPlacementMode;
  const localSpawnZone = isSquadPlacement && sessionState.authorityRole === "client"
    ? battle.spawnZones?.enemySpawn ?? []
    : battle.spawnZones?.friendlySpawn ?? [];
  const fallbackPlacementColumn = isSquadPlacement && sessionState.authorityRole === "client"
    ? battle.gridWidth - 1
    : 0;

  if (isPlacementPhase && battle.placementState && !isEchoFieldPlacementMode) {
    const placementState = battle.placementState;
    const placedCount = placementState.placedUnitIds.reduce((count, unitId) => {
      const placedUnit = battle.units[unitId];
      if (!placedUnit || !placedUnit.pos) {
        return count;
      }
      const placedPos = placedUnit.pos;
      if (localSpawnZone.length > 0) {
        const inLocalSpawnZone = localSpawnZone.some(
          (point) => point.x === placedPos.x && point.y === placedPos.y,
        );
        return inLocalSpawnZone ? count + 1 : count;
      }
      const unitPlacementColumn = placedUnit.isEnemy ? battle.gridWidth - 1 : 0;
      return unitPlacementColumn === fallbackPlacementColumn ? count + 1 : count;
    }, 0);

    if (placedCount < placementState.maxUnitsPerSide) {
      if (localSpawnZone.length > 0) {
        localSpawnZone.forEach((point) => {
          const occupied = units.some((unit) => unit.pos && unit.pos.x === point.x && unit.pos.y === point.y);
          if (!occupied) {
            placementTiles.add(`${point.x},${point.y}`);
          }
        });
      } else {
        for (let y = 0; y < battle.gridHeight; y += 1) {
          const occupied = units.some((unit) => unit.pos && unit.pos.x === fallbackPlacementColumn && unit.pos.y === y);
          if (!occupied) {
            placementTiles.add(`${fallbackPlacementColumn},${y}`);
          }
        }
      }
    }
  }

  return {
    moveTiles: moveOpts,
    attackTiles: atkOpts,
    facingTiles,
    placementTiles,
    hiddenUnitIds,
    echoPlacements,
    echoPlacementMode,
    selectedEchoFieldDraftId,
    focusTile: activeUnit?.pos ? { ...activeUnit.pos } : hoveredTile ? { ...hoveredTile } : null,
  };
}

function renderBattleGrid(battle: BattleState, selectedCardIdx: number | null, activeUnit: BattleUnitState | undefined, isPlacementPhase: boolean = false): string {
  currentBattleBoardRenderState = computeBattleBoardRenderState(battle, selectedCardIdx, activeUnit, isPlacementPhase);

  return `
    <div class="battle-grid-pan-wrapper">
      <div class="battle-grid-zoom-viewport">
        <div class="battle-grid-container battle-grid-container--3d" id="battleGridContainer">
          <div class="battle-3d-host" id="battleBoard3dHost"></div>
          <div class="battle-grid-overlays battle-grid-overlays--3d" id="battleBoardOverlay"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render defense objective header display
 */
function renderDefenseObjectiveHeader(objective: NonNullable<BattleState["defenseObjective"]>): string {
  const isUrgent = objective.turnsRemaining <= 2;
  const urgentClass = isUrgent ? "defense-objective--urgent" : "";

  return `
    <div class="battle-defense-objective ${urgentClass}">
      <div class="defense-objective-icon">🛡️</div>
      <div class="defense-objective-text">
        <div class="defense-objective-label">SURVIVE</div>
        <div class="defense-objective-turns">${objective.turnsRemaining} TURNS</div>
      </div>
    </div>
  `;
}

function renderSkirmishObjectiveHeader(battle: BattleState): string {
  const objective = getSquadObjective(battle);
  if (!objective) {
    return "";
  }

  const statusLabel = getSquadObjectiveStatusLabel(battle);
  return `
    <div class="battle-defense-objective battle-defense-objective--skirmish">
      <div class="defense-objective-icon">◎</div>
      <div class="defense-objective-text">
        <div class="defense-objective-label">${escapeBattleText(objective.label.toUpperCase())}</div>
        <div class="defense-objective-turns">HOST ${objective.score.friendly}/${objective.targetScore} • OPP ${objective.score.enemy}/${objective.targetScore}</div>
        <div class="battle-skirmish-objective-status">${escapeBattleText(statusLabel)}</div>
      </div>
    </div>
  `;
}

function renderEchoChallengeHeader(echoContext: EchoBattleContext | null): string {
  if (!echoContext?.activeChallenge) {
    return "";
  }

  return `
    <div class="battle-echo-challenge">
      <div class="battle-echo-challenge__label">ECHO CHALLENGE</div>
      <div class="battle-echo-challenge__title">${echoContext.activeChallenge.title}</div>
      <div class="battle-echo-challenge__copy">${echoContext.activeChallenge.description}</div>
    </div>
  `;
}

function renderBattleExitConfirmModal(battle: BattleState): string {
  if (battleExitConfirmState !== "abandon-echo" || !isEchoBattle(battle)) {
    return "";
  }

  return `
    <div class="game-confirm-modal-backdrop" id="battleExitConfirmModal">
      <div class="game-confirm-modal game-confirm-modal--danger" role="dialog" aria-modal="true" aria-labelledby="battleExitConfirmTitle">
        <div class="game-confirm-modal__header">
          <div class="game-confirm-modal__kicker">ECHO RUN // CONFIRM ABANDONMENT</div>
          <h2 class="game-confirm-modal__title" id="battleExitConfirmTitle">ABANDON ECHO RUN</h2>
        </div>
        <div class="game-confirm-modal__copy">Abandon this Echo Run battle and move to the Echo results screen?</div>
        <div class="game-confirm-modal__actions">
          <button
            class="game-confirm-modal__btn game-confirm-modal__btn--primary"
            type="button"
            id="battleExitConfirmAcceptBtn"
            data-battle-exit-confirm-action="accept"
            data-controller-default-focus="true"
          >
            ABANDON
          </button>
          <button
            class="game-confirm-modal__btn"
            type="button"
            data-battle-exit-confirm-action="cancel"
          >
            KEEP FIGHTING
          </button>
        </div>
      </div>
    </div>
  `;
}

function openBattleExitConfirm(): void {
  battleExitConfirmState = "abandon-echo";
  renderBattleScreen();
}

function closeBattleExitConfirm(): void {
  if (!battleExitConfirmState) {
    return;
  }
  battleExitConfirmState = null;
  renderBattleScreen();
}

function resolveBattleExitConfirm(battle: BattleState): void {
  if (battleExitConfirmState !== "abandon-echo") {
    return;
  }
  battleExitConfirmState = null;
  abandonActiveEchoRun();
  cleanupBattlePanHandlers();
  teardownBattleHud();
  resetBattleUiSessionState();
  updateGameState((prev) => ({
    ...prev,
    phase: "echo",
    currentBattle: null,
  }));
  import("./EchoRunScreen").then(({ renderEchoRunScreen }) => {
    renderEchoRunScreen();
  });
}

function renderBattleResultOverlay(battle: BattleState): string {
  const echoSummary = isEchoBattle(battle) ? summarizeEchoEncounter(battle) : null;

  if (isEchoBattle(battle) && battle.phase === "victory") {
    return `
      <div class="battle-result-overlay battle-result-overlay--echo">
        <div class="battle-result-card battle-result-card--echo">
          <div class="battle-result-kicker">S/COM_OS // ECHO ENCOUNTER CLEAR</div>
          <div class="battle-result-title">DRAFT SUCCESS</div>
          <div class="battle-result-copy">The proving ground accepted the squad’s solution. A new draft choice is ready.</div>
          <div class="battle-reward-grid battle-reward-grid--echo">
            <div class="battle-reward-item"><div class="reward-label">ENCOUNTER</div><div class="reward-value">${echoSummary?.encounterNumber ?? 0}</div></div>
            <div class="battle-reward-item"><div class="reward-label">TYPE</div><div class="reward-value">${echoSummary?.encounterType?.toUpperCase() ?? "STANDARD"}</div></div>
            <div class="battle-reward-item"><div class="reward-label">SCORE</div><div class="reward-value">+${echoSummary?.scoreGained ?? 0}</div></div>
            <div class="battle-reward-item"><div class="reward-label">REROLLS</div><div class="reward-value">+${echoSummary?.rerollsEarned ?? 0}</div></div>
            <div class="battle-reward-item"><div class="reward-label">FIELD TRIGGERS</div><div class="reward-value">${echoSummary?.fieldTriggerCount ?? 0}</div></div>
            <div class="battle-reward-item"><div class="reward-label">CHALLENGE</div><div class="reward-value">${echoSummary?.challengeCompleted ? "COMPLETE" : echoSummary?.challengeFailed ? "MISSED" : "ACTIVE"}</div></div>
          </div>
          <div class="battle-result-footer">
            <button class="battle-result-btn battle-result-btn--claim" id="echoContinueBtn">OPEN DRAFT REWARDS</button>
          </div>
        </div>
      </div>
    `;
  }

  if (isEchoBattle(battle) && battle.phase === "defeat") {
    return `
      <div class="battle-result-overlay battle-result-overlay--defeat battle-result-overlay--echo">
        <div class="battle-result-card battle-result-card--echo">
          <div class="battle-result-kicker">S/COM_OS // ECHO LINK LOST</div>
          <div class="battle-result-title">RUN FAILED</div>
          <div class="battle-result-message">Draft squad integrity failed. The simulation is ready to collapse into a results summary.</div>
          <div class="battle-defeat-text">No permanent losses were carried out beyond this Echo Run.</div>
          <div class="battle-result-footer">
            <button class="battle-result-btn battle-result-btn--primary" id="echoResultsBtn">VIEW ECHO RESULTS</button>
          </div>
        </div>
      </div>
    `;
  }

  // Check if this is a training battle
  const isTraining = (battle as any).isTraining === true;

  if (isTraining && battle.phase === "victory") {
    return `
      <div class="battle-result-overlay battle-result-overlay--training">
        <div class="battle-result-card battle-result-card--training">
          <div class="battle-result-kicker">SCROLLLINK // SIMULATION REPORT</div>
          <div class="battle-result-title">TRAINING COMPLETE</div>
          <div class="battle-result-copy">Simulation ended successfully. No combat rewards were issued for this exercise.</div>
          <div class="battle-result-message">Training data archived to the squad record.</div>
          <div class="battle-result-footer">
            <button class="battle-result-btn" id="trainingContinueBtn">CONTINUE</button>
          </div>
        </div>
      </div>
    `;
  }

  if (isSquadBattle(battle) && (battle.phase === "victory" || battle.phase === "defeat")) {
    const resolvedMatch = loadSquadMatchState();
    const winnerLabel = getSquadMatchWinnerLabel(battle);
    const resultReason = resolvedMatch?.result?.reason ?? getSquadBattleOutcomeCopy(battle);

    return `
      <div class="battle-result-overlay">
        <div class="battle-result-card">
          <div class="battle-result-kicker">SCROLLLINK // SKIRMISH RESOLVED</div>
          <div class="battle-result-title">${getSquadBattleOutcomeTitle(battle)}</div>
          <div class="battle-result-copy">${escapeBattleText(winnerLabel)} controls the tactical field.</div>
          <div class="battle-result-message">${escapeBattleText(resultReason)}</div>
          <div class="battle-result-footer">
            <button class="battle-result-btn battle-result-btn--claim" id="squadReturnBtn">RETURN TO SKIRMISH BOARD</button>
          </div>
        </div>
      </div>
    `;
  }

  // Normal battle overlay
  if (battle.phase === "victory") {
    const r = battle.rewards ?? {
      wad: 0,
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
      squadXp: 0,
    };
    const advancedRewards = {
      alloy: Number((battle.rewards as any)?.alloy ?? 0),
      drawcord: Number((battle.rewards as any)?.drawcord ?? 0),
      fittings: Number((battle.rewards as any)?.fittings ?? 0),
      resin: Number((battle.rewards as any)?.resin ?? 0),
      chargeCells: Number((battle.rewards as any)?.chargeCells ?? 0),
    };
    const isDefenseBattle = battle.defenseObjective?.type === "survive_turns";
    const isTheaterOperationBattle = Boolean(battle.theaterMeta && hasTheaterOperation(getGameState().operation));
    const survivingFriendlies = Object.values(battle.units).filter((unit) => !unit.isEnemy);
    const totalFriendlyHp = survivingFriendlies.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0);
    const totalFriendlyMaxHp = survivingFriendlies.reduce((sum, unit) => sum + Math.max(1, unit.maxHp), 0);
    const integrityPercent = totalFriendlyMaxHp > 0
      ? Math.max(0, Math.min(100, Math.round((totalFriendlyHp / totalFriendlyMaxHp) * 100)))
      : 0;
    const latestBattleNote = (battle.log[battle.log.length - 1] ?? "")
      .replace(/^SLK\/\/[A-Z_]+\s*::\s*/i, "")
      .trim() || "Reward packet ready for transfer.";
    const rewardPacketTypes = [
      r.wad,
      r.metalScrap,
      r.wood,
      r.chaosShards,
      r.steamComponents,
      advancedRewards.alloy,
      advancedRewards.drawcord,
      advancedRewards.fittings,
      advancedRewards.resin,
      advancedRewards.chargeCells,
      r.squadXp ?? 0,
    ].filter((amount) => amount > 0).length;
    const victoryStatusLabel = isDefenseBattle
      ? "PERIMETER HELD"
      : isTheaterOperationBattle
        ? "ROOM SECURED"
        : "HOSTILES BROKEN";

    // Load unlockable name if present
    const unlockableId = (r as any).unlockable;
    let unlockableName = "";
    if (unlockableId && unlockableId !== "pending") {
      try {
        const unlock = getUnlockableById(unlockableId);
        unlockableName = unlock ? unlock.displayName : unlockableId;
      } catch {
        unlockableName = "Unlockable";
      }
    }

    return `
      <div class="battle-result-overlay">
        <div class="battle-result-card">
          <div class="battle-result-kicker">SCROLLLINK // ENGAGEMENT RESOLVED</div>
          <div class="battle-result-title">${isDefenseBattle ? "FACILITY DEFENDED" : "VICTORY"}</div>
          ${isDefenseBattle ? `
            <div class="battle-defense-success">
              Facility perimeter held. Defensive line remains intact.
            </div>
          ` : `
            <div class="battle-result-copy">
              Hostile resistance broken. Claim the reward package and continue the operation.
            </div>
          `}
          <div class="battle-result-message">${escapeBattleText(latestBattleNote)}</div>
          <div class="battle-result-summary">
            <article class="battle-result-summary-card">
              <div class="battle-result-summary-card__label">SURVIVORS</div>
              <div class="battle-result-summary-card__value">${survivingFriendlies.length}</div>
              <div class="battle-result-summary-card__meta">${survivingFriendlies.length === 1 ? "Unit remains standing" : "Units remain standing"}</div>
            </article>
            <article class="battle-result-summary-card">
              <div class="battle-result-summary-card__label">INTEGRITY</div>
              <div class="battle-result-summary-card__value">${integrityPercent}%</div>
              <div class="battle-result-summary-card__meta">${totalFriendlyHp}/${totalFriendlyMaxHp} HP across the squad</div>
            </article>
            <article class="battle-result-summary-card">
              <div class="battle-result-summary-card__label">TURN COUNT</div>
              <div class="battle-result-summary-card__value">${battle.turnCount}</div>
              <div class="battle-result-summary-card__meta">${battle.turnCount === 1 ? "turn elapsed" : "turns elapsed"}</div>
            </article>
            <article class="battle-result-summary-card">
              <div class="battle-result-summary-card__label">STATUS</div>
              <div class="battle-result-summary-card__value">${victoryStatusLabel}</div>
              <div class="battle-result-summary-card__meta">${rewardPacketTypes} reward channel${rewardPacketTypes === 1 ? "" : "s"} primed</div>
            </article>
          </div>
          <div class="battle-result-section-title">Reward Packet</div>
          <div class="battle-reward-grid">
            <div class="battle-reward-item"><div class="reward-label">WAD</div><div class="reward-value">+${r.wad}</div></div>
            <div class="battle-reward-item"><div class="reward-label">METAL SCRAP</div><div class="reward-value">+${r.metalScrap}</div></div>
            <div class="battle-reward-item"><div class="reward-label">WOOD</div><div class="reward-value">+${r.wood}</div></div>
            <div class="battle-reward-item"><div class="reward-label">CHAOS SHARDS</div><div class="reward-value">+${r.chaosShards}</div></div>
            <div class="battle-reward-item"><div class="reward-label">STEAM COMPONENTS</div><div class="reward-value">+${r.steamComponents}</div></div>
            <div class="battle-reward-item battle-reward-item--stat"><div class="reward-label">${STAT_SHORT_LABEL}</div><div class="reward-value">+${r.squadXp ?? 0}</div></div>
            ${advancedRewards.alloy > 0 ? `<div class="battle-reward-item"><div class="reward-label">ALLOY</div><div class="reward-value">+${advancedRewards.alloy}</div></div>` : ""}
            ${advancedRewards.drawcord > 0 ? `<div class="battle-reward-item"><div class="reward-label">DRAWCORD</div><div class="reward-value">+${advancedRewards.drawcord}</div></div>` : ""}
            ${advancedRewards.fittings > 0 ? `<div class="battle-reward-item"><div class="reward-label">FITTINGS</div><div class="reward-value">+${advancedRewards.fittings}</div></div>` : ""}
            ${advancedRewards.resin > 0 ? `<div class="battle-reward-item"><div class="reward-label">RESIN</div><div class="reward-value">+${advancedRewards.resin}</div></div>` : ""}
            ${advancedRewards.chargeCells > 0 ? `<div class="battle-reward-item"><div class="reward-label">CHARGE CELLS</div><div class="reward-value">+${advancedRewards.chargeCells}</div></div>` : ""}
            ${unlockableId && unlockableId !== "pending" && unlockableName ? `
              <div class="battle-reward-item battle-reward-item--unlockable">
                <div class="reward-label">NEW UNLOCK</div>
                <div class="reward-value">${unlockableName}</div>
              </div>
            ` : ""}
          </div>
          <div class="battle-result-footer">
            <button class="battle-result-btn battle-result-btn--claim" id="claimRewardsBtn">CLAIM REWARDS AND CONTINUE</button>
          </div>
        </div>
      </div>
    `;
  }

  if (battle.phase === "defeat") {
    const isTheaterOperationBattle = Boolean(battle.theaterMeta && hasTheaterOperation(getGameState().operation));
    // Check if in campaign run (for retry option)
    const isCampaignRun = !isTheaterOperationBattle && ((window as any).__isCampaignRun || false);

    return `
      <div class="battle-result-overlay battle-result-overlay--defeat">
        <div class="battle-result-card">
          <div class="battle-result-kicker">SCROLLLINK // ENGAGEMENT FAILED</div>
          <div class="battle-result-title">DEFEAT</div>
          <div class="battle-result-message">${isTheaterOperationBattle ? "Operation force withdrawn. HAVEN recovery channel standing by." : "Combat link severed. Recovery channel standing by."}</div>
          <div class="battle-defeat-text">${isTheaterOperationBattle ? "The theater remains saved in its current state. Deployed units return shaken." : "Your squad has been wiped out."}</div>
          <div class="battle-result-footer">
            ${isCampaignRun ? `
              <button class="battle-result-btn battle-result-btn--primary" id="retryRoomBtn">RETRY ROOM</button>
              <button class="battle-result-btn" id="abandonRunBtn">ABANDON RUN</button>
            ` : `
              <button class="battle-result-btn" id="defeatReturnBtn">${isTheaterOperationBattle ? "RETURN TO HAVEN" : "RETURN TO BASE"}</button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Animation state for hand draw/discard
let isHandAnimating = false;

function animateHandDraw(container: HTMLElement, onComplete: () => void) {
  if (isHandAnimating) {
    onComplete();
    return;
  }

  isHandAnimating = true;
  const cards = container.querySelectorAll(".battle-card-slot");

  // Set initial state (invisible, below)
  cards.forEach((card) => {
    const el = card as HTMLElement;
    el.style.opacity = "0";
    el.style.transform = "translateY(50px)";
    el.style.transition = "none";
  });

  // Force reflow
  void container.offsetHeight;

  // Animate each card in with stagger
  cards.forEach((card, i) => {
    const el = card as HTMLElement;
    setTimeout(() => {
      el.style.transition = "opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)";
      el.style.opacity = "1";
      el.style.transform = "";
    }, i * 50);
  });

  // Complete after all animations
  setTimeout(() => {
    isHandAnimating = false;
    onComplete();
  }, cards.length * 50 + 300);
}

function animateHandDiscard(container: HTMLElement, onComplete: () => void) {
  if (isHandAnimating) {
    onComplete();
    return;
  }

  isHandAnimating = true;
  const cards = container.querySelectorAll(".battle-card-slot");

  // Animate cards out
  cards.forEach((card, i) => {
    const el = card as HTMLElement;
    setTimeout(() => {
      el.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
      el.style.opacity = "0";
      el.style.transform = "translateY(50px) scale(0.8)";
    }, i * 30);
  });

  // Complete after animations
  setTimeout(() => {
    isHandAnimating = false;
    onComplete();
  }, cards.length * 30 + 300);
}

function animatePlayedCard(cardIndex: number | null, onComplete: () => void): void {
  if (cardIndex === null || cardIndex < 0) {
    onComplete();
    return;
  }

  const playedSlot = document.querySelector<HTMLElement>(`#battleHandContainer .battle-card-slot[data-card-index="${cardIndex}"]`);
  if (!playedSlot) {
    onComplete();
    return;
  }

  const playedCard = playedSlot.querySelector<HTMLElement>(".battle-cardui");
  if (!playedCard) {
    onComplete();
    return;
  }

  if (playedSlot.dataset.playAnimating === "true") {
    return;
  }

  playedSlot.dataset.playAnimating = "true";
  playedSlot.classList.add("battle-card-slot--played");
  playedCard.classList.add("battle-cardui--played");

  window.setTimeout(() => {
    playedSlot.dataset.playAnimating = "false";
    onComplete();
  }, 340);
}

function handleBattleHudCardSelection(cardIndex: number): void {
  if (!localBattleState) return;
  if (turnState.hasActed) return;
  const activeUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : undefined;
  const isPlayerTurn = Boolean(activeUnit && isLocalBattleTurn(localBattleState, activeUnit));
  if (!isPlayerTurn) return;
  if (isBattleUnitAutoControlled(localBattleState, activeUnit)) return;
  const card = activeUnit?.hand?.[cardIndex] ? resolveCard(activeUnit.hand[cardIndex]) : null;
  if (activeUnit && card && getBattleCardDisabledReason(card, activeUnit)) {
    selectedCardIndex = null;
    renderBattleScreen();
    return;
  }

  selectedCardIndex = selectedCardIndex === cardIndex ? null : cardIndex;
  renderBattleScreen();
}

function handleBattleHudUndoMove(): void {
  if (
    localBattleState &&
    (localBattleState.phase === "victory" || localBattleState.phase === "defeat")
  ) {
    return;
  }

  const activeUnit = localBattleState?.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : undefined;
  if (!turnState.hasActed && turnState.hasCommittedMove && turnState.originalPosition && activeUnit && localBattleState) {
    if (!canLocalControlBattleUnit(localBattleState, activeUnit)) {
      return;
    }
    if (isBattleUnitAutoControlled(localBattleState, activeUnit)) {
      return;
    }

    if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
      void sendLocalNetworkBattleCommand({
        type: "undo_move",
        unitId: activeUnit.id,
      });
      return;
    }

    turnState.movementRemaining = getUnitMovementRange(activeUnit);
    turnState.hasMoved = false;
    turnState.hasCommittedMove = false;
    const originalPosition = { ...turnState.originalPosition };
    turnState.originalPosition = null;

    const newUnits = { ...localBattleState.units };
    newUnits[activeUnit.id] = {
      ...newUnits[activeUnit.id],
      pos: originalPosition,
    };
    const newLog = [...localBattleState.log, `SLK//UNDO :: ${activeUnit.name} returns to original position.`];
    setBattleState({
      ...localBattleState,
      units: newUnits,
      log: newLog,
    });

    renderBattleScreen();
  }
}

function finalizeBattleHudEndTurn(stateToAdvance: BattleState): void {
  turnState.isFacingSelection = false;
  selectedCardIndex = null;

  const completeAdvance = () => {
    const nextState = advanceTurn(stateToAdvance);

    requestAnimationFrame(() => {
      const nextHandContainer = document.getElementById("battleHandContainer");
      if (nextHandContainer && nextState.activeUnitId) {
        const nextUnit = nextState.units[nextState.activeUnitId];
        if (nextUnit && canLocalControlBattleUnit(nextState, nextUnit)) {
          animateHandDraw(nextHandContainer, () => {});
        }
      }
    });

    if (shouldAutoResolveBattleState(nextState)) {
      runEnemyTurnsAnimated(nextState);
      return;
    }

    setBattleState(nextState);
    renderBattleScreen();
  };

  const handContainer = document.getElementById("battleHandContainer");
  if (handContainer) {
    animateHandDiscard(handContainer, completeAdvance);
    return;
  }

  completeAdvance();
}

function handleBattleHudEndTurn(): void {
  if (localBattleState && (localBattleState.phase === "victory" || localBattleState.phase === "defeat")) {
    return;
  }

  const activeUnit = localBattleState?.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : undefined;
  const isPlayerTurn = Boolean(activeUnit && isLocalBattleTurn(localBattleState, activeUnit));
  if (!isPlayerTurn || !localBattleState || !activeUnit) return;
  if (isBattleUnitAutoControlled(localBattleState, activeUnit)) return;

  if (!activeUnit.pos) {
    if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
      void sendLocalNetworkBattleCommand({
        type: "end_turn",
        unitId: activeUnit.id,
      });
      return;
    }
    finalizeBattleHudEndTurn(localBattleState);
    return;
  }

  if (turnState.isFacingSelection) {
    if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
      void sendLocalNetworkBattleCommand({
        type: "end_turn",
        unitId: activeUnit.id,
      });
      turnState.isFacingSelection = false;
      renderBattleScreen();
      return;
    }
    finalizeBattleHudEndTurn(localBattleState);
    return;
  }

  if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
    turnState.isFacingSelection = true;
    selectedCardIndex = null;
    renderBattleScreen();
    return;
  }

  turnState.isFacingSelection = true;
  selectedCardIndex = null;
  setBattleState({
    ...localBattleState,
    log: [
      ...localBattleState.log,
      `SLK//FACING :: Select facing direction for ${activeUnit.name}, then the turn will end.`,
    ],
  });
  renderBattleScreen();
}

function handleBattleHudDebugAutoWin(): void {
  if (!localBattleState) return;
  const newUnits = { ...localBattleState.units };

  Object.keys(newUnits).forEach((id) => {
    if (newUnits[id].isEnemy) {
      newUnits[id] = { ...newUnits[id], hp: 0 };
    }
  });

  const newTurnOrder = localBattleState.turnOrder.filter((id) => {
    const unit = newUnits[id];
    return unit && (!unit.isEnemy || unit.hp > 0);
  });

  const newLog = [...localBattleState.log, "SLK//DEBUG :: Auto-win triggered."];
  let newState: BattleState = {
    ...localBattleState,
    units: newUnits,
    turnOrder: newTurnOrder,
    log: newLog,
  };

  newState = evaluateBattleOutcome(newState);
  if (newState.phase !== "victory") {
    newState = {
      ...newState,
      phase: "victory",
      rewards: {
        wad: 50,
        metalScrap: 10,
        wood: 5,
        chaosShards: 2,
        steamComponents: 2,
        squadXp: 0,
      },
    };
  }
  setBattleState(newState);
  renderBattleScreen();
}

function getBattleHudWeaponContext(): { activeUnit: BattleUnitState; weapon: NonNullable<ReturnType<typeof getEquippedWeapon>> } | null {
  if (!localBattleState || !localBattleState.activeUnitId) return null;
  const activeUnit = localBattleState.units[localBattleState.activeUnitId];
  if (!activeUnit) return null;

  const state = getGameState();
  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const weapon = getEquippedWeapon(activeUnit, equipmentById);
  if (!weapon) return null;
  return { activeUnit, weapon };
}

function handleBattleHudClutchToggle(clutchId: string): void {
  const context = getBattleHudWeaponContext();
  if (!context || !localBattleState || !context.activeUnit.weaponState) {
    return;
  }

  const nextWeaponState = toggleWeaponClutch(context.activeUnit.weaponState, context.weapon, clutchId);
  const clutch = getWeaponClutches(context.weapon).find((entry) => entry.id === clutchId);
  const active = nextWeaponState.activeClutchIds.includes(clutchId);
  const nextState: BattleState = {
    ...localBattleState,
    units: {
      ...localBattleState.units,
      [context.activeUnit.id]: {
        ...context.activeUnit,
        weaponState: nextWeaponState,
        clutchActive: nextWeaponState.clutchActive,
        weaponWear: nextWeaponState.wear,
      },
    },
    log: [
      ...localBattleState.log,
      `SLK//CLUTCH :: ${context.activeUnit.name} ${active ? "engages" : "disengages"} ${clutch?.label ?? "weapon clutch"}.`,
    ],
  };
  setBattleState(nextState);
  renderBattleScreen();
}

function handleBattleHudQuickReload(): void {
  const context = getBattleHudWeaponContext();
  if (!context || !localBattleState || !context.activeUnit.weaponState) {
    return;
  }
  const outcome = quickReload(context.activeUnit.weaponState, context.weapon);
  let nextState = updateUnitWeaponState(localBattleState, context.activeUnit.id, outcome.state);
  const refreshedUser = nextState.units[context.activeUnit.id];
  if (refreshedUser) {
    nextState = applyStrain(nextState, refreshedUser, outcome.strainCost);
  }
  nextState = {
    ...nextState,
    log: [...nextState.log, `SLK//RELOAD :: ${context.activeUnit.name} performs a quick reload.`],
  };
  setBattleState(nextState);
  renderBattleScreen();
}

function handleBattleHudFullReload(): void {
  const context = getBattleHudWeaponContext();
  if (!context || !localBattleState || !context.activeUnit.weaponState) {
    return;
  }
  const outcome = fullReload(context.activeUnit.weaponState, context.weapon);
  let nextState = updateUnitWeaponState(localBattleState, context.activeUnit.id, outcome.state);
  const refreshedUser = nextState.units[context.activeUnit.id];
  if (refreshedUser) {
    nextState = applyStrain(nextState, refreshedUser, outcome.strainCost);
  }
  nextState = {
    ...nextState,
    log: [...nextState.log, `SLK//RELOAD :: ${context.activeUnit.name} performs a full reload.`],
  };
  setBattleState(nextState);
  renderBattleScreen();
}

function handleBattleHudFieldPatch(): void {
  const context = getBattleHudWeaponContext();
  if (!context || !localBattleState || !context.activeUnit.weaponState) {
    return;
  }
  const outcome = fieldPatch(context.activeUnit.weaponState);
  let nextState = updateUnitWeaponState(localBattleState, context.activeUnit.id, outcome.state);
  const refreshedUser = nextState.units[context.activeUnit.id];
  if (refreshedUser && outcome.strainCost > 0) {
    nextState = applyStrain(nextState, refreshedUser, outcome.strainCost);
  }
  nextState = {
    ...nextState,
    log: [
      ...nextState.log,
      outcome.repairedNodeId
        ? `SLK//PATCH :: ${context.activeUnit.name} patches node ${outcome.repairedNodeId}.`
        : `SLK//PATCH :: ${context.activeUnit.name} finds no patchable damage.`,
    ],
  };
  setBattleState(nextState);
  renderBattleScreen();
}

function handleBattleHudVent(): void {
  const context = getBattleHudWeaponContext();
  if (!context || !localBattleState || !context.activeUnit.weaponState) {
    return;
  }
  const outcome = ventWeapon(context.activeUnit.weaponState, context.weapon);
  let nextState = updateUnitWeaponState(localBattleState, context.activeUnit.id, outcome.state);
  const ventUser = nextState.units[context.activeUnit.id];
  if (ventUser) {
    const hpLoss = Math.max(1, Math.ceil(ventUser.maxHp * outcome.hpCostPercent));
    const remainingHp = ventUser.hp - hpLoss;
    if (remainingHp <= 0) {
      const nextUnits = { ...nextState.units };
      delete nextUnits[ventUser.id];
      nextState = {
        ...nextState,
        units: nextUnits,
        turnOrder: nextState.turnOrder.filter((id) => id !== ventUser.id),
        log: [...nextState.log, `SLK//VENT :: ${ventUser.name} vents the weapon core and is destroyed by the backlash.`],
      };
    } else {
      nextState = {
        ...nextState,
        units: {
          ...nextState.units,
          [ventUser.id]: {
            ...ventUser,
            hp: remainingHp,
          },
        },
        log: [...nextState.log, `SLK//VENT :: ${ventUser.name} vents the weapon core and loses ${hpLoss} HP.`],
      };
    }
  }
  finalizeBattleHudEndTurn(nextState);
}

function handleBattleHudConsumableUse(consumableId: string, targetId: string): void {
  if (!localBattleState) return;
  const activeUnit = localBattleState.activeUnitId ? localBattleState.units[localBattleState.activeUnitId] : null;
  if (!activeUnit || activeUnit.isEnemy || localBattleState.phase !== "player_turn") {
    showSystemPing({
      type: "error",
      title: "Consumables Locked",
      message: "Consumables can only be used during a friendly unit's active turn.",
      channel: "battle-consumables",
    });
    return;
  }

  const state = getGameState();
  const outcome = applyBattleConsumable(localBattleState, state.consumables, consumableId, targetId);
  if (!outcome.success) {
    showSystemPing({
      type: "error",
      title: "Consumable Unavailable",
      message: outcome.message,
      channel: "battle-consumables",
    });
    return;
  }

  syncBattleConsumableUsageToGameState(outcome.battle, outcome.consumables, outcome.targetId, outcome.healedAmount);
  setBattleState(outcome.battle);
  renderBattleScreen();
  showSystemPing({
    type: "info",
    title: "Consumable Used",
    message: outcome.message,
    channel: "battle-consumables",
  });
}

function syncBattleBoardScene(
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  isPlacementPhase: boolean,
): void {
  const host = getBattleBoardHost();
  if (!host) {
    return;
  }

  const renderState = currentBattleBoardRenderState ?? computeBattleBoardRenderState(
    battle,
    selectedCardIndex,
    activeUnit,
    isPlacementPhase,
  );
  currentBattleBoardRenderState = renderState;

  const scene = getBattleSceneControllerInstance();
  scene.mount(host);
  scene.setViewChangeHandler((view) => {
    captureActiveBattleViewPreset(view);
  });
  scene.sync(createBattleBoardSnapshot(battle, {
    moveTiles: renderState.moveTiles,
    attackTiles: renderState.attackTiles,
    placementTiles: renderState.placementTiles,
    facingTiles: renderState.facingTiles,
    hoveredTile,
    hiddenUnitIds: renderState.hiddenUnitIds,
    echoFieldPlacements: renderState.echoPlacements,
    selectedEchoFieldDraftId: renderState.selectedEchoFieldDraftId,
    focusTile: renderState.focusTile,
  }));

  const activeViewIndex = getActiveBattleViewIndex();
  const activeViewSignature = `${battle.id}:${activeViewIndex}`;
  if (battleLastAppliedViewSignature !== activeViewSignature) {
    const activeViewPreset = getActiveBattleViewPreset();
    battleZoom = activeViewPreset.zoomFactor;
    scene.applyViewState(activeViewPreset, false);
    battleLastAppliedViewSignature = activeViewSignature;
  }
}

function updateHoveredBattleTile(nextTile: BattleBoardPoint | null): void {
  if (!nextTile && hoveredTile === null) {
    return;
  }
  if (nextTile && hoveredTile && hoveredTile.x === nextTile.x && hoveredTile.y === nextTile.y) {
    return;
  }
  hoveredTile = nextTile ? { ...nextTile } : null;
  renderBattleScreen();
}

function battleBoardSetHas(set: Set<string>, point: BattleBoardPoint): boolean {
  return set.has(`${point.x},${point.y}`);
}

function handleBattleBoardPlacementPick(
  pick: BattleBoardPick,
  battle: BattleState,
  isClientNetworkPlacement: boolean,
): void {
  if (!localBattleState || !localBattleState.placementState) {
    return;
  }

  const occupiedUnitId = pick.unitId
    ?? Object.values(localBattleState.units).find((unit) => unit.pos?.x === pick.x && unit.pos?.y === pick.y && unit.hp > 0)?.id
    ?? null;
  if (occupiedUnitId) {
    const unit = localBattleState.units[occupiedUnitId];
    if (unit && canLocalControlBattleUnit(localBattleState, unit) && localBattleState.placementState.placedUnitIds.includes(occupiedUnitId)) {
      if (isClientNetworkPlacement) {
        void sendLocalNetworkPlacementCommand({ type: "remove_placed_unit", unitId: occupiedUnitId });
        return;
      }
      const newState = unplaceBattleUnit(localBattleState, occupiedUnitId);
      setBattleState(newState);
      renderBattleScreen();
      return;
    }
  }

  if (getEchoContext(localBattleState)?.placementMode === "fields") {
    const currentEchoContext = getEchoContext(localBattleState);
    const draftId = currentEchoContext?.selectedFieldDraftId ?? currentEchoContext?.availableFields[0]?.draftId ?? null;
    if (!draftId) {
      return;
    }

    let newState = upsertEchoFieldPlacement(localBattleState, draftId, { x: pick.x, y: pick.y });
    const remainingFields = getUnplacedEchoFields(newState);
    if (remainingFields.length > 0) {
      newState = selectEchoPlacementField(newState, remainingFields[0].draftId);
    }
    setBattleState(newState);
    renderBattleScreen();
    return;
  }

  if (!currentBattleBoardRenderState || !battleBoardSetHas(currentBattleBoardRenderState.placementTiles, pick)) {
    return;
  }

  const occupied = Object.values(localBattleState.units).some(
    (unit) => unit.pos && unit.pos.x === pick.x && unit.pos.y === pick.y && unit.hp > 0,
  );
  if (occupied) {
    return;
  }

  const selectedUnitId = localBattleState.placementState.selectedUnitId;
  let unitToPlace: BattleUnitState | undefined | null = null;
  if (selectedUnitId) {
    const selectedUnit = localBattleState.units[selectedUnitId];
    if (selectedUnit && canLocalControlBattleUnit(localBattleState, selectedUnit)
      && !localBattleState.placementState.placedUnitIds.includes(selectedUnitId)) {
      unitToPlace = selectedUnit;
    }
  }

  if (!unitToPlace) {
    unitToPlace = getLocalPlacementUnits(localBattleState).find(
      (unit) => !localBattleState!.placementState!.placedUnitIds.includes(unit.id) && !unit.pos,
    );
  }

  if (!unitToPlace) {
    return;
  }

  const validPlacementTiles = getPlacementTilesForUnit(localBattleState, unitToPlace);
  if (!validPlacementTiles.some((tilePos) => tilePos.x === pick.x && tilePos.y === pick.y)) {
    return;
  }

  if (isClientNetworkPlacement) {
    void sendLocalNetworkPlacementCommand({ type: "place_unit", unitId: unitToPlace.id, x: pick.x, y: pick.y });
    return;
  }

  const newState = placeUnit(localBattleState, unitToPlace.id, { x: pick.x, y: pick.y });
  setBattleState(newState);
  renderBattleScreen();
}

function handleBattleBoardActionPick(
  pick: BattleBoardPick,
  battle: BattleState,
  activeUnit: BattleUnitState | undefined,
  isPlayerTurn: boolean,
): void {
  if (isBattleHudPointerInteraction) return;
  if (isAnimatingEnemyTurn) return;
  if (hasActiveBattleAnimation()) return;
  if (localBattleState && (localBattleState.phase === "victory" || localBattleState.phase === "defeat")) return;
  if (!isPlayerTurn || !activeUnit || !localBattleState || !canLocalControlBattleUnit(localBattleState, activeUnit)) return;
  if (isBattleUnitAutoControlled(localBattleState, activeUnit)) return;
  if (!currentBattleBoardRenderState) return;

  const { x, y } = pick;

  if (turnState.isFacingSelection && battleBoardSetHas(currentBattleBoardRenderState.facingTiles, pick)) {
    if (!activeUnit.pos) return;
    const dx = x - activeUnit.pos.x;
    const dy = y - activeUnit.pos.y;
    let newFacing: "north" | "south" | "east" | "west";

    if (Math.abs(dx) >= Math.abs(dy)) {
      newFacing = dx > 0 ? "east" : "west";
    } else {
      newFacing = dy > 0 ? "south" : "north";
    }

    if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
      void sendLocalNetworkBattleCommand({
        type: "end_turn",
        unitId: activeUnit.id,
        facing: newFacing,
      });
      turnState.isFacingSelection = false;
      renderBattleScreen();
      return;
    }

    const newUnits = { ...localBattleState.units };
    newUnits[activeUnit.id] = { ...newUnits[activeUnit.id], facing: newFacing };
    const newState = { ...localBattleState, units: newUnits };
    setBattleState(newState);
    finalizeBattleHudEndTurn(newState);
    return;
  }

  if (battleBoardSetHas(currentBattleBoardRenderState.moveTiles, pick)) {
    if (!turnState.hasMoved && activeUnit.pos) {
      turnState.originalPosition = { x: activeUnit.pos.x, y: activeUnit.pos.y };
    }

    const originX = turnState.originalPosition?.x ?? activeUnit.pos?.x ?? 0;
    const originY = turnState.originalPosition?.y ?? activeUnit.pos?.y ?? 0;
    const currentX = activeUnit.pos?.x ?? 0;
    const currentY = activeUnit.pos?.y ?? 0;
    const maxMove = getUnitMovementRange(activeUnit);
    const path = getMovePath(localBattleState, { x: currentX, y: currentY }, { x, y }, maxMove);
    if (path.length < 2) {
      return;
    }

    const totalCost = getDistance(originX, originY, x, y);
    if (totalCost > maxMove) {
      return;
    }

    if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
      if (!turnState.hasMoved && activeUnit.pos) {
        turnState.originalPosition = { x: activeUnit.pos.x, y: activeUnit.pos.y };
      }
      turnState.movementRemaining = Math.max(0, maxMove - totalCost);
      turnState.hasMoved = true;
      turnState.hasCommittedMove = true;
      void sendLocalNetworkBattleCommand({
        type: "move_unit",
        unitId: activeUnit.id,
        x,
        y,
      });
      renderBattleScreen();
      return;
    }

    executeLocalBattleMove(activeUnit.id, path, 40);
    return;
  }

  const units = getUnitsArray(localBattleState);
  const targetUnit = units.find((unit) => unit.pos?.x === x && unit.pos?.y === y && unit.hp > 0);
  if (targetUnit) {
    if (turnState.hasActed) {
      return;
    }

    const ux = activeUnit.pos?.x ?? 0;
    const uy = activeUnit.pos?.y ?? 0;
    const dist = getDistance(ux, uy, x, y);

    let cardToPlay: number | null = selectedCardIndex;
    let shouldPlay = false;
    let targetUnitId = "";

    if (cardToPlay === null && activeUnit.hand.length > 0) {
      for (let index = 0; index < activeUnit.hand.length; index += 1) {
        const card = resolveCard(activeUnit.hand[index]);
        if (canCardTargetUnit(card, activeUnit, targetUnit, dist)) {
          cardToPlay = index;
          shouldPlay = true;
          targetUnitId = targetUnit.id;
          break;
        }
      }
    } else if (cardToPlay !== null) {
      const card = resolveCard(activeUnit.hand[cardToPlay]);
      if (canCardTargetUnit(card, activeUnit, targetUnit, dist)) {
        shouldPlay = true;
        targetUnitId = targetUnit.id;
      }
    }

    if (shouldPlay && cardToPlay !== null) {
      if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
        selectedCardIndex = null;
        void sendLocalNetworkBattleCommand({
          type: "play_card",
          unitId: activeUnit.id,
          cardIndex: cardToPlay,
          targetUnitId,
        });
        renderBattleScreen();
        return;
      }

      executeLocalBattleCardPlay(activeUnit.id, cardToPlay, targetUnitId, 40);
      return;
    }
  }

  if (battleBoardSetHas(currentBattleBoardRenderState.attackTiles, pick) && selectedCardIndex !== null && targetUnit) {
    if (isRemoteNetworkClientTurn(localBattleState, activeUnit)) {
      const playedCardIndex = selectedCardIndex;
      if (playedCardIndex !== null) {
        selectedCardIndex = null;
        void sendLocalNetworkBattleCommand({
          type: "play_card",
          unitId: activeUnit.id,
          cardIndex: playedCardIndex,
          targetUnitId: targetUnit.id,
        });
        renderBattleScreen();
      }
      return;
    }

    const playedCardIndex = selectedCardIndex;
    if (playedCardIndex !== null) {
      executeLocalBattleCardPlay(activeUnit.id, playedCardIndex, targetUnit.id, 40);
    }
  }
}

function attachBattleListeners() {
  if (!localBattleState) return;

  const battle = localBattleState;
  const activeUnit = battle.activeUnitId ? battle.units[battle.activeUnitId] : undefined;
  const isPlayerTurn = Boolean(activeUnit && isLocalBattleTurn(battle, activeUnit));
  const isPlacementPhase = battle.phase === "placement";
  setupBattleHudResizeListener();
  syncBattleBoardScene(battle, activeUnit, isPlacementPhase);

  // Exit battle button
  const exitBtn = document.getElementById("exitBattleBtn");
  if (exitBtn) {
    exitBtn.onclick = () => {
      if (isEchoBattle(battle)) {
        openBattleExitConfirm();
        return;
      }

      cleanupBattlePanHandlers();
      teardownBattleHud();
      resetBattleUiSessionState();

      // If in endless mode, exit to base camp with summary
      if (isEndlessBattleMode) {
        console.log(`[ENDLESS BATTLE] Exiting after ${endlessBattleCount} battles`);
        const finalCount = endlessBattleCount;
        isEndlessBattleMode = false;
        endlessBattleCount = 0;

        // Show summary and return to base camp
        alert(`Endless Battle Mode Exited!\nBattles Completed: ${finalCount - 1}`);
        import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
          renderFieldScreen("base_camp");
        });
      } else {
        returnFromBattle(battle);
      }
    };
  }

  const debugAutoWinBtn = document.getElementById("debugAutoWinBtn");
  if (debugAutoWinBtn) {
    debugAutoWinBtn.onclick = () => {
      handleBattleHudDebugAutoWin();
    };
  }

  document.querySelectorAll<HTMLElement>("[data-battle-exit-confirm-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const action = button.getAttribute("data-battle-exit-confirm-action");
      if (action === "accept") {
        resolveBattleExitConfirm(battle);
      } else {
        closeBattleExitConfirm();
      }
    });
  });

  document.getElementById("battleExitConfirmModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeBattleExitConfirm();
    }
  });

  // Toggle UI panels button
  const toggleUiBtn = document.getElementById("toggleUiBtn");
  if (toggleUiBtn) {
    toggleUiBtn.onclick = () => {
      toggleUiPanels();
    };
  }

  // Reset pan button
  document.querySelectorAll<HTMLElement>("#resetBattlePanBtn").forEach((resetPanBtn) => {
    resetPanBtn.onclick = () => {
      resetBattlePan();
    };
  });

  document.querySelectorAll<HTMLElement>("[data-battle-view-index]").forEach((viewBtn) => {
    viewBtn.onclick = (event) => {
      event.preventDefault();
      const nextIndex = Number.parseInt(viewBtn.dataset.battleViewIndex ?? "", 10);
      if (!Number.isFinite(nextIndex)) {
        return;
      }
      activateBattleViewPreset(nextIndex);
    };
  });

  document.querySelectorAll<HTMLElement>("[data-battle-manage-unit-id]").forEach((unitRow) => {
    unitRow.onclick = (event) => {
      event.preventDefault();
      const unitId = unitRow.dataset.battleManageUnitId;
      if (!unitId || unitId === selectedManageUnitId) {
        return;
      }

      selectedManageUnitId = unitId;
      renderBattleScreen();
    };
  });


  // Card selection
  document.querySelectorAll(".battle-cardui").forEach(el => {
    (el as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const i = parseInt((el as HTMLElement).dataset.cardIndex ?? "-1");
      if (i >= 0) {
        handleBattleHudCardSelection(i);
      }
    };
  });

  // Placement phase handlers
  if (isPlacementPhase) {
    console.log("[BATTLE] Setting up placement phase handlers");
    const echoPlacementContext = getEchoContext(localBattleState);
    const isEchoFieldPlacementMode = echoPlacementContext?.placementMode === "fields";
    const isClientNetworkPlacement = Boolean(
      localBattleState
      && (isSquadBattle(localBattleState) || isCoopOperationsBattle(localBattleState))
      && getGameState().session.authorityRole === "client",
    );
    // Quick Place button
    const quickPlaceBtn = document.getElementById("quickPlaceBtn");
    if (quickPlaceBtn && !isEchoFieldPlacementMode) {
      console.log("[BATTLE] Quick Place button found, attaching handler");
      quickPlaceBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[BATTLE] Quick Place button clicked");
        if (!localBattleState) return;
        if (isClientNetworkPlacement) {
          await sendLocalNetworkPlacementCommand({ type: "quick_place" });
          return;
        }
        const selectedUnitId = localBattleState.placementState?.selectedUnitId ?? null;
        const selectedController = selectedUnitId
          && canLocalControlBattleUnit(localBattleState, localBattleState.units[selectedUnitId] ?? null)
            ? (localBattleState.units[selectedUnitId]?.controller ?? "P1")
            : isSquadBattle(localBattleState)
              ? getLocalSquadSlot(localBattleState)
              : undefined;
        let newState = quickPlaceUnits(localBattleState, toLocalUnitOwnership(selectedController));
        setBattleState(newState);
        renderBattleScreen();
      });
    } else {
      console.warn("[BATTLE] Quick Place button NOT found");
    }

    // Confirm button
    const confirmBtn = document.getElementById("confirmPlacementBtn");
    if (confirmBtn) {
      console.log("[BATTLE] Confirm button found, attaching handler");
      confirmBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[BATTLE] Confirm button clicked");
        if (!localBattleState) return;
        if (isClientNetworkPlacement) {
          showSystemPing({
            type: "info",
            title: "HOST CONTROLS FINAL DEPLOYMENT",
            message: "Wait for the host to finalize network battle deployment.",
            durationMs: 2200,
            channel: "network-placement-host",
            replaceChannel: true,
          });
          return;
        }
        let newState = localBattleState;
        const currentEchoContext = getEchoContext(localBattleState);
        if (currentEchoContext?.placementMode === "units" && currentEchoContext.availableFields.length > 0) {
          newState = setEchoPlacementMode(localBattleState, "fields");
          if (!getEchoContext(newState)?.selectedFieldDraftId && currentEchoContext.availableFields[0]?.draftId) {
            newState = selectEchoPlacementField(newState, currentEchoContext.availableFields[0].draftId);
          }
          setBattleState(newState);
          renderBattleScreen();
          return;
        }

        let pendingFields = getUnplacedEchoFields(localBattleState);
        if (currentEchoContext?.placementMode === "fields" && pendingFields.length > 0) {
          return;
        }

        newState = confirmPlacement(localBattleState);
        setBattleState(newState);
        // Reset turn state for first active unit
        if (newState.activeUnitId) {
          const firstUnit = newState.units[newState.activeUnitId];
          resetTurnStateForUnit(firstUnit, newState);
        }
        // Run enemy turns if starting unit is enemy
        if (shouldAutoResolveBattleState(newState)) {
          console.log("[BATTLE] Starting enemy turn sequence after placement");
          runEnemyTurnsAnimated(newState);
          return;
        }

        renderBattleScreen();
      });
    } else {
      console.warn("[BATTLE] Confirm button NOT found");
    }

    const editUnitPlacementBtn = document.getElementById("editUnitPlacementBtn");
    if (editUnitPlacementBtn) {
      editUnitPlacementBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!localBattleState) return;
        const newState = setEchoPlacementMode(localBattleState, "units");
        setBattleState(newState);
        renderBattleScreen();
      });
    }

    const placementPanel = document.querySelector('.battle-node[data-battle-node-id="placement"] .battle-placement-panel');
    if (placementPanel) {
      const oldPanelHandler = (placementPanel as any).__placementPanelHandler;
      if (oldPanelHandler) {
        placementPanel.removeEventListener("click", oldPanelHandler);
      }

      const placementPanelHandler = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        mouseEvent.stopPropagation();
        const fieldItem = (mouseEvent.target as HTMLElement).closest(".placement-field-item") as HTMLElement | null;
        if (fieldItem && localBattleState) {
          mouseEvent.preventDefault();
          const draftId = fieldItem.getAttribute("data-echo-field-draft-id");
          if (draftId) {
            const newState = selectEchoPlacementField(localBattleState, draftId);
            setBattleState(newState);
            renderBattleScreen();
          }
          return;
        }

        const unitItem = (mouseEvent.target as HTMLElement).closest(".placement-unit-item") as HTMLElement;
        if (unitItem && localBattleState && localBattleState.placementState) {
          mouseEvent.preventDefault();

          const unitId = unitItem.getAttribute("data-unit-id");
          const isPlaced = unitItem.getAttribute("data-placed") === "true";

          if (unitId) {
            if (isPlaced) {
              if (isClientNetworkPlacement) {
                void sendLocalNetworkPlacementCommand({ type: "remove_placed_unit", unitId });
                return;
              }
              const newState = unplaceBattleUnit(localBattleState, unitId);
              setBattleState(newState);
              renderBattleScreen();
            } else {
              const newState = selectBattlePlacementUnit(localBattleState, unitId);
              setBattleState(newState);
              renderBattleScreen();
              if (isClientNetworkPlacement) {
                void sendLocalNetworkPlacementCommand({ type: "select_placement_unit", unitId });
              }
            }
          }
        }
      };

      (placementPanel as any).__placementPanelHandler = placementPanelHandler;
      placementPanel.addEventListener("click", placementPanelHandler);
    }

    getBattleSceneControllerInstance().setInteractionHandlers({
      onPrimaryPick: (pick) => handleBattleBoardPlacementPick(pick, battle, isClientNetworkPlacement),
      onHoverTile: (tile) => updateHoveredBattleTile(tile),
    });

    // Don't attach normal battle listeners during placement
    return;
  }

  getBattleSceneControllerInstance().setInteractionHandlers({
    onPrimaryPick: (pick) => handleBattleBoardActionPick(pick, battle, activeUnit, isPlayerTurn),
    onHoverTile: (tile) => updateHoveredBattleTile(tile),
  });

  // OLD TILE CLICK HANDLER - REMOVED (replaced by new grid click handler system above)

  // Undo move button
  const undoBtn = document.getElementById("undoMoveBtn");
  if (undoBtn) {
    undoBtn.onclick = () => {
      handleBattleHudUndoMove();
    };
  }

  const interactBtn = document.getElementById("interactBtn");
  if (interactBtn) {
    interactBtn.onclick = () => {
      if (!localBattleState?.activeUnitId) {
        return;
      }
      const activeUnit = localBattleState.units[localBattleState.activeUnitId];
      if (!activeUnit || !canUnitInteract(localBattleState, activeUnit)) {
        return;
      }
      const nextState = interactWithMapObject(localBattleState, activeUnit.id);
      setBattleState(nextState);
      renderBattleScreen();
    };
  }

  document.querySelectorAll<HTMLElement>("[data-battle-auto-mode]").forEach((button) => {
    button.onclick = () => {
      const mode = button.getAttribute("data-battle-auto-mode");
      const unitId = button.getAttribute("data-unit-id");
      if (!unitId || (mode !== "manual" && mode !== "undaring" && mode !== "daring")) {
        return;
      }
      setBattleUnitAutoMode(unitId, mode);
    };
  });

  const endTurnBtn = document.getElementById("endTurnBtn");
  if (endTurnBtn) {
    endTurnBtn.onclick = () => {
      handleBattleHudEndTurn();
    };
  }

  document.querySelectorAll<HTMLElement>("[data-battle-consumable-use]").forEach((button) => {
    button.onclick = () => {
      const consumableId = button.getAttribute("data-battle-consumable-use");
      const targetId = button.getAttribute("data-battle-consumable-target");
      if (!consumableId || !targetId) {
        return;
      }
      handleBattleHudConsumableUse(consumableId, targetId);
    };
  });

  // Training continue button (for training battles)
  const trainingContinueBtn = document.getElementById("trainingContinueBtn");
  if (trainingContinueBtn) {
    lockResultButtonUntilReady(trainingContinueBtn);
    trainingContinueBtn.onclick = () => {
      if (!isBattleResultInputReady()) {
        return;
      }
      if (localBattleState) {
        handleTrainingBattleComplete(localBattleState);
      }
    };
  }

  const echoContinueBtn = document.getElementById("echoContinueBtn");
  if (echoContinueBtn) {
    lockResultButtonUntilReady(echoContinueBtn);
    echoContinueBtn.onclick = () => {
      if (!isBattleResultInputReady() || !localBattleState) {
        return;
      }
      commitEchoEncounterVictory(localBattleState);
      cleanupBattlePanHandlers();
      teardownBattleHud();
      resetBattleUiSessionState();
      updateGameState((prev) => ({
        ...prev,
        phase: "echo",
        currentBattle: null,
      }));
      import("./EchoRunScreen").then(({ renderEchoRunScreen }) => {
        renderEchoRunScreen();
      });
    };
  }

  const echoResultsBtn = document.getElementById("echoResultsBtn");
  if (echoResultsBtn) {
    lockResultButtonUntilReady(echoResultsBtn);
    echoResultsBtn.onclick = () => {
      if (!isBattleResultInputReady() || !localBattleState) {
        return;
      }
      finalizeEchoRunFromBattleDefeat(localBattleState);
      cleanupBattlePanHandlers();
      teardownBattleHud();
      resetBattleUiSessionState();
      updateGameState((prev) => ({
        ...prev,
        phase: "echo",
        currentBattle: null,
      }));
      import("./EchoRunScreen").then(({ renderEchoRunScreen }) => {
        renderEchoRunScreen();
      });
    };
  }

  const squadReturnBtn = document.getElementById("squadReturnBtn");
  if (squadReturnBtn) {
    lockResultButtonUntilReady(squadReturnBtn);
    squadReturnBtn.onclick = () => {
      if (!isBattleResultInputReady()) {
        return;
      }
      cleanupBattlePanHandlers();
      teardownBattleHud();
      resetBattleUiSessionState();
      updateGameState((prev) => ({
        ...prev,
        currentBattle: null,
        phase: "shell",
      }));
      import("./CommsArrayScreen").then(({ renderActiveSkirmishScreen }) => {
        renderActiveSkirmishScreen("basecamp");
      });
    };
  }

  // Claim rewards button - use both onclick and addEventListener for maximum reliability
  // Only look for button if battle phase is victory or defeat
  const claimBtn = (battle.phase === "victory" || battle.phase === "defeat")
    ? document.getElementById("claimRewardsBtn")
    : null;
  if (claimBtn) {
    console.log("[BATTLE] Found claim rewards button, attaching handlers");
    lockResultButtonUntilReady(claimBtn);

    // Clear any existing handlers
    claimBtn.onclick = null;

    // Use onclick as primary handler (more reliable)
    claimBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isBattleResultInputReady()) {
        console.log("[BATTLE] Result input gate still cooling down; ignoring stale click.");
        return;
      }
      console.log("[BATTLE] Claim rewards button clicked (onclick)");

      if (!localBattleState) {
        console.warn("[BATTLE] No battle state when claiming rewards");
        return;
      }

      const r = localBattleState.rewards;
      if (!r) {
        console.warn("[BATTLE] No rewards to claim");
        return;
      }

      // Block rewards for training battles
      const isTraining = (localBattleState as any).isTraining === true;
      if (isTraining) {
        console.warn("[TRAINING_NO_REWARDS] blocked reward grant");
        // Show training completion screen instead
        handleTrainingBattleComplete(localBattleState);
        return;
      }

      console.log("[BATTLE] Claiming rewards:", r);

      try {
        // Handle recipe reward if present
        if (r.recipe === "pending") {
          // Generate a random unknown recipe
          import("../../core/crafting").then(({ RECIPE_DATABASE, learnRecipe }) => {
            const state = getGameState();
            const allRecipes = Object.values(RECIPE_DATABASE);
            const knownRecipeIds = state.knownRecipeIds || [];
            const unknownRecipes = allRecipes.filter(r => !r.starterRecipe && !knownRecipeIds.includes(r.id));
            if (unknownRecipes.length > 0) {
              const randomRecipe = unknownRecipes[Math.floor(Math.random() * unknownRecipes.length)];
              updateGameState(s => ({
                ...s,
                knownRecipeIds: learnRecipe(s.knownRecipeIds || [], randomRecipe.id),
              }));
              console.log(`[BATTLE] Learned recipe: ${randomRecipe.name}`);
            }
          }).catch(err => {
            console.warn("[BATTLE] Could not grant recipe reward:", err);
          });
        }

        updateGameState(s => {
          const rewardedState = grantSessionResources(s, {
            wad: r.wad ?? 0,
            resources: createEmptyResourceWallet({
              metalScrap: r.metalScrap ?? 0,
              wood: r.wood ?? 0,
              chaosShards: r.chaosShards ?? 0,
              steamComponents: r.steamComponents ?? 0,
            }),
          });

          const updatedState = awardStatTokens({
            ...rewardedState,
            cardLibrary: r.cards && r.cards.length > 0
              ? addCardsToLibrary(rewardedState.cardLibrary ?? {}, r.cards)
              : rewardedState.cardLibrary,
          }, r.squadXp ?? 0);

          // Grant unlockable if present
          if ((r as any).unlockable) {
            import("../../core/unlockableOwnership").then(({ grantUnlock }) => {
              grantUnlock((r as any).unlockable, "battle_reward");
            }).catch(err => {
              console.warn("[BATTLE] Could not grant unlockable reward:", err);
            });
          }

          return updatedState;
        });

        // Block quest progress for training battles (isTraining already declared above)
        if (!isTraining) {
          // Update quest progress for battle completion
          // Count enemies defeated (estimate from rewards or battle state)
          const enemyCount = Math.max(1, Math.floor((r.wad || 0) / 10)); // Rough estimate
          updateQuestProgress("kill_enemies", enemyCount, enemyCount);
          updateQuestProgress("complete_battle", "any", 1);

          // Update resource collection quests
          if (r.metalScrap) updateQuestProgress("collect_resource", "metalScrap", r.metalScrap);
          if (r.wood) updateQuestProgress("collect_resource", "wood", r.wood);
          if (r.chaosShards) updateQuestProgress("collect_resource", "chaosShards", r.chaosShards);
          if (r.steamComponents) updateQuestProgress("collect_resource", "steamComponents", r.steamComponents);

          // Track survival affinity for all units that survived
          trackBattleSurvival(localBattleState, true);
        } else {
          console.warn("[TRAINING_NO_REWARDS] blocked quest progress update");
        }

        // Block campaign progress for training battles (isTraining already declared above)
        if (!isTraining) {
          // Mark battle as won in campaign system (synchronous to ensure state is updated before render)
          try {
            // Check if this was a defense battle
            const isDefenseBattle = localBattleState.defenseObjective?.type === "survive_turns";
            if (hasTheaterOperation(getGameState().operation)) {
              updateGameState((s) => applyTheaterBattleOutcome(s, localBattleState!));
            } else if (isDefenseBattle && (window as any).__defenseKeyRoomId) {
              // Record defense victory
              import("../../core/campaignManager").then(m => {
                m.recordDefenseVictory((window as any).__defenseKeyRoomId);
                syncCampaignToGameState();
              });
              // Clear defense flags
              (window as any).__isDefenseBattle = false;
              (window as any).__defenseKeyRoomId = undefined;
            } else {
              recordBattleVictory();
              syncCampaignToGameState();
            }
          } catch (error) {
            // Fallback if campaign system not available (e.g., no active run)
            console.warn("[BATTLE] Campaign system error, using fallback:", error);
            if (hasTheaterOperation(getGameState().operation)) {
              updateGameState((s) => applyTheaterBattleOutcome(s, localBattleState!));
            } else {
              markCurrentOperationRoomVisited();
            }
          }
        } else {
          console.warn("[TRAINING_NO_REWARDS] blocked campaign progress update");
        }

        console.log("[BATTLE] Rewards claimed successfully");
      } catch (error) {
        console.error("[BATTLE] Error claiming rewards:", error);
        alert(`Error claiming rewards: ${error}`);
        return;
      }

      cleanupBattlePanHandlers();
      teardownBattleHud();
      resetBattleUiSessionState();

      // Check if this was a special battle type
      const isEliteBattle = (window as any).__isEliteBattle || false;
      const eliteRoomId = (window as any).__eliteRoomId;
      const isKeyRoomCapture = (window as any).__isKeyRoomCapture || false;
      const keyRoomNodeId = (window as any).__keyRoomNodeId;

      // Clear campaign flags
      (window as any).__isCampaignRun = false;
      (window as any).__isEliteBattle = false;
      (window as any).__eliteRoomId = undefined;
      (window as any).__isKeyRoomCapture = false;
      (window as any).__keyRoomNodeId = undefined;

      // Check if this was a training battle (should have been handled earlier, but double-check)
      // isTraining is already declared above, so just check it
      if (isTraining) {
        // Training battle - should have been handled by handleTrainingBattleComplete
        // But if we reach here, route to Comms Array
        const returnTo = (battle as any)?.returnTo || "basecamp";
        renderBattleReturnDestination(returnTo);
        return;
      }

      // If in endless mode, start next battle instead of returning to operation map
      if (isEndlessBattleMode) {
        startNextEndlessBattle();
      } else if (isKeyRoomCapture && keyRoomNodeId) {
        // Key Room capture - show facility selection screen
        import("./FacilitySelectionScreen").then(m => {
          m.renderFacilitySelectionScreen(keyRoomNodeId);
        });
      } else if (isEliteBattle && eliteRoomId) {
        // Elite battle victory - show Field Mod reward screen
        import("./FieldModRewardScreen").then(m => {
          const activeRun = getActiveRun();
          if (activeRun) {
            const rewardSeed = `${activeRun.rngSeed}_elite_${eliteRoomId}`;
            m.renderFieldModRewardScreen(eliteRoomId, rewardSeed, true); // true = elite weights
          } else {
            renderOperationMap();
          }
        });
      } else {
        renderOperationMap();
      }
    };

    // Ensure button is clickable
    claimBtn.style.pointerEvents = isBattleResultInputReady() ? "auto" : "none";
    claimBtn.style.cursor = "pointer";
    claimBtn.style.zIndex = "1001";
  } else if ((battle.phase === "victory" || battle.phase === "defeat") && !isEchoBattle(battle) && !isSquadBattle(battle)) {
    // Only warn if we're in victory/defeat phase but button is missing (actual bug)
    console.warn("[BATTLE] Claim rewards button not found in DOM despite battle phase:", battle.phase);
  }

  // Defeat handlers - retry or abandon
  const retryBtn = document.getElementById("retryRoomBtn");
  if (retryBtn) {
    lockResultButtonUntilReady(retryBtn);
    retryBtn.onclick = () => {
      if (!isBattleResultInputReady()) {
        return;
      }
      // Check if this is a defense battle
      const isDefenseBattle = (window as any).__isDefenseBattle || false;

      // Record defeat (increments retry counter)
      import("../../core/campaignManager").then(m => {
        if (isDefenseBattle) {
          m.recordDefenseDefeat();
        } else {
          m.recordBattleDefeat();
        }

        // Cleanup UI state
        cleanupBattlePanHandlers();
        teardownBattleHud();
        resetBattleUiSessionState();

        // Re-enter battle (will use same encounter from pendingBattle or pendingDefenseBattle)
        const activeRun = m.getActiveRun();

        if (isDefenseBattle && activeRun?.pendingDefenseBattle) {
          // Re-create defense battle from same encounter
          import("../../core/defenseBattleGenerator").then(({ createDefenseBattle }) => {
            const state = getGameState();
            const { keyRoomId, turnsToSurvive, encounterSeed } = activeRun.pendingDefenseBattle!;
            const battle = createDefenseBattle(state, keyRoomId, turnsToSurvive, encounterSeed);
            if (battle) {
              updateGameState(prev => ({
                ...prev,
                currentBattle: battle,
                phase: "battle",
              }));
              renderBattleScreen();
            }
          });
        } else if (activeRun?.pendingBattle) {
          // Re-create normal battle from same encounter
          const state = getGameState();
          const battle = createBattleFromEncounter(state, activeRun.pendingBattle.encounterDefinition);
          updateGameState(prev => ({
            ...prev,
            currentBattle: battle,
            phase: "battle",
          }));
          renderBattleScreen();
        }
      });
    };
  }

  const abandonBtn = document.getElementById("abandonRunBtn");
  if (abandonBtn) {
    lockResultButtonUntilReady(abandonBtn);
    abandonBtn.onclick = () => {
      if (!isBattleResultInputReady()) {
        return;
      }
      import("../../core/campaignManager").then(m => {
        m.abandonRun();
        m.syncCampaignToGameState?.();
      });
      cleanupBattlePanHandlers();
      teardownBattleHud();
      resetBattleUiSessionState();
      import("../screens/OperationSelectScreen").then(m => m.renderOperationSelectScreen());
    };
  }

  const defeatBtn = document.getElementById("defeatReturnBtn");
  if (defeatBtn) {
    lockResultButtonUntilReady(defeatBtn);
    defeatBtn.onclick = () => {
      if (!isBattleResultInputReady()) {
        return;
      }
      cleanupBattlePanHandlers();
      teardownBattleHud();
      resetBattleUiSessionState();

      if (isEndlessBattleMode) {
        console.log(`[ENDLESS BATTLE] Defeated after ${endlessBattleCount} battles`);
        isEndlessBattleMode = false;
        endlessBattleCount = 0;
      }
      const isTheaterOperationBattle = Boolean(battle.theaterMeta && hasTheaterOperation(getGameState().operation));
      if (isTheaterOperationBattle) {
        updateGameState((state) => ({
          ...applyTheaterOperationFailure(state, battle),
          phase: "field",
        }));
        import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
          renderFieldScreen("base_camp");
          showSystemPing({
            title: "OPERATION FAILED",
            message: "The deployed team was forced back to HAVEN.",
            detail: "Theater progress was preserved. Deployed units returned Shaken until they recover.",
            type: "error",
            channel: "operation-failure",
            durationMs: 3600,
          });
        });
        return;
      }
      if (hasTheaterOperation(getGameState().operation)) {
        updateGameState((s) => applyTheaterBattleOutcome(s, battle));
      }
      returnFromBattle(battle);
    };
  }

  // Scroll battle log to bottom
  const log = document.getElementById("battleLog");
  if (log) log.scrollTop = log.scrollHeight;

  document.querySelectorAll<HTMLElement>("[data-clutch-id]").forEach((button) => {
    const clutchId = button.dataset.clutchId;
    if (!clutchId || button.hasAttribute("disabled")) {
      return;
    }
    button.onclick = () => {
      handleBattleHudClutchToggle(clutchId);
    };
  });

  document.getElementById("quickReloadBtn")?.addEventListener("click", () => {
    handleBattleHudQuickReload();
  });
  document.getElementById("fullReloadBtn")?.addEventListener("click", () => {
    handleBattleHudFullReload();
  });
  document.getElementById("fieldPatchBtn")?.addEventListener("click", () => {
    handleBattleHudFieldPatch();
  });
  document.getElementById("ventBtn")?.addEventListener("click", () => {
    handleBattleHudVent();
  });
}

// ============================================================================
// ENEMY TURN HELPER - Runs enemy turns with animation
// ============================================================================

function runEnemyTurns(state: BattleState): BattleState {
  if (state.phase !== "player_turn" && state.phase !== "enemy_turn") return state;

  let currentState = state;
  let safety = 0;

  while (safety < 20) {
    const active = currentState.activeUnitId ? currentState.units[currentState.activeUnitId] : null;

    if (!active || active.hp <= 0) {
      // Unit is dead, remove it and check for victory
      currentState = advanceTurn(currentState);
      // Explicitly check for victory after removing dead unit
      currentState = evaluateBattleOutcome(currentState);
      if (currentState.phase === "victory" || currentState.phase === "defeat") {
        break;
      }
      safety++;
      continue;
    }

    if (!shouldAutoResolveBattleState(currentState)) {
      // Player's turn - reset their movement
      resetTurnStateForUnit(active, currentState);
      break;
    }

    // Process exactly ONE enemy turn then exit the function.
    // The animated loop in runEnemyTurnsAnimated will handle scheduling the next turn
    // after a delay, creating a "one at a time" sequence.
    currentState = performEnemyTurn(currentState);
    // CRITICAL: Explicitly check for victory/defeat after enemy turn
    // This ensures victory is detected even if evaluateBattleOutcome wasn't called
    currentState = evaluateBattleOutcome(currentState);
    // Queue animation if position changed (will be handled by re-render for now)
    // The animation will happen on next render cycle

    if (currentState.phase === "victory" || currentState.phase === "defeat") {
      console.log(`[BATTLE] Battle ended during enemy turn: ${currentState.phase}`);
      break;
    }

    safety++;
    break;
  }

  return currentState;
}

/**
 * Runs enemy turns with animation and UI updates
 */
function runEnemyTurnsAnimated(state: BattleState): void {
  if (isAnimatingEnemyTurn) return;
  isAnimatingEnemyTurn = true; // Set block immediately

  const activeId = state.activeUnitId;
  const oldUnit = activeId ? state.units[activeId] : null;
  const oldPos = oldUnit ? oldUnit.pos : null;

  const newState = runEnemyTurns(state);
  const newUnit = activeId ? newState.units[activeId] : null;
  const newPos = newUnit ? newUnit.pos : null;

  const hasMoved = oldPos && newPos && (oldPos.x !== newPos.x || oldPos.y !== newPos.y);
  const enemyAttackTargetId = activeId ? inferEnemyAttackAnimationTarget(state, newState, activeId) : null;

  if (hasMoved && activeId && oldPos && newPos) {
    const path: Vec2[] = [oldPos, newPos];

    // Animate movement using old state as reference (so initial position is correct)
    startMovementAnimation(activeId, path, state, () => {
      // Apply the final state and render after animation
      setBattleState(newState);
      renderBattleScreen();

      // Schedule next turn
      if (shouldAutoResolveBattleState(newState)) {
        setTimeout(() => {
          isAnimatingEnemyTurn = false;
          console.log("[BATTLE] Animating next enemy turn step...");
          runEnemyTurnsAnimated(newState);
        }, 500); // Shorter delay since animation took some time
      } else {
        isAnimatingEnemyTurn = false;
        // renderBattleScreen() already called above
      }
    });
  } else if (activeId && enemyAttackTargetId) {
    startAttackBumpAnimation(state, activeId, enemyAttackTargetId, () => {
      setBattleState(newState);

      if (shouldAutoResolveBattleState(newState)) {
        renderBattleScreen();
        setTimeout(() => {
          isAnimatingEnemyTurn = false;
          console.log("[BATTLE] Animating next enemy turn step...");
          runEnemyTurnsAnimated(newState);
        }, 550);
      } else {
        isAnimatingEnemyTurn = false;
        renderBattleScreen();
      }
    });
  } else {
    // No movement (e.g., attack or skip) - apply state and wait
    setBattleState(newState);

    // If next unit is still an enemy, schedule another turn
    if (shouldAutoResolveBattleState(newState)) {
      setTimeout(() => {
        isAnimatingEnemyTurn = false; // Clear block briefly for next recursive call
        console.log("[BATTLE] Animating next enemy turn step...");
        runEnemyTurnsAnimated(newState);
      }, 1500); // 1.5s delay per enemy action for clarity
    } else {
      isAnimatingEnemyTurn = false; // Final clear
      renderBattleScreen();
    }
  }
}

/**
 * Endless Mode helper
 */
export function startEndlessBattleMode(): void {
  const state = getGameState();
  const battle = createTestBattleForCurrentParty(state);
  if (!battle) {
    console.error("[ENDLESS] Failed to create initial battle");
    alert("Endless Battle Mode requires at least one deployed unit.");
    return;
  }

  isEndlessBattleMode = true;
  endlessBattleCount = 1;
  setBattleState(battle);
  renderBattleScreen();
}

function startNextEndlessBattle(): void {
  endlessBattleCount++;
  const state = getGameState();
  const newBattle = createTestBattleForCurrentParty(state);
  if (newBattle) {
    setBattleState(newBattle);
    renderBattleScreen();
  } else {
    console.error("[ENDLESS] Failed to create next battle");
    exitEndlessBattleMode();
  }
}



// runEnemyTurnsAnimated was here but seems to be missing or merged - assuming it's managed via runEnemyTurns


/**
 * Handle training battle completion - show rematch/change settings/return options
 */
function handleTrainingBattleComplete(battle: BattleState): void {
  const trainingConfig = (battle as any).trainingConfig;
  const returnTo = (battle as any).returnTo || "basecamp";

  // Cleanup battle state
  cleanupBattlePanHandlers();
  teardownBattleHud();
  resetBattleUiSessionState();

  // Show training completion screen
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="training-complete-screen">
      <div class="training-complete-header">
        <h1 class="training-complete-title">TRAINING COMPLETE</h1>
        <div class="training-complete-subtitle">Simulation ended successfully</div>
      </div>
      
      <div class="training-complete-content">
        <div class="training-complete-message">
          <p>Training battle completed. No rewards were granted (training mode).</p>
        </div>
        
        <div class="training-complete-actions">
          <button class="training-action-btn training-action-btn--primary" id="rematchBtn">
            REMATCH
          </button>
          <button class="training-action-btn" id="changeSettingsBtn">
            CHANGE SETTINGS
          </button>
          <button class="training-action-btn" id="returnToBaseBtn">
            RETURN TO BASE CAMP
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach handlers
  const rematchBtn = document.getElementById("rematchBtn");
  if (rematchBtn) {
    rematchBtn.onclick = () => {
      if (returnTo === "map_builder") {
        import("./MapBuilderScreen").then(({ relaunchMapBuilderQuickTest }) => {
          relaunchMapBuilderQuickTest();
        });
        return;
      }
      // Use stored training config to start a new battle directly
      import("./CommsArrayScreen").then(({ getLastTrainingConfig }) => {
        const lastConfig = getLastTrainingConfig();
        if (lastConfig && trainingConfig) {
          const state = getGameState();
          const nextBattle = createTrainingBattle(state, lastConfig, `training_${Date.now()}`);
          if (nextBattle) {
            (nextBattle as any).returnTo = returnTo;
            updateGameState((prev) => ({
              ...prev,
              currentBattle: nextBattle,
              phase: "battle",
            }));
            renderBattleScreen();
            return;
          }
          renderBattleReturnDestination(returnTo);
        } else {
          renderBattleReturnDestination(returnTo);
        }
      });
    };
  }

  const changeSettingsBtn = document.getElementById("changeSettingsBtn");
  if (changeSettingsBtn) {
    changeSettingsBtn.onclick = () => {
      renderBattleReturnDestination(returnTo);
    };
  }

  const returnToBaseBtn = document.getElementById("returnToBaseBtn");
  if (returnToBaseBtn) {
    returnToBaseBtn.onclick = () => {
      renderBattleReturnDestination(returnTo);
    };
  }
}

/**
 * Exit endless battle mode and return to base camp
 */
export function exitEndlessBattleMode(): void {
  console.log(`[ENDLESS BATTLE] Exiting after ${endlessBattleCount} battles`);

  cleanupBattlePanHandlers();
  teardownBattleHud();
  resetBattleUiSessionState();
  isEndlessBattleMode = false;

  const finalCount = endlessBattleCount;
  endlessBattleCount = 0;

  // Show exit message
  alert(`Endless Battle Mode Complete!\nBattles Won: ${finalCount}`);

  import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
    renderFieldScreen("base_camp");
  });
}
