// ============================================================================
// FIELD SYSTEM - FIELD MODE SCREEN
// ============================================================================

import "./field.css";
import { FieldEnemy, FieldMap, FieldNpc, FieldObject, FieldProjectile, FieldState, InteractionZone, PlayerAvatar } from "./types";
import { getImportedItem } from "../content/technica";
import { getFieldMap } from "./maps";
import {
  createPlayerAvatar,
  updatePlayerMovement,
  getOverlappingInteractionZone,
} from "./player";
import { Haven3DFieldController, type Haven3DFieldCameraState } from "./haven3d/Haven3DFieldController";
import {
  resolveHaven3DGearbladeDamage,
  type Haven3DEnemyDefense,
} from "./haven3d/combatRules";
import {
  getHaven3DEnemyAttackLabel,
  getHaven3DEnemyAttackProfile,
} from "./haven3d/enemyMoves";
import type { Haven3DGearbladeMode } from "./haven3d/coordinates";
import { handleInteraction, getInteractionZone } from "./interactions";
import { getGameState, updateGameState } from "../state/gameStore";
import { showAlertDialog } from "../ui/components/confirmDialog";
import {
  checkCompanionReachedTarget,
  createCompanion,
  findNearestResource,
  updateCompanion,
  updateCompanionFetch,
  updateCompanionFollow,
} from "./companion";
import { isEnemyFieldObject, syncFieldEnemiesForMap } from "./enemies";
import { updateNpc, getNpcInRange, getFieldNpcsForMap, NPC_DIALOGUE } from "./npcs";
import {
  getPlayerInput,
  getPlayerActionLabel,
  handleKeyDown as handlePlayerInputKeyDown,
  handleKeyUp as handlePlayerInputKeyUp,
  isPlayerInputActionEvent,
  resetPlayerInput,
} from "../core/playerInput";
import {
  clearControllerContext,
  getAssignedGamepad,
  isGamepadActionActive,
  registerControllerContext,
  updateFocusableElements,
} from "../core/controllerSupport";
import { tryJoinAsP2, dropOutP2, applyTetherConstraint } from "../core/coop";
import { resolvePlayerSpawn, SpawnSource } from "./spawnResolver";
import {
  NETWORK_PLAYER_SLOTS,
  SESSION_PLAYER_SLOTS,
  type BaseCampLayoutLoadout,
  type BaseCampPinnedItemFrame,
  type FieldAvatar,
  type GameState,
  type LobbyState,
  type NetworkPlayerSlot,
  type PlayerId,
  type SkirmishObjectiveType,
} from "../core/types";
import { setBaseCampFieldReturnMap } from "../ui/screens/baseCampReturn";
import { getDispatchState } from "../core/dispatchSystem";
import { getStatBank, STAT_SHORT_LABEL } from "../core/statTokens";
import {
  BLACK_MARKET_UNLOCK_FLOOR_ORDINAL,
  DISPATCH_UNLOCK_FLOOR_ORDINAL,
  FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL,
  HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL,
  PORT_UNLOCK_FLOOR_ORDINAL,
  SCHEMA_UNLOCK_FLOOR_ORDINAL,
  STABLE_UNLOCK_FLOOR_ORDINAL,
  isBlackMarketNodeUnlocked,
  isDispatchNodeUnlocked,
  isFoundryAnnexUnlocked,
  isHavenBuildModeUnlocked,
  isPortNodeUnlocked,
  isSchemaNodeUnlocked,
  isStableNodeUnlocked,
} from "../core/campaign";
import {
  BASIC_RESOURCE_KEYS,
  RESOURCE_SHORT_LABELS,
  createEmptyResourceWallet,
  getResourceEntries,
  type ResourceKey,
  type ResourceWallet,
} from "../core/resources";
import {
  canCraftMaterialRefineryRecipe,
  countAdvancedMaterialOwned,
  craftMaterialRefineryRecipe,
  getMaterialRefineryRecipe,
  getMaterialRefineryRecipes,
  getMaterialRefineryShortage,
  type AdvancedMaterialId,
  type MaterialRefineryContext,
} from "../core/materialRefinery";
import {
  BOWBLADE_BASE_ATTACK_CYCLE_MS,
  BOWBLADE_BASE_MAX_ENERGY_CELLS,
  BOWBLADE_BASE_MELEE_CHARGE_GAIN,
  BOWBLADE_BASE_MELEE_DAMAGE,
  BOWBLADE_BASE_MELEE_KNOCKBACK_FORCE,
  BOWBLADE_BASE_PROJECTILE_SPEED,
  BOWBLADE_BASE_RANGED_DAMAGE,
  BOWBLADE_BASE_RANGED_RANGE,
  BOWBLADE_MIN_ATTACK_CYCLE_MS,
  getBowbladeFieldProfile,
} from "../core/weaponsmith";
import { getAerissFieldMovementSpeedBonus } from "../core/mounts";
import {
  canPlayerUseFieldAction,
  getFieldActionRestrictionMessage,
  grantSessionResources,
  getPlayerControllerLabel,
  isLocalCoopActive,
} from "../core/session";
import {
  attachNotesWidgetHandlers,
  attachStuckNoteHandlers,
  NOTES_LAYOUT_ID,
  renderNotesWidget,
  renderStuckNotesLayer,
} from "../ui/components/notesWidget";
import { getActiveQuests, initializeQuestState, updateQuestProgress } from "../quests/questManager";
import { renderQuestTrackerWidget } from "../ui/components/questTrackerWidget";
import { showSystemPing } from "../ui/components/systemPing";
import { showTutorialCallout, showTutorialCalloutSequence } from "../ui/components/tutorialCallout";
import { playNamedAudioHook, playPlaceholderSfx, setMusicCue } from "../core/audioSystem";
import {
  subscribeToFeedback,
  triggerFeedback,
  type FeedbackRequest,
} from "../core/feedback";
import {
  enhanceTerminalUiButtons,
  startTerminalTyping,
} from "../ui/components/terminalFeedback";
import { createLobbyPlaylist, shouldRenderLobbyAvatar } from "../core/multiplayerLobby";
import { getSquadWinConditionLabel } from "../core/squadOnline";
import {
  getBaseCampNodeDefinition,
  getBaseCampNodeDefinitions,
  getBaseCampNodeLayout,
  type BaseCampNodeId,
} from "./baseCampBuild";
import {
  getCurrentOpsTerminalAtlasFloor,
  getOpsTerminalAtlasWarmEconomySummaries,
} from "../core/opsTerminalAtlas";
import {
  canCraftDecorItem,
  craftDecorItem,
  getFieldDecorFootprintSize,
  getFieldDecorTurretProfile,
  getAvailableFieldDecor,
  getCraftableDecorItems,
  getDecorItemById,
  getPlacedFieldDecor,
  moveFieldDecor,
  normalizeFieldDecorRotationQuarterTurns,
  placeFieldDecor,
  removeFieldDecor,
  renderDecorSpriteSvg,
  setFieldDecorRotation,
  seedInitialDecor,
  type DecorItem,
  type FieldDecorRotationQuarterTurns,
} from "../core/decorSystem";
import {
  buildFieldMinimapModel,
  drawFieldMinimapCanvas,
  FIELD_MINIMAP_REVEAL_RADIUS,
  MINIMAP_LAYOUT_ID,
  revealFieldMinimapArea,
} from "./fieldMinimap";
import {
  getEscActionAvailability,
  getEscExpeditionRestrictionMessage,
  isEscActionEnabled,
  type EscNodeAction,
} from "../core/escAvailability";
import {
  OUTER_DECK_HAVEN_EXIT_SPAWN_TILE,
  abortOuterDeckExpedition,
  claimOuterDeckWorldBossDefeat,
  getOuterDeckFieldContext,
  getOuterDeckOpenWorldState,
  getOuterDeckSubareaByMapId,
  isOuterDeckAccessibleMap,
  isOuterDeckBranchMap,
  isOuterDeckOverworldMap,
  isOuterDeckSubareaCleared,
  markOuterDeckOpenWorldChunkExplored,
  markOuterDeckOpenWorldEnemyDefeated,
  markOuterDeckOpenWorldResourceCollected,
  markOuterDeckSubareaCleared,
  setOuterDeckOpenWorldBossHp,
  setOuterDeckOpenWorldPlayerWorldPosition,
  type OuterDeckZoneId,
} from "../core/outerDecks";
import {
  getOuterDeckChunkCoordsFromWorldPixel,
  getOuterDeckChunkKey,
  getOuterDeckStreamMetadata,
  isOuterDeckOpenWorldMap,
  outerDeckLocalPixelToWorld,
  outerDeckWorldPixelToLocal,
  shouldRecenterOuterDeckStreamWindow,
} from "./outerDeckWorld";

function openAllNodesMenuFromField(currentMapId?: FieldMap["id"]): void {
  resetFieldMovementInputState();
  void import("../ui/screens/AllNodesMenuScreen").then(({ renderAllNodesMenuScreen }) => {
    renderAllNodesMenuScreen(currentMapId);
  });
}

function syncFieldTheaterAutoTickState(): void {
  void import("../ui/screens/AllNodesMenuScreen").then(({ ensureTheaterAutoTickStateSync }) => {
    ensureTheaterAutoTickStateSync();
  });
}

function openOperationMapFromField(): void {
  void import("../ui/screens/OperationMapScreen").then(({ renderOperationMapScreen }) => {
    renderOperationMapScreen();
  });
}

// ============================================================================
// STATE
// ============================================================================

let fieldState: FieldState | null = null;
let currentMap: FieldMap | null = null;
let animationFrameId: number | null = null;
let haven3DFieldController: Haven3DFieldController | null = null;
let lastFrameTime = 0;
type FieldViewMode = "third-person" | "top-down";
const fieldViewModes = new Map<FieldMap["id"], FieldViewMode>();
const haven3DFieldCameraStates = new Map<string, Haven3DFieldCameraState>();
// Legacy movementInput kept for backward compatibility, but we'll use getPlayerInput instead
let movementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  dash: false,
};

let activeInteractionPrompt: string | null = null;
let activeAutoInteractionZoneKey: string | null = null;
let suppressedAutoInteractionZoneKey: string | null = null;
type FieldControllerActionSnapshot = {
  interact: boolean;
  attack: boolean;
  special1: boolean;
};

const previousFieldControllerActions: Record<PlayerId, FieldControllerActionSnapshot> = {
  P1: { interact: false, attack: false, special1: false },
  P2: { interact: false, attack: false, special1: false },
};

// Panel state - simple boolean
let isPanelOpen = false;

// Track if global listeners are attached (prevents duplicates)
let globalListenersAttached = false;
let fieldFocusableRefreshTimerId: number | null = null;
let fieldRuntimeP2Avatar: FieldAvatar | null = null;
let lastFieldAvatarSyncAtMs = Number.NEGATIVE_INFINITY;
let lastFieldAvatarSyncKey = "";
const FIELD_AVATAR_SYNC_INTERVAL_MS = 120;

function resetFieldMovementInputState(): void {
  movementInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
  };
  resetPlayerInput();
  resetHavenBuildPanState();
  resetFieldControllerActionTracking();
}

function scheduleFieldFocusableRefresh(delayMs = 48): void {
  if (fieldFocusableRefreshTimerId !== null) {
    window.clearTimeout(fieldFocusableRefreshTimerId);
  }

  fieldFocusableRefreshTimerId = window.setTimeout(() => {
    fieldFocusableRefreshTimerId = null;
    updateFocusableElements();
  }, delayMs);
}

function syncFieldNpcsForMap(mapId: FieldMap["id"], currentNpcs: FieldNpc[] = []): FieldNpc[] {
  const currentNpcById = new Map(currentNpcs.map((npc) => [npc.id, npc]));

  return getFieldNpcsForMap(String(mapId)).map((nextNpc) => {
    const currentNpc = currentNpcById.get(nextNpc.id);
    if (!currentNpc) {
      return nextNpc;
    }

    const hasPatrolRoute = nextNpc.routeMode === "fixed" && (nextNpc.routePoints?.length ?? 0) > 0;
    const shouldPreserveMotionState = nextNpc.routeMode === "random" || hasPatrolRoute;

    return {
      ...nextNpc,
      x: shouldPreserveMotionState ? currentNpc.x : nextNpc.x,
      y: shouldPreserveMotionState ? currentNpc.y : nextNpc.y,
      state: shouldPreserveMotionState ? currentNpc.state : nextNpc.state,
      direction: shouldPreserveMotionState ? currentNpc.direction : nextNpc.direction,
      routePointIndex: shouldPreserveMotionState ? currentNpc.routePointIndex : nextNpc.routePointIndex,
      stateStartTime: shouldPreserveMotionState ? currentNpc.stateStartTime : nextNpc.stateStartTime,
      stateDuration: shouldPreserveMotionState ? currentNpc.stateDuration : nextNpc.stateDuration
    };
  });
}

function createDefaultFieldCombatState(): NonNullable<FieldState["combat"]> {
  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  return {
    isAttacking: false,
    attackCooldown: 0,
    attackAnimTime: 0,
    isRangedMode: false,
    gearbladeMode: "blade",
    energyCells: 0,
    maxEnergyCells: Math.max(1, BOWBLADE_BASE_MAX_ENERGY_CELLS + bowbladeFieldProfile.maxEnergyCellsBonus),
  };
}

function normalizeFieldCombatState(
  combat: FieldState["combat"] | null | undefined,
): NonNullable<FieldState["combat"]> {
  const nextCombat = combat ? { ...combat } : createDefaultFieldCombatState();
  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  if (!nextCombat.gearbladeMode) {
    nextCombat.gearbladeMode = nextCombat.isRangedMode ? "launcher" : "blade";
  }
  nextCombat.isRangedMode = nextCombat.gearbladeMode === "launcher";
  nextCombat.maxEnergyCells = Math.max(1, BOWBLADE_BASE_MAX_ENERGY_CELLS + bowbladeFieldProfile.maxEnergyCellsBonus);
  nextCombat.energyCells = Math.max(0, Math.min(nextCombat.energyCells, nextCombat.maxEnergyCells));
  return nextCombat;
}

function normalizeFieldPlayerState(player: PlayerAvatar): PlayerAvatar {
  const maxHp = Math.max(1, Number(player.maxHp ?? FIELD_PLAYER_MAX_HP));
  return {
    ...player,
    hp: Math.max(0, Math.min(Number(player.hp ?? maxHp), maxHp)),
    maxHp,
    invulnerabilityTime: Math.max(0, Number(player.invulnerabilityTime ?? 0)),
    vx: Number(player.vx ?? 0),
    vy: Number(player.vy ?? 0),
  };
}

function getFieldPlayerStateVitals(): { hp: number; maxHp: number; ratio: number; critical: boolean } {
  const player = fieldState?.player;
  const maxHp = Math.max(1, Number(player?.maxHp ?? FIELD_PLAYER_MAX_HP));
  const hp = Math.max(0, Math.min(maxHp, Number(player?.hp ?? maxHp)));
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  return {
    hp,
    maxHp,
    ratio,
    critical: ratio <= 0.3,
  };
}

function renderFieldStateMeterHtml(): string {
  const vitals = getFieldPlayerStateVitals();
  return `
    <div class="field-state-meter ${vitals.critical ? "field-state-meter--critical" : ""}" data-field-state-meter>
      <div class="field-state-meter__topline">
        <span>STATE</span>
        <span data-field-state-meter-text>${vitals.hp}/${vitals.maxHp}</span>
      </div>
      <div class="field-state-meter__track">
        <div class="field-state-meter__fill" data-field-state-meter-fill style="width: ${(vitals.ratio * 100).toFixed(1)}%"></div>
      </div>
    </div>
  `;
}

function syncMountedFieldStateMeters(root: ParentNode = document): void {
  const vitals = getFieldPlayerStateVitals();
  root.querySelectorAll<HTMLElement>("[data-field-state-meter]").forEach((meter) => {
    meter.classList.toggle("field-state-meter--critical", vitals.critical);
    const text = meter.querySelector<HTMLElement>("[data-field-state-meter-text]");
    if (text) {
      text.textContent = `${vitals.hp}/${vitals.maxHp}`;
    }
    const fill = meter.querySelector<HTMLElement>("[data-field-state-meter-fill]");
    if (fill) {
      fill.style.width = `${(vitals.ratio * 100).toFixed(1)}%`;
    }
  });
}

function getFieldAttackCooldown(): number {
  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  return Math.max(BOWBLADE_MIN_ATTACK_CYCLE_MS, FIELD_ATTACK_COOLDOWN + bowbladeFieldProfile.attackCooldownDelta);
}

function getLocallyRelevantFieldEnemies(): FieldEnemy[] {
  const liveEnemies = (fieldState?.fieldEnemies ?? []).filter((enemy) => enemy.hp > 0);
  if (!currentMap || (!isOuterDeckOverworldMap(currentMap.id) && currentMap.id !== "base_camp")) {
    return liveEnemies;
  }

  const state = getGameState();
  const activeAvatarPositions = (["P1", "P2"] as PlayerId[])
    .filter((playerId) => isFieldPlayerActive(playerId, state))
    .map((playerId) => getRuntimeFieldAvatar(playerId, state))
    .filter((avatar): avatar is FieldAvatar => Boolean(avatar))
    .map((avatar) => ({ x: avatar.x, y: avatar.y }));

  if (activeAvatarPositions.length === 0 && fieldState?.player) {
    activeAvatarPositions.push({ x: fieldState.player.x, y: fieldState.player.y });
  }

  return liveEnemies.filter((enemy) => activeAvatarPositions.some((avatar) => (
    Math.hypot(enemy.x - avatar.x, enemy.y - avatar.y)
    <= Math.max(FIELD_OUTER_DECK_OVERWORLD_COMBAT_RADIUS, enemy.aggroRange + 48)
  )));
}

function isFieldCombatActive(): boolean {
  return getLocallyRelevantFieldEnemies().length > 0;
}

function getUncollectedFieldResourceObjects(): Array<FieldMap["objects"][number]> {
  if (!currentMap || !fieldState) {
    return [];
  }

  const collected = new Set(fieldState.collectedResourceObjectIds ?? []);
  return currentMap.objects.filter((object) => object.type === "resource" && !collected.has(object.id));
}

function getFieldObjectForEnemy(enemy: FieldEnemy, map: FieldMap | null = currentMap): FieldObject | null {
  if (!map || !enemy.sourceObjectId) {
    return null;
  }
  return map.objects.find((object) => object.id === enemy.sourceObjectId) ?? null;
}

function getPersistentFieldEnemyKey(enemy: FieldEnemy, map: FieldMap | null = currentMap): string {
  const sourceObject = getFieldObjectForEnemy(enemy, map);
  return String(sourceObject?.metadata?.persistentKey ?? enemy.sourceObjectId ?? enemy.spawnKey ?? enemy.id);
}

function normalizeOuterDeckZoneId(value: unknown): OuterDeckZoneId | null {
  return value === "counterweight_shaft"
    || value === "outer_scaffold"
    || value === "drop_bay"
    || value === "supply_intake_port"
    ? value
    : null;
}

function cloneFieldData<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value)) as T;
}

function captureOuterDeckRunSnapshot(state: GameState): OuterDeckRunSnapshot | null {
  if (!state.outerDecks) {
    return null;
  }

  return {
    wad: state.wad,
    resources: cloneFieldData(state.resources),
    sessionResourceLedger: cloneFieldData(state.session.resourceLedger),
    consumables: cloneFieldData(state.consumables),
    inventory: cloneFieldData(state.inventory),
    knownRecipeIds: cloneFieldData(state.knownRecipeIds),
    outerDecks: cloneFieldData(state.outerDecks),
  };
}

function restoreOuterDeckRunSnapshot(state: GameState, snapshot: OuterDeckRunSnapshot): GameState {
  return {
    ...state,
    wad: snapshot.wad,
    resources: cloneFieldData(snapshot.resources),
    session: {
      ...state.session,
      resourceLedger: cloneFieldData(snapshot.sessionResourceLedger),
    },
    consumables: cloneFieldData(snapshot.consumables),
    inventory: cloneFieldData(snapshot.inventory),
    knownRecipeIds: cloneFieldData(snapshot.knownRecipeIds),
    outerDecks: cloneFieldData(snapshot.outerDecks),
  };
}

function formatOuterDeckRunLossSummary(snapshot: OuterDeckRunSnapshot | null, current: GameState): string {
  if (!snapshot) {
    return "Unbanked salvage was dropped during recovery.";
  }

  const losses: string[] = [];
  const wadLost = Math.max(0, Math.floor(Number(current.wad ?? 0) - Number(snapshot.wad ?? 0)));
  if (wadLost > 0) {
    losses.push(`${wadLost} WAD`);
  }

  BASIC_RESOURCE_KEYS.forEach((key) => {
    const amount = Math.max(0, Math.floor(Number(current.resources?.[key] ?? 0) - Number(snapshot.resources?.[key] ?? 0)));
    if (amount > 0) {
      losses.push(`${amount} ${formatFieldEnemyResourceName(key)}`);
    }
  });

  return losses.length > 0
    ? `Lost unbanked run haul: ${losses.join(", ")}.`
    : "No unbanked salvage was recovered before the failure.";
}

function maybeBeginOuterDeckRunSnapshot(map: FieldMap | null): void {
  if (!map || !isOuterDeckOpenWorldMap(map) || outerDeckRunSnapshot) {
    return;
  }

  outerDeckRunSnapshot = captureOuterDeckRunSnapshot(getGameState());
}

function maybeBankOuterDeckRunSnapshot(previousMapId: FieldMap["id"] | string | null, nextMapId: FieldMap["id"] | string): void {
  if (!outerDeckRunSnapshot || fieldFailureTransitionPending || !previousMapId) {
    return;
  }

  const wasInOuterDeck = getOuterDeckFieldContext(String(previousMapId)) !== "haven";
  const nextIsHaven = getOuterDeckFieldContext(String(nextMapId)) === "haven";
  if (wasInOuterDeck && nextIsHaven) {
    outerDeckRunSnapshot = null;
  }
}

function persistOuterDeckOpenWorldRuntimeState(force = false): void {
  if (suppressOuterDeckRuntimePersist) {
    return;
  }

  if (!currentMap || !fieldState || !isOuterDeckOpenWorldMap(currentMap)) {
    return;
  }

  const world = outerDeckLocalPixelToWorld(currentMap, fieldState.player.x, fieldState.player.y);
  const facing = fieldState.player.facing;
  const bossHpEntries = (fieldState.fieldEnemies ?? [])
    .filter((enemy) => enemy.hp > 0)
    .flatMap((enemy) => {
      const sourceObject = getFieldObjectForEnemy(enemy);
      const bossKey = String(sourceObject?.metadata?.bossKey ?? "");
      if (!bossKey || enemy.hp >= enemy.maxHp) {
        return [];
      }
      return [{ bossKey, hp: enemy.hp }];
    });
  const chunk = getOuterDeckChunkCoordsFromWorldPixel(world.x, world.y);
  const exploredChunkKey = getOuterDeckChunkKey(chunk.chunkX, chunk.chunkY);

  updateGameState((state) => {
    let nextState = setOuterDeckOpenWorldPlayerWorldPosition(state, world.x, world.y, facing);
    nextState = markOuterDeckOpenWorldChunkExplored(nextState, exploredChunkKey);
    for (const entry of bossHpEntries) {
      nextState = setOuterDeckOpenWorldBossHp(nextState, entry.bossKey, entry.hp);
    }
    return force || nextState !== state ? nextState : state;
  });
}

function syncP1AvatarPosition(nextX: number, nextY: number): void {
  if (!fieldState) {
    return;
  }
  fieldState.player.x = nextX;
  fieldState.player.y = nextY;
}

function areFieldAvatarsEqual(a: FieldAvatar | null | undefined, b: FieldAvatar | null | undefined): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.x === b.x && a.y === b.y && a.facing === b.facing;
}

function getRuntimeFieldAvatar(playerId: PlayerId, state = getGameState()): FieldAvatar | null {
  if (playerId === "P1") {
    return fieldState
      ? {
          x: fieldState.player.x,
          y: fieldState.player.y,
          facing: fieldState.player.facing,
        }
      : state.players.P1.avatar;
  }

  if (!state.players.P2.active) {
    return null;
  }

  return fieldRuntimeP2Avatar ?? state.players.P2.avatar;
}

function syncRuntimeFieldAvatarsFromState(state = getGameState()): void {
  if (!state.players.P2.active) {
    fieldRuntimeP2Avatar = null;
    return;
  }

  if (!fieldRuntimeP2Avatar && state.players.P2.avatar) {
    fieldRuntimeP2Avatar = { ...state.players.P2.avatar };
  }
}

function setRuntimeFieldAvatarPosition(
  playerId: PlayerId,
  nextX: number,
  nextY: number,
  facing?: FieldAvatar["facing"],
): void {
  if (playerId === "P1") {
    if (!fieldState) {
      return;
    }
    fieldState.player.x = nextX;
    fieldState.player.y = nextY;
    if (facing) {
      fieldState.player.facing = facing;
    }
    return;
  }

  const persistedAvatar = getGameState().players.P2.avatar;
  fieldRuntimeP2Avatar = {
    x: nextX,
    y: nextY,
    facing: facing ?? fieldRuntimeP2Avatar?.facing ?? persistedAvatar?.facing ?? "south",
  };
}

function isFieldPlayerActive(playerId: PlayerId, state = getGameState()): boolean {
  return Boolean(state.players[playerId]?.active);
}

function flushFieldAvatarPositionsToGameState(force = false): void {
  const state = getGameState();
  syncRuntimeFieldAvatarsFromState(state);

  const p1RuntimeAvatar = getRuntimeFieldAvatar("P1", state);
  const p2RuntimeAvatar = getRuntimeFieldAvatar("P2", state);
  const nextSyncKey = [
    state.players.P1.active ? "1" : "0",
    p1RuntimeAvatar ? `${p1RuntimeAvatar.x.toFixed(2)}:${p1RuntimeAvatar.y.toFixed(2)}:${p1RuntimeAvatar.facing}` : "null",
    state.players.P2.active ? "1" : "0",
    p2RuntimeAvatar ? `${p2RuntimeAvatar.x.toFixed(2)}:${p2RuntimeAvatar.y.toFixed(2)}:${p2RuntimeAvatar.facing}` : "null",
  ].join("|");

  if (!force) {
    if (nextSyncKey === lastFieldAvatarSyncKey) {
      return;
    }

    const now = performance.now();
    if (now - lastFieldAvatarSyncAtMs < FIELD_AVATAR_SYNC_INTERVAL_MS) {
      return;
    }
    lastFieldAvatarSyncAtMs = now;
  } else {
    lastFieldAvatarSyncAtMs = performance.now();
  }

  lastFieldAvatarSyncKey = nextSyncKey;

  updateGameState((currentState) => {
    const currentP1Avatar = currentState.players.P1.avatar;
    const currentP2Avatar = currentState.players.P2.avatar;
    const p1Changed = !areFieldAvatarsEqual(currentP1Avatar, p1RuntimeAvatar);
    const p2Changed = !areFieldAvatarsEqual(currentP2Avatar, p2RuntimeAvatar);

    if (!p1Changed && !p2Changed) {
      return currentState;
    }

    return {
      ...currentState,
      players: {
        ...currentState.players,
        P1: p1Changed
          ? {
              ...currentState.players.P1,
              avatar: p1RuntimeAvatar ? { ...p1RuntimeAvatar } : null,
            }
          : currentState.players.P1,
        P2: p2Changed
          ? {
              ...currentState.players.P2,
              avatar: p2RuntimeAvatar ? { ...p2RuntimeAvatar } : null,
            }
          : currentState.players.P2,
      },
    };
  });

  persistOuterDeckOpenWorldRuntimeState(force);
}

// Store last interaction zone position for returning to field from nodes
let lastInteractionZonePosition: { x: number; y: number; zoneId: string } | null = null;

// Zoom state
let fieldZoom = 1.0;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
let fieldPinnedResizeHandler: (() => void) | null = null;
let fieldPinnedQuacFeedback = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';
let stickyNoteDragResumePending = false;
let lastNetworkLobbyAvatarSyncKey = "";
let lastMinimapRevealKey = "";
let cleanupFieldFeedbackListener: (() => void) | null = null;
let cleanupFieldControllerContext: (() => void) | null = null;
let smoothedFieldCameraCenter: { x: number; y: number } | null = null;
let currentFieldCameraTransform = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
};
let lastFieldPromptSignature: string | null = null;
let lastFieldStepSample: { x: number; y: number } | null = null;
let fieldStepDistanceAccumulator = 0;
let fieldStepPulseUntilMs = 0;
let lastSableBarkAudioAtMs = Number.NEGATIVE_INFINITY;
let outerDeckRunSnapshot: OuterDeckRunSnapshot | null = null;
let suppressOuterDeckRuntimePersist = false;
let fieldFailureTransitionPending = false;
let havenBuildModeActive = false;
let havenBuildResumePaused = false;
let havenBuildCameraCenter: { x: number; y: number } | null = null;
let havenBuildPanInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  fast: false,
};
let havenBuildPaletteSelection: { kind: "node"; nodeId: BaseCampNodeId } | HavenBuildDecorSelection | null = null;
let havenBuildDragState: {
  kind: "node" | "decor";
  itemId: string;
  width: number;
  height: number;
  offsetTilesX: number;
  offsetTilesY: number;
  pointerId: number;
  element: HTMLElement;
  originX: number;
  originY: number;
  latestX: number;
  latestY: number;
  valid: boolean;
} | null = null;
const fieldTurretLastFireAtMs = new Map<string, number>();
const fieldTileHtmlCache = new WeakMap<FieldMap, string>();
const FIELD_TILE_BACKGROUND_COLOR = "#23201e";
const FIELD_TILE_PATTERN_STYLES = {
  floor: {
    fill: "#5a4738",
    stroke: "rgba(111, 87, 65, 0.18)",
  },
  wall: {
    fill: "#43434a",
    stroke: "rgba(86, 86, 95, 0.22)",
  },
  grass: {
    fill: "#525543",
    stroke: "rgba(111, 87, 65, 0.18)",
  },
  dirt: {
    fill: "#5f4a38",
    stroke: "rgba(111, 87, 65, 0.18)",
  },
  stone: {
    fill: "#5a4738",
    stroke: "rgba(111, 87, 65, 0.18)",
  },
} as const;

type FieldTilePatternKey = keyof typeof FIELD_TILE_PATTERN_STYLES;

type HavenBuildObjectMeta =
  | {
      kind: "node";
      itemId: BaseCampNodeId;
      width: number;
      height: number;
    }
  | {
      kind: "decor";
      itemId: string;
      decorId: string;
      width: number;
      height: number;
    };

type HavenBuildDecorSelection = {
  kind: "decor";
  decorId: string;
  rotationQuarterTurns: FieldDecorRotationQuarterTurns;
};

type NetworkLobbyPlaylistDraftRound = {
  gridWidth: number;
  gridHeight: number;
  objectiveType: SkirmishObjectiveType;
};

type NetworkLobbyWindowLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  colorKey: string;
};

let networkLobbyUiState: {
  challengeeSlot: NetworkPlayerSlot | "";
  playlistDraft: NetworkLobbyPlaylistDraftRound[];
  coopSelectedSlots: NetworkPlayerSlot[];
} = {
  challengeeSlot: "",
  playlistDraft: [{ gridWidth: 8, gridHeight: 5, objectiveType: "elimination" }],
  coopSelectedSlots: [],
};

const NETWORK_LOBBY_WINDOW_ITEM_ID = "network-lobby-window";
const NETWORK_LOBBY_WINDOW_MARGIN = 14;
const NETWORK_LOBBY_WINDOW_MIN_WIDTH = 360;
const NETWORK_LOBBY_WINDOW_MIN_HEIGHT = 420;
const NETWORK_LOBBY_WINDOW_DEFAULT_WIDTH = 430;
const NETWORK_LOBBY_WINDOW_DEFAULT_HEIGHT = 720;
let networkLobbyWindowLayout: NetworkLobbyWindowLayout | null = null;
let networkLobbyWindowMinimized = false;
let pendingFieldSpawnOverride: {
  mapId: FieldMap["id"];
  x: number;
  y: number;
  facing?: "north" | "south" | "east" | "west";
} | null = null;
let pendingFieldReturnFromInteraction: {
  mapId: string;
  playerId: PlayerId;
  savedPlayerPos: { x: number; y: number };
  zoneId: string;
  interactionKey: string;
} | null = null;

const FIELD_TILE_SIZE = 64;
const FIELD_ATTACK_COOLDOWN = BOWBLADE_BASE_ATTACK_CYCLE_MS;
const FIELD_ATTACK_DURATION = 200;
const FIELD_ATTACK_RANGE = 70;
const FIELD_RANGED_ATTACK_RANGE = BOWBLADE_BASE_RANGED_RANGE;
const FIELD_ATTACK_DAMAGE = Math.max(18, BOWBLADE_BASE_MELEE_DAMAGE);
const FIELD_RANGED_ATTACK_DAMAGE = Math.max(34, BOWBLADE_BASE_RANGED_DAMAGE);
const FIELD_PROJECTILE_SPEED = BOWBLADE_BASE_PROJECTILE_SPEED;
const FIELD_PROJECTILE_LIFETIME = 2000;
const FIELD_GRAPPLE_RANGE = 430;
const FIELD_GRAPPLE_DAMAGE = 14;
const FIELD_GRAPPLE_PULL_FORCE = 560;
const FIELD_ENEMY_PING_2D_CLEARANCE = 58;
const FIELD_ENEMY_KNOCKBACK_FORCE = BOWBLADE_BASE_MELEE_KNOCKBACK_FORCE;
const FIELD_ENEMY_KNOCKBACK_DURATION = 300;
const FIELD_KNOCKBACK_DAMPING = 0.85;
const FIELD_PLAYER_MAX_HP = 100;
const FIELD_OUTER_DECK_OVERWORLD_COMBAT_RADIUS = 320;
const FIELD_PLAYER_DAMAGE_ON_CONTACT = 10;
const FIELD_PLAYER_INVULNERABILITY_DURATION = 900;
const FIELD_PLAYER_KNOCKBACK_FORCE = 420;
const FIELD_CAMERA_SMOOTHING = 0.2;
const FIELD_TURRET_PROJECTILE_LIFETIME = 1600;
const FIELD_FOOTSTEP_DISTANCE = 82;
const FIELD_DASH_FOOTSTEP_DISTANCE = 56;
const FIELD_STEP_PULSE_DURATION_MS = 150;
const FIELD_SABLE_BARK_PICKUP_COOLDOWN_MS = 520;
const HAVEN_BUILD_PAN_SPEED = 720;
const HAVEN_BUILD_PAN_FAST_MULTIPLIER = 2.25;

type OuterDeckRunSnapshot = {
  wad: GameState["wad"];
  resources: GameState["resources"];
  sessionResourceLedger: GameState["session"]["resourceLedger"];
  consumables: GameState["consumables"];
  inventory: GameState["inventory"];
  knownRecipeIds: GameState["knownRecipeIds"];
  outerDecks: NonNullable<GameState["outerDecks"]>;
};

function getFieldBetaMarkerHtml(mapId: FieldMap["id"]): string {
  const fieldContext = getOuterDeckFieldContext(String(mapId));
  if (fieldContext === "haven") {
    return "";
  }

  const label = fieldContext === "outerDeckOverworld" ? "OUTER DECKS // BETA FIELD SYSTEM" : "OUTER DECK SUBAREA // BETA FIELD SYSTEM";
  return `<div class="field-beta-marker">${label}</div>`;
}

function maybeShowFieldTutorials(mapId: FieldMap["id"]): void {
  const fieldContext = getOuterDeckFieldContext(String(mapId));
  if (mapId === "base_camp") {
    showTutorialCalloutSequence([
      {
        id: "tutorial_haven_field",
        title: "HAVEN Field Hub",
        message: "Walk the base camp to reach its stations directly instead of driving everything through menus.",
        detail: "Use the Ops Terminal to deploy, the roster and workshop nodes to prepare your squad, and the field routes to move between HAVEN spaces.",
        channel: "tutorial-field",
      },
    ]);
    return;
  }

  if (fieldContext !== "haven") {
    showTutorialCallout({
      id: "tutorial_outer_deck_beta",
      title: "Outer Decks Are In Beta",
      message: "Everything outside HAVEN is currently a beta field layer tied to expeditions and recovery routes.",
      detail: "Expect tuning and routing changes here while the beta focuses on Regions 1-2 and the first 6 floors of the campaign.",
      durationMs: 9000,
      channel: "tutorial-field",
    });
  }
}

function isHavenBuildMapActive(): boolean {
  return currentMap?.id === "base_camp";
}

function isFieldBuildModeMapActive(): boolean {
  return Boolean(currentMap && currentMap.id !== "quarters" && currentMap.id !== "network_lobby");
}

function canPanDuringBuildMode(): boolean {
  return isHavenBuildMapActive();
}

function isHavenBuildModeEnabled(): boolean {
  return havenBuildModeActive && isFieldBuildModeMapActive();
}

function resetHavenBuildPanState(): void {
  havenBuildCameraCenter = null;
  havenBuildPanInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    fast: false,
  };
}

function resetFieldFeedbackState(): void {
  smoothedFieldCameraCenter = null;
  currentFieldCameraTransform = {
    offsetX: 0,
    offsetY: 0,
    zoom: fieldZoom,
  };
  lastFieldPromptSignature = null;
  lastFieldStepSample = null;
  fieldStepDistanceAccumulator = 0;
  fieldStepPulseUntilMs = 0;
  lastSableBarkAudioAtMs = Number.NEGATIVE_INFINITY;
}

function playSablePickupBark(currentTime: number): void {
  if (currentTime - lastSableBarkAudioAtMs < FIELD_SABLE_BARK_PICKUP_COOLDOWN_MS) {
    return;
  }

  lastSableBarkAudioAtMs = currentTime;
  playNamedAudioHook("sable_bark");
}

function getFieldOverlayRoot(): HTMLElement | null {
  return document.getElementById("app");
}

function ensureFieldFeedbackOverlay(): HTMLElement | null {
  const root = getFieldOverlayRoot();
  if (!root) {
    return null;
  }

  // Keep pickup and prompt feedback outside the rerendered map subtree so they do not pop off mid-animation.
  let overlay = root.querySelector<HTMLElement>("#fieldFeedbackOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fieldFeedbackOverlay";
    overlay.className = "field-feedback-overlay";
    root.appendChild(overlay);
  }
  return overlay;
}

function ensureFieldPromptOverlay(): HTMLElement | null {
  const root = getFieldOverlayRoot();
  if (!root) {
    return null;
  }

  let overlay = root.querySelector<HTMLElement>("#fieldPromptOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fieldPromptOverlay";
    overlay.className = "field-prompt-overlay";
    root.appendChild(overlay);
  }
  return overlay;
}

function queueFieldFeedbackElement(element: HTMLElement, durationMs: number): void {
  const overlay = ensureFieldFeedbackOverlay();
  if (!overlay) {
    return;
  }

  overlay.appendChild(element);
  window.setTimeout(() => {
    element.classList.add("field-feedback-element--exit");
    window.setTimeout(() => {
      element.remove();
    }, 220);
  }, durationMs);
}

function resolveFieldOverlayPoint(position: FeedbackRequest["position"]): { x: number; y: number } | null {
  if (!position || position.space !== "field-world") {
    return null;
  }

  const root = getFieldOverlayRoot();
  const viewport = document.querySelector(".field-viewport") as HTMLElement | null;
  if (!root || !viewport) {
    return null;
  }

  const rootRect = root.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const localX = (position.x - currentFieldCameraTransform.offsetX) * currentFieldCameraTransform.zoom;
  const localY = (position.y - currentFieldCameraTransform.offsetY) * currentFieldCameraTransform.zoom;

  return {
    x: viewportRect.left - rootRect.left + localX,
    y: viewportRect.top - rootRect.top + localY,
  };
}

function renderFieldFeedbackRequest(request: FeedbackRequest): void {
  const overlay = ensureFieldFeedbackOverlay();
  if (!overlay) {
    return;
  }

  const origin = resolveFieldOverlayPoint(request.position);
  if (!origin) {
    return;
  }

  const feedbackText = request.text ?? (request.type === "resource" ? "RESOURCE" : null);
  if (feedbackText) {
    const tone = typeof request.meta?.tone === "string" ? request.meta.tone : request.type;
    const textEl = document.createElement("div");
    textEl.className = `field-feedback-element field-feedback-text field-feedback-text--${tone}`;
    textEl.textContent = feedbackText;
    textEl.style.left = `${origin.x}px`;
    textEl.style.top = `${origin.y - 18}px`;
    queueFieldFeedbackElement(textEl, request.type === "warning" ? 1040 : 820);
  }

  if (request.type === "resource") {
    const target = resolveFieldOverlayPoint(request.targetPosition);
    if (target) {
      const pickupEl = document.createElement("div");
      pickupEl.className = "field-feedback-element field-feedback-snap";
      pickupEl.style.left = `${origin.x}px`;
      pickupEl.style.top = `${origin.y}px`;
      pickupEl.style.setProperty("--field-feedback-target-x", `${target.x}px`);
      pickupEl.style.setProperty("--field-feedback-target-y", `${target.y}px`);
      overlay.appendChild(pickupEl);
      requestAnimationFrame(() => {
        pickupEl.classList.add("field-feedback-snap--active");
      });
      window.setTimeout(() => {
        pickupEl.remove();
      }, 520);
    }
  }
}

function ensureFieldFeedbackListener(): void {
  if (cleanupFieldFeedbackListener) {
    return;
  }

  cleanupFieldFeedbackListener = subscribeToFeedback((request) => {
    if (!document.querySelector(".field-root")) {
      return;
    }

    const fieldRelated = request.position?.space === "field-world" || request.source === "field";
    if (!fieldRelated) {
      return;
    }

    renderFieldFeedbackRequest(request);
  });
}

function syncFieldPromptOverlay(promptText: string | null): void {
  const overlay = ensureFieldPromptOverlay();
  if (!overlay) {
    return;
  }

  if (!promptText) {
    overlay.classList.remove("field-prompt-overlay--active");
    lastFieldPromptSignature = null;
    return;
  }

  let promptEl = overlay.querySelector<HTMLElement>(".field-interaction-prompt");
  if (!promptEl) {
    promptEl = document.createElement("div");
    promptEl.className = "field-interaction-prompt";
    overlay.appendChild(promptEl);
  }

  promptEl.textContent = promptText;
  const promptAnchor = getFieldInteractionPromptOverlayPoint(promptEl);
  if (promptAnchor) {
    promptEl.style.left = `${promptAnchor.x}px`;
    promptEl.style.top = `${promptAnchor.y}px`;
  } else {
    promptEl.style.removeProperty("left");
    promptEl.style.removeProperty("top");
  }
  overlay.classList.add("field-prompt-overlay--active");

  if (lastFieldPromptSignature !== promptText) {
    promptEl.classList.remove("field-interaction-prompt--pulse");
    void promptEl.offsetWidth;
    promptEl.classList.add("field-interaction-prompt--pulse");
  }

  lastFieldPromptSignature = promptText;
}

function updateFieldMovementFeedback(currentTime: number, dashActive: boolean): void {
  const center = getTrackedFieldCenter();
  if (!lastFieldStepSample) {
    lastFieldStepSample = { ...center };
    return;
  }

  const distance = Math.hypot(center.x - lastFieldStepSample.x, center.y - lastFieldStepSample.y);
  lastFieldStepSample = { ...center };
  if (distance <= 0.05) {
    return;
  }

  fieldStepDistanceAccumulator += distance;
  const triggerDistance = dashActive ? FIELD_DASH_FOOTSTEP_DISTANCE : FIELD_FOOTSTEP_DISTANCE;
  if (fieldStepDistanceAccumulator < triggerDistance) {
    return;
  }

  fieldStepDistanceAccumulator = fieldStepDistanceAccumulator % triggerDistance;
  fieldStepPulseUntilMs = currentTime + FIELD_STEP_PULSE_DURATION_MS;
  playPlaceholderSfx("ui-move");
}

function syncCurrentMapFromState(): void {
  if (!currentMap) {
    return;
  }
  currentMap = getFieldMap(currentMap.id);
}

function setHavenBuildMode(active: boolean): void {
  if (!isFieldBuildModeMapActive()) {
    havenBuildModeActive = false;
    havenBuildResumePaused = false;
    resetHavenBuildPanState();
    havenBuildPaletteSelection = null;
    havenBuildDragState = null;
    return;
  }

  if (active && !isHavenBuildModeUnlocked()) {
    showSystemPing({
      type: "info",
      title: "BUILD MODE LOCKED",
      message: `Discover Floor ${String(HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} to unlock field build mode.`,
      channel: "haven-build",
    });
    havenBuildModeActive = false;
    havenBuildResumePaused = false;
    resetHavenBuildPanState();
    havenBuildPaletteSelection = null;
    havenBuildDragState = null;
    return;
  }

  if (active) {
    seedInitialDecor();
  }

  havenBuildModeActive = active;
  resetHavenBuildPanState();
  havenBuildPaletteSelection = null;
  havenBuildDragState = null;

  if (fieldState) {
    if (active) {
      havenBuildResumePaused = fieldState.isPaused;
      fieldState.isPaused = true;
    } else {
      fieldState.isPaused = havenBuildResumePaused;
      havenBuildResumePaused = false;
    }
  }

  activeInteractionPrompt = active ? null : getCombinedInteractionPrompt();
  syncCurrentMapFromState();
  render();
}

function getBuildNodeIdForObject(objectId: string): BaseCampNodeId | null {
  const definition = getBaseCampNodeDefinitions().find((entry) => entry.objectId === objectId);
  return definition?.id ?? null;
}

function getBuildMetaForObject(obj: FieldMap["objects"][number]): HavenBuildObjectMeta | null {
  if (!isFieldBuildModeMapActive()) {
    return null;
  }

  if (obj.type === "decoration") {
    const decorId = String(obj.metadata?.decorId ?? "");
    const placementId = String(obj.metadata?.placementId ?? "");
    if (!decorId || !placementId) {
      return null;
    }
    return {
      kind: "decor",
      itemId: placementId,
      decorId,
      width: obj.width,
      height: obj.height,
    };
  }

  if (obj.type !== "station") {
    return null;
  }

  if (!isHavenBuildMapActive()) {
    return null;
  }

  const nodeId = getBuildNodeIdForObject(obj.id);
  if (!nodeId) {
    return null;
  }

  return {
    kind: "node",
    itemId: nodeId,
    width: obj.width,
    height: obj.height,
  };
}

function getAvailableFieldDecorCountForState(state: ReturnType<typeof getGameState>, decorId: string): number {
  return getAvailableFieldDecor(state).filter((decor) => decor.id === decorId).length;
}

function getCurrentAvailableFieldDecorCount(decorId: string): number {
  return getAvailableFieldDecorCountForState(getGameState(), decorId);
}

function getAvailableFieldDecorStock(state: ReturnType<typeof getGameState>): Array<{ decor: DecorItem; availableCount: number }> {
  const stock = new Map<string, { decor: DecorItem; availableCount: number }>();
  getAvailableFieldDecor(state).forEach((decor) => {
    const existing = stock.get(decor.id);
    if (existing) {
      existing.availableCount += 1;
      return;
    }
    stock.set(decor.id, {
      decor,
      availableCount: 1,
    });
  });
  return [...stock.values()];
}

function createHavenBuildDecorSelection(decorId: string): HavenBuildDecorSelection {
  const retainedRotation = havenBuildPaletteSelection?.kind === "decor" && havenBuildPaletteSelection.decorId === decorId
    ? havenBuildPaletteSelection.rotationQuarterTurns
    : 0;
  return {
    kind: "decor",
    decorId,
    rotationQuarterTurns: retainedRotation,
  };
}

function rotateSelectedBuildDecor(deltaQuarterTurns: number = 1): void {
  if (havenBuildPaletteSelection?.kind !== "decor") {
    return;
  }

  havenBuildPaletteSelection = {
    ...havenBuildPaletteSelection,
    rotationQuarterTurns: normalizeFieldDecorRotationQuarterTurns(
      havenBuildPaletteSelection.rotationQuarterTurns + deltaQuarterTurns,
    ),
  };
  render();
}

function rotatePlacedBuildDecor(placementId: string): void {
  if (!currentMap) {
    return;
  }

  const placedDecor = getPlacedFieldDecor(getGameState(), currentMap.id)
    .find(({ placement }) => placement.placementId === placementId);
  if (!placedDecor) {
    return;
  }

  const nextRotation = normalizeFieldDecorRotationQuarterTurns(
    (placedDecor.placement.rotationQuarterTurns ?? 0) + 1,
  );
  const footprint = getFieldDecorFootprintSize(placedDecor.decor, nextRotation);
  const placement = validateBuildPlacement(
    placedDecor.placement.x,
    placedDecor.placement.y,
    footprint.width,
    footprint.height,
    `field_decor_${placementId}`,
    null,
  );
  if (!placement.valid) {
    showSystemPing({
      type: "error",
      title: "CANNOT ROTATE DECOR",
      message: placement.reason || "That rotation would collide with the current layout.",
      channel: "haven-build",
    });
    return;
  }

  if (!setFieldDecorRotation(placementId, nextRotation)) {
    showSystemPing({
      type: "error",
      title: "ROTATION FAILED",
      message: "That decoration could not be reoriented right now.",
      channel: "haven-build",
    });
    return;
  }

  syncCurrentMapFromState();
  render();
}

function getBuildPlacementFromClientPosition(clientX: number, clientY: number): { tileX: number; tileY: number } | null {
  const mapElement = document.querySelector<HTMLElement>(".field-map");
  if (!mapElement) {
    return null;
  }

  const rect = mapElement.getBoundingClientRect();
  const mapX = (clientX - rect.left) / fieldZoom;
  const mapY = (clientY - rect.top) / fieldZoom;

  return {
    tileX: Math.floor(mapX / FIELD_TILE_SIZE),
    tileY: Math.floor(mapY / FIELD_TILE_SIZE),
  };
}

function clampBuildOrigin(x: number, y: number, width: number, height: number): { x: number; y: number } {
  if (!currentMap) {
    return { x, y };
  }
  return {
    x: Math.max(0, Math.min(currentMap.width - width, x)),
    y: Math.max(0, Math.min(currentMap.height - height, y)),
  };
}

function validateBuildPlacement(
  x: number,
  y: number,
  width: number,
  height: number,
  excludedObjectId: string | null = null,
  excludedZoneId: string | null = null,
): { valid: boolean; reason?: string } {
  if (!currentMap) {
    return { valid: false, reason: "No active map." };
  }

  if (x < 0 || y < 0 || x + width > currentMap.width || y + height > currentMap.height) {
    return { valid: false, reason: "Out of bounds." };
  }

  const excludedObject = excludedObjectId
    ? currentMap.objects.find((object) => object.id === excludedObjectId) ?? null
    : null;

  for (let tileY = y; tileY < y + height; tileY += 1) {
    for (let tileX = x; tileX < x + width; tileX += 1) {
      const tile = currentMap.tiles[tileY]?.[tileX];
      const insideExcludedObject = Boolean(
        excludedObject
        && tileX >= excludedObject.x
        && tileX < excludedObject.x + excludedObject.width
        && tileY >= excludedObject.y
        && tileY < excludedObject.y + excludedObject.height,
      );
      if (!tile?.walkable && !insideExcludedObject) {
        return { valid: false, reason: "Placement must stay on open floor." };
      }
    }
  }

  const overlap = currentMap.objects.some((object) => {
    if (object.id === excludedObjectId || isEnemyFieldObject(object)) {
      return false;
    }
    return (
      x < object.x + object.width
      && x + width > object.x
      && y < object.y + object.height
      && y + height > object.y
    );
  });

  if (overlap) {
    return { valid: false, reason: "Another object is already there." };
  }

  const overlapsZone = currentMap.interactionZones.some((zone) => {
    if (zone.id === excludedZoneId) {
      return false;
    }
    return (
      x < zone.x + zone.width
      && x + width > zone.x
      && y < zone.y + zone.height
      && y + height > zone.y
    );
  });

  if (overlapsZone) {
    return { valid: false, reason: "Route controls and interaction gates must stay clear." };
  }

  return { valid: true };
}

function setDraggedBuildElementPosition(element: HTMLElement, x: number, y: number, valid: boolean): void {
  element.style.left = `${x * FIELD_TILE_SIZE}px`;
  element.style.top = `${y * FIELD_TILE_SIZE}px`;
  element.classList.toggle("field-object--invalid-drop", !valid);
}

function commitBaseCampNodeLayout(nodeId: BaseCampNodeId, x: number, y: number, hidden: boolean): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      baseCampFieldNodeLayouts: {
        ...(state.uiLayout?.baseCampFieldNodeLayouts ?? {}),
        [nodeId]: {
          ...getBaseCampNodeLayout(state.uiLayout, nodeId),
          x,
          y,
          hidden,
        },
      },
    },
  }));
}

function placeCurrentBuildSelection(tileX: number, tileY: number): void {
  if (!havenBuildPaletteSelection || !currentMap) {
    return;
  }

  if (havenBuildPaletteSelection.kind === "node") {
    const definition = getBaseCampNodeDefinition(havenBuildPaletteSelection.nodeId);
    if (!definition) {
      return;
    }
    const origin = clampBuildOrigin(
      tileX - Math.floor(definition.width / 2),
      tileY - Math.floor(definition.height / 2),
      definition.width,
      definition.height,
    );
    const placement = validateBuildPlacement(origin.x, origin.y, definition.width, definition.height, null);
    if (!placement.valid) {
      showSystemPing({
        type: "error",
        title: "CANNOT PLACE NODE",
        message: placement.reason || "That placement is blocked.",
        channel: "haven-build",
      });
      return;
    }
    commitBaseCampNodeLayout(definition.id, origin.x, origin.y, false);
    havenBuildPaletteSelection = null;
    syncCurrentMapFromState();
    render();
    return;
  }

  const decor = getDecorItemById(havenBuildPaletteSelection.decorId);
  if (!decor) {
    return;
  }
  const footprint = getFieldDecorFootprintSize(decor, havenBuildPaletteSelection.rotationQuarterTurns);
  const origin = clampBuildOrigin(
    tileX - Math.floor(footprint.width / 2),
    tileY - Math.floor(footprint.height / 2),
    footprint.width,
    footprint.height,
  );
  const placement = validateBuildPlacement(origin.x, origin.y, footprint.width, footprint.height, null);
  if (!placement.valid) {
    showSystemPing({
      type: "error",
      title: "CANNOT PLACE DECOR",
      message: placement.reason || "That placement is blocked.",
      channel: "haven-build",
    });
    return;
  }
  if (!placeFieldDecor(
    havenBuildPaletteSelection.decorId,
    currentMap.id,
    origin.x,
    origin.y,
    havenBuildPaletteSelection.rotationQuarterTurns,
  )) {
    showSystemPing({
      type: "error",
      title: "DECOR LOCKED",
      message: "That decoration is not available to place right now.",
      channel: "haven-build",
    });
    return;
  }
  havenBuildPaletteSelection = getCurrentAvailableFieldDecorCount(havenBuildPaletteSelection.decorId) > 0
    ? havenBuildPaletteSelection
    : null;
  syncCurrentMapFromState();
  render();
}

function isNetworkLobbyMapActive(): boolean {
  return currentMap?.id === "network_lobby";
}

function getActiveNetworkLobby(): LobbyState | null {
  return getGameState().lobby ?? null;
}

function isActiveCoopOperationsLobby(lobby: LobbyState | null | undefined): boolean {
  return Boolean(
    lobby
    && lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.status === "active",
  );
}

function shouldSuppressEscMenuAccess(): boolean {
  // Keep E.S.C. locked only while the player is physically inside the
  // dedicated multiplayer lobby field map. Once they're back in any other
  // field context, Escape should behave like the normal field-to-E.S.C. flow.
  return isNetworkLobbyMapActive();
}

function registerFieldControllerContext(): void {
  cleanupFieldControllerContext?.();
  cleanupFieldControllerContext = registerControllerContext({
    id: "field",
    defaultMode: "cursor",
    focusRoot: () => document.querySelector(".field-root"),
    onAction: (action) => {
      if (!document.querySelector(".field-root")) {
        return false;
      }

      if (action === "pause" || action === "menu") {
        if (shouldSuppressEscMenuAccess()) {
          return true;
        }
        if (isHavenBuildModeEnabled()) {
          setHavenBuildMode(false);
          return true;
        }
        toggleAllNodesPanel();
        return true;
      }

      return false;
    },
    getDebugState: () => ({
      focus: currentMap?.id ? String(currentMap.id) : "field",
      hovered: activeInteractionPrompt ?? "none",
      window: isHavenBuildModeEnabled() ? "build" : "field",
      x: Math.round(fieldState?.player.x ?? 0),
      y: Math.round(fieldState?.player.y ?? 0),
    }),
  });
}

function suspendFieldForScreenTransition(): void {
  if (fieldState) {
    fieldState.isPaused = true;
  }
  flushFieldAvatarPositionsToGameState(true);
  teardownFieldMode();
}

function getRenderableLobbyForCurrentField(): LobbyState | null {
  const lobby = getActiveNetworkLobby();
  if (!lobby) {
    return null;
  }
  if (isNetworkLobbyMapActive()) {
    return lobby;
  }
  if (isActiveCoopOperationsLobby(lobby)) {
    return lobby;
  }
  return null;
}

function ensureNetworkLobbyUiState(lobby: LobbyState | null): void {
  const defaultChallengee = NETWORK_PLAYER_SLOTS.find((slot) => {
    if (!lobby || slot === lobby.localSlot) {
      return false;
    }
    return Boolean(lobby.members[slot]?.connected);
  }) ?? "";
  if (
    networkLobbyUiState.challengeeSlot
    && (!lobby || !lobby.members[networkLobbyUiState.challengeeSlot]?.connected || networkLobbyUiState.challengeeSlot === lobby.localSlot)
  ) {
    networkLobbyUiState.challengeeSlot = defaultChallengee;
  }
  if (!networkLobbyUiState.challengeeSlot) {
    networkLobbyUiState.challengeeSlot = defaultChallengee;
  }
  if (networkLobbyUiState.playlistDraft.length <= 0) {
    networkLobbyUiState.playlistDraft = [{ gridWidth: 8, gridHeight: 5, objectiveType: "elimination" }];
  }
  if (lobby) {
    const connectedSlots = NETWORK_PLAYER_SLOTS.filter((slot) => Boolean(lobby.members[slot]?.connected));
    if (lobby.activity.kind === "coop_operations") {
      networkLobbyUiState.coopSelectedSlots = lobby.activity.coopOperations.selectedSlots.filter((slot) =>
        connectedSlots.includes(slot),
      );
    } else if (networkLobbyUiState.coopSelectedSlots.length <= 0) {
      networkLobbyUiState.coopSelectedSlots = connectedSlots;
    } else {
      networkLobbyUiState.coopSelectedSlots = networkLobbyUiState.coopSelectedSlots.filter((slot) => connectedSlots.includes(slot));
      connectedSlots.forEach((slot) => {
        if (!networkLobbyUiState.coopSelectedSlots.includes(slot) && slot === lobby.localSlot) {
          networkLobbyUiState.coopSelectedSlots.push(slot);
        }
      });
    }
  }
}

function clampLobbyGridWidth(value: number): number {
  return Math.max(4, Math.min(10, Math.floor(value)));
}

function clampLobbyGridHeight(value: number): number {
  return Math.max(3, Math.min(8, Math.floor(value)));
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDefaultNetworkLobbyWindowLayout(): NetworkLobbyWindowLayout {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const width = clampValue(
    NETWORK_LOBBY_WINDOW_DEFAULT_WIDTH,
    NETWORK_LOBBY_WINDOW_MIN_WIDTH,
    Math.max(NETWORK_LOBBY_WINDOW_MIN_WIDTH, viewportWidth - (NETWORK_LOBBY_WINDOW_MARGIN * 2)),
  );
  const height = clampValue(
    NETWORK_LOBBY_WINDOW_DEFAULT_HEIGHT,
    NETWORK_LOBBY_WINDOW_MIN_HEIGHT,
    Math.max(NETWORK_LOBBY_WINDOW_MIN_HEIGHT, viewportHeight - (NETWORK_LOBBY_WINDOW_MARGIN * 2)),
  );
  return {
    left: Math.max(NETWORK_LOBBY_WINDOW_MARGIN, viewportWidth - width - NETWORK_LOBBY_WINDOW_MARGIN),
    top: NETWORK_LOBBY_WINDOW_MARGIN,
    width,
    height,
    colorKey: getDefaultPinnedItemColorKey("comms-array"),
  };
}

function clampNetworkLobbyWindowLayout(layout: NetworkLobbyWindowLayout): NetworkLobbyWindowLayout {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const width = clampValue(
    Math.round(layout.width),
    NETWORK_LOBBY_WINDOW_MIN_WIDTH,
    Math.max(NETWORK_LOBBY_WINDOW_MIN_WIDTH, viewportWidth - (NETWORK_LOBBY_WINDOW_MARGIN * 2)),
  );
  const height = clampValue(
    Math.round(layout.height),
    NETWORK_LOBBY_WINDOW_MIN_HEIGHT,
    Math.max(NETWORK_LOBBY_WINDOW_MIN_HEIGHT, viewportHeight - (NETWORK_LOBBY_WINDOW_MARGIN * 2)),
  );
  const left = clampValue(
    Math.round(layout.left),
    NETWORK_LOBBY_WINDOW_MARGIN,
    Math.max(NETWORK_LOBBY_WINDOW_MARGIN, viewportWidth - width - NETWORK_LOBBY_WINDOW_MARGIN),
  );
  const top = clampValue(
    Math.round(layout.top),
    NETWORK_LOBBY_WINDOW_MARGIN,
    Math.max(NETWORK_LOBBY_WINDOW_MARGIN, viewportHeight - height - NETWORK_LOBBY_WINDOW_MARGIN),
  );
  const colorKey = PINNED_COLOR_THEME_MAP.has(layout.colorKey)
    ? layout.colorKey
    : getDefaultPinnedItemColorKey("comms-array");
  return {
    left,
    top,
    width,
    height,
    colorKey,
  };
}

function getPreferredFieldSpawnPosition(map: FieldMap["id"], tileSize: number): { x: number; y: number } | null {
  if (map === "network_lobby") {
    const spawnTileX = 11;
    const spawnTileY = 11;
    return {
      x: spawnTileX * tileSize + tileSize / 2,
      y: spawnTileY * tileSize + tileSize / 2,
    };
  }
  if (map === "base_camp") {
    const spawnTileX = 41;
    const spawnTileY = 27;
    return {
      x: spawnTileX * tileSize + tileSize / 2,
      y: spawnTileY * tileSize + tileSize / 2,
    };
  }
  return null;
}

function getNetworkLobbyWindowLayout(): NetworkLobbyWindowLayout {
  if (!networkLobbyWindowLayout) {
    networkLobbyWindowLayout = getDefaultNetworkLobbyWindowLayout();
  }
  networkLobbyWindowLayout = clampNetworkLobbyWindowLayout(networkLobbyWindowLayout);
  return networkLobbyWindowLayout;
}

function setNetworkLobbyWindowLayout(nextLayout: NetworkLobbyWindowLayout): void {
  networkLobbyWindowLayout = clampNetworkLobbyWindowLayout(nextLayout);
}

function getNetworkLobbyWindowStyle(): string {
  const layout = getNetworkLobbyWindowLayout();
  const themeStyle = getPinnedItemThemeStyle(NETWORK_LOBBY_WINDOW_ITEM_ID, {
    [NETWORK_LOBBY_WINDOW_ITEM_ID]: layout.colorKey,
  });
  return [
    `left: ${layout.left}px`,
    `top: ${layout.top}px`,
    `width: ${layout.width}px`,
    `height: ${layout.height}px`,
    themeStyle,
  ].join("; ");
}

function syncNetworkLobbyWindowLayoutFromElement(windowEl: HTMLElement): void {
  const rect = windowEl.getBoundingClientRect();
  setNetworkLobbyWindowLayout({
    ...getNetworkLobbyWindowLayout(),
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });
}

function cycleNetworkLobbyWindowColor(): void {
  const layout = getNetworkLobbyWindowLayout();
  const themeIndex = Math.max(
    0,
    PINNED_COLOR_THEMES.findIndex((theme) => theme.key === layout.colorKey),
  );
  const nextTheme = PINNED_COLOR_THEMES[(themeIndex + 1) % PINNED_COLOR_THEMES.length] ?? PINNED_COLOR_THEMES[0];
  setNetworkLobbyWindowLayout({
    ...layout,
    colorKey: nextTheme.key,
  });
}

function getLobbyPreviewCells(round: NetworkLobbyPlaylistDraftRound): Array<{ x: number; y: number; kind: "relay" | "friendly_breach" | "enemy_breach" | "extraction" }> {
  const width = clampLobbyGridWidth(round.gridWidth);
  const height = clampLobbyGridHeight(round.gridHeight);
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  if (round.objectiveType === "control_relay") {
    if (Math.abs(width - height) <= 1) {
      return [
        { x: centerX, y: centerY, kind: "relay" as const },
        { x: Math.max(1, centerX - 1), y: centerY, kind: "relay" as const },
        { x: centerX, y: Math.max(1, centerY - 1), kind: "relay" as const },
        { x: Math.max(1, centerX - 1), y: Math.max(1, centerY - 1), kind: "relay" as const },
      ].filter((cell, index, all) =>
        cell.x > 0
        && cell.x < width - 1
        && cell.y > 0
        && cell.y < height - 1
        && all.findIndex((candidate) => candidate.x === cell.x && candidate.y === cell.y) === index,
      );
    }

    if (width > height) {
      const startX = Math.max(1, centerX - 1);
      const endX = Math.min(width - 2, centerX + 1);
      return Array.from({ length: endX - startX + 1 }, (_, index) => ({
        x: startX + index,
        y: centerY,
        kind: "relay" as const,
      }));
    }

    const startY = Math.max(1, centerY - 1);
    const endY = Math.min(height - 2, centerY + 1);
    return Array.from({ length: endY - startY + 1 }, (_, index) => ({
      x: centerX,
      y: startY + index,
      kind: "relay" as const,
    }));
  }

  if (round.objectiveType === "breakthrough") {
    const breachCount = width >= 9 ? 3 : width >= 7 ? 2 : 1;
    const offsets = breachCount === 1 ? [0] : breachCount === 2 ? [-1, 1] : [-1, 0, 1];
    const rows = offsets
      .map((offset) => Math.min(height - 2, Math.max(1, centerY + offset)))
      .filter((row, index, list) => list.indexOf(row) === index);
    return [
      ...rows.map((row) => ({ x: width - 2, y: row, kind: "friendly_breach" as const })),
      ...rows.map((row) => ({ x: 1, y: row, kind: "enemy_breach" as const })),
    ];
  }

  if (round.objectiveType === "extraction") {
    return [
      { x: centerX, y: centerY, kind: "extraction" as const },
      { x: Math.max(1, centerX - 1), y: centerY, kind: "extraction" as const },
    ].filter((cell, index, all) =>
      cell.x > 0
      && cell.x < width - 1
      && cell.y > 0
      && cell.y < height - 1
      && all.findIndex((candidate) => candidate.x === cell.x && candidate.y === cell.y) === index,
    );
  }

  return [];
}

function renderLobbyRoundPreview(round: NetworkLobbyPlaylistDraftRound): string {
  const width = clampLobbyGridWidth(round.gridWidth);
  const height = clampLobbyGridHeight(round.gridHeight);
  const previewCells = getLobbyPreviewCells(round);
  const cells = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const previewCell = previewCells.find((cell) => cell.x === x && cell.y === y);
      const classes = [
        "network-lobby-preview__cell",
        x === 0 ? "network-lobby-preview__cell--friendly-deploy" : "",
        x === width - 1 ? "network-lobby-preview__cell--enemy-deploy" : "",
        previewCell ? `network-lobby-preview__cell--${previewCell.kind}` : "",
      ].filter(Boolean).join(" ");
      const label = previewCell?.kind === "relay"
        ? "R"
        : previewCell?.kind === "friendly_breach"
          ? "H"
          : previewCell?.kind === "enemy_breach"
            ? "O"
            : previewCell?.kind === "extraction"
              ? "X"
              : "";
      return `<div class="${classes}">${label}</div>`;
    }).join(""),
  ).join("");

  return `
    <div class="network-lobby-preview">
      <div class="network-lobby-preview__grid" style="grid-template-columns: repeat(${width}, 1fr);">
        ${cells}
      </div>
      <div class="network-lobby-preview__meta">${getSquadWinConditionLabel(round.objectiveType)} // ${width}×${height}</div>
    </div>
  `;
}

function renderNetworkLobbyOverlay(lobby: LobbyState): string {
  ensureNetworkLobbyUiState(lobby);
  const localSlot = lobby.localSlot;
  const pendingChallenge = lobby.pendingChallenge;
  const isChallengee = Boolean(pendingChallenge && localSlot && pendingChallenge.challengeeSlot === localSlot);
  const isChallenger = Boolean(pendingChallenge && localSlot && pendingChallenge.challengerSlot === localSlot);
  const localIsSkirmishFighter = lobby.activity.kind === "skirmish"
    && localSlot
    && (lobby.activity.skirmish.challengerSlot === localSlot || lobby.activity.skirmish.challengeeSlot === localSlot);
  const activeRound = lobby.activity.kind === "skirmish"
    ? lobby.activity.skirmish.playlist.rounds[lobby.activity.skirmish.currentRoundIndex]
    : null;
  const hostCallsign = lobby.members[lobby.hostSlot]?.callsign ?? lobby.hostSlot;
  const layoutStyle = getNetworkLobbyWindowStyle();
  const minimizeLabel = networkLobbyWindowMinimized ? "+" : "_";
  const minimizeAriaLabel = networkLobbyWindowMinimized ? "Restore COMMS window" : "Minimize COMMS window";

  return `
    <aside class="window network-lobby-window network-lobby-shell ${networkLobbyWindowMinimized ? "network-lobby-window--minimized" : ""}" style="${layoutStyle}">
      <div class="window-header network-lobby-window__header network-lobby-shell__header">
        <div class="network-lobby-shell__heading">
          <div class="network-lobby-shell__kicker">COMMS</div>
          <div class="network-lobby-shell__join-label">JOIN CODE</div>
          <div class="network-lobby-shell__join-code">${lobby.joinCode}</div>
          <div class="network-lobby-shell__title">${hostCallsign} // HOST</div>
        </div>
        <div class="network-lobby-shell__toolbar">
          <button class="all-nodes-item-color network-lobby-window__color" type="button" id="networkLobbyCycleColorBtn" aria-label="Cycle lobby window color">
            <span class="all-nodes-item-color-dot" aria-hidden="true"></span>
          </button>
          <button class="all-nodes-item-minimize network-lobby-window__minimize" type="button" id="networkLobbyMinimizeBtn" aria-label="${minimizeAriaLabel}">${minimizeLabel}</button>
        </div>
      </div>

      ${networkLobbyWindowMinimized ? "" : `
      <section class="network-lobby-panel">
        <div class="network-lobby-panel__title">Roster</div>
        <div class="network-lobby-roster">
          ${NETWORK_PLAYER_SLOTS.map((slot) => {
            const member = lobby.members[slot];
            return `
              <div class="network-lobby-roster__item ${slot === localSlot ? "network-lobby-roster__item--local" : ""}">
                <div>
                  <strong>${slot}</strong>${member ? ` // ${member.callsign}` : " // OPEN"}
                </div>
                <span>${member ? `${member.authorityRole.toUpperCase()} • ${member.presence.toUpperCase()}` : "Awaiting link"}</span>
              </div>
            `;
          }).join("")}
        </div>
      </section>

      ${pendingChallenge ? `
        <section class="network-lobby-panel">
          <div class="network-lobby-panel__title">Pending Challenge</div>
          <div class="network-lobby-panel__copy">${pendingChallenge.challengerCallsign} challenged ${pendingChallenge.challengeeCallsign}.</div>
          ${renderLobbyRoundPreview({
            gridWidth: pendingChallenge.playlist.rounds[0]?.gridWidth ?? 8,
            gridHeight: pendingChallenge.playlist.rounds[0]?.gridHeight ?? 5,
            objectiveType: pendingChallenge.playlist.rounds[0]?.objectiveType ?? "elimination",
          })}
          <div class="network-lobby-panel__actions">
            ${isChallengee ? `
              <button class="network-lobby-shell__btn" type="button" id="networkLobbyAcceptChallengeBtn">ACCEPT</button>
              <button class="network-lobby-shell__btn network-lobby-shell__btn--ghost" type="button" id="networkLobbyDeclineChallengeBtn">DECLINE</button>
            ` : isChallenger ? `
              <button class="network-lobby-shell__btn network-lobby-shell__btn--ghost" type="button" id="networkLobbyCancelChallengeBtn">CANCEL CHALLENGE</button>
            ` : `<span class="network-lobby-panel__copy">Awaiting response.</span>`}
          </div>
        </section>
      ` : ""}

      ${lobby.activity.kind === "skirmish" ? `
        <section class="network-lobby-panel">
          <div class="network-lobby-panel__title">Active Skirmish</div>
          <div class="network-lobby-panel__copy">${lobby.activity.skirmish.challengerCallsign} vs ${lobby.activity.skirmish.challengeeCallsign} // ${lobby.activity.skirmish.status.toUpperCase()}</div>
          ${activeRound ? renderLobbyRoundPreview({
            gridWidth: activeRound.gridWidth,
            gridHeight: activeRound.gridHeight,
            objectiveType: activeRound.objectiveType,
          }) : ""}
          <div class="network-lobby-panel__actions">
            ${localIsSkirmishFighter ? `<button class="network-lobby-shell__btn" type="button" id="networkLobbyEnterSkirmishBtn">ENTER SKIRMISH</button>` : `<span class="network-lobby-panel__copy">Observers remain in the lobby while fighters deploy.</span>`}
          </div>
        </section>
      ` : ""}

      <section class="network-lobby-panel">
        <div class="network-lobby-panel__actions">
          <button class="network-lobby-shell__btn network-lobby-shell__btn--ghost" type="button" id="networkLobbyLeaveBtn">LEAVE LOBBY</button>
        </div>
      </section>
      `}
      ${networkLobbyWindowMinimized ? "" : `<button class="all-nodes-item-resize network-lobby-window__resize" type="button" id="networkLobbyResizeHandle" aria-label="Resize multiplayer lobby window"></button>`}
    </aside>
  `;
}

function attachNetworkLobbyOverlayHandlers(container: HTMLElement): void {
  const lobby = getActiveNetworkLobby();
  if (!lobby) {
    return;
  }

  const lobbyWindow = container.querySelector<HTMLElement>(".network-lobby-window");
  const lobbyWindowHeader = container.querySelector<HTMLElement>(".network-lobby-window__header");
  const colorCycleBtn = container.querySelector<HTMLElement>("#networkLobbyCycleColorBtn");
  const minimizeBtn = container.querySelector<HTMLElement>("#networkLobbyMinimizeBtn");
  const resizeHandle = container.querySelector<HTMLElement>("#networkLobbyResizeHandle");

  if (lobbyWindowHeader && lobbyWindow) {
    const persistWindowPosition = () => {
      requestAnimationFrame(() => {
        syncNetworkLobbyWindowLayoutFromElement(lobbyWindow);
      });
    };
    lobbyWindowHeader.addEventListener("pointerup", persistWindowPosition);
    lobbyWindowHeader.addEventListener("pointercancel", persistWindowPosition);
    lobbyWindowHeader.addEventListener("lostpointercapture", persistWindowPosition);
  }

  if (colorCycleBtn && lobbyWindow) {
    colorCycleBtn.onclick = () => {
      cycleNetworkLobbyWindowColor();
      lobbyWindow.setAttribute("style", getNetworkLobbyWindowStyle());
    };
  }

  if (minimizeBtn) {
    minimizeBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      networkLobbyWindowMinimized = !networkLobbyWindowMinimized;
      renderFieldScreen("network_lobby");
    };
  }

  if (resizeHandle && lobbyWindow) {
    resizeHandle.onpointerdown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLayout = getNetworkLobbyWindowLayout();

      resizeHandle.setPointerCapture(pointerId);

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) {
          return;
        }
        const nextLayout = clampNetworkLobbyWindowLayout({
          ...startLayout,
          width: startLayout.width + (moveEvent.clientX - startX),
          height: startLayout.height + (moveEvent.clientY - startY),
        });
        setNetworkLobbyWindowLayout(nextLayout);
        lobbyWindow.setAttribute("style", getNetworkLobbyWindowStyle());
      };

      const endResize = (endEvent?: PointerEvent) => {
        if (endEvent && endEvent.pointerId !== pointerId) {
          return;
        }
        try {
          resizeHandle.releasePointerCapture(pointerId);
        } catch {
          // ignore capture release failures after pointer end
        }
        resizeHandle.removeEventListener("pointermove", onPointerMove);
        resizeHandle.removeEventListener("pointerup", endResize);
        resizeHandle.removeEventListener("pointercancel", endResize);
        syncNetworkLobbyWindowLayoutFromElement(lobbyWindow);
      };

      resizeHandle.addEventListener("pointermove", onPointerMove);
      resizeHandle.addEventListener("pointerup", endResize);
      resizeHandle.addEventListener("pointercancel", endResize);
    };
  }

  const leaveBtn = container.querySelector<HTMLElement>("#networkLobbyLeaveBtn");
  if (leaveBtn) {
    leaveBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      import("../ui/screens/CommsArrayScreen").then(async ({ leaveCurrentMultiplayerLobby }) => {
        await leaveCurrentMultiplayerLobby();
      });
    };
  }

  const openSkirmishConsoleBtn = container.querySelector<HTMLElement>("#networkLobbyOpenSkirmishConsoleBtn");
  if (openSkirmishConsoleBtn) {
    openSkirmishConsoleBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      void import("../ui/screens/CommsArrayScreen").then(({ renderLobbySkirmishConsoleScreen }) => {
        renderLobbySkirmishConsoleScreen("field");
      });
    };
  }

  const challengeeSelect = container.querySelector<HTMLSelectElement>("#networkLobbyChallengeeSelect");
  if (challengeeSelect) {
    challengeeSelect.onchange = () => {
      networkLobbyUiState.challengeeSlot = (challengeeSelect.value as NetworkPlayerSlot | "") ?? "";
      renderFieldScreen("network_lobby");
    };
  }

  container.querySelectorAll<HTMLInputElement>("[data-lobby-round-width]").forEach((input) => {
    input.onchange = () => {
      const index = Number.parseInt(input.getAttribute("data-lobby-round-width") ?? "-1", 10);
      if (index < 0 || !networkLobbyUiState.playlistDraft[index]) {
        return;
      }
      networkLobbyUiState.playlistDraft[index].gridWidth = clampLobbyGridWidth(Number.parseInt(input.value, 10) || 8);
      renderFieldScreen("network_lobby");
    };
  });

  container.querySelectorAll<HTMLInputElement>("[data-lobby-round-height]").forEach((input) => {
    input.onchange = () => {
      const index = Number.parseInt(input.getAttribute("data-lobby-round-height") ?? "-1", 10);
      if (index < 0 || !networkLobbyUiState.playlistDraft[index]) {
        return;
      }
      networkLobbyUiState.playlistDraft[index].gridHeight = clampLobbyGridHeight(Number.parseInt(input.value, 10) || 5);
      renderFieldScreen("network_lobby");
    };
  });

  container.querySelectorAll<HTMLSelectElement>("[data-lobby-round-objective]").forEach((select) => {
    select.onchange = () => {
      const index = Number.parseInt(select.getAttribute("data-lobby-round-objective") ?? "-1", 10);
      if (index < 0 || !networkLobbyUiState.playlistDraft[index]) {
        return;
      }
      const nextObjective = select.value as SkirmishObjectiveType;
      networkLobbyUiState.playlistDraft[index].objectiveType = nextObjective;
      renderFieldScreen("network_lobby");
    };
  });

  container.querySelectorAll<HTMLElement>("[data-lobby-round-remove]").forEach((button) => {
    button.onclick = () => {
      const index = Number.parseInt(button.getAttribute("data-lobby-round-remove") ?? "-1", 10);
      if (index < 0 || networkLobbyUiState.playlistDraft.length <= 1) {
        return;
      }
      networkLobbyUiState.playlistDraft = networkLobbyUiState.playlistDraft.filter((_, roundIndex) => roundIndex !== index);
      renderFieldScreen("network_lobby");
    };
  });

  const addRoundBtn = container.querySelector<HTMLElement>("#networkLobbyAddPlaylistRoundBtn");
  if (addRoundBtn) {
    addRoundBtn.onclick = () => {
      networkLobbyUiState.playlistDraft = [
        ...networkLobbyUiState.playlistDraft,
        { ...networkLobbyUiState.playlistDraft[networkLobbyUiState.playlistDraft.length - 1] },
      ];
      renderFieldScreen("network_lobby");
    };
  }

  const sendChallengeBtn = container.querySelector<HTMLElement>("#networkLobbySendChallengeBtn");
  if (sendChallengeBtn) {
    sendChallengeBtn.onclick = () => {
      if (!networkLobbyUiState.challengeeSlot) {
        return;
      }
      const playlist = createLobbyPlaylist(networkLobbyUiState.playlistDraft.map((round) => ({
        gridWidth: round.gridWidth,
        gridHeight: round.gridHeight,
        objectiveType: round.objectiveType,
      })));
      import("../ui/screens/CommsArrayScreen").then(async ({ requestLobbySkirmishChallenge }) => {
        await requestLobbySkirmishChallenge(networkLobbyUiState.challengeeSlot as NetworkPlayerSlot, playlist);
      });
    };
  }

  const acceptBtn = container.querySelector<HTMLElement>("#networkLobbyAcceptChallengeBtn");
  if (acceptBtn) {
    acceptBtn.onclick = () => {
      import("../ui/screens/CommsArrayScreen").then(async ({ respondToLobbyChallenge }) => {
        await respondToLobbyChallenge(true);
      });
    };
  }

  const declineBtn = container.querySelector<HTMLElement>("#networkLobbyDeclineChallengeBtn");
  if (declineBtn) {
    declineBtn.onclick = () => {
      import("../ui/screens/CommsArrayScreen").then(async ({ respondToLobbyChallenge }) => {
        await respondToLobbyChallenge(false);
      });
    };
  }

  const cancelBtn = container.querySelector<HTMLElement>("#networkLobbyCancelChallengeBtn");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      import("../ui/screens/CommsArrayScreen").then(async ({ cancelLobbyChallenge }) => {
        await cancelLobbyChallenge();
      });
    };
  }

  const enterSkirmishBtn = container.querySelector<HTMLElement>("#networkLobbyEnterSkirmishBtn");
  if (enterSkirmishBtn) {
    enterSkirmishBtn.onclick = () => {
      import("../ui/screens/CommsArrayScreen").then(({ openCurrentLobbySkirmish }) => {
        openCurrentLobbySkirmish();
      });
    };
  }

  container.querySelectorAll<HTMLInputElement>("[data-lobby-coop-slot]").forEach((checkbox) => {
    checkbox.onchange = () => {
      const slot = checkbox.getAttribute("data-lobby-coop-slot") as NetworkPlayerSlot | null;
      if (!slot) {
        return;
      }
      if (checkbox.checked) {
        if (!networkLobbyUiState.coopSelectedSlots.includes(slot)) {
          networkLobbyUiState.coopSelectedSlots = [...networkLobbyUiState.coopSelectedSlots, slot];
        }
      } else {
        networkLobbyUiState.coopSelectedSlots = networkLobbyUiState.coopSelectedSlots.filter((selectedSlot) => selectedSlot !== slot);
      }
      renderFieldScreen("network_lobby");
    };
  });

  const startCoopBtn = container.querySelector<HTMLElement>("#networkLobbyStartCoopBtn");
  if (startCoopBtn) {
    startCoopBtn.onclick = () => {
      void import("../ui/screens/CommsArrayScreen").then(async ({ startLobbyCoopOperations }) => {
        await startLobbyCoopOperations(networkLobbyUiState.coopSelectedSlots);
      });
    };
  }
}

type PinnedNodeDefinition = {
  action: string;
  icon: string;
  label: string;
  desc: string;
  variant?: string;
};

type PinnedColorTheme = {
  key: string;
  vars: Record<string, string>;
};

const PINNED_QUAC_LAYOUT_ID = "quac-terminal";
const PINNED_RESOURCE_LAYOUT_ID = "resource-tracker";
const PINNED_QUEST_TRACKER_LAYOUT_ID = "quest-tracker";
const PINNED_THEATER_AUTO_TICK_LAYOUT_ID = "theater-auto-tick";
const PINNED_MATERIALS_REFINERY_RESOURCE_SHORT_LABELS: Record<string, string> = {
  metalScrap: "M",
  wood: "T",
  chaosShards: "C",
  steamComponents: "S",
};

const PINNED_NODE_LAYOUT: PinnedNodeDefinition[] = [
  { action: "ops-terminal", icon: "OPS", label: "OPS TERMINAL", desc: "Deploy on operations", variant: "all-nodes-node-btn--primary" },
  { action: "roster", icon: "RST", label: "UNIT ROSTER", desc: "Manage your units" },
  { action: "loadout", icon: "LDT", label: "LOADOUT", desc: "Equipment & inventory" },
  { action: "inventory", icon: "INV", label: "INVENTORY", desc: "View all owned items" },
  { action: "gear-workbench", icon: "WKS", label: "WORKSHOP", desc: "Craft, upgrade & tinker" },
  { action: "materials-refinery", icon: "CRF", label: "LIGHT CRAFTING", desc: "Refine advanced field materials" },
  { action: "shop", icon: "SHP", label: "SHOP", desc: "Buy items & PAKs" },
  { action: "tavern", icon: "TAV", label: "TAVERN", desc: "Recruit new units" },
  { action: "quest-board", icon: "QST", label: "QUEST BOARD", desc: "View active quests" },
  { action: "port", icon: "PRT", label: "PORT", desc: "Trade resources" },
  { action: "quarters", icon: "QTR", label: "QUARTERS", desc: "Rest & heal units" },
  { action: "stable", icon: "STB", label: "STABLE", desc: "Manage mounts", variant: "all-nodes-node-btn--stable" },
  { action: "black-market", icon: "BLK", label: "BLACK MARKET", desc: "Acquire illicit field mods" },
  { action: "schema", icon: "SCH", label: "S.C.H.E.M.A.", desc: "Authorize future C.O.R.E. build types", variant: "all-nodes-node-btn--utility" },
  { action: "foundry-annex", icon: "FND", label: "FOUNDRY + ANNEX", desc: "Unlock module logic and partition authorizations", variant: "all-nodes-node-btn--utility" },
  { action: PINNED_THEATER_AUTO_TICK_LAYOUT_ID, icon: "TCK", label: "THEATER CLOCK", desc: "Advance active theaters in the background", variant: "all-nodes-node-btn--utility" },
  { action: "codex", icon: "CDX", label: "CODEX", desc: "Archives & bestiary", variant: "all-nodes-node-btn--utility" },
  { action: "settings", icon: "CFG", label: "SETTINGS", desc: "Game options", variant: "all-nodes-node-btn--utility" },
  { action: "comms-array", icon: "COM", label: "COMMS ARRAY", desc: "Training & multiplayer", variant: "all-nodes-node-btn--utility" },
];

const PINNED_VALID_ITEM_IDS = new Set([
  PINNED_RESOURCE_LAYOUT_ID,
  ...PINNED_NODE_LAYOUT.map((node) => node.action),
  PINNED_QUAC_LAYOUT_ID,
  MINIMAP_LAYOUT_ID,
  NOTES_LAYOUT_ID,
  PINNED_QUEST_TRACKER_LAYOUT_ID,
]);
const SCHEMA_LOCK_MESSAGE = `S.C.H.E.M.A. comes online after Floor ${String(SCHEMA_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const PORT_LOCK_MESSAGE = `PORT unlocks after Floor ${String(PORT_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const STABLE_LOCK_MESSAGE = `STABLE unlocks after Floor ${String(STABLE_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const DISPATCH_LOCK_MESSAGE = `DISPATCH unlocks after Floor ${String(DISPATCH_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const BLACK_MARKET_LOCK_MESSAGE = `BLACK MARKET unlocks after Floor ${String(BLACK_MARKET_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const FOUNDRY_ANNEX_LOCK_MESSAGE = `FOUNDRY + ANNEX comes online after Floor ${String(FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;

const PINNED_COLOR_THEMES: PinnedColorTheme[] = [
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

const PINNED_COLOR_THEME_MAP = new Map(PINNED_COLOR_THEMES.map((theme) => [theme.key, theme]));

const PINNED_QUAC_COMMAND_ALIASES: Array<{ action: string; aliases: string[] }> = [
  { action: "ops-terminal", aliases: ["ops", "ops terminal", "operation", "operations", "deploy", "mission", "missions"] },
  { action: "roster", aliases: ["roster", "unit roster", "units", "party", "manage units"] },
  { action: "loadout", aliases: ["loadout", "gear", "equipment", "equip", "locker"] },
  { action: "inventory", aliases: ["inventory", "items", "assets", "storage", "owned items"] },
  { action: "gear-workbench", aliases: ["workshop", "workbench", "gear workbench", "upgrade gear"] },
  { action: "materials-refinery", aliases: ["crafting", "materials", "refinery", "alloy", "drawcord", "fittings", "resin", "charge cells"] },
  { action: "shop", aliases: ["shop", "store", "quartermaster", "buy", "market"] },
  { action: "tavern", aliases: ["tavern", "recruit", "recruitment", "hire"] },
  { action: "quest-board", aliases: ["quest", "quests", "quest board", "board", "jobs"] },
  { action: "port", aliases: ["port", "trade", "trading", "manifest", "supply"] },
  { action: "quarters", aliases: ["quarters", "rest", "barracks", "heal"] },
  { action: "stable", aliases: ["stable", "mounts", "mount", "mounted units"] },
  { action: "black-market", aliases: ["black market", "black-market", "mods", "field mods", "contraband"] },
  { action: "schema", aliases: ["schema", "s c h e m a", "core housing", "core engineering", "core authorization", "core unlocks"] },
  { action: "foundry-annex", aliases: ["foundry", "annex", "foundry annex", "foundry + annex"] },
  { action: PINNED_THEATER_AUTO_TICK_LAYOUT_ID, aliases: ["theater clock", "theater tick", "theater timer", "auto tick", "advance theaters", "background theater"] },
  { action: "codex", aliases: ["codex", "archive", "archives", "bestiary"] },
  { action: "settings", aliases: ["settings", "config", "configuration", "options"] },
  { action: "comms-array", aliases: ["comms", "comms array", "multiplayer", "training"] },
  { action: "endless-field-nodes", aliases: ["endless rooms", "debug endless rooms"] },
  { action: "endless-battles", aliases: ["endless battles", "debug endless battles"] },
];

const FIELD_ESC_NODE_ACTION_SET = new Set(PINNED_NODE_LAYOUT.map((node) => node.action));

function isFieldEscNodeAction(action: string): action is EscNodeAction {
  return FIELD_ESC_NODE_ACTION_SET.has(action);
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get the current map ID from field state
 */
export function getCurrentFieldMap(): FieldMap["id"] | null {
  return fieldState?.currentMap || null;
}

export function getCurrentFieldRuntimeMap(): FieldMap | null {
  return currentMap;
}

export function getCurrentFieldRuntimeState(): FieldState | null {
  return fieldState;
}

export function isCurrentHaven3DFieldObjectVisible(objectId: string): boolean {
  return haven3DFieldController?.isFieldObjectVisible(objectId) ?? false;
}

export function setNextFieldSpawnOverride(
  mapId: FieldMap["id"],
  position: { x: number; y: number; facing?: "north" | "south" | "east" | "west" },
): void {
  pendingFieldSpawnOverride = {
    mapId,
    x: position.x,
    y: position.y,
    facing: position.facing,
  };
}

export function setNextFieldSpawnOverrideTile(
  mapId: FieldMap["id"],
  position: { x: number; y: number; facing?: "north" | "south" | "east" | "west" },
): void {
  const tileSize = 64;
  setNextFieldSpawnOverride(mapId, {
    x: position.x * tileSize + tileSize / 2,
    y: position.y * tileSize + tileSize / 2,
    facing: position.facing,
  });
}

/**
 * Store the interaction zone position for returning to field from nodes
 */
export function storeInteractionZonePosition(zoneId: string, x: number, y: number): void {
  lastInteractionZonePosition = { x, y, zoneId };
}

function stopHaven3DFieldRuntime(): void {
  if (haven3DFieldController) {
    haven3DFieldCameraStates.set(String(haven3DFieldController.mapId), haven3DFieldController.getCameraState());
  }
  haven3DFieldController?.dispose();
  haven3DFieldController = null;
}

export function getCurrentHaven3DFieldCameraState(): Haven3DFieldCameraState | null {
  return haven3DFieldController?.getCameraState() ?? null;
}

function isHaven3DSupportedMap(mapId: FieldMap["id"] | string | null | undefined): boolean {
  return mapId === "base_camp" || isOuterDeckAccessibleMap(mapId);
}

function getFieldViewMode(mapId: FieldMap["id"] | string | null | undefined = currentMap?.id): FieldViewMode {
  if (!mapId || !isHaven3DSupportedMap(mapId)) {
    return "top-down";
  }
  return fieldViewModes.get(mapId) ?? "third-person";
}

function setFieldViewMode(mapId: FieldMap["id"] | string, mode: FieldViewMode): void {
  if (!isHaven3DSupportedMap(mapId)) {
    return;
  }
  fieldViewModes.set(mapId, mode);
}

function shouldUseHaven3DFieldRuntime(mapId: FieldMap["id"] | string, options?: { openBuildMode?: boolean }): boolean {
  return isHaven3DSupportedMap(mapId)
    && !options?.openBuildMode
    && getFieldViewMode(mapId) === "third-person";
}

function isHaven3DFieldRuntimeActive(): boolean {
  return Boolean(currentMap && isHaven3DSupportedMap(currentMap.id) && haven3DFieldController);
}

function renderFieldViewToggle(mapId: FieldMap["id"] | string = currentMap?.id ?? "base_camp"): string {
  const showingThirdPerson = getFieldViewMode(mapId) === "third-person";
  const title = isOuterDeckAccessibleMap(mapId)
    ? "Switch outer deck camera"
    : "Switch base camp camera";
  return `
    <button
      class="field-view-toggle ${showingThirdPerson ? "field-view-toggle--third-person" : "field-view-toggle--top-down"}"
      type="button"
      data-field-view-toggle
      aria-pressed="${showingThirdPerson}"
      title="${title}"
    >
      <span class="field-view-toggle__label">VIEW</span>
      <span class="field-view-toggle__value">${showingThirdPerson ? "3D" : "TOP"}</span>
    </button>
  `;
}

function switchFieldViewMode(): void {
  if (!currentMap || !isHaven3DSupportedMap(currentMap.id)) {
    return;
  }
  const nextMode = getFieldViewMode(currentMap.id) === "third-person" ? "top-down" : "third-person";
  setFieldViewMode(currentMap.id, nextMode);
  renderFieldScreen(currentMap.id);
}

function handleFieldViewTogglePointerDown(event: PointerEvent): void {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLElement>("[data-field-view-toggle]");
  if (!button || !document.querySelector(".field-root")) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  switchFieldViewMode();
}

function attachFieldViewToggleHandlers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-field-view-toggle]").forEach((button) => {
    if (button.dataset.fieldViewToggleKeybound === "true") {
      return;
    }
    button.dataset.fieldViewToggleKeybound = "true";
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      switchFieldViewMode();
    });
  });
}

function updateHaven3DFieldRuntime(deltaTime: number, currentTime: number): void {
  if (!fieldState || !currentMap) {
    return;
  }

  if (fieldState.isPaused) {
    resetFieldControllerActionTracking();
    return;
  }

  const state = getGameState();
  syncRuntimeFieldAvatarsFromState(state);

  if (fieldState.npcs) {
    const map = currentMap;
    fieldState.npcs = fieldState.npcs.map((npc) => updateNpc(npc, map, deltaTime, currentTime));
  }

  updateFieldCombat(deltaTime, currentTime);
  processFieldControllerActions();
  maybeTriggerAutoInteraction();
  activeInteractionPrompt = isFieldCombatActive() ? null : getCombinedInteractionPrompt();
  syncMountedFieldStateMeters();
  syncFieldMinimapExploration();
  flushFieldAvatarPositionsToGameState();
  if (refreshOuterDeckStreamWindowIfNeeded()) {
    return;
  }
  drawPinnedMinimapOverlay();
}

function mountHaven3DFieldRuntime(root: HTMLElement): void {
  if (!currentMap || !fieldState) {
    return;
  }

  stopHaven3DFieldRuntime();

  const existingPanel = root.querySelector("#allNodesPanel");
  root.innerHTML = "";
  if (existingPanel) {
    root.appendChild(existingPanel);
  }

  const fieldRoot = document.createElement("div");
  fieldRoot.className = "field-root field-root--haven3d";
  fieldRoot.innerHTML = `
    <div class="haven3d-root">
      <div class="haven3d-scene" data-haven3d-scene></div>
      <div class="haven3d-hud">
        ${renderFieldStateMeterHtml()}
        <div class="haven3d-corner-controls">
          ${renderFieldViewToggle(currentMap.id)}
          <div class="haven3d-mode-strip" aria-label="Gearblade modes">
            <button class="haven3d-mode-chip" type="button" data-haven3d-mode="blade"><span>1</span>Blade</button>
            <button class="haven3d-mode-chip" type="button" data-haven3d-mode="launcher"><span>2</span>Launcher</button>
            <button class="haven3d-mode-chip" type="button" data-haven3d-mode="grapple"><span>3</span>Grapple</button>
          </div>
        </div>
        <div class="haven3d-prompt" data-haven3d-prompt></div>
      </div>
    </div>
  `;
  root.insertBefore(fieldRoot, root.firstChild);

  const sceneHost = fieldRoot.querySelector<HTMLElement>("[data-haven3d-scene]");
  if (!sceneHost) {
    return;
  }

  const map = currentMap;
  haven3DFieldController = new Haven3DFieldController({
    host: sceneHost,
    map,
    initialCameraState: haven3DFieldCameraStates.get(String(map.id)) ?? null,
    getNpcs: () => fieldState?.npcs ?? [],
    getEnemies: () => fieldState?.fieldEnemies ?? [],
    getCompanion: () => fieldState?.companion ?? null,
    getPlayerAvatar: (playerId) => getRuntimeFieldAvatar(playerId),
    isPlayerActive: (playerId) => isFieldPlayerActive(playerId),
    isPaused: () => Boolean(fieldState?.isPaused),
    setPlayerAvatar: (playerId, x, y, facing) => {
      setRuntimeFieldAvatarPosition(playerId, x, y, facing);
    },
    constrainPlayerPosition: (playerId, desired, previous) => {
      const otherPlayerId: PlayerId = playerId === "P1" ? "P2" : "P1";
      const otherAvatar = isFieldPlayerActive(otherPlayerId)
        ? getRuntimeFieldAvatar(otherPlayerId)
        : null;
      if (!otherAvatar) {
        return desired;
      }

      const constrained = applyTetherConstraint(previous, desired, otherAvatar);
      return {
        ...desired,
        x: constrained.x,
        y: constrained.y,
      };
    },
    getPrompt: () => activeInteractionPrompt,
    onInteractPressed: (playerId) => handleInteractKey(playerId),
    onOpenMenu: () => toggleAllNodesPanel(),
    onFrame: (deltaTime, currentTime) => updateHaven3DFieldRuntime(deltaTime, currentTime),
    isFieldObjectVisible: (objectId) => {
      const fieldObject = map.objects.find((object) => object.id === objectId);
      if (fieldObject?.type !== "resource") {
        return true;
      }
      return !(fieldState?.collectedResourceObjectIds ?? []).includes(objectId);
    },
    onPlayerFootstep: () => playPlaceholderSfx("ui-move"),
    onBladeStrike: (strike) => handleHaven3DBladeStrike(strike),
    onLauncherImpact: (impact) => handleHaven3DLauncherImpact(impact),
    onGrappleImpact: (impact) => handleHaven3DGrappleImpact(impact),
    enableGearbladeModes: true,
    enabledGearbladeModes: ["blade", "launcher", "grapple"],
  });
  haven3DFieldController.start();

  attachFieldViewToggleHandlers(fieldRoot);
  ensureFieldFeedbackListener();
  registerFieldControllerContext();
  scheduleFieldFocusableRefresh();
}

function syncFieldMinimapExploration(): void {
  if (!fieldState || !currentMap) {
    return;
  }

  const tileX = Math.floor(fieldState.player.x / FIELD_TILE_SIZE);
  const tileY = Math.floor(fieldState.player.y / FIELD_TILE_SIZE);
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
    return;
  }

  const outerDeckMetadata = getOuterDeckStreamMetadata(currentMap);
  const worldTileX = tileX + Math.floor(Number(outerDeckMetadata?.worldOriginTileX ?? 0));
  const worldTileY = tileY + Math.floor(Number(outerDeckMetadata?.worldOriginTileY ?? 0));
  const revealKey = `${currentMap.id}:${worldTileX}:${worldTileY}`;
  if (revealKey === lastMinimapRevealKey) {
    return;
  }

  lastMinimapRevealKey = revealKey;
  revealFieldMinimapArea(currentMap.id, tileX, tileY, FIELD_MINIMAP_REVEAL_RADIUS, {
    width: currentMap.width,
    height: currentMap.height,
    worldOriginTileX: outerDeckMetadata?.worldOriginTileX,
    worldOriginTileY: outerDeckMetadata?.worldOriginTileY,
  });
}

type StreamedEnemySnapshot = {
  persistentKey: string;
  hp: number;
  facing: FieldEnemy["facing"];
  gearbladeDefenseBroken?: boolean;
};

function getStreamedEnemySnapshots(map: FieldMap, enemies: FieldEnemy[] = []): StreamedEnemySnapshot[] {
  return enemies
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => ({
      persistentKey: getPersistentFieldEnemyKey(enemy, map),
      hp: enemy.hp,
      facing: enemy.facing,
      gearbladeDefenseBroken: enemy.gearbladeDefenseBroken,
    }));
}

function syncFieldEnemiesForStreamedOuterDeckMap(map: FieldMap, previousSnapshots: StreamedEnemySnapshot[]): FieldEnemy[] {
  const snapshotByKey = new Map(previousSnapshots.map((snapshot) => [snapshot.persistentKey, snapshot]));
  return syncFieldEnemiesForMap(map).map((enemy) => {
    const snapshot = snapshotByKey.get(getPersistentFieldEnemyKey(enemy, map));
    if (!snapshot) {
      return enemy;
    }
    return {
      ...enemy,
      hp: Math.max(1, Math.min(enemy.maxHp, snapshot.hp)),
      facing: snapshot.facing,
      gearbladeDefenseBroken: snapshot.gearbladeDefenseBroken ?? enemy.gearbladeDefenseBroken,
    };
  });
}

function clampLocalOuterDeckPosition(map: FieldMap, position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(FIELD_TILE_SIZE / 2, Math.min((map.width * FIELD_TILE_SIZE) - (FIELD_TILE_SIZE / 2), position.x)),
    y: Math.max(FIELD_TILE_SIZE / 2, Math.min((map.height * FIELD_TILE_SIZE) - (FIELD_TILE_SIZE / 2), position.y)),
  };
}

function rebuildOuterDeckStreamWindow(): boolean {
  if (!currentMap || !fieldState || !isOuterDeckOpenWorldMap(currentMap)) {
    return false;
  }

  const previousMap = currentMap;
  const playerWorld = outerDeckLocalPixelToWorld(previousMap, fieldState.player.x, fieldState.player.y);
  const companionWorld = fieldState.companion
    ? outerDeckLocalPixelToWorld(previousMap, fieldState.companion.x, fieldState.companion.y)
    : null;
  const p2World = fieldRuntimeP2Avatar
    ? outerDeckLocalPixelToWorld(previousMap, fieldRuntimeP2Avatar.x, fieldRuntimeP2Avatar.y)
    : null;
  const enemySnapshots = getStreamedEnemySnapshots(previousMap, fieldState.fieldEnemies ?? []);
  const wasUsingHaven3D = isHaven3DFieldRuntimeActive();

  persistOuterDeckOpenWorldRuntimeState(true);
  const nextMap = getFieldMap(previousMap.id);
  if (!isOuterDeckOpenWorldMap(nextMap)) {
    return false;
  }

  const nextPlayerLocal = clampLocalOuterDeckPosition(nextMap, outerDeckWorldPixelToLocal(nextMap, playerWorld.x, playerWorld.y));
  const nextCompanionLocal = companionWorld
    ? clampLocalOuterDeckPosition(nextMap, outerDeckWorldPixelToLocal(nextMap, companionWorld.x, companionWorld.y))
    : null;
  const nextP2Local = p2World
    ? clampLocalOuterDeckPosition(nextMap, outerDeckWorldPixelToLocal(nextMap, p2World.x, p2World.y))
    : null;

  currentMap = nextMap;
  fieldState = {
    ...fieldState,
    currentMap: nextMap.id,
    player: normalizeFieldPlayerState({
      ...fieldState.player,
      x: nextPlayerLocal.x,
      y: nextPlayerLocal.y,
    }),
    companion: fieldState.companion && nextCompanionLocal
      ? {
          ...fieldState.companion,
          x: nextCompanionLocal.x,
          y: nextCompanionLocal.y,
        }
      : fieldState.companion,
    npcs: syncFieldNpcsForMap(nextMap.id, fieldState.npcs ?? []),
    fieldEnemies: syncFieldEnemiesForStreamedOuterDeckMap(nextMap, enemySnapshots),
    projectiles: [],
    collectedResourceObjectIds: fieldState.collectedResourceObjectIds ?? [],
  };

  if (nextP2Local && fieldRuntimeP2Avatar) {
    fieldRuntimeP2Avatar = {
      ...fieldRuntimeP2Avatar,
      x: nextP2Local.x,
      y: nextP2Local.y,
    };
  }

  activeAutoInteractionZoneKey = null;
  suppressedAutoInteractionZoneKey = null;
  lastMinimapRevealKey = "";
  syncFieldMinimapExploration();
  lastFieldAvatarSyncAtMs = Number.NEGATIVE_INFINITY;
  lastFieldAvatarSyncKey = "";

  if (wasUsingHaven3D) {
    const root = document.getElementById("app");
    if (root) {
      mountHaven3DFieldRuntime(root);
      createPinnedNodesOverlay();
      requestAnimationFrame(() => drawPinnedMinimapOverlay());
    }
  } else {
    render();
    requestAnimationFrame(() => drawPinnedMinimapOverlay());
  }

  return true;
}

function refreshOuterDeckStreamWindowIfNeeded(): boolean {
  if (!currentMap || !fieldState || !isOuterDeckOpenWorldMap(currentMap)) {
    return false;
  }

  const world = outerDeckLocalPixelToWorld(currentMap, fieldState.player.x, fieldState.player.y);
  if (!shouldRecenterOuterDeckStreamWindow(currentMap, world.x, world.y)) {
    return false;
  }

  return rebuildOuterDeckStreamWindow();
}

function drawPinnedMinimapOverlay(): void {
  const overlay = document.getElementById("fieldPinnedOverlay");
  if (!overlay || !currentMap || !fieldState) {
    return;
  }

  const canvas = overlay.querySelector<HTMLCanvasElement>("[data-field-minimap-canvas]");
  if (!canvas) {
    return;
  }

  drawFieldMinimapCanvas(
    canvas,
    buildFieldMinimapModel(currentMap.id, {
      runtimeMap: currentMap,
      runtimeFieldState: fieldState,
    }),
    { transparent: true },
  );
}

function getPlayerInteractLabel(playerId: PlayerId): string {
  const interactLabel = getPlayerActionLabel(playerId, "interact");
  if (!getAssignedGamepad(playerId)) {
    return interactLabel;
  }

  const confirmLabel = getPlayerActionLabel(playerId, "confirm");
  return confirmLabel !== interactLabel ? `${interactLabel} / ${confirmLabel}` : interactLabel;
}

function resetFieldControllerActionTracking(): void {
  previousFieldControllerActions.P1 = { interact: false, attack: false, special1: false };
  previousFieldControllerActions.P2 = { interact: false, attack: false, special1: false };
}

function getFieldControllerActionSnapshot(playerId: PlayerId): FieldControllerActionSnapshot {
  if (!getAssignedGamepad(playerId)) {
    return {
      interact: false,
      attack: false,
      special1: false,
    };
  }

  return {
    interact: isGamepadActionActive(playerId, "interact")
      || isGamepadActionActive(playerId, "confirm"),
    attack: isGamepadActionActive(playerId, "attack"),
    special1: isGamepadActionActive(playerId, "dash")
      || isGamepadActionActive(playerId, "tabPrev")
      || isGamepadActionActive(playerId, "tabNext"),
  };
}

function processFieldControllerActions(): void {
  if (!fieldState || !currentMap || fieldState.isPaused) {
    resetFieldControllerActionTracking();
    return;
  }

  const combatActive = isFieldCombatActive();
  const state = getGameState();
  const activePlayers = (["P1", "P2"] as PlayerId[]).filter((playerId) => isFieldPlayerActive(playerId, state));

  for (const playerId of activePlayers) {
    const previous = previousFieldControllerActions[playerId];
    const next = getFieldControllerActionSnapshot(playerId);

    const interactPressed = next.interact && !previous.interact;
    const attackPressed = next.attack && !previous.attack;
    const specialPressed = next.special1 && !previous.special1;

    previousFieldControllerActions[playerId] = next;

    if (combatActive) {
      if (playerId === "P1" && specialPressed) {
        toggleFieldCombatRangedMode();
      }

      if (playerId === "P1" && attackPressed) {
        triggerFieldCombatAttack();
      }
      continue;
    }

    if (interactPressed) {
      handleInteractKey(playerId);
      break;
    }
  }
}

function createRuntimeAvatar(playerId: PlayerId): PlayerAvatar | null {
  const avatar = getRuntimeFieldAvatar(playerId);
  if (!avatar) {
    return null;
  }

  return {
    x: avatar.x,
    y: avatar.y,
    width: 32,
    height: 32,
    speed: 240,
    facing: avatar.facing,
  };
}

type InteractionActorContext = {
  playerId: PlayerId;
  avatar: PlayerAvatar;
  zone: InteractionZone;
};

function getPlayerInteractionContext(playerId: PlayerId): InteractionActorContext | null {
  if (!currentMap) {
    return null;
  }

  const avatar = createRuntimeAvatar(playerId);
  if (!avatar) {
    return null;
  }

  const zoneId = getOverlappingInteractionZone(avatar, currentMap);
  if (!zoneId) {
    return null;
  }

  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) {
    return null;
  }

  return {
    playerId,
    avatar,
    zone,
  };
}

function getNearestPlayerToZone(zone: InteractionZone): PlayerId | null {
  const candidates = (["P1", "P2"] as PlayerId[])
    .filter((playerId) => isFieldPlayerActive(playerId))
    .map((playerId) => {
      const avatar = createRuntimeAvatar(playerId);
      if (!avatar) {
        return null;
      }

      const zoneCenterX = (zone.x + zone.width / 2) * 64;
      const zoneCenterY = (zone.y + zone.height / 2) * 64;
      const dx = avatar.x - zoneCenterX;
      const dy = avatar.y - zoneCenterY;
      return {
        playerId,
        distance: Math.sqrt(dx * dx + dy * dy),
      };
    })
    .filter(Boolean) as Array<{ playerId: PlayerId; distance: number }>;

  candidates.sort((left, right) => left.distance - right.distance);
  return candidates[0]?.playerId ?? null;
}

function isAutoTriggerZone(zone: InteractionZone | null | undefined): boolean {
  return Boolean(zone?.metadata?.autoTrigger);
}

function buildAutoInteractionZoneKey(
  mapId: string,
  playerId: PlayerId,
  zoneId: string,
): string {
  return `${mapId}:${playerId}:${zoneId}`;
}

function shouldPrepareFieldReturnFromInteraction(zone: InteractionZone): boolean {
  if (!isAutoTriggerZone(zone)) {
    return false;
  }

  switch (zone.action) {
    case "shop":
    case "roster":
    case "loadout":
    case "ops_terminal":
    case "quest_board":
    case "tavern":
    case "gear_workbench":
    case "port":
    case "dispatch":
    case "black_market":
    case "stable":
    case "schema":
    case "foundry-annex":
    case "comms-array":
      return true;
    case "custom":
      return zone.metadata?.handlerId === "weaponsmith_workshop";
    default:
      return false;
  }
}

function getDoorExitFacing(zone: InteractionZone): PlayerAvatar["facing"] | null {
  switch (zone.metadata?.doorFacing) {
    case "north":
      return "north";
    case "east":
      return "east";
    case "west":
      return "west";
    case "south":
      return "south";
    default:
      return null;
  }
}

function resolveInteractionExitPosition(
  zone: InteractionZone,
  savedPlayerPos: { x: number; y: number },
): { x: number; y: number; facing?: PlayerAvatar["facing"] } {
  const tileSize = FIELD_TILE_SIZE;
  const zoneLeft = zone.x * tileSize;
  const zoneTop = zone.y * tileSize;
  const zoneRight = (zone.x + zone.width) * tileSize;
  const zoneBottom = (zone.y + zone.height) * tileSize;
  const exitFacing = getDoorExitFacing(zone);
  const clampXToZone = () => Math.max(zoneLeft + (tileSize / 2), Math.min(zoneRight - (tileSize / 2), savedPlayerPos.x));
  const clampYToZone = () => Math.max(zoneTop + (tileSize / 2), Math.min(zoneBottom - (tileSize / 2), savedPlayerPos.y));

  switch (zone.metadata?.doorFacing) {
    case "north":
      return { x: clampXToZone(), y: zoneTop - (tileSize / 2), facing: exitFacing ?? undefined };
    case "east":
      return { x: zoneRight + (tileSize / 2), y: clampYToZone(), facing: exitFacing ?? undefined };
    case "west":
      return { x: zoneLeft - (tileSize / 2), y: clampYToZone(), facing: exitFacing ?? undefined };
    case "south":
      return { x: clampXToZone(), y: zoneBottom + (tileSize / 2), facing: exitFacing ?? undefined };
    default:
      break;
  }

  const pushPadding = 28;
  const nearestBoundary = [
    { axis: "x" as const, value: zoneLeft - pushPadding, distance: Math.abs(savedPlayerPos.x - zoneLeft) },
    { axis: "x" as const, value: zoneRight + pushPadding, distance: Math.abs(savedPlayerPos.x - zoneRight) },
    { axis: "y" as const, value: zoneTop - pushPadding, distance: Math.abs(savedPlayerPos.y - zoneTop) },
    { axis: "y" as const, value: zoneBottom + pushPadding, distance: Math.abs(savedPlayerPos.y - zoneBottom) },
  ].sort((left, right) => left.distance - right.distance)[0];

  if (nearestBoundary?.axis === "x") {
    return {
      x: nearestBoundary.value,
      y: Math.max(zoneTop - tileSize, Math.min(zoneBottom + tileSize, savedPlayerPos.y)),
    };
  }

  if (nearestBoundary?.axis === "y") {
    return {
      x: Math.max(zoneLeft - tileSize, Math.min(zoneRight + tileSize, savedPlayerPos.x)),
      y: nearestBoundary.value,
    };
  }

  return { ...savedPlayerPos };
}

function getCombinedInteractionPrompt(): string | null {
  const state = getGameState();
  if (!isLocalCoopActive(state)) {
    const soloContext = getPlayerInteractionContext("P1");
    return soloContext && !isAutoTriggerZone(soloContext.zone)
      ? `${getPlayerInteractLabel("P1")} :: ${soloContext.zone.label}`
      : null;
  }

  const contexts = (["P1", "P2"] as PlayerId[])
    .map((playerId) => getPlayerInteractionContext(playerId))
    .filter((context): context is InteractionActorContext => {
      if (!context) {
        return false;
      }
      return !isAutoTriggerZone(context.zone);
    });

  if (contexts.length === 0) {
    return null;
  }

  const uniqueZones = new Map<string, InteractionActorContext[]>();
  contexts.forEach((context) => {
    const existing = uniqueZones.get(context.zone.id) ?? [];
    existing.push(context);
    uniqueZones.set(context.zone.id, existing);
  });

  const promptParts = Array.from(uniqueZones.values()).map((zoneContexts) => {
    const labels = zoneContexts
      .map((context) => `${getPlayerControllerLabel(context.playerId)} [${getPlayerInteractLabel(context.playerId)}]`)
      .join(" // ");
    return `${labels} :: ${zoneContexts[0]?.zone.label}`;
  });

  return promptParts.join(" | ");
}

function getFieldInteractionPromptOverlayPoint(promptEl: HTMLElement): { x: number; y: number } | null {
  const state = getGameState();
  const contexts = !isLocalCoopActive(state)
    ? [getPlayerInteractionContext("P1")].filter((context): context is InteractionActorContext => {
        if (!context) {
          return false;
        }
        return !isAutoTriggerZone(context.zone);
      })
    : (["P1", "P2"] as PlayerId[])
        .map((playerId) => getPlayerInteractionContext(playerId))
        .filter((context): context is InteractionActorContext => {
          if (!context) {
            return false;
          }
          return !isAutoTriggerZone(context.zone);
        });

  if (contexts.length === 0) {
    return null;
  }

  const averageAnchor = contexts.reduce(
    (totals, context) => ({
      x: totals.x + context.avatar.x,
      y: totals.y + context.avatar.y - (context.avatar.height / 2) - 12,
    }),
    { x: 0, y: 0 },
  );

  const rawPoint = resolveFieldOverlayPoint({
    space: "field-world",
    x: averageAnchor.x / contexts.length,
    y: averageAnchor.y / contexts.length,
  } as any);

  if (!rawPoint) {
    return null;
  }

  const root = getFieldOverlayRoot();
  const viewport = document.querySelector<HTMLElement>(".field-viewport");
  if (!root || !viewport) {
    return rawPoint;
  }

  const rootRect = root.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const promptRect = promptEl.getBoundingClientRect();
  const promptWidth = promptRect.width || promptEl.offsetWidth || 0;
  const promptHeight = promptRect.height || promptEl.offsetHeight || 0;
  const edgePadding = 18;

  const minX = viewportRect.left - rootRect.left + (promptWidth / 2) + edgePadding;
  const maxX = viewportRect.right - rootRect.left - (promptWidth / 2) - edgePadding;
  const minY = viewportRect.top - rootRect.top + promptHeight + edgePadding;
  const maxY = viewportRect.bottom - rootRect.top - edgePadding;

  return {
    x: Math.max(minX, Math.min(maxX, rawPoint.x)),
    y: Math.max(minY, Math.min(maxY, rawPoint.y)),
  };
}

function triggerZoneInteraction(playerId: PlayerId, zone: InteractionZone, avatar: PlayerAvatar): void {
  if (!fieldState || !currentMap) {
    return;
  }

  if (!canPlayerUseFieldAction(getGameState(), playerId, zone.action)) {
    showFieldAuthorityPing(playerId, zone);
    return;
  }

  const savedPlayerPos = { x: avatar.x, y: avatar.y };
  const interactionKey = buildAutoInteractionZoneKey(String(currentMap.id), playerId, zone.id);
  if (shouldPrepareFieldReturnFromInteraction(zone)) {
    pendingFieldReturnFromInteraction = {
      mapId: String(currentMap.id),
      playerId,
      savedPlayerPos,
      zoneId: zone.id,
      interactionKey,
    };
  }
  fieldState.isPaused = true;

  void handleInteraction(zone, currentMap, () => {
    resumeFieldAfterInteraction(playerId, savedPlayerPos, zone, interactionKey);
  }, suspendFieldForScreenTransition).catch((error) => {
    console.error("[FIELD] Error handling interaction:", error);
    if (fieldState) {
      fieldState.isPaused = false;
      renderFieldScreen(fieldState.currentMap);
    }
  });
}

function maybeTriggerAutoInteraction(): void {
  if (!fieldState || !currentMap || fieldState.isPaused || isFieldCombatActive() || isHavenBuildModeEnabled()) {
    if (!fieldState || !fieldState.isPaused) {
      activeAutoInteractionZoneKey = null;
    }
    return;
  }

  const state = getGameState();
  const orderedPlayers = (["P1", "P2"] as PlayerId[]).filter((playerId) => isFieldPlayerActive(playerId, state));
  const autoContext = orderedPlayers
    .map((playerId) => getPlayerInteractionContext(playerId))
    .find((context): context is InteractionActorContext => {
      if (!context) {
        return false;
      }
      return isAutoTriggerZone(context.zone);
    });

  if (!autoContext) {
    activeAutoInteractionZoneKey = null;
    suppressedAutoInteractionZoneKey = null;
    return;
  }

  const interactionKey = buildAutoInteractionZoneKey(String(currentMap.id), autoContext.playerId, autoContext.zone.id);
  if (suppressedAutoInteractionZoneKey === interactionKey) {
    return;
  }
  if (activeAutoInteractionZoneKey === interactionKey) {
    return;
  }

  activeAutoInteractionZoneKey = interactionKey;
  triggerZoneInteraction(autoContext.playerId, autoContext.zone, autoContext.avatar);
}

function showFieldAuthorityPing(playerId: PlayerId, zone: InteractionZone): void {
  showSystemPing({
    type: "info",
    title: "LOCAL AUTHORITY",
    message: getFieldActionRestrictionMessage(zone.label),
    detail: `${getPlayerControllerLabel(playerId)} can still inspect side windows and move in the field.`,
    channel: "field-local-authority",
  });
}

function showFieldCombatLockPing(): void {
  showSystemPing({
    type: "info",
    title: "COMBAT ACTIVE",
    message: "Clear the light enemies before using field interactions.",
    detail: "Melee and ranged controls are active until the room is safe.",
    channel: "field-combat-lock",
  });
}

function resumeFieldAfterInteraction(
  playerId: PlayerId,
  savedPlayerPos: { x: number; y: number },
  zone?: InteractionZone,
  interactionKey?: string,
): void {
  if (!fieldState || !currentMap) {
    return;
  }

  if (pendingFieldReturnFromInteraction?.interactionKey === interactionKey) {
    pendingFieldReturnFromInteraction = null;
  }

  fieldState.isPaused = false;
  const tileSize = 64;
  let nextX = savedPlayerPos.x;
  let nextY = savedPlayerPos.y;

  if (zone && isAutoTriggerZone(zone)) {
    const exitPosition = resolveInteractionExitPosition(zone, savedPlayerPos);
    nextX = exitPosition.x;
    nextY = exitPosition.y;

    nextX = Math.max(32, Math.min((currentMap.width * tileSize) - 32, nextX));
    nextY = Math.max(32, Math.min((currentMap.height * tileSize) - 32, nextY));
    suppressedAutoInteractionZoneKey = interactionKey ?? null;
  } else {
    const offsetX = savedPlayerPos.x % tileSize < tileSize / 2 ? -8 : 8;
    const offsetY = savedPlayerPos.y % tileSize < tileSize / 2 ? -8 : 8;
    nextX = savedPlayerPos.x + offsetX;
    nextY = savedPlayerPos.y + offsetY;
  }

  const currentAvatar = getRuntimeFieldAvatar(playerId);
  setRuntimeFieldAvatarPosition(playerId, nextX, nextY, currentAvatar?.facing);
  flushFieldAvatarPositionsToGameState(true);

  if (zone && isAutoTriggerZone(zone)) {
    render();
    return;
  }

  renderFieldScreen(fieldState.currentMap);
}

function normalizePinnedQuacCommand(value: string): string {
  return value.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
}

function getFieldEscAvailabilityContext() {
  return {
    expeditionActive: Boolean(currentMap && isOuterDeckBranchMap(String(currentMap.id))),
    coopOperationsActive: getGameState().session.mode === "coop_operations",
  };
}

function isLockedHavenAnnexAction(action: string): boolean {
  if (action === "port") {
    return !isPortNodeUnlocked();
  }
  if (action === "stable") {
    return !isStableNodeUnlocked();
  }
  if (action === "dispatch") {
    return !isDispatchNodeUnlocked();
  }
  return false;
}

function isLockedSchemaAction(action: string): boolean {
  return action === "schema" && !isSchemaNodeUnlocked();
}

function isLockedBlackMarketAction(action: string): boolean {
  return action === "black-market" && !isBlackMarketNodeUnlocked();
}

function isLockedFoundryAnnexAction(action: string): boolean {
  return action === "foundry-annex" && !isFoundryAnnexUnlocked();
}

function getLockedActionMessage(action: string): string | null {
  switch (action) {
    case "schema":
      return SCHEMA_LOCK_MESSAGE;
    case "port":
      return PORT_LOCK_MESSAGE;
    case "stable":
      return STABLE_LOCK_MESSAGE;
    case "dispatch":
      return DISPATCH_LOCK_MESSAGE;
    case "black-market":
      return BLACK_MARKET_LOCK_MESSAGE;
    case "foundry-annex":
      return FOUNDRY_ANNEX_LOCK_MESSAGE;
    default:
      return null;
  }
}

function resolvePinnedQuacCommand(input: string): string | null {
  const normalized = normalizePinnedQuacCommand(input);
  if (!normalized) return null;

  for (const entry of PINNED_QUAC_COMMAND_ALIASES) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizePinnedQuacCommand(alias);
      if (normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) {
        return entry.action;
      }
    }
  }

  return null;
}

function readPinnedOverlayItems(): string[] {
  const pinnedItems = getGameState().uiLayout?.baseCampPinnedItems ?? [];
  return pinnedItems.filter((itemId) => {
    if (!PINNED_VALID_ITEM_IDS.has(itemId)) {
      return false;
    }

    if (isFieldEscNodeAction(itemId) && getEscActionAvailability(itemId, getFieldEscAvailabilityContext()) !== "active") {
      return false;
    }

    if (isLockedHavenAnnexAction(itemId)) {
      return false;
    }
    if (isLockedSchemaAction(itemId)) {
      return false;
    }
    if (isLockedBlackMarketAction(itemId)) {
      return false;
    }
    if (isLockedFoundryAnnexAction(itemId)) {
      return false;
    }

    return true;
  });
}

function readPinnedOverlayFrames(): Record<string, BaseCampPinnedItemFrame> {
  return getGameState().uiLayout?.baseCampPinnedItemFrames ?? {};
}

function readPinnedOverlayColors(): Record<string, string> {
  const uiLayout = getGameState().uiLayout;
  const activeLoadoutIndex = Math.max(0, Math.min((uiLayout?.baseCampActiveLoadoutIndex ?? uiLayout?.baseCampResetPresetIndex ?? 0), 1));
  const activeLoadoutColors = uiLayout?.baseCampLayoutLoadouts?.[`${activeLoadoutIndex}`]?.itemColors;
  return activeLoadoutColors ?? uiLayout?.baseCampItemColors ?? {};
}

function persistPinnedOverlayItems(ids: string[]): void {
  updateGameState((state) => {
    const activeLoadoutIndex = Math.max(0, Math.min((state.uiLayout?.baseCampActiveLoadoutIndex ?? state.uiLayout?.baseCampResetPresetIndex ?? 0), 1));
    const loadoutKey = `${activeLoadoutIndex}`;
    const nextPinned = new Set(ids);
    const currentFrames = state.uiLayout?.baseCampPinnedItemFrames ?? {};
    const nextFrames = Object.fromEntries(
      Object.entries(currentFrames).filter(([itemId]) => nextPinned.has(itemId)),
    ) as Record<string, BaseCampPinnedItemFrame>;
    const savedLoadouts = state.uiLayout?.baseCampLayoutLoadouts ?? {};
    const currentLoadout = savedLoadouts[loadoutKey] ?? {};
    const nextLoadouts: Record<string, BaseCampLayoutLoadout> = {
      ...savedLoadouts,
      [loadoutKey]: {
        ...currentLoadout,
        pinnedItems: ids,
        pinnedItemFrames: nextFrames,
      },
    };

    return {
      ...state,
      uiLayout: {
        ...(state.uiLayout ?? {}),
        baseCampLayoutVersion: state.uiLayout?.baseCampLayoutVersion ?? 4,
        baseCampPinnedItems: ids,
        baseCampPinnedItemFrames: nextFrames,
        baseCampLayoutLoadouts: nextLoadouts,
      },
    };
  });
}

function getDefaultPinnedItemColorKey(itemId: string): string {
  switch (itemId) {
    case PINNED_QUAC_LAYOUT_ID:
      return "verdant";
    case PINNED_RESOURCE_LAYOUT_ID:
      return "violet";
    case MINIMAP_LAYOUT_ID:
      return "steel";
    case NOTES_LAYOUT_ID:
      return "steel";
    case PINNED_QUEST_TRACKER_LAYOUT_ID:
      return "teal";
    case "port":
    case "comms-array":
      return "teal";
    case "tavern":
    case "quarters":
      return "oxide";
    case "stable":
      return "moss";
    case "black-market":
      return "oxide";
    case "foundry-annex":
    case "schema":
    case "codex":
    case "settings":
    case "inventory":
      return "steel";
    default:
      return "amber";
  }
}

function getPinnedItemThemeStyle(itemId: string, colors: Record<string, string>): string {
  const colorKey = colors[itemId] ?? getDefaultPinnedItemColorKey(itemId);
  const theme = PINNED_COLOR_THEME_MAP.get(colorKey) ?? PINNED_COLOR_THEMES[0];
  return Object.entries(theme.vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

// ============================================================================
// RENDER
// ============================================================================

export function renderFieldScreen(
  mapId: FieldMap["id"] = "base_camp",
  options?: { openBuildMode?: boolean },
): void {
  teardownFieldMode();
  setMusicCue(mapId === "base_camp" || mapId === "quarters" ? "haven-field" : "quiet");
  const root = document.getElementById("app");
  if (!root) return;
  document.body.setAttribute("data-screen", mapId === "base_camp" ? "field-base-camp" : `field-${String(mapId)}`);
  clearControllerContext();
  const previousMapId = currentMap?.id ?? null;
  havenBuildModeActive = false;
  havenBuildResumePaused = false;
  resetHavenBuildPanState();
  resetFieldFeedbackState();
  havenBuildPaletteSelection = null;
  havenBuildDragState = null;
  if (previousMapId !== mapId) {
    activeAutoInteractionZoneKey = null;
    suppressedAutoInteractionZoneKey = null;
    fieldTurretLastFireAtMs.clear();
  }

  maybeBankOuterDeckRunSnapshot(previousMapId, mapId);
  setBaseCampFieldReturnMap(mapId);

  // Load map
  currentMap = getFieldMap(mapId);
  maybeBeginOuterDeckRunSnapshot(currentMap);
  const outerDeckOpenWorldSpawn = isOuterDeckOpenWorldMap(currentMap)
    ? (() => {
        const openWorld = getOuterDeckOpenWorldState(getGameState());
        const local = outerDeckWorldPixelToLocal(currentMap!, openWorld.playerWorldX, openWorld.playerWorldY);
        return {
          x: local.x,
          y: local.y,
          facing: openWorld.playerFacing,
        };
      })()
    : null;

  // Initialize or restore player avatars from game state
  const tileSize = 64;
  let playerX: number;
  let playerY: number;

  const isResuming = fieldState && fieldState.currentMap === mapId;
  const fieldSpawnOverride = pendingFieldSpawnOverride && pendingFieldSpawnOverride.mapId === mapId
    ? pendingFieldSpawnOverride
    : null;
  const fieldReturnFromInteraction = pendingFieldReturnFromInteraction?.mapId === String(mapId)
    ? pendingFieldReturnFromInteraction
    : null;
  let playerFacing: PlayerAvatar["facing"] | undefined = fieldSpawnOverride?.facing ?? outerDeckOpenWorldSpawn?.facing;

  // Detect spawn source (FCP = key room entry, normal = everything else)
  const spawnSource: SpawnSource = (typeof mapId === "string" && mapId.startsWith("keyroom_")) ? "FCP" : "normal";

  // Check if we have a stored interaction zone position (returning from a node) - prioritize this over resume
  if (fieldSpawnOverride) {
    pendingFieldSpawnOverride = null;
    pendingFieldReturnFromInteraction = null;
    if (mapId === "quarters") {
      playerX = fieldSpawnOverride.x;
      playerY = fieldSpawnOverride.y;
    } else {
      const spawnResult = resolvePlayerSpawn(
        spawnSource,
        currentMap,
        { x: fieldSpawnOverride.x, y: fieldSpawnOverride.y },
      );
      playerX = spawnResult.x;
      playerY = spawnResult.y;
    }
  } else if (fieldReturnFromInteraction) {
    pendingFieldReturnFromInteraction = null;
    const returnZone = getInteractionZone(currentMap, fieldReturnFromInteraction.zoneId);
    const fallbackExitPosition: { x: number; y: number; facing?: PlayerAvatar["facing"] } = {
      ...fieldReturnFromInteraction.savedPlayerPos,
    };
    const exitPosition = returnZone
      ? resolveInteractionExitPosition(returnZone, fieldReturnFromInteraction.savedPlayerPos)
      : fallbackExitPosition;
    const spawnResult = resolvePlayerSpawn(
      spawnSource,
      currentMap,
      { x: exitPosition.x, y: exitPosition.y },
    );
    playerX = spawnResult.x;
    playerY = spawnResult.y;
    playerFacing = exitPosition.facing ?? fieldState?.player.facing ?? "south";
    suppressedAutoInteractionZoneKey = fieldReturnFromInteraction.interactionKey;
    activeAutoInteractionZoneKey = null;
  } else if (outerDeckOpenWorldSpawn) {
    const spawnResult = resolvePlayerSpawn(
      spawnSource,
      currentMap,
      { x: outerDeckOpenWorldSpawn.x, y: outerDeckOpenWorldSpawn.y },
    );
    playerX = spawnResult.x;
    playerY = spawnResult.y;
    playerFacing = outerDeckOpenWorldSpawn.facing;
  } else if (mapId === "base_camp" && lastInteractionZonePosition) {
    // Use the stored interaction zone position
    const storedX = lastInteractionZonePosition.x;
    const storedY = lastInteractionZonePosition.y;
    // Clear the stored position after using it
    lastInteractionZonePosition = null;
    // Use spawn resolver to ensure position is valid
    const spawnResult = resolvePlayerSpawn(
      spawnSource,
      currentMap,
      { x: storedX, y: storedY }
    );
    playerX = spawnResult.x;
    playerY = spawnResult.y;
  } else if (isResuming && mapId !== "quarters") {
    // Restore from fieldState if available, but revalidate maps whose walkable layout can change.
    if (mapId === "network_lobby" || mapId === "base_camp") {
      const fallbackSpawn = getPreferredFieldSpawnPosition(mapId, tileSize);
      const spawnResult = resolvePlayerSpawn(
        spawnSource,
        currentMap,
        {
          x: fieldState!.player.x || fallbackSpawn?.x || tileSize * 2,
          y: fieldState!.player.y || fallbackSpawn?.y || tileSize * 2,
        },
      );
      playerX = spawnResult.x;
      playerY = spawnResult.y;
    } else {
      playerX = fieldState!.player.x;
      playerY = fieldState!.player.y;
    }
  } else {
    // Determine requested spawn position
    let requestedX: number;
    let requestedY: number;

    const preferredSpawn = getPreferredFieldSpawnPosition(mapId, tileSize);

    if (preferredSpawn) {
      requestedX = preferredSpawn.x;
      requestedY = preferredSpawn.y;
    } else if (mapId === "quarters") {
      // Spawn in the middle bottom of the walkable area
      // Quarters is 10x8, walkable area is x:1-8, y:1-6
      // Middle of x range (1-8): between 4 and 5, use tile 4 for clean positioning
      // Bottom walkable row: y:6
      const spawnTileX = 4;
      const spawnTileY = 6;
      requestedX = spawnTileX * tileSize + tileSize / 2;
      requestedY = spawnTileY * tileSize + tileSize / 2;
    } else if (mapId === "base_camp") {
      // Spawn in the main HAVEN concourse, clear of building collision.
      requestedX = 41 * tileSize + tileSize / 2;
      requestedY = 27 * tileSize + tileSize / 2;
    } else {
      // Default: center of map (avoiding edge tiles which are typically walls)
      // Use floor to ensure we're not on the right edge (width-1) or bottom edge (height-1)
      const centerTileX = Math.max(1, Math.min(currentMap.width - 2, Math.floor(currentMap.width / 2)));
      const centerTileY = Math.max(1, Math.min(currentMap.height - 2, Math.floor(currentMap.height / 2)));
      requestedX = centerTileX * tileSize + tileSize / 2;
      requestedY = centerTileY * tileSize + tileSize / 2;
    }

    // Use spawn resolver for all maps except quarters (quarters has known-good spawn)
    if (mapId === "quarters") {
      playerX = requestedX;
      playerY = requestedY;
    } else {
      // Use centralized spawn resolver
      const spawnResult = resolvePlayerSpawn(
        spawnSource,
        currentMap,
        { x: requestedX, y: requestedY }
      );

      playerX = spawnResult.x;
      playerY = spawnResult.y;

      // Validate final result - this should never fail, but log if it does
      if (!spawnResult.passable) {
        console.error(`[SPAWN] CRITICAL: Resolved spawn is not passable! This should never happen.`);
        console.error(`[SPAWN] Resolved tile: (${spawnResult.tileX}, ${spawnResult.tileY}), Map size: ${currentMap.width}x${currentMap.height}`);
      }

      // Explicit check for right wall spawn (should never happen)
      if (spawnResult.tileX === currentMap.width - 1) {
        console.error(`[SPAWN] CRITICAL: Player spawned on right wall! Tile X: ${spawnResult.tileX}, Map width: ${currentMap.width}`);
      }
    }
  }

  // Initialize or update P1 avatar in game state
  // Always update position when entering quarters to ensure correct spawn
  updateGameState(s => {
    // Initialize players if they don't exist
    const players = s.players || {
      P1: {
        id: "P1",
        slot: "P1",
        active: true,
        color: "#ff8a00",
        inputSource: "keyboard1" as const,
        presence: "local" as const,
        authorityRole: "local" as const,
        avatar: null,
        controlledUnitIds: [],
      },
      P2: {
        id: "P2",
        slot: "P2",
        active: false,
        color: "#6849c2",
        inputSource: "none" as const,
        presence: "inactive" as const,
        authorityRole: "local" as const,
        avatar: null,
        controlledUnitIds: [],
      },
    };

    // Always update position for quarters, FCP maps (keyroom_*), or initialize if missing
    const isFCPMap = typeof mapId === "string" && mapId.startsWith("keyroom_");
    const shouldUpdatePosition = Boolean(fieldSpawnOverride || fieldReturnFromInteraction)
      || isOuterDeckOpenWorldMap(currentMap)
      || mapId === "quarters"
      || mapId === "network_lobby"
      || isFCPMap
      || !players.P1.avatar;

    return {
      ...s,
      players: {
        ...players,
        P1: {
          ...players.P1,
          active: true,
          avatar: shouldUpdatePosition ? {
            x: playerX,
            y: playerY,
            facing: playerFacing ?? "south",
            spriteId: "aeriss_p1",
          } : players.P1.avatar,
        },
      },
    };
  });

  if (isResuming && fieldState && fieldState.player && mapId !== "quarters") {
    // Preserve companion if it exists
    // For quarters, always reset position, so skip this resume logic
    const companion = fieldState.companion || createCompanion(playerX - 40, playerY - 40);
    const nextFieldEnemies = syncFieldEnemiesForMap(currentMap, fieldState.fieldEnemies ?? []);
    fieldState = {
      ...fieldState,
      currentMap: mapId,
      player: normalizeFieldPlayerState({
        ...fieldState.player,
        x: playerX,
        y: playerY,
        facing: playerFacing ?? fieldState.player.facing,
      }),
      isPaused: false,
      activeInteraction: null,
      companion,
      npcs: syncFieldNpcsForMap(mapId, fieldState.npcs ?? []),
      fieldEnemies: nextFieldEnemies,
      combat: normalizeFieldCombatState(fieldState.combat ?? createDefaultFieldCombatState()),
      projectiles: fieldState.projectiles ?? [],
      collectedResourceObjectIds: fieldState.collectedResourceObjectIds ?? [],
    };
  } else {
    // Initialize Sable near player
    const companion = createCompanion(playerX - 40, playerY - 40);
    const nextFieldEnemies = syncFieldEnemiesForMap(currentMap);

    fieldState = {
      currentMap: mapId,
      player: normalizeFieldPlayerState({
        ...createPlayerAvatar(playerX, playerY),
        facing: playerFacing ?? "south",
      }),
      isPaused: false,
      activeInteraction: null,
      companion,
      npcs: syncFieldNpcsForMap(mapId),
      fieldEnemies: nextFieldEnemies,
      combat: normalizeFieldCombatState(createDefaultFieldCombatState()),
      projectiles: [],
      collectedResourceObjectIds: [],
    };
  }

  const persistedPlayers = getGameState().players;
  fieldRuntimeP2Avatar = persistedPlayers.P2.active && persistedPlayers.P2.avatar
    ? { ...persistedPlayers.P2.avatar }
    : null;
  lastFieldAvatarSyncAtMs = Number.NEGATIVE_INFINITY;
  lastFieldAvatarSyncKey = "";

  lastMinimapRevealKey = "";
  syncFieldMinimapExploration();

  // Setup input handlers (only once)
  setupGlobalListeners();

  // Restart game loop
  if (animationFrameId !== null) {
    stopGameLoop();
  }

  resetFieldMovementInputState();

  // Create panel first (outside field-root)
  createAllNodesPanel();

  if (shouldUseHaven3DFieldRuntime(mapId, options)) {
    activeInteractionPrompt = getCombinedInteractionPrompt();
    mountHaven3DFieldRuntime(root);
    createPinnedNodesOverlay();
    requestAnimationFrame(() => drawPinnedMinimapOverlay());
    if (previousMapId !== mapId) {
      maybeShowFieldTutorials(mapId);
    }
    return;
  }

  startGameLoop();
  render();
  if (options?.openBuildMode) {
    setHavenBuildMode(true);
  }
  createPinnedNodesOverlay();
  requestAnimationFrame(() => drawPinnedMinimapOverlay());
  if (previousMapId !== mapId) {
    maybeShowFieldTutorials(mapId);
  }
}

function formatBuildResourceCost(cost?: { metalScrap?: number; wood?: number; chaosShards?: number; steamComponents?: number }): string {
  const parts = [
    cost?.metalScrap ? `${cost.metalScrap} METAL` : null,
    cost?.wood ? `${cost.wood} WOOD` : null,
    cost?.chaosShards ? `${cost.chaosShards} SHARDS` : null,
    cost?.steamComponents ? `${cost.steamComponents} STEAM` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" // ") : "NO COST";
}

function renderFieldObjectContents(obj: FieldMap["objects"][number]): string {
  if (obj.type === "decoration") {
    if (obj.metadata?.grappleAnchor === true) {
      return `
        <div class="field-object-placeholder field-object-placeholder--grapple">
          <span>GRAPPLE</span>
        </div>
      `;
    }
    const decor = getDecorItemById(String(obj.metadata?.decorId ?? ""));
    const rotationQuarterTurns = normalizeFieldDecorRotationQuarterTurns(Number(obj.metadata?.rotationQuarterTurns ?? 0));
    const rotationDegrees = rotationQuarterTurns * 90;
    return `
      <div class="field-decor-visual"${rotationDegrees !== 0 ? ` style="transform: rotate(${rotationDegrees}deg);"` : ""}>
        ${decor ? renderDecorSpriteSvg(decor) : `<div class="field-object-placeholder">${obj.metadata?.name || "DECOR"}</div>`}
      </div>
      ${isHavenBuildModeEnabled() ? `<div class="field-build-object-label">${decor?.name ?? obj.metadata?.name ?? "DECOR"}</div>` : ""}
    `;
  }

  return `<div class="field-object-placeholder">${obj.metadata?.name || obj.type}</div>`;
}

function getTrackedFieldCenter(): { x: number; y: number } {
  if (!fieldState) {
    return { x: 0, y: 0 };
  }

  const state = getGameState();
  const p1Avatar = getRuntimeFieldAvatar("P1", state);
  const p2Avatar = isFieldPlayerActive("P2", state) ? getRuntimeFieldAvatar("P2", state) : null;

  if (p1Avatar && p2Avatar) {
    return {
      x: (p1Avatar.x + p2Avatar.x) / 2,
      y: (p1Avatar.y + p2Avatar.y) / 2,
    };
  }

  if (p1Avatar) {
    return {
      x: p1Avatar.x,
      y: p1Avatar.y,
    };
  }

  return {
    x: fieldState.player.x,
    y: fieldState.player.y,
  };
}

function clampBuildCameraCenter(centerX: number, centerY: number): { x: number; y: number } {
  if (!currentMap) {
    return { x: centerX, y: centerY };
  }

  const viewport = document.querySelector<HTMLElement>(".field-viewport");
  if (!viewport) {
    return { x: centerX, y: centerY };
  }

  const viewportRect = viewport.getBoundingClientRect();
  const halfWidth = viewportRect.width / (2 * fieldZoom);
  const halfHeight = viewportRect.height / (2 * fieldZoom);
  const mapPixelWidth = currentMap.width * FIELD_TILE_SIZE;
  const mapPixelHeight = currentMap.height * FIELD_TILE_SIZE;

  const minX = Math.min(halfWidth, mapPixelWidth / 2);
  const maxX = Math.max(mapPixelWidth - halfWidth, mapPixelWidth / 2);
  const minY = Math.min(halfHeight, mapPixelHeight / 2);
  const maxY = Math.max(mapPixelHeight - halfHeight, mapPixelHeight / 2);

  return {
    x: Math.max(minX, Math.min(maxX, centerX)),
    y: Math.max(minY, Math.min(maxY, centerY)),
  };
}

function updateHavenBuildPan(deltaTime: number): boolean {
  if (!isHavenBuildModeEnabled() || !canPanDuringBuildMode() || !currentMap || deltaTime <= 0) {
    return false;
  }

  const controllerInput = getPlayerInput("P1");
  const horizontal = ((havenBuildPanInput.right || controllerInput.right) ? 1 : 0) - ((havenBuildPanInput.left || controllerInput.left) ? 1 : 0);
  const vertical = ((havenBuildPanInput.down || controllerInput.down) ? 1 : 0) - ((havenBuildPanInput.up || controllerInput.up) ? 1 : 0);

  if (horizontal === 0 && vertical === 0) {
    return false;
  }

  const magnitude = Math.hypot(horizontal, vertical) || 1;
  const speed = HAVEN_BUILD_PAN_SPEED * ((havenBuildPanInput.fast || controllerInput.special1) ? HAVEN_BUILD_PAN_FAST_MULTIPLIER : 1);
  const step = speed * (deltaTime / 1000);
  const cameraCenter = havenBuildCameraCenter ?? clampBuildCameraCenter(
    getTrackedFieldCenter().x,
    getTrackedFieldCenter().y,
  );
  const nextCenter = clampBuildCameraCenter(
    cameraCenter.x + ((horizontal / magnitude) * step),
    cameraCenter.y + ((vertical / magnitude) * step),
  );

  const changed = Math.abs(nextCenter.x - cameraCenter.x) > 0.1 || Math.abs(nextCenter.y - cameraCenter.y) > 0.1;
  havenBuildCameraCenter = nextCenter;
  return changed;
}

function placeCurrentBuildSelectionAtViewCenter(): void {
  const center = havenBuildCameraCenter ?? getTrackedFieldCenter();
  const tileX = Math.round(center.x / FIELD_TILE_SIZE);
  const tileY = Math.round(center.y / FIELD_TILE_SIZE);
  placeCurrentBuildSelection(tileX, tileY);
}

function renderHavenBuildPanel(): string {
  if (!isHavenBuildModeEnabled()) {
    return "";
  }

  const state = getGameState();
  const buildPanLabel = getPlayerActionLabel("P1", "up") === "W"
    ? "WASD / ARROWS"
    : `${getPlayerActionLabel("P1", "up")} / ${getPlayerActionLabel("P1", "left")}`;
  const buildFastLabel = getPlayerActionLabel("P1", "special1");
  const buildInHaven = isHavenBuildMapActive();
  const storedNodes = buildInHaven
    ? getBaseCampNodeDefinitions()
      .filter((definition) => getBaseCampNodeLayout(state.uiLayout, definition.id).hidden)
    : [];
  const availableDecorStock = getAvailableFieldDecorStock(state);
  const availableDecorCounts = new Map(availableDecorStock.map(({ decor, availableCount }) => [decor.id, availableCount]));
  const craftableDecor = getCraftableDecorItems(state);
  const selectedDecor = havenBuildPaletteSelection?.kind === "decor"
    ? getDecorItemById(havenBuildPaletteSelection.decorId)
    : null;
  const selectedFootprint = selectedDecor && havenBuildPaletteSelection?.kind === "decor"
    ? getFieldDecorFootprintSize(selectedDecor, havenBuildPaletteSelection.rotationQuarterTurns)
    : null;
  const selectedLabel = havenBuildPaletteSelection
    ? havenBuildPaletteSelection.kind === "node"
      ? getBaseCampNodeDefinition(havenBuildPaletteSelection.nodeId)?.label ?? havenBuildPaletteSelection.nodeId
      : getDecorItemById(havenBuildPaletteSelection.decorId)?.name ?? havenBuildPaletteSelection.decorId
    : "NONE";

  return `
    <aside class="field-build-panel" data-build-panel="true">
      <div class="field-build-panel__header">
        <div>
          <div class="field-build-panel__eyebrow">${buildInHaven ? "HAVEN // BUILD MODE" : "FIELD // BUILD MODE"}</div>
          <div class="field-build-panel__title">${buildInHaven ? "FIELD LAYOUT" : "FORWARD FABRICATION"}</div>
        </div>
        <button class="field-build-panel__close" type="button" data-build-close="true">DONE</button>
      </div>
      <div class="field-build-panel__copy">
        ${buildInHaven
          ? "Drag visible nodes and place stored field items on open floor."
          : "Place and reposition fabricated field items in the current zone. HAVEN node layout stays locked here."}
      </div>
      <div class="field-build-panel__copy">${buildInHaven ? `PAN :: ${buildPanLabel} // HOLD ${buildFastLabel} TO SPEED PAN` : "CAMERA :: LOCKED OUTSIDE HAVEN"}</div>
      <div class="field-build-panel__selection">SELECTED :: ${selectedLabel}</div>
      ${selectedDecor && selectedFootprint
        ? `<div class="field-build-panel__copy">ROTATE :: R // FOOTPRINT :: ${selectedFootprint.width}x${selectedFootprint.height} // READY :: ${availableDecorCounts.get(selectedDecor.id) ?? 0}</div>`
        : ""}
      ${havenBuildPaletteSelection ? `<button class="field-build-panel__clear" type="button" data-build-place-center="true">PLACE AT VIEW CENTER</button>` : ""}
      ${havenBuildPaletteSelection?.kind === "decor" ? `<button class="field-build-panel__clear" type="button" data-build-rotate-selection="true">ROTATE SELECTED</button>` : ""}
      ${havenBuildPaletteSelection ? `<button class="field-build-panel__clear" type="button" data-build-clear="true">CLEAR SELECTION</button>` : ""}

      ${buildInHaven ? `
      <section class="field-build-panel__section">
        <div class="field-build-panel__section-title">STORED NODES</div>
        <div class="field-build-panel__grid">
          ${storedNodes.length > 0
            ? storedNodes.map((definition) => `
              <button class="field-build-chip ${havenBuildPaletteSelection?.kind === "node" && havenBuildPaletteSelection.nodeId === definition.id ? "field-build-chip--active" : ""}"
                      type="button"
                      data-build-select-node="${definition.id}">
                ${definition.label}
              </button>
            `).join("")
            : `<div class="field-build-panel__empty">No stored nodes.</div>`}
        </div>
      </section>
      ` : ""}

      <section class="field-build-panel__section">
        <div class="field-build-panel__section-title">FIELD LOCKER</div>
        <div class="field-build-decor-list">
          ${availableDecorStock.length > 0
            ? availableDecorStock.map(({ decor, availableCount }) => `
              <button class="field-build-decor-card ${havenBuildPaletteSelection?.kind === "decor" && havenBuildPaletteSelection.decorId === decor.id ? "field-build-decor-card--active" : ""}"
                      type="button"
                      data-build-select-decor="${decor.id}">
                <div class="field-build-decor-card__sprite">${renderDecorSpriteSvg(decor)}</div>
                <div class="field-build-decor-card__copy">
                  <div class="field-build-decor-card__name">${decor.name}</div>
                  <div class="field-build-decor-card__meta">${decor.tileWidth}x${decor.tileHeight} TILE${decor.tileWidth * decor.tileHeight > 1 ? "S" : ""} // READY ${availableCount}</div>
                </div>
              </button>
            `).join("")
            : `<div class="field-build-panel__empty">No unplaced field items in storage.</div>`}
        </div>
      </section>

      <section class="field-build-panel__section">
        <div class="field-build-panel__section-title">FABRICATE FIELD KIT</div>
        <div class="field-build-decor-list">
          ${craftableDecor.length > 0
            ? craftableDecor.map((decor) => `
              <div class="field-build-craft-card ${canCraftDecorItem(decor.id, state) ? "" : "field-build-craft-card--locked"}">
                <div class="field-build-decor-card__sprite">${renderDecorSpriteSvg(decor)}</div>
                <div class="field-build-decor-card__copy">
                  <div class="field-build-decor-card__name">${decor.name}</div>
                  <div class="field-build-decor-card__meta">${formatBuildResourceCost(decor.craftCost)} // READY ${availableDecorCounts.get(decor.id) ?? 0}</div>
                </div>
                <button class="field-build-craft-btn" type="button" data-build-craft-decor="${decor.id}" ${canCraftDecorItem(decor.id, state) ? "" : "disabled"}>
                  FABRICATE
                </button>
              </div>
            `).join("")
            : `<div class="field-build-panel__empty">No field fabrication recipes are online.</div>`}
        </div>
      </section>
    </aside>
  `;
}

function getFieldTilesHtml(map: FieldMap, tileSize: number): string {
  const cachedHtml = fieldTileHtmlCache.get(map);
  if (cachedHtml) {
    return cachedHtml;
  }

  const rects: string[] = [];
  const elevationRects: string[] = [];
  const mapPixelWidth = map.width * tileSize;
  const mapPixelHeight = map.height * tileSize;
  const patternDefs = (Object.entries(FIELD_TILE_PATTERN_STYLES) as Array<[FieldTilePatternKey, { fill: string; stroke: string }]>)
    .map(([key, style]) => `
      <pattern id="field-tile-pattern-${key}" patternUnits="userSpaceOnUse" width="${tileSize}" height="${tileSize}">
        <rect width="${tileSize}" height="${tileSize}" fill="${style.fill}"></rect>
        <path d="M ${tileSize - 0.5} 0 V ${tileSize} M 0 ${tileSize - 0.5} H ${tileSize}" stroke="${style.stroke}" stroke-width="1" shape-rendering="crispEdges"></path>
      </pattern>
    `)
    .join("");

  const getPatternKey = (tile: FieldMap["tiles"][number][number]): FieldTilePatternKey => {
    if (!tile || !tile.walkable || tile.type === "wall") {
      return "wall";
    }
    if (tile.type === "grass") {
      return "grass";
    }
    if (tile.type === "dirt") {
      return "dirt";
    }
    if (tile.type === "stone") {
      return "stone";
    }
    return "floor";
  };

  for (let y = 0; y < map.height; y += 1) {
    const row = map.tiles[y];
    if (!row || row.length === 0) {
      continue;
    }

    let segmentPatternKey: FieldTilePatternKey | null = null;
    let segmentStartX = 0;
    let segmentLength = 0;
    const flushSegment = (): void => {
      if (!segmentPatternKey || segmentLength <= 0) {
        return;
      }
      rects.push(
        `<rect x="${segmentStartX * tileSize}" y="${y * tileSize}" width="${segmentLength * tileSize}" height="${tileSize}" fill="url(#field-tile-pattern-${segmentPatternKey})"></rect>`,
      );
    };

    for (let x = 0; x < map.width; x += 1) {
      const tile = row[x];
      if (!tile) {
        flushSegment();
        segmentPatternKey = null;
        segmentLength = 0;
        continue;
      }

      const patternKey = getPatternKey(tile);
      if (patternKey === segmentPatternKey) {
        segmentLength += 1;
        continue;
      }

      flushSegment();
      segmentPatternKey = patternKey;
      segmentStartX = x;
      segmentLength = 1;
    }

    flushSegment();
  }

  for (let y = 0; y < map.height; y += 1) {
    const row = map.tiles[y];
    if (!row || row.length === 0) {
      continue;
    }

    let segmentElevation: number | null = null;
    let segmentStartX = 0;
    let segmentLength = 0;
    const flushElevationSegment = (): void => {
      if (!segmentElevation || segmentLength <= 0) {
        return;
      }
      const opacity = Math.min(0.4, 0.08 + (segmentElevation * 0.055));
      elevationRects.push(
        `<rect x="${segmentStartX * tileSize}" y="${y * tileSize}" width="${segmentLength * tileSize}" height="${tileSize}" fill="rgba(236, 196, 126, ${opacity.toFixed(3)})"></rect>`,
        `<path d="M ${segmentStartX * tileSize} ${(y + 1) * tileSize - 3} H ${(segmentStartX + segmentLength) * tileSize}" stroke="rgba(5, 6, 8, ${Math.min(0.5, 0.16 + segmentElevation * 0.05).toFixed(3)})" stroke-width="3"></path>`,
      );
    };

    for (let x = 0; x < map.width; x += 1) {
      const tile = row[x];
      const elevation = tile?.walkable ? Math.max(0, Math.floor(Number(tile.elevation ?? 0))) : 0;
      if (elevation === segmentElevation) {
        segmentLength += 1;
        continue;
      }

      flushElevationSegment();
      segmentElevation = elevation;
      segmentStartX = x;
      segmentLength = 1;
    }

    flushElevationSegment();
  }

  const html = `
    <svg
      class="field-tile-layer"
      aria-hidden="true"
      focusable="false"
      width="${mapPixelWidth}"
      height="${mapPixelHeight}"
      viewBox="0 0 ${mapPixelWidth} ${mapPixelHeight}"
      preserveAspectRatio="none"
      shape-rendering="crispEdges">
      <defs>${patternDefs}</defs>
      <rect width="${mapPixelWidth}" height="${mapPixelHeight}" fill="${FIELD_TILE_BACKGROUND_COLOR}"></rect>
      ${rects.join("")}
      ${elevationRects.join("")}
    </svg>
  `;
  fieldTileHtmlCache.set(map, html);
  return html;
}

function render(): void {
  const root = document.getElementById("app");
  if (!root || !currentMap || !fieldState) return;

  const tileSize = FIELD_TILE_SIZE;
  const mapPixelWidth = currentMap.width * tileSize;
  const mapPixelHeight = currentMap.height * tileSize;
  const combatActive = isFieldCombatActive();
  const liveEnemyCount = combatActive
    ? getLocallyRelevantFieldEnemies().length
    : (fieldState.fieldEnemies ?? []).filter((enemy) => enemy.hp > 0).length;
  const collectedResourceIds = new Set(fieldState.collectedResourceObjectIds ?? []);
  const displayObjects = currentMap.objects.filter((obj) => !isEnemyFieldObject(obj) && !(obj.type === "resource" && collectedResourceIds.has(obj.id)));

  const tilesHtml = getFieldTilesHtml(currentMap, tileSize);

  // Build objects HTML
  let objectsHtml = "";
  for (const obj of displayObjects) {
    const associatedZone = currentMap.interactionZones.find((zone) => {
      if (zone.metadata?.doorForObjectId === obj.id) {
        return true;
      }

      const zoneCenterX = zone.x + zone.width / 2;
      const zoneCenterY = zone.y + zone.height / 2;
      const objCenterX = obj.x + obj.width / 2;
      const objCenterY = obj.y + obj.height / 2;
      return (
        Math.abs(zoneCenterX - objCenterX) < 2 &&
        Math.abs(zoneCenterY - objCenterY) < 2
      );
    });
    const clickAction = associatedZone ? `data-interaction-zone="${associatedZone.id}"` : "";
    const buildMeta = getBuildMetaForObject(obj);
    const buildAttrs = buildMeta
      ? `data-build-kind="${buildMeta.kind}" data-build-item-id="${buildMeta.itemId}" data-build-width="${buildMeta.width}" data-build-height="${buildMeta.height}"${buildMeta.kind === "decor" ? ` data-build-decor-id="${buildMeta.decorId}"` : ""}`
      : "";
    const cursorStyle = isHavenBuildModeEnabled()
      ? "cursor: grab;"
      : associatedZone
        ? "cursor: pointer;"
        : "";
    const buildControls = isHavenBuildModeEnabled() && buildMeta
      ? `
        <div class="field-build-object-controls">
          ${buildMeta.kind === "decor"
            ? `<button class="field-build-object-rotate" type="button" data-build-rotate-decor="${buildMeta.itemId}" aria-label="Rotate item">R</button>`
            : ""}
          <button class="field-build-object-remove" type="button" data-build-remove="${buildMeta.itemId}" data-build-remove-kind="${buildMeta.kind}" aria-label="Store item">_</button>
        </div>
      `
      : "";

    objectsHtml += `
      <div class="field-object field-object-${obj.type} ${buildMeta ? "field-object--buildable" : ""} ${isHavenBuildModeEnabled() ? "field-object--build-active" : ""}"
           style="left: ${obj.x * tileSize}px; top: ${obj.y * tileSize}px; width: ${obj.width * tileSize}px; height: ${obj.height * tileSize}px; ${cursorStyle}"
           title="${obj.metadata?.name || obj.type}${associatedZone ? " (Click to interact)" : ""}"
           ${clickAction}
           ${buildAttrs}>
        ${buildControls}
        ${renderFieldObjectContents(obj)}
      </div>
    `;
  }

  const enemiesHtml = renderFieldEnemies(fieldState.fieldEnemies ?? []);
  const projectilesHtml = renderFieldProjectiles(fieldState.projectiles ?? []);

  // Player avatars (P1 and P2)
  const state = getGameState();
  syncRuntimeFieldAvatarsFromState(state);
  const fieldLobby = getRenderableLobbyForCurrentField();
  const networkLobby = isNetworkLobbyMapActive() ? fieldLobby : null;
  const currentTime = performance.now();
  // Ensure players object exists (backward compatibility)
  const players = state.players || {
    P1: { id: "P1", slot: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, presence: "local" as const, authorityRole: "local" as const, avatar: null, controlledUnitIds: [] },
    P2: { id: "P2", slot: "P2", active: false, color: "#6849c2", inputSource: "none" as const, presence: "inactive" as const, authorityRole: "local" as const, avatar: null, controlledUnitIds: [] },
  };
  const p1DashActive = Boolean(players.P1.active && getPlayerInput("P1").special1);
  const p2DashActive = Boolean(players.P2.active && getPlayerInput("P2").special1);
  const stepPulseClass = currentTime < fieldStepPulseUntilMs ? " field-player--step" : "";
  const p1Avatar = getRuntimeFieldAvatar("P1", state);
  const p2Avatar = players.P2.active ? getRuntimeFieldAvatar("P2", state) : null;

  let playerHtml = "";

  // P1 Avatar (always present)
  if (p1Avatar) {
    const combatClass = combatActive ? " field-node-player-combat" : "";
    const attackClass = combatActive && fieldState.combat?.isAttacking ? " player-attacking" : "";
    const invulnerableClass = Number(fieldState.player.invulnerabilityTime ?? 0) > 0 ? " player-invulnerable" : "";
    const dashClass = p1DashActive ? " field-player--dash" : "";
    playerHtml += `
      <div class="field-player field-player-p1${combatClass}${attackClass}${invulnerableClass}${dashClass}${stepPulseClass}"
           style="left: ${p1Avatar.x - 16}px; top: ${p1Avatar.y - 16}px; width: 32px; height: 32px;"
           data-facing="${p1Avatar.facing}">
        <div class="field-player-sprite"></div>
      </div>
    `;
  }

  // P2 Avatar (if active)
  if (p2Avatar) {
    const dashClass = p2DashActive ? " field-player--dash" : "";
    playerHtml += `
      <div class="field-player field-player-p2${dashClass}${stepPulseClass}" 
           style="left: ${p2Avatar.x - 16}px; top: ${p2Avatar.y - 16}px; width: 32px; height: 32px;"
           data-facing="${p2Avatar.facing}">
        <div class="field-player-sprite"></div>
      </div>
    `;
  }

  const currentMapId = currentMap?.id ?? null;
  if (fieldLobby && currentMapId) {
    playerHtml += NETWORK_PLAYER_SLOTS
      .filter((slot) => slot !== fieldLobby.localSlot && shouldRenderLobbyAvatar(fieldLobby, slot))
      .map((slot) => {
        const avatar = fieldLobby.avatars[slot];
        const member = fieldLobby.members[slot];
        const avatarMapId = avatar?.mapId ?? "network_lobby";
        const isSelectedCoopParticipant = fieldLobby.activity.kind !== "coop_operations"
          || fieldLobby.activity.coopOperations.participants[slot]?.selected;
        if (!avatar || !member || avatarMapId !== currentMapId || !isSelectedCoopParticipant) {
          return "";
        }
        return `
          <div class="field-player field-player--remote"
               style="left: ${avatar.x - 16}px; top: ${avatar.y - 16}px; width: 32px; height: 32px;"
               data-facing="${avatar.facing}">
            <div class="field-player-sprite">${slot.replace("P", "")}</div>
            <div class="field-player-name field-player-name--remote">${member.callsign}</div>
          </div>
        `;
      })
      .join("");
  }

  const attackEffectHtml =
    combatActive && p1Avatar && fieldState.combat?.isAttacking
      ? renderFieldAttackEffect(p1Avatar)
      : "";
  const combatState = fieldState.combat ?? createDefaultFieldCombatState();
  const canToggleFieldView = isHaven3DSupportedMap(currentMap.id) && !isHavenBuildModeEnabled();
  const fieldCornerControlsHtml = canToggleFieldView || combatActive
    ? `
      <div class="field-corner-controls">
        ${canToggleFieldView ? renderFieldViewToggle(currentMap.id) : ""}
        ${combatActive ? renderFieldGearbladeModeStrip(combatState) : ""}
      </div>
    `
    : "";

  // Sable companion (Headline 15a)
  const companionHtml = fieldState.companion ? `
    <div class="field-companion field-companion-sable" 
         style="left: ${fieldState.companion.x - fieldState.companion.width / 2}px; top: ${fieldState.companion.y - fieldState.companion.height / 2
    }px; width: ${fieldState.companion.width}px; height: ${fieldState.companion.height}px;"
         data-facing="${fieldState.companion.facing}" data-state="${fieldState.companion.state}">
      <div class="field-companion-sprite">🐕</div>
    </div>
  ` : "";

  // NPCs (Headline 15b)
  const npcsHtml = fieldState.npcs ? fieldState.npcs.map(npc => `
    <div class="field-npc" 
         style="left: ${npc.x - npc.width / 2}px; top: ${npc.y - npc.height / 2}px; width: ${npc.width}px; height: ${npc.height}px;"
         data-facing="${npc.direction}" data-state="${npc.state}">
      <div class="field-npc-sprite">${
        npc.spritePath
          ? `<img src="${npc.spritePath}" alt="${npc.name}" class="field-npc-sprite-image" />`
          : "👤"
      }</div>
      <div class="field-npc-name">${npc.name}</div>
    </div>
  `).join("") : "";

  // Interaction prompt
  const moveLabel = getPlayerActionLabel("P1", "up") === "W"
    ? "WASD"
    : `${getPlayerActionLabel("P1", "up")} / ${getPlayerActionLabel("P1", "left")}`;
  const dashLabel = getPlayerActionLabel("P1", "special1");
  const attackLabel = getPlayerActionLabel("P1", "attack");
  const interactLabel = getPlayerActionLabel("P1", "interact");
  const cancelLabel = getPlayerActionLabel("P1", "cancel");
  const buildModeHudInstructions = canPanDuringBuildMode()
    ? `BUILD MODE // ${moveLabel} TO PAN // HOLD ${dashLabel} TO SPEED PAN // R TO ROTATE // SELECT FROM PANEL, THEN PLACE AT VIEW CENTER OR USE POINTER.`
    : "BUILD MODE // CAMERA LOCKED IN FIELD ZONES // R TO ROTATE // SELECT FROM PANEL, THEN PLACE AT VIEW CENTER OR USE POINTER.";
  const buildModeHeaderHtml = isHavenBuildModeEnabled()
    ? `<div class="field-build-mode-header">BUILD MODE ACTIVE</div>`
    : "";
  const controllerHudInstructions = combatActive
    ? `${moveLabel} to move • ${dashLabel} to dash • ${attackLabel} to attack • 1/2/3 or Tab to switch Gearblade • Clear hostiles to interact`
    : `${moveLabel} to move • ${dashLabel} to dash • ${interactLabel} to interact • Hold ${cancelLabel} for Inventory`;
  const promptHtml = !combatActive && activeInteractionPrompt
    ? `<div class="field-interaction-prompt">${activeInteractionPrompt}</div>`
    : "";
  const hudInstructions = combatActive
    ? "WASD to move • Shift to dash • Space to attack • Tab to toggle melee/ranged • Clear hostiles to interact"
    : "WASD to move • Shift to dash • E to interact • Hold ESC for Inventory";
  void promptHtml;
  void hudInstructions;
  const combatStatusHtml = combatActive
    ? `<div class="field-hud-combat-status">HOSTILES ${liveEnemyCount} • ${getFieldGearbladeMode(fieldState.combat).toUpperCase()} • CELLS ${fieldState.combat?.energyCells ?? 0}/${fieldState.combat?.maxEnergyCells ?? 5}</div>`
    : "";

  // Get field-root container or create it
  let fieldRoot = root.querySelector(".field-root") as HTMLElement | null;
  if (!fieldRoot) {
    // Clear any existing content (like main menu) before creating field screen
    // But preserve the all-nodes panel if it exists
    const existingPanel = root.querySelector("#allNodesPanel");
    root.innerHTML = "";
    if (existingPanel) {
      root.appendChild(existingPanel);
    }

    fieldRoot = document.createElement("div");
    fieldRoot.className = "field-root";
    root.insertBefore(fieldRoot, root.firstChild);
  }
  fieldRoot.classList.remove("field-root--haven3d");

  // Update only the field-root content (preserves panel)
  fieldRoot.innerHTML = `
    ${buildModeHeaderHtml}
    <div class="field-viewport">
      <div class="field-map" style="width: ${mapPixelWidth}px; height: ${mapPixelHeight}px;">
        ${tilesHtml}
        ${objectsHtml}
        ${enemiesHtml}
        ${npcsHtml}
        ${playerHtml}
        ${companionHtml}
        ${attackEffectHtml}
        ${projectilesHtml}
        ${renderStuckNotesLayer("field", currentMap.id, "field-stuck-note")}
      </div>
    </div>

    ${fieldCornerControlsHtml}

    <div class="field-hud">
      ${getFieldBetaMarkerHtml(currentMap.id)}
      ${renderFieldStateMeterHtml()}
      ${combatStatusHtml}
      <div class="field-hud-instructions">
        ${isHavenBuildModeEnabled() ? buildModeHudInstructions : controllerHudInstructions}
      </div>
    </div>
    ${renderHavenBuildPanel()}
  `;
  enhanceTerminalUiButtons(fieldRoot);
  attachFieldViewToggleHandlers(fieldRoot);

  const existingLobbyOverlay = root.querySelector(".network-lobby-overlay") as HTMLElement | null;
  if (networkLobby) {
    const overlayMarkup = renderNetworkLobbyOverlay(networkLobby);
      const overlaySignature = JSON.stringify({
        updatedAt: networkLobby.updatedAt,
        activity: networkLobby.activity,
        pendingChallenge: networkLobby.pendingChallenge,
        ui: networkLobbyUiState,
        windowMinimized: networkLobbyWindowMinimized,
      });
    let overlay = existingLobbyOverlay;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "network-lobby-overlay";
      root.appendChild(overlay);
    }
    if (overlay.dataset.renderKey !== overlaySignature) {
      overlay.dataset.renderKey = overlaySignature;
      overlay.innerHTML = overlayMarkup;
      attachNetworkLobbyOverlayHandlers(overlay);
    }
  } else if (existingLobbyOverlay) {
    existingLobbyOverlay.remove();
  }

  ensureFieldFeedbackListener();
  ensureFieldFeedbackOverlay();
  syncFieldPromptOverlay(!combatActive ? activeInteractionPrompt : null);
  centerViewportOnPlayer();

  // Re-attach wheel listener if needed (viewport is recreated on each render)
  const viewport = fieldRoot.querySelector<HTMLElement>(".field-viewport");
  if (viewport) {
    viewport.addEventListener("wheel", handleWheelZoom, { passive: false });
  }

  attachStuckNoteHandlers(fieldRoot, {
    onStateChange: () => renderFieldScreen(currentMap?.id ?? "base_camp"),
    getStickyZoom: () => fieldZoom,
    onStickyDragStart: () => {
      if (fieldState && !fieldState.isPaused) {
        fieldState.isPaused = true;
        stickyNoteDragResumePending = true;
      } else {
        stickyNoteDragResumePending = false;
      }
    },
    onStickyDragEnd: () => {
      if (fieldState && stickyNoteDragResumePending) {
        fieldState.isPaused = false;
      }
      stickyNoteDragResumePending = false;
    },
  });
  attachHavenBuildListeners(fieldRoot);
  drawPinnedMinimapOverlay();
  registerFieldControllerContext();
  scheduleFieldFocusableRefresh();
}

function attachHavenBuildListeners(fieldRoot: HTMLElement): void {
  if (!isHavenBuildModeEnabled()) {
    return;
  }

  const closeButton = fieldRoot.querySelector<HTMLElement>("[data-build-close='true']");
  closeButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setHavenBuildMode(false);
  });

  const clearButton = fieldRoot.querySelector<HTMLElement>("[data-build-clear='true']");
  clearButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    havenBuildPaletteSelection = null;
    render();
  });

  const placeCenterButton = fieldRoot.querySelector<HTMLElement>("[data-build-place-center='true']");
  placeCenterButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    placeCurrentBuildSelectionAtViewCenter();
  });

  const rotateSelectionButton = fieldRoot.querySelector<HTMLElement>("[data-build-rotate-selection='true']");
  rotateSelectionButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    rotateSelectedBuildDecor();
  });

  fieldRoot.querySelectorAll<HTMLElement>("[data-build-select-node]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = button.dataset.buildSelectNode as BaseCampNodeId | undefined;
      if (!nodeId) {
        return;
      }
      havenBuildPaletteSelection = { kind: "node", nodeId };
      render();
    });
  });

  fieldRoot.querySelectorAll<HTMLElement>("[data-build-select-decor]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const decorId = button.dataset.buildSelectDecor;
      if (!decorId) {
        return;
      }
      havenBuildPaletteSelection = createHavenBuildDecorSelection(decorId);
      render();
    });
  });

  fieldRoot.querySelectorAll<HTMLElement>("[data-build-craft-decor]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const decorId = button.dataset.buildCraftDecor;
      if (!decorId) {
        return;
      }
      const decor = getDecorItemById(decorId);
      if (!decor || !craftDecorItem(decorId)) {
        showSystemPing({
          type: "error",
          title: "FABRICATION FAILED",
          message: "Resources blocked that decor build.",
          channel: "haven-build",
        });
        return;
      }
      havenBuildPaletteSelection = createHavenBuildDecorSelection(decorId);
      showSystemPing({
        type: "success",
        title: "DECOR FABRICATED",
        message: decor.name,
        channel: "haven-build",
      });
      syncCurrentMapFromState();
      render();
    });
  });

  fieldRoot.querySelectorAll<HTMLElement>("[data-build-rotate-decor]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const placementId = button.dataset.buildRotateDecor;
      if (!placementId) {
        return;
      }
      rotatePlacedBuildDecor(placementId);
    });
  });

  const mapElement = fieldRoot.querySelector<HTMLElement>(".field-map");
  if (mapElement) {
    mapElement.addEventListener("click", (event) => {
      if (!havenBuildPaletteSelection) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest(".field-object") || target.closest(".field-build-panel")) {
        return;
      }
      const placement = getBuildPlacementFromClientPosition(event.clientX, event.clientY);
      if (!placement) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      placeCurrentBuildSelection(placement.tileX, placement.tileY);
    });
  }

  fieldRoot.querySelectorAll<HTMLElement>(".field-build-object-remove").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const kind = button.dataset.buildRemoveKind;
      const itemId = button.dataset.buildRemove;
      if (!kind || !itemId) {
        return;
      }
      if (kind === "node") {
        const nodeId = itemId as BaseCampNodeId;
        const layout = getBaseCampNodeLayout(getGameState().uiLayout, nodeId);
        commitBaseCampNodeLayout(nodeId, layout.x, layout.y, true);
      } else {
        removeFieldDecor(itemId);
      }
      havenBuildPaletteSelection = null;
      syncCurrentMapFromState();
      render();
    });
  });

  fieldRoot.querySelectorAll<HTMLElement>(".field-object[data-build-kind]").forEach((element) => {
    element.onpointerdown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".field-build-object-remove") || target.closest(".field-build-object-rotate")) {
        return;
      }

      const kind = element.dataset.buildKind as "node" | "decor" | undefined;
      const itemId = element.dataset.buildItemId;
      const width = Number(element.dataset.buildWidth ?? 0);
      const height = Number(element.dataset.buildHeight ?? 0);
      if (!kind || !itemId || width <= 0 || height <= 0) {
        return;
      }

      const originX = Math.round(parseFloat(element.style.left || "0") / FIELD_TILE_SIZE);
      const originY = Math.round(parseFloat(element.style.top || "0") / FIELD_TILE_SIZE);
      const tilePoint = getBuildPlacementFromClientPosition(event.clientX, event.clientY);
      if (!tilePoint) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      havenBuildDragState = {
        kind,
        itemId,
        width,
        height,
        offsetTilesX: tilePoint.tileX - originX,
        offsetTilesY: tilePoint.tileY - originY,
        pointerId: event.pointerId,
        element,
        originX,
        originY,
        latestX: originX,
        latestY: originY,
        valid: true,
      };

      element.setPointerCapture(event.pointerId);

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!havenBuildDragState || moveEvent.pointerId !== havenBuildDragState.pointerId) {
          return;
        }
        const nextPoint = getBuildPlacementFromClientPosition(moveEvent.clientX, moveEvent.clientY);
        if (!nextPoint) {
          return;
        }
        const nextOrigin = clampBuildOrigin(
          nextPoint.tileX - havenBuildDragState.offsetTilesX,
          nextPoint.tileY - havenBuildDragState.offsetTilesY,
          havenBuildDragState.width,
          havenBuildDragState.height,
        );
        const excludedObjectId = havenBuildDragState.kind === "node"
          ? getBaseCampNodeDefinition(havenBuildDragState.itemId as BaseCampNodeId)?.objectId ?? null
          : `field_decor_${havenBuildDragState.itemId}`;
        const excludedZoneId = havenBuildDragState.kind === "node"
          ? getBaseCampNodeDefinition(havenBuildDragState.itemId as BaseCampNodeId)?.zoneId ?? null
          : null;
        const placement = validateBuildPlacement(
          nextOrigin.x,
          nextOrigin.y,
          havenBuildDragState.width,
          havenBuildDragState.height,
          excludedObjectId,
          excludedZoneId,
        );
        havenBuildDragState.latestX = nextOrigin.x;
        havenBuildDragState.latestY = nextOrigin.y;
        havenBuildDragState.valid = placement.valid;
        setDraggedBuildElementPosition(havenBuildDragState.element, nextOrigin.x, nextOrigin.y, placement.valid);
      };

      const endDrag = (endEvent?: PointerEvent) => {
        if (!havenBuildDragState || (endEvent && endEvent.pointerId !== havenBuildDragState.pointerId)) {
          return;
        }

        const dragState = havenBuildDragState;
        havenBuildDragState = null;
        try {
          dragState.element.releasePointerCapture(dragState.pointerId);
        } catch {
          // ignore pointer capture cleanup issues
        }
        dragState.element.removeEventListener("pointermove", onPointerMove);
        dragState.element.removeEventListener("pointerup", endDrag);
        dragState.element.removeEventListener("pointercancel", endDrag);

        if (dragState.valid) {
          if (dragState.kind === "node") {
            commitBaseCampNodeLayout(dragState.itemId as BaseCampNodeId, dragState.latestX, dragState.latestY, false);
          } else {
            moveFieldDecor(dragState.itemId, dragState.latestX, dragState.latestY);
          }
          syncCurrentMapFromState();
          render();
          return;
        }

        setDraggedBuildElementPosition(dragState.element, dragState.originX, dragState.originY, true);
        showSystemPing({
          type: "error",
          title: "INVALID PLACEMENT",
          message: "Keep items on open floor and away from other objects.",
          channel: "haven-build",
        });
      };

      element.addEventListener("pointermove", onPointerMove);
      element.addEventListener("pointerup", endDrag);
      element.addEventListener("pointercancel", endDrag);
    };
  });
}

function renderFieldEnemies(enemies: NonNullable<FieldState["fieldEnemies"]>): string {
  return enemies
    .filter((enemy) => enemy.hp > 0 || enemy.deathAnimTime)
    .map((enemy) => {
      const isDying = enemy.deathAnimTime !== undefined && enemy.hp <= 0;
      const telegraphHtml = !isDying ? renderFieldEnemyTelegraph(enemy) : "";
      const spriteHtml = enemy.spritePath
        ? `<div class="enemy-sprite"><img class="field-enemy-sprite-image" src="${enemy.spritePath}" alt="" /></div>`
        : `<div class="enemy-sprite">👾</div>`;
      return `
        ${telegraphHtml}
        <div class="field-node-enemy ${isDying ? "enemy-dying" : ""}" style="
          left: ${enemy.x - enemy.width / 2}px;
          top: ${enemy.y - enemy.height / 2}px;
          width: ${enemy.width}px;
          height: ${enemy.height}px;
        ">
          ${spriteHtml}
          ${!isDying ? `
            <div class="enemy-hp-bar">
              <div class="enemy-hp-fill" style="width: ${(enemy.hp / enemy.maxHp) * 100}%"></div>
            </div>
          ` : ""}
        </div>
      `;
    })
    .join("");
}

function renderFieldEnemyTelegraph(enemy: FieldEnemy): string {
  if (enemy.attackState !== "windup" && enemy.attackState !== "recovery") {
    return "";
  }

  const profile = getHaven3DEnemyAttackProfile(enemy);
  const directionX = enemy.attackDirectionX ?? getFieldFacingUnitVector(enemy.facing).x;
  const directionY = enemy.attackDirectionY ?? getFieldFacingUnitVector(enemy.facing).y;
  const originX = enemy.attackOriginX ?? enemy.x;
  const originY = enemy.attackOriginY ?? enemy.y;
  const rotationDeg = (Math.atan2(directionY, directionX) * 180 / Math.PI) - 90;
  const width = Math.max(28, (profile.halfWidth * 2) + enemy.width);
  const height = Math.max(36, profile.reach + (enemy.height * 0.5));
  const currentTime = performance.now();
  const elapsed = Math.max(0, currentTime - Number(enemy.attackStartedAt ?? currentTime));
  const progress = enemy.attackState === "windup"
    ? Math.max(0, Math.min(1, elapsed / Math.max(1, profile.windupMs)))
    : 1 - Math.max(0, Math.min(1, elapsed / Math.max(1, profile.recoveryMs)));

  return `
    <div
      class="field-enemy-telegraph field-enemy-telegraph--${enemy.attackState}"
      style="
        left: ${originX}px;
        top: ${originY}px;
        width: ${width}px;
        height: ${height}px;
        transform: translateX(-50%) rotate(${rotationDeg.toFixed(2)}deg);
        --telegraph-progress: ${progress.toFixed(3)};
      "
    ></div>
  `;
}

function renderFieldProjectiles(projectiles: FieldProjectile[]): string {
  return projectiles
    .map(
      (projectile) => `
        <div class="field-node-projectile"
             style="left: ${projectile.x - 4}px; top: ${projectile.y - 4}px; width: 8px; height: 8px;"></div>
      `
    )
    .join("");
}

function renderFieldGearbladeModeStrip(combat: NonNullable<FieldState["combat"]>): string {
  const activeMode = getFieldGearbladeMode(combat);
  const modes: Array<{ mode: Haven3DGearbladeMode; key: string; label: string }> = [
    { mode: "blade", key: "1", label: "Blade" },
    { mode: "launcher", key: "2", label: "Launcher" },
    { mode: "grapple", key: "3", label: "Grapple" },
  ];
  return `
    <div class="haven3d-mode-strip field-gearblade-mode-strip" aria-label="Gearblade modes">
      ${modes.map(({ mode, key, label }) => `
        <button
          class="haven3d-mode-chip ${activeMode === mode ? "haven3d-mode-chip--active" : ""}"
          type="button"
          data-field-gearblade-mode="${mode}"
          aria-pressed="${activeMode === mode}"
        ><span>${key}</span>${label}</button>
      `).join("")}
    </div>
  `;
}

function renderFieldAttackEffect(player: { x: number; y: number; facing: "north" | "south" | "east" | "west" }): string {
  const activeMode = getFieldGearbladeMode(fieldState?.combat);
  const attackOffset = {
    north: { x: 0, y: -35, rotation: -45 },
    south: { x: 0, y: 35, rotation: 135 },
    east: { x: 35, y: 0, rotation: 45 },
    west: { x: -35, y: 0, rotation: -135 },
  };

  const offset = attackOffset[player.facing];
  return `
    <div class="field-node-attack-effect field-node-sword-slash field-node-sword-slash--${activeMode}"
         data-facing="${player.facing}"
         style="
           left: ${player.x + offset.x - 40}px;
           top: ${player.y + offset.y - 40}px;
           width: 80px;
           height: 80px;
           transform-origin: center center;
         ">
      <div class="sword-slash-line" style="transform: rotate(${offset.rotation}deg);"></div>
    </div>
  `;
}

function centerViewportOnPlayer(): void {
  if (!fieldState) return;

  const viewport = document.querySelector(".field-viewport");
  const map = document.querySelector(".field-map");
  if (!viewport || !map) return;

  const viewportRect = viewport.getBoundingClientRect();
  const mapElement = map as HTMLElement;

  let centerX: number;
  let centerY: number;

  if (isHavenBuildModeEnabled()) {
    const buildCenter = havenBuildCameraCenter ?? clampBuildCameraCenter(
      getTrackedFieldCenter().x,
      getTrackedFieldCenter().y,
    );
    havenBuildCameraCenter = buildCenter;
    centerX = buildCenter.x;
    centerY = buildCenter.y;
  } else {
    const trackedCenter = clampBuildCameraCenter(
      getTrackedFieldCenter().x,
      getTrackedFieldCenter().y,
    );
    if (!smoothedFieldCameraCenter) {
      smoothedFieldCameraCenter = trackedCenter;
    } else {
      smoothedFieldCameraCenter = {
        x: smoothedFieldCameraCenter.x + ((trackedCenter.x - smoothedFieldCameraCenter.x) * FIELD_CAMERA_SMOOTHING),
        y: smoothedFieldCameraCenter.y + ((trackedCenter.y - smoothedFieldCameraCenter.y) * FIELD_CAMERA_SMOOTHING),
      };
    }
    centerX = smoothedFieldCameraCenter.x;
    centerY = smoothedFieldCameraCenter.y;
  }

  // Account for zoom when calculating offset
  const offsetX = centerX - (viewportRect.width / (2 * fieldZoom));
  const offsetY = centerY - (viewportRect.height / (2 * fieldZoom));

  currentFieldCameraTransform = {
    offsetX,
    offsetY,
    zoom: fieldZoom,
  };
  applyMapTransform(mapElement, offsetX, offsetY, fieldZoom);
}

function applyMapTransform(mapElement: HTMLElement, offsetX: number, offsetY: number, zoom: number): void {
  // Apply scale first, then translate (order matters for CSS transforms)
  // We need to adjust translate to account for scale
  mapElement.style.transform = `translate(${-offsetX * zoom}px, ${-offsetY * zoom}px) scale(${zoom})`;
  mapElement.style.transformOrigin = "0 0";
}

// ============================================================================
// ALL NODES PANEL - Bulletproof Implementation
// ============================================================================

function createAllNodesPanel(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Check if panel already exists
  let panel = document.getElementById("allNodesPanel");
  if (panel) {
    // Make sure it's visible and update content
    panel.style.display = "";
    updateAllNodesPanelContent();
    updatePanelVisibility();
    return;
  }

  // Create panel element
  panel = document.createElement("div");
  panel.id = "allNodesPanel";
  panel.className = "all-nodes-panel";
  root.appendChild(panel);

  // Populate content
  updateAllNodesPanelContent();
  updatePanelVisibility();
}

function updateAllNodesPanelContent(): void {
  const panel = document.getElementById("allNodesPanel");
  if (!panel) return;

  const state = getGameState();
  const wad = state.wad ?? 0;
  const res = state.resources ?? createEmptyResourceWallet();

  // Check if we're currently in field mode
  const isInFieldMode = document.querySelector(".field-root") !== null;

  panel.innerHTML = `
    <div class="all-nodes-panel-content">
      <div class="all-nodes-panel-header">
        <div class="all-nodes-panel-title">ALL NODES</div>
        <button class="all-nodes-panel-close" id="allNodesPanelClose">×</button>
      </div>
      <div class="all-nodes-panel-body">
        <div class="all-nodes-mode-toggle">
          <div class="all-nodes-mode-toggle-label">MODE</div>
          <div class="all-nodes-mode-toggle-switch">
            <button class="all-nodes-mode-btn ${!isInFieldMode ? 'all-nodes-mode-btn--active' : ''}" data-mode="basecamp">
              <span class="mode-icon">🏠</span>
              <span class="mode-label">BASE CAMP</span>
            </button>
            <button class="all-nodes-mode-btn ${isInFieldMode ? 'all-nodes-mode-btn--active' : ''}" data-mode="field">
              <span class="mode-icon">🌍</span>
              <span class="mode-label">FIELD</span>
            </button>
          </div>
        </div>
        
        <div class="all-nodes-panel-resources">
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">WAD</span>
            <span class="all-nodes-resource-value">${wad}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">METAL</span>
            <span class="all-nodes-resource-value">${res.metalScrap}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">WOOD</span>
            <span class="all-nodes-resource-value">${res.wood}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">SHARDS</span>
            <span class="all-nodes-resource-value">${res.chaosShards}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">STEAM</span>
            <span class="all-nodes-resource-value">${res.steamComponents}</span>
          </div>
        </div>
        
        <div class="all-nodes-panel-buttons">
          <button class="all-nodes-btn" data-action="shop">
            <span class="btn-icon">🛒</span>
            <span class="btn-label">SHOP</span>
          </button>
          <button class="all-nodes-btn" data-action="workshop">
            <span class="btn-icon">🔨</span>
            <span class="btn-label">WORKSHOP</span>
          </button>
          <button class="all-nodes-btn" data-action="roster">
            <span class="btn-icon">👥</span>
            <span class="btn-label">UNIT ROSTER</span>
          </button>
          <button class="all-nodes-btn" data-action="loadout">
            <span class="btn-icon">🎒</span>
            <span class="btn-label">LOADOUT</span>
          </button>
          <button class="all-nodes-btn" data-action="inventory">
            <span class="btn-icon">📦</span>
            <span class="btn-label">INVENTORY</span>
          </button>
          <button class="all-nodes-btn" data-action="quest-board">
            <span class="btn-icon">📋</span>
            <span class="btn-label">QUEST BOARD</span>
          </button>
          <button class="all-nodes-btn" data-action="tavern">
            <span class="btn-icon">🍺</span>
            <span class="btn-label">TAVERN</span>
          </button>
          <button class="all-nodes-btn" data-action="ops-terminal">
            <span class="btn-icon">🎯</span>
            <span class="btn-label">OPS TERMINAL</span>
          </button>
          <button class="all-nodes-btn" data-action="gear-workbench">
            <span class="btn-icon">🔧</span>
            <span class="btn-label">WORKSHOP</span>
          </button>
          <button class="all-nodes-btn" data-action="port">
            <span class="btn-icon">⚓</span>
            <span class="btn-label">PORT</span>
          </button>
          <button class="all-nodes-btn" data-action="dispatch">
            <span class="btn-icon">🛰</span>
            <span class="btn-label">DISPATCH</span>
          </button>
          <button class="all-nodes-btn all-nodes-btn--stable" data-action="stable">
            <span class="btn-icon">🐎</span>
            <span class="btn-label">STABLE</span>
          </button>
          <button class="all-nodes-btn" data-action="settings">
            <span class="btn-icon">⚙</span>
            <span class="btn-label">SETTINGS</span>
          </button>
          <button class="all-nodes-btn" data-action="comms-array">
            <span class="btn-icon">📡</span>
            <span class="btn-label">COMMS ARRAY</span>
          </button>
          <div class="all-nodes-divider"></div>
          <button class="all-nodes-btn all-nodes-btn--debug" data-action="endless-field-nodes">
            <span class="btn-icon">∞</span>
            <span class="btn-label">ENDLESS FIELD NODES</span>
          </button>
          <button class="all-nodes-btn all-nodes-btn--debug" data-action="endless-battles">
            <span class="btn-icon">⚔</span>
            <span class="btn-label">ENDLESS BATTLES</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach close button listener
  const closeBtn = panel.querySelector("#allNodesPanelClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAllNodesPanel();
    });
  }

  // Attach mode toggle listeners
  const modeButtons = panel.querySelectorAll(".all-nodes-mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mode = (btn as HTMLElement).dataset.mode;
      if (mode === "basecamp") {
        toggleAllNodesPanel();
        openAllNodesMenuFromField();
      } else if (mode === "field") {
        toggleAllNodesPanel();
        // Use current map if in field mode, otherwise default to base_camp
        const currentMapName = fieldState?.currentMap ?? "base_camp";
        renderFieldScreen(currentMapName);
      }
    });
  });

  // Attach button listeners via delegation
  panel.addEventListener("click", handlePanelClick);
}

function handlePanelClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const btn = target.closest(".all-nodes-btn") as HTMLElement;
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const action = btn.getAttribute("data-action");
  if (action) {
    handleNodeAction(action);
  }
}

function updatePanelVisibility(): void {
  const panel = document.getElementById("allNodesPanel");
  if (!panel) return;

  if (isPanelOpen) {
    panel.classList.add("all-nodes-panel--open");
  } else {
    panel.classList.remove("all-nodes-panel--open");
  }
}

function toggleAllNodesPanel(): void {
  if (shouldSuppressEscMenuAccess()) {
    return;
  }

  // Navigate to the standalone All Nodes Menu Screen
  // This exits field mode and shows the menu as an independent screen
  const currentMapId = fieldState?.currentMap ?? "base_camp";

  // Stop the game loop and cleanup
  stopGameLoop();
  stopHaven3DFieldRuntime();
  resetFieldMovementInputState();
  cleanupGlobalListeners();

  // Remove the overlay panel if it exists
  const panel = document.getElementById("allNodesPanel");
  if (panel) {
    panel.remove();
  }

  removePinnedNodesOverlay();

  isPanelOpen = false;

  // Navigate to the All Nodes Menu Screen
  openAllNodesMenuFromField(currentMapId);
}

function closeAllNodesPanel(): void {
  isPanelOpen = false;
  updatePanelVisibility();
}

function renderPinnedOverlayToolbar(itemId: string, label: string): string {
  return `
    <div class="all-nodes-item-toolbar field-pinned-item-toolbar">
      <span class="all-nodes-item-grip" aria-hidden="true">::</span>
      <div class="all-nodes-item-toolbar-actions">
        <button class="all-nodes-item-pin all-nodes-item-pin--active" type="button" data-field-pin-id="${itemId}" aria-label="Unpin ${label}">P</button>
      </div>
    </div>
  `;
}

function renderPinnedDispatchNodePip(): string {
  const dispatch = getDispatchState(getGameState());
  if (dispatch.activeExpeditions.length === 0) {
    return `
      <span class="node-pip node-pip--idle">
        <span class="node-pip-label">Routes</span>
        <span class="node-pip-value">Idle</span>
      </span>
    `;
  }

  const routeSummary = dispatch.activeExpeditions
    .slice(0, 2)
    .map((expedition) => {
      const remaining = Math.max(0, expedition.completesAtTick - dispatch.dispatchTick);
      return `${expedition.missionName} ${remaining}t`;
    })
    .join(" • ");
  const extraCount = Math.max(0, dispatch.activeExpeditions.length - 2);
  const compactSummary = extraCount > 0 ? `${routeSummary} +${extraCount}` : routeSummary;

  return `
    <span class="node-pip">
      <span class="node-pip-label">Routes</span>
      <span class="node-pip-value">${compactSummary}</span>
    </span>
  `;
}

function renderPinnedRosterNodePip(): string {
  const state = getGameState();
  const friendlyUnits = Object.values(state.unitsById).filter((unit) => !unit.isEnemy);
  const partyCount = (state.partyUnitIds ?? []).length;
  const reserveCount = Math.max(0, friendlyUnits.length - partyCount);
  const statBank = getStatBank(state);

  return `
    <span class="node-pip">
      <span class="node-pip-label">Roster</span>
      <span class="node-pip-value">${partyCount} party / ${reserveCount} reserve • ${statBank} ${STAT_SHORT_LABEL}</span>
    </span>
  `;
}

function isPinnedTheaterAutoTickEnabled(): boolean {
  return Boolean(getGameState().uiLayout?.baseCampTheaterAutoTickEnabled);
}

function getPinnedAtlasFloorOrdinalSafe(): number {
  try {
    return getCurrentOpsTerminalAtlasFloor().floorOrdinal;
  } catch {
    return 1;
  }
}

function renderPinnedTheaterAutoTickCard(): string {
  const enabled = isPinnedTheaterAutoTickEnabled();
  const floorOrdinal = getPinnedAtlasFloorOrdinalSafe();
  const summaries = getOpsTerminalAtlasWarmEconomySummaries(floorOrdinal);
  const totalWadUpkeep = summaries.reduce((total, summary) => total + Math.max(0, summary.wadUpkeepPerTick ?? 0), 0);
  const incomeSummary = summaries
    .flatMap((summary) => getResourceEntries(summary.incomePerTick))
    .filter(({ amount }) => Number(amount ?? 0) > 0)
    .slice(0, 3)
    .map(({ key, amount }) => `${RESOURCE_SHORT_LABELS[key] ?? key.toUpperCase()} +${Math.round(Number(amount ?? 0))}`)
    .join(" // ");

  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--theater-clock">
      ${renderPinnedOverlayToolbar(PINNED_THEATER_AUTO_TICK_LAYOUT_ID, "theater clock")}
      <section class="all-nodes-theater-clock-panel" aria-label="Theater clock">
        <div class="all-nodes-theater-clock-heading">
          <span class="all-nodes-theater-clock-kicker">BACKGROUND THEATER TICKS</span>
          <span class="all-nodes-theater-clock-rate">+1 TICK / 10 SEC</span>
        </div>
        <div class="all-nodes-theater-clock-meta">
          <span>FLOOR ${String(Math.max(1, floorOrdinal)).padStart(2, "0")}</span>
          <span>${summaries.length} ONLINE</span>
          <span>WAD ${totalWadUpkeep > 0 ? `-${totalWadUpkeep}` : "0"}</span>
        </div>
        <button
          class="all-nodes-theater-clock-toggle${enabled ? " is-active" : ""}"
          type="button"
          data-field-theater-autotick-toggle="${enabled ? "off" : "on"}"
          aria-pressed="${enabled ? "true" : "false"}"
        >
          <span class="all-nodes-theater-clock-toggle-track">
            <span class="all-nodes-theater-clock-toggle-thumb"></span>
          </span>
          <span class="all-nodes-theater-clock-toggle-copy">
            <span class="all-nodes-theater-clock-toggle-state">${enabled ? "ONLINE" : "OFFLINE"}</span>
            <span class="all-nodes-theater-clock-toggle-desc">${enabled ? "Atlas sectors keep advancing while you stay in field mode." : "Flip the switch to keep online theaters moving in the background."}</span>
          </span>
        </button>
        <div class="all-nodes-theater-clock-status">
          <div class="all-nodes-theater-clock-line">${summaries.length > 0 ? `${summaries[0]?.sectorLabel ?? "SECTOR"} ${summaries[0]?.zoneName ?? "ONLINE"}${summaries.length > 1 ? ` // +${summaries.length - 1} more` : ""}` : "No operational theaters are online on this floor."}</div>
          <div class="all-nodes-theater-clock-line all-nodes-theater-clock-line--muted">${incomeSummary || "No active income streams are registered on this floor yet."}</div>
        </div>
      </section>
    </div>
  `;
}

function renderPinnedNodeCard(node: PinnedNodeDefinition): string {
  const availability = isFieldEscNodeAction(node.action)
    ? getEscActionAvailability(node.action, getFieldEscAvailabilityContext())
    : "active";
  const variantClass = node.variant ? ` ${node.variant}` : "";
  const disabledClass = availability === "disabled" ? " all-nodes-node-btn--disabled" : "";
  const pip = node.action === "dispatch"
    ? renderPinnedDispatchNodePip()
    : node.action === "roster"
      ? renderPinnedRosterNodePip()
      : "";
  return `
    <div class="all-nodes-item-shell">
      ${renderPinnedOverlayToolbar(node.action, node.label)}
      <button class="all-nodes-node-btn${variantClass}${disabledClass}" type="button" data-field-node-action="${node.action}" ${availability === "disabled" ? "disabled aria-disabled=\"true\"" : ""}>
        <span class="node-icon">${node.icon}</span>
        <span class="node-label">${node.label}</span>
        <span class="node-desc">${node.desc}</span>
        ${pip}
      </button>
    </div>
  `;
}

function renderPinnedResourceCard(wad: number, resources: ResourceWallet): string {
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--resource">
      ${renderPinnedOverlayToolbar(PINNED_RESOURCE_LAYOUT_ID, "resource tracker")}
      <section class="all-nodes-balance-panel" aria-label="Resource balances">
        <div class="all-nodes-balance-heading">
          <span class="all-nodes-balance-kicker">RESOURCE BALANCE</span>
        </div>
        <div class="all-nodes-balance-grid">
          <div class="all-nodes-balance-item">
            <span class="all-nodes-balance-icon">W</span>
            <span class="all-nodes-balance-label">WAD</span>
            <span class="all-nodes-balance-value">${wad.toLocaleString()}</span>
          </div>
          ${getResourceEntries(resources, { includeZero: true, keys: BASIC_RESOURCE_KEYS }).map((entry) => `
            <div class="all-nodes-balance-item">
              <span class="all-nodes-balance-icon">${entry.abbreviation}</span>
              <span class="all-nodes-balance-label">${entry.shortLabel}</span>
              <span class="all-nodes-balance-value">${entry.amount}</span>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function getPinnedMaterialRefineryContext(): MaterialRefineryContext {
  const mapId = fieldState?.currentMap ?? currentMap?.id ?? "base_camp";
  return getOuterDeckFieldContext(String(mapId)) === "outerDeckBranch" ? "expedition" : "haven";
}

function formatPinnedMaterialRefineryCost(recipeId: AdvancedMaterialId): string {
  const recipe = getMaterialRefineryRecipe(recipeId);
  return Object.entries(recipe.cost)
    .map(([resourceKey, amount]) => `${amount}${PINNED_MATERIALS_REFINERY_RESOURCE_SHORT_LABELS[resourceKey] ?? resourceKey}`)
    .join(" + ");
}

function formatPinnedMaterialRefineryShortage(recipeId: AdvancedMaterialId): string {
  const shortage = getMaterialRefineryShortage(getGameState(), recipeId);
  if (shortage.length === 0) {
    return "READY";
  }

  return shortage
    .map((entry) => `${PINNED_MATERIALS_REFINERY_RESOURCE_SHORT_LABELS[entry.resourceKey] ?? entry.resourceKey} ${entry.available}/${entry.required}`)
    .join(" · ");
}

function renderPinnedMaterialsRefineryCard(): string {
  const state = getGameState();
  const context = getPinnedMaterialRefineryContext();
  const destinationLabel = context === "expedition" ? "FORWARD LOCKER" : "BASE STORAGE";

  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--materials-refinery">
      ${renderPinnedOverlayToolbar("materials-refinery", "light crafting")}
      <section class="all-nodes-refinery-panel" aria-label="Light crafting">
        <div class="all-nodes-refinery-heading">
          <div class="all-nodes-refinery-title">LIGHT CRAFTING</div>
          <span class="all-nodes-refinery-destination">${destinationLabel}</span>
        </div>
        <div class="all-nodes-refinery-resource-strip">
          ${BASIC_RESOURCE_KEYS.map((resourceKey) => `
            <div class="all-nodes-refinery-resource-item">
              <span>${PINNED_MATERIALS_REFINERY_RESOURCE_SHORT_LABELS[resourceKey] ?? resourceKey}</span>
              <strong>${Number(state.resources?.[resourceKey] ?? 0)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="all-nodes-refinery-grid">
          ${getMaterialRefineryRecipes().map((recipe) => {
            const owned = countAdvancedMaterialOwned(state, recipe.id);
            const canCraft = canCraftMaterialRefineryRecipe(state, recipe.id);
            return `
              <article class="all-nodes-refinery-card${canCraft ? "" : " all-nodes-refinery-card--locked"}">
                <div class="all-nodes-refinery-card-header">
                  <div class="all-nodes-refinery-card-name">${recipe.name}</div>
                  <span class="all-nodes-refinery-card-owned">x${owned}</span>
                </div>
                <div class="all-nodes-refinery-card-meta">
                  <span class="all-nodes-refinery-card-cost">${formatPinnedMaterialRefineryCost(recipe.id)}</span>
                  <span class="all-nodes-refinery-card-status${canCraft ? "" : " all-nodes-refinery-card-status--short"}">${formatPinnedMaterialRefineryShortage(recipe.id)}</span>
                </div>
                <button
                  class="all-nodes-refinery-craft-btn"
                  type="button"
                  data-refinery-craft-id="${recipe.id}"
                  ${canCraft ? "" : "disabled"}
                >
                  MAKE
                </button>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderPinnedQuacCard(): string {
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--quac">
      ${renderPinnedOverlayToolbar(PINNED_QUAC_LAYOUT_ID, "QUAC terminal")}
      <section class="all-nodes-cli-panel" aria-label="Quick User Access Console">
        <div class="all-nodes-cli-header">
          <div class="all-nodes-cli-title">Q.U.A.C. TERMINAL</div>
        </div>
        <form class="all-nodes-cli-form" data-field-quac-form>
          <label class="all-nodes-cli-prompt" for="fieldPinnedQuacInput">S/COM://QUAC&gt;</label>
          <input
            class="all-nodes-cli-input"
            id="fieldPinnedQuacInput"
            name="fieldPinnedQuacInput"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder='Enter command: "unit roster", "loadout", "inventory"...'
          />
          <button class="all-nodes-cli-submit" type="submit">EXECUTE</button>
        </form>
        <div class="all-nodes-cli-status" data-field-quac-status>${fieldPinnedQuacFeedback}</div>
      </section>
    </div>
  `;
}

function renderPinnedQuacStatus(statusEl: HTMLElement, message: string, isError = false): void {
  statusEl.classList.toggle("all-nodes-cli-status--error", isError);
  statusEl.innerHTML = "";

  const output = document.createElement("div");
  output.className = "all-nodes-cli-status__output";
  statusEl.appendChild(output);

  startTerminalTyping(statusEl, output, [message], {
    showCursor: false,
    loop: false,
    baseCharDelayMs: 16,
    minCharDelayMs: 6,
    accelerationPerCharMs: 0.7,
    pauseAfterLineMs: 90,
    maxLines: 1,
    scrollBehavior: "auto",
    lineClassName: "all-nodes-cli-status__line",
    promptClassName: "all-nodes-cli-status__prompt",
    textClassName: "all-nodes-cli-status__text",
    promptParser: (line) => ({
      prompt: "S/COM://QUAC>",
      text: ` ${line}`,
    }),
  });
}

function renderPinnedNotesCard(): string {
  const state = getGameState();
  const anchorX = Math.round((state.players?.P1?.avatar?.x ?? 640) + 56);
  const anchorY = Math.round((state.players?.P1?.avatar?.y ?? 360) - 28);
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--notes">
      ${renderPinnedOverlayToolbar(NOTES_LAYOUT_ID, "field memos")}
      <section class="all-nodes-notes-panel" aria-label="Field memos" data-ez-drag-disable="true">
        <div class="all-nodes-notes-panel__title">FIELD MEMOS</div>
        ${renderNotesWidget("field-pinned-notes", {
          className: "notes-widget--esc",
          placeholder: "Record reminders, squad plans, build routes, or anything else you want to keep pinned to E.S.C.",
          statusLabel: "AUTO-SAVE ACTIVE // AVAILABLE IN ATLAS + THEATER",
          titleLabel: "Tab Name",
          stickyTarget: {
            surfaceType: "field",
            surfaceId: fieldState?.currentMap ?? "base_camp",
            x: anchorX,
            y: anchorY,
          },
        })}
      </section>
    </div>
  `;
}

function renderPinnedQuestTrackerCard(): string {
  initializeQuestState();
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--quest-tracker">
      ${renderPinnedOverlayToolbar(PINNED_QUEST_TRACKER_LAYOUT_ID, "quest tracker")}
      ${renderQuestTrackerWidget(getActiveQuests(), {
        className: "quest-tracker-widget--esc",
        emptyTitle: "NO ACTIVE QUESTS",
        emptyText: "Accept directives and contracts from the Quest Board to track them here.",
      })}
    </div>
  `;
}

function renderPinnedMinimapCard(): string {
  const model = currentMap && fieldState
    ? buildFieldMinimapModel(currentMap.id, {
      runtimeMap: currentMap,
      runtimeFieldState: fieldState,
    })
    : null;
  const subtitle = model ? `${model.mapName} // ${model.width}x${model.height}` : "NO FIELD DATA AVAILABLE";
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--minimap">
      ${renderPinnedOverlayToolbar(MINIMAP_LAYOUT_ID, "minimap")}
      <section class="all-nodes-minimap-panel all-nodes-minimap-panel--pinned" aria-label="Pinned field minimap">
        <div class="all-nodes-minimap-header">
          <div class="all-nodes-minimap-heading">
            <span class="all-nodes-minimap-kicker">MINIMAP</span>
            <span class="all-nodes-minimap-subtitle">${subtitle}</span>
          </div>
          ${model ? `<span class="all-nodes-minimap-readout">${model.discoveredCount} scan cells</span>` : ""}
        </div>
        <div class="all-nodes-minimap-frame">
          ${model
            ? `<canvas class="all-nodes-minimap-canvas" data-field-minimap-canvas aria-label="Pinned minimap canvas for ${model.mapName}"></canvas>`
            : `
              <div class="all-nodes-minimap-empty">
                <span class="all-nodes-minimap-empty-title">SCAN CACHE EMPTY</span>
                <span class="all-nodes-minimap-empty-text">Field cartography will appear here once the map is initialized.</span>
              </div>
            `}
        </div>
      </section>
    </div>
  `;
}

function renderPinnedOverlayItem(itemId: string, frame: BaseCampPinnedItemFrame, colors: Record<string, string>): string {
  const style = [
    `left: ${frame.left}px`,
    `top: ${frame.top}px`,
    `width: ${frame.width}px`,
    `height: ${frame.height}px`,
    getPinnedItemThemeStyle(itemId, colors),
  ].join("; ");

  if (itemId === PINNED_RESOURCE_LAYOUT_ID) {
    const state = getGameState();
    const resources = state.resources ?? createEmptyResourceWallet();
    return `
      <div class="all-nodes-grid-item field-pinned-item field-pinned-item--resource" data-pinned-item-id="${itemId}" style="${style}">
        ${renderPinnedResourceCard(state.wad ?? 0, resources)}
      </div>
    `;
  }

  if (itemId === PINNED_QUAC_LAYOUT_ID) {
    return `
      <div class="all-nodes-grid-item field-pinned-item field-pinned-item--quac" data-pinned-item-id="${itemId}" style="${style}">
        ${renderPinnedQuacCard()}
      </div>
    `;
  }

  if (itemId === MINIMAP_LAYOUT_ID) {
    return `
      <div class="all-nodes-grid-item field-pinned-item field-pinned-item--minimap" data-pinned-item-id="${itemId}" style="${style}">
        ${renderPinnedMinimapCard()}
      </div>
    `;
  }

  if (itemId === NOTES_LAYOUT_ID) {
    return `
      <div class="all-nodes-grid-item field-pinned-item field-pinned-item--notes" data-pinned-item-id="${itemId}" style="${style}">
        ${renderPinnedNotesCard()}
      </div>
    `;
  }

  if (itemId === PINNED_QUEST_TRACKER_LAYOUT_ID) {
    return `
      <div class="all-nodes-grid-item field-pinned-item field-pinned-item--quest-tracker" data-pinned-item-id="${itemId}" style="${style}">
        ${renderPinnedQuestTrackerCard()}
      </div>
    `;
  }

  if (itemId === "materials-refinery") {
    return `
      <div class="all-nodes-grid-item field-pinned-item field-pinned-item--materials-refinery" data-pinned-item-id="${itemId}" style="${style}">
        ${renderPinnedMaterialsRefineryCard()}
      </div>
    `;
  }

  if (itemId === PINNED_THEATER_AUTO_TICK_LAYOUT_ID) {
    return `
      <div class="all-nodes-grid-item field-pinned-item field-pinned-item--theater-clock" data-pinned-item-id="${itemId}" style="${style}">
        ${renderPinnedTheaterAutoTickCard()}
      </div>
    `;
  }

  const node = PINNED_NODE_LAYOUT.find((entry) => entry.action === itemId);
  if (!node) return "";

  return `
    <div class="all-nodes-grid-item field-pinned-item" data-pinned-item-id="${itemId}" style="${style}">
      ${renderPinnedNodeCard(node)}
    </div>
  `;
}

function updatePinnedNodesOverlay(): void {
  const overlay = document.getElementById("fieldPinnedOverlay");
  if (!overlay) return;

  const frames = readPinnedOverlayFrames();
  const colors = readPinnedOverlayColors();
  const pinnedItems = readPinnedOverlayItems().filter((itemId) => Boolean(frames[itemId]));

  if (pinnedItems.length === 0) {
    overlay.classList.remove("field-pinned-overlay--active");
    overlay.innerHTML = "";
    return;
  }

  overlay.classList.add("field-pinned-overlay--active");
  overlay.innerHTML = pinnedItems
    .map((itemId) => renderPinnedOverlayItem(itemId, frames[itemId], colors))
    .join("");
  enhanceTerminalUiButtons(overlay);
  overlay.querySelectorAll<HTMLElement>("[data-field-quac-status]").forEach((statusEl) => {
    renderPinnedQuacStatus(statusEl, fieldPinnedQuacFeedback, statusEl.classList.contains("all-nodes-cli-status--error"));
  });
  attachNotesWidgetHandlers(overlay, {
    onStateChange: () => renderFieldScreen(fieldState?.currentMap ?? "base_camp"),
  });
  attachStuckNoteHandlers(overlay, {
    onStateChange: () => renderFieldScreen(fieldState?.currentMap ?? "base_camp"),
    getStickyZoom: () => fieldZoom,
    onStickyDragStart: () => {
      if (fieldState && !fieldState.isPaused) {
        fieldState.isPaused = true;
        stickyNoteDragResumePending = true;
      } else {
        stickyNoteDragResumePending = false;
      }
    },
    onStickyDragEnd: () => {
      if (fieldState && stickyNoteDragResumePending) {
        fieldState.isPaused = false;
      }
      stickyNoteDragResumePending = false;
    },
  });
  requestAnimationFrame(() => drawPinnedMinimapOverlay());
}

function handlePinnedOverlayClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const pinButton = target.closest<HTMLElement>("[data-field-pin-id]");
  if (pinButton) {
    e.preventDefault();
    e.stopPropagation();

    const itemId = pinButton.dataset.fieldPinId;
    if (!itemId) return;

    const pinned = new Set(readPinnedOverlayItems());
    pinned.delete(itemId);
    persistPinnedOverlayItems(Array.from(pinned));
    updatePinnedNodesOverlay();
    return;
  }

  const refineryButton = target.closest<HTMLElement>("[data-refinery-craft-id]");
  if (refineryButton) {
    e.preventDefault();
    e.stopPropagation();

    const recipeId = refineryButton.dataset.refineryCraftId as AdvancedMaterialId | undefined;
    if (!recipeId) {
      return;
    }

    updateGameState((prev) => craftMaterialRefineryRecipe(prev, recipeId, getPinnedMaterialRefineryContext()));
    updatePinnedNodesOverlay();
    return;
  }

  const theaterAutoTickButton = target.closest<HTMLElement>("[data-field-theater-autotick-toggle]");
  if (theaterAutoTickButton) {
    e.preventDefault();
    e.stopPropagation();

    const enabled = theaterAutoTickButton.dataset.fieldTheaterAutotickToggle === "on";
    updateGameState((state) => ({
      ...state,
      uiLayout: {
        ...(state.uiLayout ?? {}),
        baseCampTheaterAutoTickEnabled: enabled,
      },
    }));
    syncFieldTheaterAutoTickState();
    showSystemPing({
      type: enabled ? "success" : "info",
      title: enabled ? "THEATER CLOCK ONLINE" : "THEATER CLOCK OFFLINE",
      message: enabled
        ? "Operational theaters will advance by 1 tick every 10 seconds."
        : "Background theater advancement has been paused.",
      channel: "esc-theater-auto-tick",
      replaceChannel: true,
    });
    updatePinnedNodesOverlay();
    return;
  }

  const nodeButton = target.closest<HTMLElement>("[data-field-node-action]");
  if (!nodeButton) return;

  e.preventDefault();
  e.stopPropagation();

  const action = nodeButton.dataset.fieldNodeAction;
  if (action) {
    handleNodeAction(action);
  }
}

function handlePinnedOverlaySubmit(e: SubmitEvent): void {
  const form = (e.target as HTMLElement | null)?.closest<HTMLFormElement>("[data-field-quac-form]");
  if (!form) return;

  e.preventDefault();
  e.stopPropagation();

  const input = form.querySelector<HTMLInputElement>(".all-nodes-cli-input");
  const status = form.parentElement?.querySelector<HTMLElement>("[data-field-quac-status]");
  if (!input || !status) return;

  const rawCommand = input.value;
  const resolvedAction = resolvePinnedQuacCommand(rawCommand);

  if (!resolvedAction) {
    fieldPinnedQuacFeedback = `Unknown command: "${rawCommand.trim() || "blank"}". Try "unit roster", "loadout", "inventory", "shop", or "port".`;
    renderPinnedQuacStatus(status, fieldPinnedQuacFeedback, true);
    input.select();
    return;
  }

  if (isFieldEscNodeAction(resolvedAction) && !isEscActionEnabled(resolvedAction, getFieldEscAvailabilityContext())) {
    fieldPinnedQuacFeedback = getEscExpeditionRestrictionMessage(resolvedAction);
    renderPinnedQuacStatus(status, fieldPinnedQuacFeedback, true);
    input.select();
    return;
  }

  fieldPinnedQuacFeedback = `Executing ${resolvedAction.toUpperCase()}...`;
  renderPinnedQuacStatus(status, fieldPinnedQuacFeedback);
  input.value = "";
  handleNodeAction(resolvedAction);
}

function handlePinnedOverlayInput(e: Event): void {
  const input = e.target as HTMLInputElement | null;
  if (!input?.classList.contains("all-nodes-cli-input")) return;

  const status = input.closest(".all-nodes-item-shell")?.querySelector<HTMLElement>("[data-field-quac-status]");
  if (!status || !status.classList.contains("all-nodes-cli-status--error")) return;

  fieldPinnedQuacFeedback = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';
  renderPinnedQuacStatus(status, fieldPinnedQuacFeedback);
}

function createPinnedNodesOverlay(): void {
  const root = document.getElementById("app");
  if (!root) return;

  syncFieldTheaterAutoTickState();

  let overlay = document.getElementById("fieldPinnedOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fieldPinnedOverlay";
    overlay.className = "field-pinned-overlay";
    overlay.addEventListener("click", handlePinnedOverlayClick);
    overlay.addEventListener("submit", handlePinnedOverlaySubmit as EventListener);
    overlay.addEventListener("input", handlePinnedOverlayInput);
    root.appendChild(overlay);
  }

  if (fieldPinnedResizeHandler) {
    window.removeEventListener("resize", fieldPinnedResizeHandler);
  }
  fieldPinnedResizeHandler = () => {
    if (!document.querySelector(".field-root")) {
      if (fieldPinnedResizeHandler) {
        window.removeEventListener("resize", fieldPinnedResizeHandler);
        fieldPinnedResizeHandler = null;
      }
      return;
    }
    updatePinnedNodesOverlay();
  };
  window.addEventListener("resize", fieldPinnedResizeHandler);

  updatePinnedNodesOverlay();
}

function removePinnedNodesOverlay(): void {
  document.getElementById("fieldPinnedOverlay")?.remove();

  if (fieldPinnedResizeHandler) {
    window.removeEventListener("resize", fieldPinnedResizeHandler);
    fieldPinnedResizeHandler = null;
  }
}

function getFieldGearbladeMode(combat: FieldState["combat"] | null | undefined): Haven3DGearbladeMode {
  if (combat?.gearbladeMode === "blade" || combat?.gearbladeMode === "launcher" || combat?.gearbladeMode === "grapple") {
    return combat.gearbladeMode;
  }
  return combat?.isRangedMode ? "launcher" : "blade";
}

function setFieldGearbladeMode(mode: Haven3DGearbladeMode): void {
  if (isHaven3DFieldRuntimeActive()) {
    return;
  }

  if (!fieldState?.combat || !isFieldCombatActive()) {
    return;
  }

  fieldState.combat.gearbladeMode = mode;
  fieldState.combat.isRangedMode = mode === "launcher";
  render();
}

function cycleFieldGearbladeMode(): void {
  if (!fieldState?.combat || !isFieldCombatActive()) {
    return;
  }

  const modes: Haven3DGearbladeMode[] = ["blade", "launcher", "grapple"];
  const currentMode = getFieldGearbladeMode(fieldState.combat);
  const currentIndex = Math.max(0, modes.indexOf(currentMode));
  setFieldGearbladeMode(modes[(currentIndex + 1) % modes.length]);
}

function toggleFieldCombatRangedMode(): void {
  if (!fieldState?.combat || !isFieldCombatActive()) {
    return;
  }

  setFieldGearbladeMode(getFieldGearbladeMode(fieldState.combat) === "launcher" ? "blade" : "launcher");
}

function handleFieldGearbladeModePointerDown(event: PointerEvent): void {
  if (isHaven3DFieldRuntimeActive()) {
    return;
  }

  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLElement>("[data-field-gearblade-mode]");
  if (!button || !document.querySelector(".field-root")) {
    return;
  }

  const mode = button.dataset.fieldGearbladeMode as Haven3DGearbladeMode | undefined;
  if (mode !== "blade" && mode !== "launcher" && mode !== "grapple") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  setFieldGearbladeMode(mode);
}

function triggerFieldCombatAttack(): void {
  if (fieldFailureTransitionPending) {
    return;
  }

  if (!fieldState?.combat || !isFieldCombatActive()) {
    return;
  }

  if (fieldState.combat.attackCooldown > 0 || fieldState.combat.isAttacking) {
    return;
  }

  const player = getRuntimeFieldAvatar("P1");
  if (!player) {
    return;
  }

  const mode = getFieldGearbladeMode(fieldState.combat);
  if (mode === "launcher") {
    if (fieldState.combat.energyCells <= 0) {
      showSystemPing({
        type: "info",
        title: "NO ENERGY",
        message: "Use melee attacks to charge ranged shots.",
        detail: "Field enemies keep the room in combat mode until they are cleared.",
        channel: "field-combat-energy",
      });
      return;
    }

    performFieldRangedAttack(player);
  } else if (mode === "grapple") {
    performFieldGrappleAttack(player);
  } else {
    performFieldMeleeAttack(player);
  }

  fieldState.combat.attackCooldown = getFieldAttackCooldown();
  fieldState.combat.isAttacking = true;
  fieldState.combat.attackAnimTime = FIELD_ATTACK_DURATION;
}

function formatFieldEnemyResourceName(resourceKey: "metalScrap" | "wood" | "chaosShards" | "steamComponents"): string {
  switch (resourceKey) {
    case "metalScrap":
      return "Metal Scrap";
    case "wood":
      return "Wood";
    case "chaosShards":
      return "Chaos Shards";
    case "steamComponents":
      return "Steam Components";
    default:
      return resourceKey;
  }
}

function isBasicFieldResourceKey(resourceKey: ResourceKey): resourceKey is (typeof BASIC_RESOURCE_KEYS)[number] {
  return (BASIC_RESOURCE_KEYS as readonly ResourceKey[]).includes(resourceKey);
}

function collectFieldResourceObject(resourceObjectId: string, source: "player" | "sable"): void {
  if (!fieldState) {
    return;
  }

  const targetObject = getUncollectedFieldResourceObjects().find((object) => object.id === resourceObjectId);
  if (!targetObject) {
    return;
  }

  const resourceType = String(targetObject.metadata?.resourceType ?? "") as ResourceKey;
  if (!isBasicFieldResourceKey(resourceType)) {
    return;
  }

  const amount = Math.max(1, Math.floor(Number(targetObject.metadata?.amount ?? 1)));
  const resourceLabel = formatFieldEnemyResourceName(resourceType as "metalScrap" | "wood" | "chaosShards" | "steamComponents");
  const collectorPosition = source === "sable" && fieldState.companion
    ? { x: fieldState.companion.x, y: fieldState.companion.y }
    : { x: fieldState.player.x, y: fieldState.player.y };
  const resourceCenter = {
    x: (targetObject.x + (targetObject.width / 2)) * FIELD_TILE_SIZE,
    y: (targetObject.y + (targetObject.height / 2)) * FIELD_TILE_SIZE,
  };
  fieldState.collectedResourceObjectIds = Array.from(new Set([...(fieldState.collectedResourceObjectIds ?? []), resourceObjectId]));

  const persistentResourceKey = String(targetObject.metadata?.persistentKey ?? targetObject.id);
  updateGameState((state) => {
    const rewardedState = grantSessionResources(state, {
      resources: {
        [resourceType]: amount,
      } as Partial<ResourceWallet>,
    });
    return currentMap && isOuterDeckOpenWorldMap(currentMap)
      ? markOuterDeckOpenWorldResourceCollected(rewardedState, persistentResourceKey)
      : rewardedState;
  });

  if (source === "sable") {
    playSablePickupBark(performance.now());
  }

  triggerFeedback({
    type: "resource",
    source: "field",
    intensity: source === "sable" ? 2 : 1,
    position: {
      x: resourceCenter.x,
      y: resourceCenter.y,
      space: "field-world",
    },
    targetPosition: {
      x: collectorPosition.x,
      y: collectorPosition.y,
      space: "field-world",
    },
    text: `+${amount} ${resourceLabel}`,
    channel: "field-resource-pickup",
    meta: {
      resourceType,
      source,
      objectId: resourceObjectId,
    },
  });

  showSystemPing({
    type: "success",
    title: source === "sable" ? "SABLE RECOVERED SALVAGE" : "SALVAGE RECOVERED",
    message: `${targetObject.metadata?.name ?? resourceLabel} secured.`,
    detail: `+${amount} ${resourceLabel}`,
    durationMs: 2600,
    channel: "field-resource-pickup",
    replaceChannel: true,
  });
}

function awardFieldEnemyDrops(enemy: FieldEnemy): string[] {
  const drops = enemy.drops;
  if (!drops) {
    return [];
  }

  const rewardLines: string[] = [];
  const wad = Math.max(0, Math.floor(drops.wad ?? 0));
  const resources: {
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  } = {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0,
  };
  BASIC_RESOURCE_KEYS.forEach((key) => {
    resources[key] = Math.max(0, Math.floor(drops.resources?.[key] ?? 0));
  });
  const awardedItems = (drops.items ?? []).flatMap((item) => {
    if (!item.id || item.chance <= 0 || Math.random() > item.chance) {
      return [];
    }

    const quantity = Math.max(1, Math.floor(item.quantity || 1));
    const importedItem = getImportedItem(item.id);
    const itemName = importedItem?.name ?? item.id;
    rewardLines.push(`+${quantity} ${itemName}`);

    return [{
      id: item.id,
      quantity,
      itemName,
      importedItem,
    }];
  });

  if (wad > 0) {
    rewardLines.push(`+${wad} WAD`);
  }

  (Object.entries(resources) as Array<[keyof typeof resources, number]>).forEach(([resourceKey, amount]) => {
    if (amount > 0) {
      rewardLines.push(`+${amount} ${formatFieldEnemyResourceName(resourceKey)}`);
    }
  });

  if (rewardLines.length === 0) {
    return rewardLines;
  }

  updateGameState((prev) => {
    const nextConsumables = { ...(prev.consumables ?? {}) };
    const nextBaseStorage = [...(prev.inventory?.baseStorage ?? [])];

    awardedItems.forEach(({ id, quantity, itemName, importedItem }) => {
      nextConsumables[id] = (nextConsumables[id] ?? 0) + quantity;
      const existingIndex = nextBaseStorage.findIndex((entry) => entry.id === id);
      const fallbackItem = {
        id,
        name: itemName,
        kind: "consumable" as const,
        stackable: true,
        quantity: nextConsumables[id],
        massKg: 0,
        bulkBu: 0,
        powerW: 0,
      };
      const itemTemplate = importedItem ?? fallbackItem;

      if (existingIndex >= 0) {
        const existingItem = nextBaseStorage[existingIndex];
        const nextQuantity = itemTemplate.stackable
          ? nextConsumables[id]
          : Math.max(1, existingItem.quantity + quantity);
        nextBaseStorage[existingIndex] = {
          ...existingItem,
          ...itemTemplate,
          quantity: nextQuantity,
        };
        return;
      }

      nextBaseStorage.push({
        ...itemTemplate,
        quantity: itemTemplate.stackable ? nextConsumables[id] : quantity,
      });
    });

    const rewardedState = grantSessionResources(prev, {
      wad,
      resources: createEmptyResourceWallet(resources),
    });

    return {
      ...rewardedState,
      consumables: nextConsumables,
      inventory: {
        ...rewardedState.inventory,
        baseStorage: nextBaseStorage,
      },
    };
  });

  return rewardLines;
}

function handleFieldEnemyDefeat(enemy: FieldEnemy): void {
  if (enemy.deathAnimTime !== undefined) {
    return;
  }

  enemy.hp = 0;
  enemy.deathAnimTime = performance.now();

  updateQuestProgress("kill_enemies", 1, 1);

  const rewardLines = awardFieldEnemyDrops(enemy);
  if (rewardLines.length > 0) {
    showSystemPing({
      type: "success",
      title: "FIELD ENEMY DEFEATED",
      message: enemy.name,
      detail: rewardLines.join(" | "),
      durationMs: 4200,
      channel: "field-enemy-drops",
      replaceChannel: true,
    });
  }

  if (currentMap && isOuterDeckOpenWorldMap(currentMap)) {
    const sourceObject = getFieldObjectForEnemy(enemy);
    const bossKey = String(sourceObject?.metadata?.bossKey ?? "");
    if (bossKey) {
      const bossResult = claimOuterDeckWorldBossDefeat(
        getGameState(),
        bossKey,
        normalizeOuterDeckZoneId(sourceObject?.metadata?.bossZoneId),
      );
      updateGameState(() => bossResult.state);
      showSystemPing({
        type: "success",
        title: "WORLD BOSS DEFEATED",
        message: enemy.name,
        detail: bossResult.awardedRecipeId
          ? `Recovered ${bossResult.awardedRecipeId.replace(/^recipe_/, "").replace(/_/g, " ").toUpperCase()}.`
          : "Boss salvage transferred to HAVEN.",
        durationMs: 5200,
        channel: "outer-deck-world-boss",
        replaceChannel: true,
      });
    } else {
      const persistentKey = getPersistentFieldEnemyKey(enemy);
      updateGameState((state) => markOuterDeckOpenWorldEnemyDefeated(state, persistentKey));
    }
  }

  if (currentMap && isOuterDeckBranchMap(String(currentMap.id))) {
    const subarea = getOuterDeckSubareaByMapId(getGameState(), String(currentMap.id));
    const roomCleared = Boolean(subarea) && Boolean(fieldState?.fieldEnemies?.every((fieldEnemy) => fieldEnemy.hp <= 0));
    if (subarea && roomCleared && !isOuterDeckSubareaCleared(getGameState(), subarea.id)) {
      updateGameState((state) => markOuterDeckSubareaCleared(state, subarea.id));
      showSystemPing({
        type: "success",
        title: "SUBAREA SECURED",
        message: subarea.title,
        detail: "Route gate and recovery interactions are now available.",
        channel: "outer-deck-subarea-clear",
        replaceChannel: true,
      });
    }
  }
}

function performFieldMeleeAttack(player: { x: number; y: number; facing: "north" | "south" | "east" | "west" }): void {
  if (!fieldState?.fieldEnemies || !fieldState.combat) {
    return;
  }
  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  const meleeDamage = FIELD_ATTACK_DAMAGE + bowbladeFieldProfile.meleeDamageBonus;
  const meleeEnergyGain = BOWBLADE_BASE_MELEE_CHARGE_GAIN + bowbladeFieldProfile.meleeEnergyGainBonus;
  const knockbackForce = FIELD_ENEMY_KNOCKBACK_FORCE + bowbladeFieldProfile.meleeKnockbackBonus;

  const attackOffset = {
    north: { x: 0, y: -FIELD_ATTACK_RANGE / 2 },
    south: { x: 0, y: FIELD_ATTACK_RANGE / 2 },
    east: { x: FIELD_ATTACK_RANGE / 2, y: 0 },
    west: { x: -FIELD_ATTACK_RANGE / 2, y: 0 },
  };
  const offset = attackOffset[player.facing];
  const attackX = player.x + offset.x;
  const attackY = player.y + offset.y;

  for (const enemy of fieldState.fieldEnemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const distance = Math.hypot(enemy.x - attackX, enemy.y - attackY);
    if (distance >= FIELD_ATTACK_RANGE) {
      continue;
    }

    const defenseResult = resolveHaven3DGearbladeDamage(enemy, "blade");
    if (defenseResult.blocked) {
      showHaven3DDefensePing(enemy, defenseResult.defense, defenseResult.requiredBreaker);
      continue;
    }

    enemy.hp -= meleeDamage * defenseResult.damageMultiplier;
    fieldState.combat.energyCells = Math.min(fieldState.combat.maxEnergyCells, fieldState.combat.energyCells + meleeEnergyGain);

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distToPlayer = Math.hypot(dx, dy);
    if (distToPlayer > 0) {
      enemy.vx = (dx / distToPlayer) * knockbackForce;
      enemy.vy = (dy / distToPlayer) * knockbackForce;
      enemy.knockbackTime = FIELD_ENEMY_KNOCKBACK_DURATION;
    }

    if (enemy.hp <= 0) {
      handleFieldEnemyDefeat(enemy);
    }
  }
}

function performFieldGrappleAttack(player: { x: number; y: number; facing: "north" | "south" | "east" | "west" }): void {
  if (!fieldState?.fieldEnemies) {
    return;
  }

  const target = getNearestFieldEnemyInRange(player, FIELD_GRAPPLE_RANGE, -0.18);
  if (!target) {
    showSystemPing({
      type: "info",
      title: "NO GRAPPLE TARGET",
      message: "Face a hostile within tether range.",
      channel: "field-combat-grapple",
      replaceChannel: true,
    });
    playPlaceholderSfx("ui-move");
    return;
  }

  const defenseResult = resolveHaven3DGearbladeDamage(target, "grapple");
  if (defenseResult.blocked) {
    showHaven3DDefensePing(target, defenseResult.defense, defenseResult.requiredBreaker);
    playPlaceholderSfx("ui-move");
    return;
  }
  if (defenseResult.breaksDefense) {
    target.gearbladeDefenseBroken = true;
    showHaven3DDefenseBreakPing(target, defenseResult.defense);
  }

  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  const damage = (FIELD_GRAPPLE_DAMAGE + Math.max(0, Math.floor(bowbladeFieldProfile.meleeDamageBonus * 0.35))) * defenseResult.damageMultiplier;
  target.hp -= damage;

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  target.vx = -(dx / distance) * FIELD_GRAPPLE_PULL_FORCE;
  target.vy = -(dy / distance) * FIELD_GRAPPLE_PULL_FORCE;
  target.knockbackTime = FIELD_ENEMY_KNOCKBACK_DURATION * 1.45;
  target.facing = getFieldFacingFromDelta(player.x - target.x, player.y - target.y, target.facing);

  if (target.hp <= 0) {
    handleFieldEnemyDefeat(target);
  }
  playPlaceholderSfx("ui-confirm");
}

function getFieldFacingUnitVector(facing: "north" | "south" | "east" | "west"): { x: number; y: number } {
  switch (facing) {
    case "north":
      return { x: 0, y: -1 };
    case "south":
      return { x: 0, y: 1 };
    case "east":
      return { x: 1, y: 0 };
    case "west":
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 1 };
  }
}

function getFieldFacingFromDelta(
  dx: number,
  dy: number,
  fallback: "north" | "south" | "east" | "west",
): "north" | "south" | "east" | "west" {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return fallback;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "east" : "west";
  }
  return dy >= 0 ? "south" : "north";
}

function getNearestFieldEnemyInRange(
  origin: Pick<PlayerAvatar, "x" | "y" | "facing">,
  range: number,
  minForwardDot = -1,
): FieldEnemy | null {
  if (!fieldState?.fieldEnemies) {
    return null;
  }

  const direction = getFieldFacingUnitVector(origin.facing);
  let nearestEnemy: FieldEnemy | null = null;
  let nearestDistance = range;
  for (const enemy of fieldState.fieldEnemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const dx = enemy.x - origin.x;
    const dy = enemy.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001 || distance > nearestDistance) {
      continue;
    }

    const dot = ((dx / distance) * direction.x) + ((dy / distance) * direction.y);
    if (dot < minForwardDot) {
      continue;
    }

    nearestEnemy = enemy;
    nearestDistance = distance;
  }
  return nearestEnemy;
}

type FieldEnemyPingTone = "info" | "warning" | "success" | "danger";

function showFieldEnemyPing(
  enemy: FieldEnemy,
  title: string,
  detail: string | null,
  tone: FieldEnemyPingTone,
): void {
  if (isHaven3DFieldRuntimeActive() && haven3DFieldController?.showEnemyPing(enemy.id, title, detail, tone)) {
    return;
  }

  const text = detail ? `${title} // ${detail}` : title;
  triggerFeedback({
    type: tone === "success" ? "ui_confirm" : tone === "danger" ? "hit" : "warning",
    source: "field",
    intensity: tone === "danger" ? 2 : 1,
    position: {
      x: enemy.x,
      y: enemy.y - Math.max(FIELD_ENEMY_PING_2D_CLEARANCE, enemy.height * 1.32),
      space: "field-world",
    },
    text,
    channel: `field-enemy-ping-${enemy.id}`,
    audioHook: null,
    haptic: null,
    meta: {
      tone,
      enemyId: enemy.id,
    },
  });
}

function showHaven3DDefensePing(enemy: FieldEnemy, defense: Haven3DEnemyDefense, requiredMode: string | null): void {
  if (defense === "none" || !requiredMode) {
    return;
  }

  showFieldEnemyPing(
    enemy,
    defense === "shield" ? "SHIELD HELD" : "ARMOR HELD",
    `USE ${requiredMode.toUpperCase()}`,
    "warning",
  );
}

function showHaven3DDefenseBreakPing(enemy: FieldEnemy, defense: Haven3DEnemyDefense): void {
  if (defense === "none") {
    return;
  }

  showFieldEnemyPing(
    enemy,
    defense === "shield" ? "SHIELD RIPPED" : "ARMOR CRACKED",
    "VULNERABLE",
    "success",
  );
}

function getDistanceToSegmentPx(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);
  if (segmentLengthSquared <= 0.001) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const rawT = (((pointX - startX) * segmentX) + ((pointY - startY) * segmentY)) / segmentLengthSquared;
  const t = Math.max(0, Math.min(1, rawT));
  const closestX = startX + segmentX * t;
  const closestY = startY + segmentY * t;
  return Math.hypot(pointX - closestX, pointY - closestY);
}

function handleHaven3DBladeStrike(strike: {
  playerId: PlayerId;
  x: number;
  y: number;
  facing: "north" | "south" | "east" | "west";
  directionX: number;
  directionY: number;
  hiltX: number;
  hiltY: number;
  tipX: number;
  tipY: number;
  bladeHalfWidth: number;
  target: { kind: "npc" | "enemy"; id: string; key: string } | null;
  radius: number;
  arcRadians: number;
  damage: number;
  knockback: number;
}): boolean {
  if (!fieldState?.fieldEnemies || !fieldState.combat) {
    return false;
  }

  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  const forwardLength = Math.max(0.001, Math.hypot(strike.directionX, strike.directionY));
  const forward = {
    x: strike.directionX / forwardLength,
    y: strike.directionY / forwardLength,
  };
  const baseDamage = strike.damage + bowbladeFieldProfile.meleeDamageBonus;
  const knockback = strike.knockback + bowbladeFieldProfile.meleeKnockbackBonus;
  const energyGain = BOWBLADE_BASE_MELEE_CHARGE_GAIN + bowbladeFieldProfile.meleeEnergyGainBonus;
  let didHit = false;

  for (const enemy of fieldState.fieldEnemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const dx = enemy.x - strike.x;
    const dy = enemy.y - strike.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const isLockedTarget = strike.target?.kind === "enemy" && strike.target.id === enemy.id;
    const forwardDistance = (dx * forward.x) + (dy * forward.y);
    const bladeDistance = getDistanceToSegmentPx(
      enemy.x,
      enemy.y,
      strike.hiltX,
      strike.hiltY,
      strike.tipX,
      strike.tipY,
    );
    const enemyRadius = Math.max(enemy.width, enemy.height) * 0.48;
    const lockAssistWidth = isLockedTarget ? 8 : 0;
    const lockAssistReach = isLockedTarget ? 14 : 0;
    if (bladeDistance > strike.bladeHalfWidth + enemyRadius + lockAssistWidth) {
      continue;
    }
    if (
      forwardDistance < 4
      || forwardDistance > strike.radius + enemyRadius + lockAssistReach
      || distance > strike.radius + enemyRadius + lockAssistReach
    ) {
      continue;
    }

    const defenseResult = resolveHaven3DGearbladeDamage(enemy, "blade");
    if (defenseResult.blocked) {
      didHit = true;
      showHaven3DDefensePing(enemy, defenseResult.defense, defenseResult.requiredBreaker);
      continue;
    }

    const damage = baseDamage * defenseResult.damageMultiplier;
    didHit = true;
    enemy.hp -= damage;
    fieldState.combat.energyCells = Math.min(fieldState.combat.maxEnergyCells, fieldState.combat.energyCells + energyGain);
    enemy.vx = (dx / distance) * knockback;
    enemy.vy = (dy / distance) * knockback;
    enemy.knockbackTime = FIELD_ENEMY_KNOCKBACK_DURATION;

    if (enemy.hp <= 0) {
      handleFieldEnemyDefeat(enemy);
    }
  }

  playPlaceholderSfx(didHit ? "ui-confirm" : "ui-move");
  return didHit;
}

function handleHaven3DLauncherImpact(impact: {
  playerId: PlayerId;
  x: number;
  y: number;
  target: { kind: "npc" | "enemy"; id: string; key: string } | null;
  radius: number;
  damage: number;
  knockback: number;
}): boolean {
  if (!fieldState?.fieldEnemies || !fieldState.combat) {
    return false;
  }

  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  const baseDamage = impact.damage + bowbladeFieldProfile.rangedDamageBonus;
  const knockback = impact.knockback;
  let didHit = false;

  for (const enemy of fieldState.fieldEnemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const dx = enemy.x - impact.x;
    const dy = enemy.y - impact.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const isLockedTarget = impact.target?.kind === "enemy" && impact.target.id === enemy.id;
    if (!isLockedTarget && distance > impact.radius + Math.max(enemy.width, enemy.height) * 0.5) {
      continue;
    }
    if (isLockedTarget && distance > impact.radius * 2.8) {
      continue;
    }

    const defenseResult = resolveHaven3DGearbladeDamage(enemy, "launcher");
    if (defenseResult.blocked) {
      didHit = true;
      showHaven3DDefensePing(enemy, defenseResult.defense, defenseResult.requiredBreaker);
      break;
    }
    if (defenseResult.breaksDefense) {
      enemy.gearbladeDefenseBroken = true;
      showHaven3DDefenseBreakPing(enemy, defenseResult.defense);
    }

    const damage = baseDamage * defenseResult.damageMultiplier;
    didHit = true;
    enemy.hp -= damage;
    enemy.vx = (dx / distance) * knockback;
    enemy.vy = (dy / distance) * knockback;
    enemy.knockbackTime = FIELD_ENEMY_KNOCKBACK_DURATION;

    if (enemy.hp <= 0) {
      handleFieldEnemyDefeat(enemy);
    }
    break;
  }

  playPlaceholderSfx(didHit ? "ui-confirm" : "ui-move");
  return didHit;
}

function handleHaven3DGrappleImpact(impact: {
  playerId: PlayerId;
  x: number;
  y: number;
  target: { kind: "npc" | "enemy"; id: string; key: string };
  damage: number;
  knockback: number;
}): boolean {
  if (!fieldState?.fieldEnemies || impact.target.kind !== "enemy") {
    return false;
  }

  const enemy = fieldState.fieldEnemies.find((entry) => entry.id === impact.target.id && entry.hp > 0);
  if (!enemy) {
    return false;
  }

  const defenseResult = resolveHaven3DGearbladeDamage(enemy, "grapple");
  if (defenseResult.blocked) {
    showHaven3DDefensePing(enemy, defenseResult.defense, defenseResult.requiredBreaker);
    playPlaceholderSfx("ui-move");
    return true;
  }
  if (defenseResult.breaksDefense) {
    enemy.gearbladeDefenseBroken = true;
    showHaven3DDefenseBreakPing(enemy, defenseResult.defense);
  }

  const dx = enemy.x - impact.x;
  const dy = enemy.y - impact.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  enemy.hp -= impact.damage * defenseResult.damageMultiplier;
  enemy.vx = (dx / distance) * impact.knockback;
  enemy.vy = (dy / distance) * impact.knockback;
  enemy.knockbackTime = FIELD_ENEMY_KNOCKBACK_DURATION * 1.35;

  if (enemy.hp <= 0) {
    handleFieldEnemyDefeat(enemy);
  }

  playPlaceholderSfx("ui-confirm");
  return true;
}

function performFieldRangedAttack(player: { x: number; y: number; facing: "north" | "south" | "east" | "west" }): void {
  if (!fieldState?.projectiles || !fieldState.combat || !fieldState.fieldEnemies) {
    return;
  }
  const bowbladeFieldProfile = getBowbladeFieldProfile(getGameState());
  const rangedRange = FIELD_RANGED_ATTACK_RANGE + bowbladeFieldProfile.rangedRangeBonus;
  const projectileSpeed = FIELD_PROJECTILE_SPEED + bowbladeFieldProfile.rangedProjectileSpeedBonus;
  const rangedDamage = FIELD_RANGED_ATTACK_DAMAGE + bowbladeFieldProfile.rangedDamageBonus;

  fieldState.combat.energyCells -= 1;

  let nearestEnemy = null as (typeof fieldState.fieldEnemies)[number] | null;
  let nearestDistance = rangedRange;

  for (const enemy of fieldState.fieldEnemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemy = enemy;
    }
  }

  const directionByFacing = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
  };

  let velocity = directionByFacing[player.facing];
  if (nearestEnemy) {
    const dx = nearestEnemy.x - player.x;
    const dy = nearestEnemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      velocity = {
        x: dx / distance,
        y: dy / distance,
      };
    }
  }

  fieldState.projectiles.push({
    id: `field_projectile_${Date.now()}_${Math.random()}`,
    x: player.x,
    y: player.y,
    vx: velocity.x * projectileSpeed,
    vy: velocity.y * projectileSpeed,
    damage: rangedDamage,
    lifetime: 0,
    maxLifetime: FIELD_PROJECTILE_LIFETIME,
    gearbladeMode: "launcher",
  });
}

function updateFieldAutoTurrets(currentTime: number): void {
  if (!fieldState?.projectiles || !fieldState.fieldEnemies || !currentMap) {
    return;
  }

  const fieldEnemies = fieldState.fieldEnemies;
  const projectiles = fieldState.projectiles;
  const liveEnemies = fieldEnemies.filter((enemy) => enemy.hp > 0);
  if (liveEnemies.length === 0) {
    return;
  }

  currentMap.objects.forEach((object) => {
    if (object.type !== "decoration") {
      return;
    }

    const decorId = typeof object.metadata?.decorId === "string" ? object.metadata.decorId : "";
    const turretProfile = decorId ? getFieldDecorTurretProfile(decorId) : null;
    if (!turretProfile) {
      return;
    }

    const lastFiredAt = fieldTurretLastFireAtMs.get(object.id) ?? Number.NEGATIVE_INFINITY;
    if (currentTime - lastFiredAt < turretProfile.cooldownMs) {
      return;
    }

    const turretX = (object.x + (object.width / 2)) * FIELD_TILE_SIZE;
    const turretY = (object.y + (object.height / 2)) * FIELD_TILE_SIZE;
    let nearestEnemy: FieldEnemy | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    liveEnemies.forEach((enemy) => {
      const distance = Math.hypot(enemy.x - turretX, enemy.y - turretY);
      if (distance > turretProfile.rangePx || distance >= nearestDistance) {
        return;
      }
      nearestEnemy = enemy;
      nearestDistance = distance;
    });

    if (!nearestEnemy || nearestDistance <= 0) {
      return;
    }

    const targetEnemy = nearestEnemy as FieldEnemy;
    fieldTurretLastFireAtMs.set(object.id, currentTime);
    projectiles.push({
      id: `field_turret_projectile_${object.id}_${currentTime}`,
      x: turretX,
      y: turretY,
      vx: ((targetEnemy.x - turretX) / nearestDistance) * turretProfile.projectileSpeed,
      vy: ((targetEnemy.y - turretY) / nearestDistance) * turretProfile.projectileSpeed,
      damage: turretProfile.damage,
      lifetime: 0,
      maxLifetime: FIELD_TURRET_PROJECTILE_LIFETIME,
    });
  });
}

function updateFieldCombat(deltaTime: number, currentTime: number): void {
  if (fieldFailureTransitionPending) {
    return;
  }

  if (!fieldState?.combat || !fieldState.fieldEnemies || !fieldState.projectiles || !currentMap) {
    return;
  }

  if (fieldState.combat.attackCooldown > 0) {
    fieldState.combat.attackCooldown = Math.max(0, fieldState.combat.attackCooldown - deltaTime);
  }

  if (fieldState.combat.isAttacking) {
    fieldState.combat.attackAnimTime -= deltaTime;
    if (fieldState.combat.attackAnimTime <= 0) {
      fieldState.combat.attackAnimTime = 0;
      fieldState.combat.isAttacking = false;
    }
  }

  updateFieldAutoTurrets(currentTime);
  updateFieldProjectiles(deltaTime);
  updateFieldEnemies(deltaTime, currentTime);
  updateFieldPlayerPressure(deltaTime);
  updateFieldCompanionBehavior(deltaTime, currentTime);
}

function updateFieldProjectiles(deltaTime: number): void {
  if (!fieldState?.projectiles || !fieldState.fieldEnemies || !currentMap) {
    return;
  }

  const roomWidth = currentMap.width * FIELD_TILE_SIZE;
  const roomHeight = currentMap.height * FIELD_TILE_SIZE;

  for (let index = fieldState.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = fieldState.projectiles[index];
    projectile.lifetime += deltaTime;
    if (projectile.lifetime >= projectile.maxLifetime) {
      fieldState.projectiles.splice(index, 1);
      continue;
    }

    projectile.x += projectile.vx * (deltaTime / 1000);
    projectile.y += projectile.vy * (deltaTime / 1000);

    if (projectile.x < 0 || projectile.x > roomWidth || projectile.y < 0 || projectile.y > roomHeight) {
      fieldState.projectiles.splice(index, 1);
      continue;
    }

    for (const enemy of fieldState.fieldEnemies) {
      if (enemy.hp <= 0) {
        continue;
      }

      const distance = Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y);
      if (distance >= Math.max(enemy.width, enemy.height) / 2) {
        continue;
      }

      let damageMultiplier = 1;
      if (projectile.gearbladeMode === "launcher") {
        const defenseResult = resolveHaven3DGearbladeDamage(enemy, "launcher");
        if (defenseResult.blocked) {
          showHaven3DDefensePing(enemy, defenseResult.defense, defenseResult.requiredBreaker);
          fieldState.projectiles.splice(index, 1);
          break;
        }
        if (defenseResult.breaksDefense) {
          enemy.gearbladeDefenseBroken = true;
          showHaven3DDefenseBreakPing(enemy, defenseResult.defense);
        }
        damageMultiplier = defenseResult.damageMultiplier;
      }

      enemy.hp -= projectile.damage * damageMultiplier;
      if (distance > 0) {
        enemy.vx = ((enemy.x - projectile.x) / distance) * (FIELD_ENEMY_KNOCKBACK_FORCE * 0.5);
        enemy.vy = ((enemy.y - projectile.y) / distance) * (FIELD_ENEMY_KNOCKBACK_FORCE * 0.5);
        enemy.knockbackTime = FIELD_ENEMY_KNOCKBACK_DURATION;
      }

      if (enemy.hp <= 0) {
        handleFieldEnemyDefeat(enemy);
      }

      fieldState.projectiles.splice(index, 1);
      break;
    }
  }
}

function handleFieldPlayerDefeat(sourceEnemy: FieldEnemy | null): void {
  if (!fieldState || fieldFailureTransitionPending) {
    return;
  }

  fieldFailureTransitionPending = true;
  fieldState.isPaused = true;
  fieldState.player.hp = 0;
  fieldState.player.vx = 0;
  fieldState.player.vy = 0;

  const failureMapId = currentMap?.id ?? fieldState.currentMap;
  const isOuterDeckFailure = getOuterDeckFieldContext(String(failureMapId)) !== "haven";
  const snapshot = isOuterDeckFailure ? outerDeckRunSnapshot : null;
  const lossDetail = isOuterDeckFailure
    ? formatOuterDeckRunLossSummary(snapshot, getGameState())
    : "Recovered to HAVEN medical after field collapse.";
  const sourceName = sourceEnemy?.name ? `Collapsed under ${sourceEnemy.name} pressure.` : "Field state collapsed.";

  playPlaceholderSfx("battle-defeat");
  suppressOuterDeckRuntimePersist = true;

  try {
    updateGameState((state) => {
      const restored = snapshot ? restoreOuterDeckRunSnapshot(state, snapshot) : state;
      return isOuterDeckFailure ? abortOuterDeckExpedition(restored) : restored;
    });
    outerDeckRunSnapshot = null;
    setNextFieldSpawnOverrideTile("base_camp", OUTER_DECK_HAVEN_EXIT_SPAWN_TILE);
    renderFieldScreen("base_camp");
  } finally {
    suppressOuterDeckRuntimePersist = false;
    window.setTimeout(() => {
      fieldFailureTransitionPending = false;
    }, 0);
  }

  showSystemPing({
    type: "error",
    title: isOuterDeckFailure ? "OUTER DECK RUN FAILED" : "FIELD STATE BROKEN",
    message: sourceName,
    detail: lossDetail,
    durationMs: 6200,
    channel: "field-player-defeat",
    replaceChannel: true,
  });
}

function applyFieldPlayerDamage(
  enemy: FieldEnemy,
  amount: number,
  knockbackForce: number,
  direction: { x: number; y: number },
  title: string,
): void {
  if (!fieldState || fieldFailureTransitionPending || (fieldState.player.invulnerabilityTime ?? 0) > 0) {
    return;
  }

  const player = fieldState.player;
  const maxHp = Math.max(1, Number(player.maxHp ?? FIELD_PLAYER_MAX_HP));
  const nextHp = Math.max(0, Number(player.hp ?? maxHp) - Math.max(0, amount));
  player.hp = nextHp;
  player.invulnerabilityTime = FIELD_PLAYER_INVULNERABILITY_DURATION;

  const knockbackDistance = Math.max(0.001, Math.hypot(direction.x, direction.y));
  player.vx = (direction.x / knockbackDistance) * knockbackForce;
  player.vy = (direction.y / knockbackDistance) * knockbackForce;

  showFieldEnemyPing(
    enemy,
    title,
    `STATE ${player.hp}/${player.maxHp}`,
    "danger",
  );
  syncMountedFieldStateMeters();

  if (nextHp <= 0) {
    handleFieldPlayerDefeat(enemy);
  }
}

function clearHaven3DEnemyAttack(enemy: FieldEnemy): void {
  delete enemy.attackState;
  delete enemy.attackStartedAt;
  delete enemy.attackDidStrike;
  delete enemy.attackLungeProgress;
  delete enemy.attackOriginX;
  delete enemy.attackOriginY;
  delete enemy.attackTargetX;
  delete enemy.attackTargetY;
  delete enemy.attackDirectionX;
  delete enemy.attackDirectionY;
}

function startHaven3DEnemyAttack(enemy: FieldEnemy, player: Pick<PlayerAvatar, "x" | "y" | "facing">, currentTime: number): void {
  const profile = getHaven3DEnemyAttackProfile(enemy);
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  enemy.attackStyle = profile.style;
  enemy.attackState = "windup";
  enemy.attackStartedAt = currentTime;
  enemy.attackDidStrike = false;
  enemy.attackLungeProgress = 0;
  enemy.attackOriginX = enemy.x;
  enemy.attackOriginY = enemy.y;
  enemy.attackTargetX = player.x;
  enemy.attackTargetY = player.y;
  enemy.attackDirectionX = dx / distance;
  enemy.attackDirectionY = dy / distance;
  enemy.facing = getFieldFacingFromDelta(dx, dy, enemy.facing);
}

function applyHaven3DEnemyStrike(enemy: FieldEnemy, currentTime: number): void {
  if (!fieldState) {
    return;
  }

  enemy.lastAttackAt = currentTime;
  const player = fieldState.player;
  const profile = getHaven3DEnemyAttackProfile(enemy);
  if ((player.invulnerabilityTime ?? 0) > 0) {
    return;
  }

  const originX = enemy.attackOriginX ?? enemy.x;
  const originY = enemy.attackOriginY ?? enemy.y;
  const directionX = enemy.attackDirectionX ?? getFieldFacingUnitVector(enemy.facing).x;
  const directionY = enemy.attackDirectionY ?? getFieldFacingUnitVector(enemy.facing).y;
  const dx = player.x - originX;
  const dy = player.y - originY;
  const forwardDistance = (dx * directionX) + (dy * directionY);
  const lateralDistance = Math.abs((dx * directionY) - (dy * directionX));
  const wasHit = forwardDistance >= 0
    && forwardDistance <= profile.reach + (player.height / 2)
    && lateralDistance <= profile.halfWidth + (player.width / 2);

  if (!wasHit) {
    return;
  }

  applyFieldPlayerDamage(
    enemy,
    profile.damage,
    profile.knockbackForce,
    { x: dx, y: dy },
    getHaven3DEnemyAttackLabel(profile.style),
  );
}

function updateHaven3DEnemyAttackLunge(enemy: FieldEnemy, profile: ReturnType<typeof getHaven3DEnemyAttackProfile>, elapsed: number): void {
  if (!profile.lungeDistancePx || !profile.lungeStartMs || !profile.lungeEndMs || profile.lungeEndMs <= profile.lungeStartMs) {
    return;
  }

  const rawProgress = (elapsed - profile.lungeStartMs) / (profile.lungeEndMs - profile.lungeStartMs);
  const clampedProgress = Math.max(0, Math.min(1, rawProgress));
  const easedProgress = clampedProgress * clampedProgress * (3 - (2 * clampedProgress));
  const previousProgress = Math.max(0, Math.min(1, Number(enemy.attackLungeProgress ?? 0)));
  const progressDelta = Math.max(0, easedProgress - previousProgress);
  if (progressDelta <= 0) {
    enemy.attackLungeProgress = Math.max(previousProgress, easedProgress);
    return;
  }

  const directionX = enemy.attackDirectionX ?? getFieldFacingUnitVector(enemy.facing).x;
  const directionY = enemy.attackDirectionY ?? getFieldFacingUnitVector(enemy.facing).y;
  const moveDistance = profile.lungeDistancePx * progressDelta;
  const nextX = enemy.x + directionX * moveDistance;
  const nextY = enemy.y + directionY * moveDistance;
  if (canMoveEntityTo(nextX, enemy.y, enemy.width, enemy.height)) {
    enemy.x = nextX;
  }
  if (canMoveEntityTo(enemy.x, nextY, enemy.width, enemy.height)) {
    enemy.y = nextY;
  }
  enemy.attackLungeProgress = easedProgress;
}

function updateHaven3DEnemyAttack(enemy: FieldEnemy, player: Pick<PlayerAvatar, "x" | "y" | "facing">, currentTime: number): boolean {
  const profile = getHaven3DEnemyAttackProfile(enemy);
  if (enemy.attackState === "windup") {
    const elapsed = currentTime - Number(enemy.attackStartedAt ?? currentTime);
    updateHaven3DEnemyAttackLunge(enemy, profile, elapsed);
    if (!enemy.attackDidStrike && elapsed >= profile.windupMs) {
      enemy.attackDidStrike = true;
      applyHaven3DEnemyStrike(enemy, currentTime);
      enemy.attackState = "recovery";
      enemy.attackStartedAt = currentTime;
    }
    return true;
  }

  if (enemy.attackState === "recovery") {
    const elapsed = currentTime - Number(enemy.attackStartedAt ?? currentTime);
    if (elapsed >= profile.recoveryMs) {
      clearHaven3DEnemyAttack(enemy);
    }
    return true;
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  const timeSinceLastAttack = currentTime - Number(enemy.lastAttackAt ?? Number.NEGATIVE_INFINITY);
  if (
    distance <= profile.triggerRange
    && timeSinceLastAttack >= profile.cooldownMs
  ) {
    startHaven3DEnemyAttack(enemy, player, currentTime);
    return true;
  }

  return false;
}

function updateFieldEnemies(deltaTime: number, currentTime: number): void {
  if (!fieldState?.fieldEnemies || !currentMap) {
    return;
  }

  fieldState.fieldEnemies = fieldState.fieldEnemies.filter((enemy) => {
    if (enemy.hp > 0) {
      return true;
    }
    if (enemy.deathAnimTime === undefined) {
      return false;
    }
    return currentTime - enemy.deathAnimTime < 500;
  });

  const player = getRuntimeFieldAvatar("P1");
  if (!player) {
    return;
  }

  const useTelegraphedAttacks = true;
  for (const enemy of fieldState.fieldEnemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    if (enemy.knockbackTime > 0) {
      enemy.knockbackTime -= deltaTime;

      const knockbackX = enemy.vx * (deltaTime / 1000);
      const knockbackY = enemy.vy * (deltaTime / 1000);

      const newX = enemy.x + knockbackX;
      const newY = enemy.y + knockbackY;
      if (canMoveEntityTo(newX, enemy.y, enemy.width, enemy.height)) {
        enemy.x = newX;
      } else {
        enemy.vx = 0;
      }

      if (canMoveEntityTo(enemy.x, newY, enemy.width, enemy.height)) {
        enemy.y = newY;
      } else {
        enemy.vy = 0;
      }

      enemy.vx *= Math.pow(FIELD_KNOCKBACK_DAMPING, deltaTime / 16);
      enemy.vy *= Math.pow(FIELD_KNOCKBACK_DAMPING, deltaTime / 16);
      if (Math.abs(enemy.vx) < 1) enemy.vx = 0;
      if (Math.abs(enemy.vy) < 1) enemy.vy = 0;
    }

    if (enemy.knockbackTime > 0) {
      if (useTelegraphedAttacks) {
        clearHaven3DEnemyAttack(enemy);
      }
      continue;
    }

    if (useTelegraphedAttacks && updateHaven3DEnemyAttack(enemy, player, currentTime)) {
      continue;
    }

    if (currentTime - enemy.lastMoveTime < 280) {
      continue;
    }

    enemy.lastMoveTime = currentTime;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 0 || distance > enemy.aggroRange) {
      continue;
    }

    const moveX = (dx / distance) * enemy.speed * (deltaTime / 1000) * 5;
    const moveY = (dy / distance) * enemy.speed * (deltaTime / 1000) * 5;
    const nextX = enemy.x + moveX;
    const nextY = enemy.y + moveY;

    if (canMoveEntityTo(nextX, enemy.y, enemy.width, enemy.height)) {
      enemy.x = nextX;
    }
    if (canMoveEntityTo(enemy.x, nextY, enemy.width, enemy.height)) {
      enemy.y = nextY;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      enemy.facing = dx > 0 ? "east" : "west";
    } else {
      enemy.facing = dy > 0 ? "south" : "north";
    }
  }
}

function updateFieldPlayerPressure(deltaTime: number): void {
  if (!fieldState || !currentMap) {
    return;
  }

  fieldState.player = normalizeFieldPlayerState(fieldState.player);

  if ((fieldState.player.invulnerabilityTime ?? 0) > 0) {
    fieldState.player.invulnerabilityTime = Math.max(0, Number(fieldState.player.invulnerabilityTime ?? 0) - deltaTime);
  }

  if ((fieldState.player.vx ?? 0) !== 0 || (fieldState.player.vy ?? 0) !== 0) {
    const knockbackX = Number(fieldState.player.vx ?? 0) * (deltaTime / 1000);
    const knockbackY = Number(fieldState.player.vy ?? 0) * (deltaTime / 1000);
    let nextX = fieldState.player.x;
    let nextY = fieldState.player.y;

    if (canMoveEntityTo(fieldState.player.x + knockbackX, fieldState.player.y, fieldState.player.width, fieldState.player.height)) {
      nextX = fieldState.player.x + knockbackX;
    } else {
      fieldState.player.vx = 0;
    }

    if (canMoveEntityTo(nextX, fieldState.player.y + knockbackY, fieldState.player.width, fieldState.player.height)) {
      nextY = fieldState.player.y + knockbackY;
    } else {
      fieldState.player.vy = 0;
    }

    fieldState.player.x = nextX;
    fieldState.player.y = nextY;
    fieldState.player.vx = Number(fieldState.player.vx ?? 0) * Math.pow(FIELD_KNOCKBACK_DAMPING, deltaTime / 16);
    fieldState.player.vy = Number(fieldState.player.vy ?? 0) * Math.pow(FIELD_KNOCKBACK_DAMPING, deltaTime / 16);

    if (Math.abs(Number(fieldState.player.vx ?? 0)) < 1) fieldState.player.vx = 0;
    if (Math.abs(Number(fieldState.player.vy ?? 0)) < 1) fieldState.player.vy = 0;

    syncP1AvatarPosition(fieldState.player.x, fieldState.player.y);
  }

  for (const resourceObject of getUncollectedFieldResourceObjects()) {
    const resourceCenterX = (resourceObject.x + (resourceObject.width / 2)) * FIELD_TILE_SIZE;
    const resourceCenterY = (resourceObject.y + (resourceObject.height / 2)) * FIELD_TILE_SIZE;
    if (Math.hypot(resourceCenterX - fieldState.player.x, resourceCenterY - fieldState.player.y) <= 36) {
      collectFieldResourceObject(resourceObject.id, "player");
    }
  }

  // Field hostiles now damage through telegraphed attacks instead of passive body contact.
}

function updateFieldCompanionBehavior(deltaTime: number, currentTime: number): void {
  if (!fieldState?.companion || !currentMap) {
    return;
  }

  const player = fieldState.player;
  const companion = fieldState.companion;
  const availableResources = getUncollectedFieldResourceObjects().map((object) => ({
    id: object.id,
    x: (object.x + (object.width / 2)) * FIELD_TILE_SIZE,
    y: (object.y + (object.height / 2)) * FIELD_TILE_SIZE,
    collected: false,
  }));

  if (companion.state === "attack") {
    companion.state = "follow";
    companion.target = undefined;
    companion.attackCooldown = 0;
  }

  if (currentTime - companion.lastBehaviorTime > companion.behaviorCooldownMs) {
    companion.lastBehaviorTime = currentTime;

    const nearestResource = findNearestResource(companion, player, availableResources, currentMap);
    if (nearestResource) {
      companion.state = "fetch";
      companion.target = { x: nearestResource.x, y: nearestResource.y, id: nearestResource.id };
    } else {
      companion.state = "follow";
      companion.target = undefined;
    }
  }

  if (companion.state === "fetch" && companion.target) {
    const targetResource = availableResources.find((resource) => resource.id === companion.target?.id) ?? null;
    if (!targetResource) {
      companion.state = "follow";
      companion.target = undefined;
    } else {
      fieldState.companion = updateCompanionFetch(
        companion,
        player,
        { x: targetResource.x, y: targetResource.y, id: targetResource.id },
        deltaTime,
        currentMap,
      );
      if (checkCompanionReachedTarget(fieldState.companion, targetResource.id, 24)) {
        collectFieldResourceObject(targetResource.id, "sable");
        fieldState.companion.state = "follow";
        fieldState.companion.target = undefined;
      }
      return;
    }
  }

  fieldState.companion = updateCompanionFollow(
    companion,
    player,
    deltaTime,
    currentMap,
  );
}

function canMoveEntityTo(x: number, y: number, width: number, height: number): boolean {
  if (!currentMap) {
    return false;
  }

  const halfW = width / 2;
  const halfH = height / 2;
  const corners = [
    { x: x - halfW, y: y - halfH },
    { x: x + halfW, y: y - halfH },
    { x: x - halfW, y: y + halfH },
    { x: x + halfW, y: y + halfH },
  ];

  for (const corner of corners) {
    const tileX = Math.floor(corner.x / FIELD_TILE_SIZE);
    const tileY = Math.floor(corner.y / FIELD_TILE_SIZE);
    if (tileY < 0 || tileY >= currentMap.height || tileX < 0 || tileX >= currentMap.width) {
      return false;
    }
    if (!currentMap.tiles[tileY][tileX]?.walkable) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// GLOBAL INPUT HANDLING (Attached once, never duplicated)
// ============================================================================

function setupGlobalListeners(): void {
  if (globalListenersAttached) return;

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleFieldInputRelease);
  document.addEventListener("visibilitychange", handleFieldVisibilityChange);
  document.addEventListener("pointerdown", handleFieldViewTogglePointerDown, true);
  document.addEventListener("pointerdown", handleFieldGearbladeModePointerDown, true);
  document.addEventListener("click", handleFieldObjectClick, true);

  // Also add document-level click handler for All Nodes button as fallback
  document.addEventListener("click", handleAllNodesButtonClick, true);

  // Add wheel event listener for zoom
  const viewport = document.querySelector<HTMLElement>(".field-viewport");
  if (viewport) {
    viewport.addEventListener("wheel", handleWheelZoom, { passive: false });
  }

  globalListenersAttached = true;
}

function handleFieldInputRelease(): void {
  resetFieldMovementInputState();
}

function handleFieldVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    resetFieldMovementInputState();
  }
}

function handleWheelZoom(e: WheelEvent): void {
  // Only zoom if we're over the viewport
  const viewport = document.querySelector(".field-viewport");
  if (!viewport || !fieldState) return;

  const target = e.target as HTMLElement;
  if (!viewport.contains(target) && target !== viewport) return;

  e.preventDefault();
  e.stopPropagation();

  // Determine zoom direction
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fieldZoom + delta));

  if (newZoom === fieldZoom) return; // No change

  // Update zoom
  fieldZoom = newZoom;

  // Re-center on player with new zoom level
  centerViewportOnPlayer();
}

function handleAllNodesButtonClick(): void {
  // Button removed - no longer needed
}

function cleanupGlobalListeners(): void {
  if (!globalListenersAttached) return;

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("blur", handleFieldInputRelease);
  document.removeEventListener("visibilitychange", handleFieldVisibilityChange);
  document.removeEventListener("pointerdown", handleFieldViewTogglePointerDown, true);
  document.removeEventListener("pointerdown", handleFieldGearbladeModePointerDown, true);
  document.removeEventListener("click", handleFieldObjectClick, true);
  document.removeEventListener("click", handleAllNodesButtonClick, true);

  globalListenersAttached = false;
}


function handleKeyDown(e: KeyboardEvent): void {
  // Only handle when field screen is active
  if (!document.querySelector(".field-root")) return;

  const key = e.key?.toLowerCase() ?? "";
  const target = e.target as HTMLElement | null;
  const isPinnedOverlayInput = Boolean(target?.closest(".field-pinned-overlay")) && (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable === true
  );
  const isNetworkLobbyOverlayInput = Boolean(target?.closest(".network-lobby-overlay")) && (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable === true
  );

  if (isPinnedOverlayInput || isNetworkLobbyOverlayInput) {
    return;
  }

  // ESC key: toggle All Nodes panel
  if (key === "escape" || e.code === "Escape" || e.keyCode === 27) {
    e.preventDefault();
    e.stopPropagation();
    if (shouldSuppressEscMenuAccess()) {
      return;
    }
    if (isHavenBuildModeEnabled()) {
      setHavenBuildMode(false);
      return;
    }
    toggleAllNodesPanel();
    return;
  }

  if (isHavenBuildModeEnabled()) {
    const isShift = key === "shift";
    const isBuildPanKey =
      key === "w"
      || key === "a"
      || key === "s"
      || key === "d"
      || key === "arrowup"
      || key === "arrowdown"
      || key === "arrowleft"
      || key === "arrowright";

    if (!e.repeat && (key === "r" || e.code === "KeyR") && havenBuildPaletteSelection?.kind === "decor") {
      e.preventDefault();
      e.stopPropagation();
      rotateSelectedBuildDecor();
      return;
    }

    if (canPanDuringBuildMode() && (isShift || isBuildPanKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (isShift) {
        havenBuildPanInput.fast = true;
      }
      switch (key) {
        case "w":
        case "arrowup":
          havenBuildPanInput.up = true;
          break;
        case "s":
        case "arrowdown":
          havenBuildPanInput.down = true;
          break;
        case "a":
        case "arrowleft":
          havenBuildPanInput.left = true;
          break;
        case "d":
        case "arrowright":
          havenBuildPanInput.right = true;
          break;
      }
      return;
    }

    return;
  }

  // Co-op drop-in/drop-out keys (only outside battle)
  const state = getGameState();
  if (state.phase !== "battle" && state.currentBattle === null) {
    // J key: Join as P2
    if (key === "j" || key === "J") {
      e.preventDefault();
      e.stopPropagation();
      tryJoinAsP2();
      return;
    }

    // K key: Drop out P2
    if (key === "k" || key === "K") {
      e.preventDefault();
      e.stopPropagation();
      dropOutP2();
      return;
    }
  }

  // Update player input system
  handlePlayerInputKeyDown(e);

  if (isHaven3DFieldRuntimeActive()) {
    return;
  }

  if (!e.repeat && isFieldCombatActive()) {
    const requestedGearbladeMode =
      e.code === "Digit1" || e.code === "Numpad1" ? "blade"
        : e.code === "Digit2" || e.code === "Numpad2" ? "launcher"
          : e.code === "Digit3" || e.code === "Numpad3" ? "grapple"
            : null;

    if (requestedGearbladeMode) {
      e.preventDefault();
      e.stopPropagation();
      setFieldGearbladeMode(requestedGearbladeMode);
      return;
    }

    if (key === "tab" || e.code === "Tab" || key === "q" || e.code === "KeyQ") {
      e.preventDefault();
      e.stopPropagation();
      cycleFieldGearbladeMode();
      return;
    }

    if (isPlayerInputActionEvent(e, "P1", "attack")) {
      e.preventDefault();
      e.stopPropagation();
      triggerFieldCombatAttack();
      return;
    }
  }

  if (!e.repeat) {
    if (isPlayerInputActionEvent(e, "P1", "interact")) {
      handleInteractKey("P1");
      e.preventDefault();
      return;
    }

    if (isPlayerInputActionEvent(e, "P2", "interact")) {
      handleInteractKey("P2");
      e.preventDefault();
      return;
    }
  }

  // Don't process movement if paused
  if (fieldState?.isPaused) return;

  // Legacy movementInput for backward compatibility (P1 only)
  // Dash modifier
  if (e.shiftKey) {
    movementInput.dash = true;
  }

  switch (key) {
    case "w":
      movementInput.up = true;
      e.preventDefault();
      break;
    case "s":
      movementInput.down = true;
      e.preventDefault();
      break;
    case "a":
      movementInput.left = true;
      e.preventDefault();
      break;
    case "d":
      movementInput.right = true;
      e.preventDefault();
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (!document.querySelector(".field-root")) return;

  // Update player input system
  handlePlayerInputKeyUp(e);

  const key = e.key?.toLowerCase() ?? "";
  const target = e.target as HTMLElement | null;
  const isPinnedOverlayInput = Boolean(target?.closest(".field-pinned-overlay")) && (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable === true
  );
  const isNetworkLobbyOverlayInput = Boolean(target?.closest(".network-lobby-overlay")) && (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable === true
  );

  if (isPinnedOverlayInput || isNetworkLobbyOverlayInput) {
    return;
  }

  if (isHavenBuildModeEnabled()) {
    const isShift = key === "shift";
    const isBuildPanKey =
      key === "w"
      || key === "a"
      || key === "s"
      || key === "d"
      || key === "arrowup"
      || key === "arrowdown"
      || key === "arrowleft"
      || key === "arrowright";

    if (canPanDuringBuildMode() && (isShift || isBuildPanKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (isShift) {
        havenBuildPanInput.fast = false;
      }
      switch (key) {
        case "w":
        case "arrowup":
          havenBuildPanInput.up = false;
          break;
        case "s":
        case "arrowdown":
          havenBuildPanInput.down = false;
          break;
        case "a":
        case "arrowleft":
          havenBuildPanInput.left = false;
          break;
        case "d":
        case "arrowright":
          havenBuildPanInput.right = false;
          break;
      }
      return;
    }

    return;
  }

  // Legacy movementInput for backward compatibility
  if (!e.shiftKey) {
    movementInput.dash = false;
  }

  switch (key) {
    case "w":
      movementInput.up = false;
      break;
    case "s":
      movementInput.down = false;
      break;
    case "a":
      movementInput.left = false;
      break;
    case "d":
      movementInput.right = false;
      break;
  }
}

function handleFieldObjectClick(e: MouseEvent): void {
  if (!document.querySelector(".field-root")) return;

  if (isHavenBuildModeEnabled()) {
    return;
  }

  const target = e.target as HTMLElement;
  const objEl = target.closest(".field-object[data-interaction-zone]") as HTMLElement;
  if (!objEl) return;

  if (isFieldCombatActive()) {
    showFieldCombatLockPing();
    return;
  }

  e.stopPropagation();
  e.preventDefault();

  const zoneId = objEl.getAttribute("data-interaction-zone");
  if (!zoneId || !currentMap || !fieldState) return;

  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) return;
  if (isAutoTriggerZone(zone)) return;

  const actingPlayerId = getNearestPlayerToZone(zone) ?? "P1";
  const actingAvatar = createRuntimeAvatar(actingPlayerId);
  if (!actingAvatar) {
    return;
  }
  triggerZoneInteraction(actingPlayerId, zone, actingAvatar);
}

function handleInteractKey(playerId: PlayerId): void {
  if (isHavenBuildModeEnabled()) {
    return;
  }

  if (!fieldState || !currentMap || fieldState.isPaused) return;

  if (isFieldCombatActive()) {
    showFieldCombatLockPing();
    return;
  }

  const actorAvatar = createRuntimeAvatar(playerId);
  if (!actorAvatar) {
    return;
  }

  // Check for NPC interaction first (Headline 15b)
  if (fieldState.npcs) {
    const nearbyNpc = getNpcInRange(actorAvatar, fieldState.npcs);
    if (nearbyNpc && nearbyNpc.dialogueId) {
      fieldState.isPaused = true;
      void import("../ui/screens/DialogueScreen").then(({ showDialogue, showNpcDialogue }) => {
        const openedImportedDialogue = showNpcDialogue(
          nearbyNpc.dialogueId!,
          nearbyNpc.name,
          nearbyNpc.id,
          () => {
            if (fieldState) {
              fieldState.isPaused = false;
            }
          },
        );

        if (openedImportedDialogue) {
          return;
        }

        const dialogueLines = NPC_DIALOGUE[nearbyNpc.dialogueId!] || [
          "Hello there!",
          "This is placeholder dialogue.",
        ];

        showDialogue(nearbyNpc.name, dialogueLines, () => {
          if (fieldState) {
            fieldState.isPaused = false;
          }
        }, nearbyNpc.id);
      }).catch((error) => {
        console.error("[FIELD] Failed to load dialogue screen:", error);
        if (fieldState) {
          fieldState.isPaused = false;
        }
      });

      return;
    }
  }

  const interactionContext = getPlayerInteractionContext(playerId);
  if (!interactionContext) return;
  const zone = interactionContext.zone;
  if (isAutoTriggerZone(zone)) return;
  triggerZoneInteraction(playerId, zone, actorAvatar);
}

// ============================================================================
// NODE ACTIONS
// ============================================================================

async function handleNodeAction(action: string): Promise<void> {
  if (isFieldEscNodeAction(action) && !isEscActionEnabled(action, getFieldEscAvailabilityContext())) {
    showSystemPing({
      type: "info",
      title: "OUTER DECK EXPEDITION",
      message: getEscExpeditionRestrictionMessage(action),
      channel: "outer-deck-field-esc-lock",
      replaceChannel: true,
    });
    return;
  }

  if (action === PINNED_THEATER_AUTO_TICK_LAYOUT_ID) {
    const enabled = !isPinnedTheaterAutoTickEnabled();
    updateGameState((state) => ({
      ...state,
      uiLayout: {
        ...(state.uiLayout ?? {}),
        baseCampTheaterAutoTickEnabled: enabled,
      },
    }));
    syncFieldTheaterAutoTickState();
    showSystemPing({
      type: enabled ? "success" : "info",
      title: enabled ? "THEATER CLOCK ONLINE" : "THEATER CLOCK OFFLINE",
      message: enabled
        ? "Operational theaters will advance by 1 tick every 10 seconds."
        : "Background theater advancement has been paused.",
      channel: "esc-theater-auto-tick",
      replaceChannel: true,
    });
    updatePinnedNodesOverlay();
    return;
  }

  if (
    isLockedHavenAnnexAction(action)
    || isLockedSchemaAction(action)
    || isLockedBlackMarketAction(action)
    || isLockedFoundryAnnexAction(action)
  ) {
    await showAlertDialog({
      title: "NODE LOCKED",
      message: getLockedActionMessage(action) ?? "This node is not unlocked yet.",
      mount: () => document.querySelector(".field-root"),
    });
    return;
  }

  if (fieldState) {
    fieldState.isPaused = true;
  }

  suspendFieldForScreenTransition();
  closeAllNodesPanel();

  switch (action) {
    case "shop":
      import("../ui/screens/ShopScreen").then(({ renderShopScreen }) => {
        renderShopScreen("field");
      });
      break;

    case "roster":
      import("../ui/screens/RosterScreen").then(({ renderRosterScreen }) => {
        renderRosterScreen("field");
      });
      break;
    case "loadout":
      import("../ui/screens/InventoryScreen").then(({ renderInventoryScreen }) => {
        renderInventoryScreen("field");
      });
      break;
    case "inventory":
      import("../ui/screens/InventoryViewScreen").then(({ renderInventoryViewScreen }) => {
        renderInventoryViewScreen("field");
      });
      break;
    case "quest-board":
      import("../ui/screens/QuestBoardScreen").then(({ renderQuestBoardScreen }) => {
        renderQuestBoardScreen("field");
      });
      break;
    case "tavern":
      import("../ui/screens/TavernDialogueScreen").then(({ renderTavernDialogueScreen }) => {
        renderTavernDialogueScreen("base_camp_tavern", "Tavern", "field");
      });
      break;
    case "ops-terminal":
      import("../ui/screens/OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
        renderOperationSelectScreen("field");
      });
      break;
    case "gear-workbench":
      import("../ui/screens/GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        const state = getGameState();
        const firstUnitId = state.partyUnitIds?.[0] ?? null;
        if (firstUnitId) {
          const unit = state.unitsById[firstUnitId];
          const weaponId = (unit as any)?.loadout?.weapon ?? null;
          renderGearWorkbenchScreen(firstUnitId, weaponId, "field");
        } else {
          renderGearWorkbenchScreen(undefined, undefined, "field");
        }
      });
      break;
    case "materials-refinery":
      openAllNodesMenuFromField(fieldState?.currentMap ?? "base_camp");
      break;
    case "port":
      import("../ui/screens/PortScreen").then(({ renderPortScreen }) => {
        renderPortScreen("field");
      });
      break;
    case "dispatch":
      import("../ui/screens/DispatchScreen").then(({ renderDispatchScreen }) => {
        renderDispatchScreen("field");
      });
      break;
    case "stable":
      import("../ui/screens/StableScreen").then(({ renderStableScreen }) => {
        renderStableScreen("field");
      });
      break;
    case "black-market":
      import("../ui/screens/BlackMarketScreen").then(({ renderBlackMarketScreen }) => {
        renderBlackMarketScreen("field");
      });
      break;
    case "schema":
      import("../ui/screens/SchemaScreen").then(({ renderSchemaScreen }) => {
        renderSchemaScreen("field");
      });
      break;
    case "foundry-annex":
      import("../ui/screens/FoundryAnnexScreen").then(({ renderFoundryAnnexScreen }) => {
        renderFoundryAnnexScreen("field");
      });
      break;
    case "settings":
      import("../ui/screens/SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("field");
      });
      break;
    case "comms-array":
      import("../ui/screens/CommsArrayScreen").then(({ renderHavenCommsArrayScreen, renderMultiplayerCommsArrayScreen }) => {
        if (getGameState().session.mode === "coop_operations") {
          renderMultiplayerCommsArrayScreen("field");
          return;
        }
        renderHavenCommsArrayScreen("field");
      });
      break;
    case "endless-field-nodes":
      // Endless field nodes mode - continuous rooms until ESC pressed
      import("../ui/screens/FieldNodeRoomScreen").then(({ renderFieldNodeRoomScreen }) => {
        const initialSeed = Math.floor(Math.random() * 1000000);
        console.log("[ENDLESS] Starting endless field nodes mode with seed:", initialSeed);
        renderFieldNodeRoomScreen("endless_room_0", initialSeed, true);
      });
      break;
    case "endless-battles":
      // Endless battles mode - continuous battles until exit
      import("../ui/screens/BattleScreen").then(({ startEndlessBattleMode }) => {
        console.log("[ENDLESS] Starting endless battles mode");
        startEndlessBattleMode();
      });
      break;
  }
}

// ============================================================================
// GAME LOOP
// ============================================================================

function startGameLoop(): void {
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime: number): void {
  if (!fieldState || !currentMap) return;

  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  const buildPanChanged = updateHavenBuildPan(deltaTime);

  if (!fieldState.isPaused) {
    const state = getGameState();
    syncRuntimeFieldAvatarsFromState(state);
    const aerissFieldSpeedBonus = getAerissFieldMovementSpeedBonus(state.stable);
    // Ensure players object exists (backward compatibility)
    const players = state.players || {
      P1: { id: "P1", slot: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, presence: "local" as const, authorityRole: "local" as const, avatar: null, controlledUnitIds: [] },
      P2: { id: "P2", slot: "P2", active: false, color: "#6849c2", inputSource: "none" as const, presence: "inactive" as const, authorityRole: "local" as const, avatar: null, controlledUnitIds: [] },
    };
    const p1 = players.P1;
    const p2 = players.P2;
    const p1Avatar = getRuntimeFieldAvatar("P1", state);
    const p2Avatar = p2.active ? getRuntimeFieldAvatar("P2", state) : null;

    // Update P1 avatar movement
    if (p1.active && p1Avatar) {
      const p1Input = getPlayerInput("P1");
      const p1MovementInput = {
        up: p1Input.up,
        down: p1Input.down,
        left: p1Input.left,
        right: p1Input.right,
        dash: p1Input.special1,
      };

      // Convert FieldAvatar to PlayerAvatar for movement function
      const p1PlayerAvatar = {
        x: p1Avatar.x,
        y: p1Avatar.y,
        width: 32,
        height: 32,
        speed: 240 + aerissFieldSpeedBonus,
        facing: p1Avatar.facing,
      };

      let newP1Avatar = updatePlayerMovement(
        p1PlayerAvatar,
        p1MovementInput,
        currentMap,
        deltaTime,
      );

      // Apply tether constraint if P2 is active
      if (p2.active && p2Avatar) {
        const constrained = applyTetherConstraint(
          { x: newP1Avatar.x, y: newP1Avatar.y },
          { x: newP1Avatar.x, y: newP1Avatar.y },
          p2Avatar,
        );
        newP1Avatar.x = constrained.x;
        newP1Avatar.y = constrained.y;
      }

      setRuntimeFieldAvatarPosition("P1", newP1Avatar.x, newP1Avatar.y, newP1Avatar.facing);
    }

    // Update P2 avatar movement
    if (p2.active && p2Avatar) {
      const p2Input = getPlayerInput("P2");
      const p2MovementInput = {
        up: p2Input.up,
        down: p2Input.down,
        left: p2Input.left,
        right: p2Input.right,
        dash: p2Input.special1,
      };

      // Convert FieldAvatar to PlayerAvatar for movement function
      const p2PlayerAvatar = {
        x: p2Avatar.x,
        y: p2Avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p2Avatar.facing,
      };

      let newP2Avatar = updatePlayerMovement(
        p2PlayerAvatar,
        p2MovementInput,
        currentMap,
        deltaTime,
      );

      // Apply tether constraint (P2 constrained by P1)
      if (p1.active && p1Avatar) {
        const constrained = applyTetherConstraint(
          { x: newP2Avatar.x, y: newP2Avatar.y },
          { x: newP2Avatar.x, y: newP2Avatar.y },
          p1Avatar,
        );
        newP2Avatar.x = constrained.x;
        newP2Avatar.y = constrained.y;
      }

      setRuntimeFieldAvatarPosition("P2", newP2Avatar.x, newP2Avatar.y, newP2Avatar.facing);
    }

    flushFieldAvatarPositionsToGameState();
    if (refreshOuterDeckStreamWindowIfNeeded()) {
      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }
    const updatedP1Avatar = getRuntimeFieldAvatar("P1", state);
    syncFieldMinimapExploration();

      const activeLobby = getGameState().lobby;
      const localSelectedForCoop = Boolean(
        activeLobby?.activity.kind !== "coop_operations"
        || !activeLobby?.localSlot
        || activeLobby.activity.coopOperations.participants[activeLobby.localSlot]?.selected,
      );
      const shouldSyncLobbyAvatar = Boolean(
        activeLobby
        && currentMap?.id
        && localSelectedForCoop
        && (isNetworkLobbyMapActive() || isActiveCoopOperationsLobby(activeLobby)),
      );
      if (shouldSyncLobbyAvatar && updatedP1Avatar && currentMap?.id) {
        const avatar = updatedP1Avatar;
        const syncKey = `${currentMap.id}:${Math.round(avatar.x)}:${Math.round(avatar.y)}:${avatar.facing}`;
        if (syncKey !== lastNetworkLobbyAvatarSyncKey) {
          lastNetworkLobbyAvatarSyncKey = syncKey;
          import("../ui/screens/CommsArrayScreen").then(({ syncLocalLobbyAvatarFromField }) => {
            void syncLocalLobbyAvatarFromField(currentMap!.id, avatar.x, avatar.y, avatar.facing);
          });
        }
      } else {
        lastNetworkLobbyAvatarSyncKey = "";
      }

    updateFieldMovementFeedback(
      currentTime,
      Boolean(getPlayerInput("P1").special1 || (p2.active && getPlayerInput("P2").special1)),
    );

    // Update NPCs (Headline 15b)
    if (fieldState.npcs && currentMap) {
      const map = currentMap; // Type narrowing
      fieldState.npcs = fieldState.npcs.map(npc =>
        updateNpc(npc, map, deltaTime, currentTime)
      );
    }

    updateFieldCombat(deltaTime, currentTime);
    processFieldControllerActions();
    maybeTriggerAutoInteraction();

    activeInteractionPrompt = isFieldCombatActive() ? null : getCombinedInteractionPrompt();

    render();
  } else if (buildPanChanged) {
    render();
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

export function teardownFieldMode(): void {
  flushFieldAvatarPositionsToGameState(true);
  stopGameLoop();
  stopHaven3DFieldRuntime();
  resetFieldMovementInputState();
  cleanupGlobalListeners();
  if (fieldFocusableRefreshTimerId !== null) {
    window.clearTimeout(fieldFocusableRefreshTimerId);
    fieldFocusableRefreshTimerId = null;
  }
  document.getElementById("allNodesPanel")?.remove();
  document.getElementById("fieldPinnedOverlay")?.remove();
  document.getElementById("fieldFeedbackOverlay")?.remove();
  document.getElementById("fieldPromptOverlay")?.remove();
  document.querySelector(".network-lobby-overlay")?.remove();
  isPanelOpen = false;
  lastMinimapRevealKey = "";
  havenBuildModeActive = false;
  havenBuildResumePaused = false;
  resetFieldFeedbackState();
  havenBuildPaletteSelection = null;
  havenBuildDragState = null;
  activeAutoInteractionZoneKey = null;
  suppressedAutoInteractionZoneKey = null;
  fieldTurretLastFireAtMs.clear();
  cleanupFieldControllerContext?.();
  cleanupFieldControllerContext = null;
  cleanupFieldFeedbackListener?.();
  cleanupFieldFeedbackListener = null;
  fieldRuntimeP2Avatar = null;
}

// ============================================================================
// EXIT
// ============================================================================

export function exitFieldMode(returnToOpMap?: boolean): void {
  teardownFieldMode();
  if (returnToOpMap) {
    openOperationMapFromField();
  } else {
    openAllNodesMenuFromField();
  }
}
