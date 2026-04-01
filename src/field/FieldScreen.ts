// ============================================================================
// FIELD SYSTEM - FIELD MODE SCREEN
// ============================================================================

import "./field.css";
import { FieldMap, FieldState } from "./types";
import { getFieldMap } from "./maps";
import {
  createPlayerAvatar,
  updatePlayerMovement,
  getOverlappingInteractionZone,
} from "./player";
import { handleInteraction, getInteractionZone } from "./interactions";
import { getGameState, updateGameState } from "../state/gameStore";
import { renderAllNodesMenuScreen } from "../ui/screens/AllNodesMenuScreen";
import { createCompanion, updateCompanion } from "./companion";
import { createNpc, updateNpc, getNpcInRange, NPC_DIALOGUE } from "./npcs";
import { showDialogue } from "../ui/screens/DialogueScreen";
import { getPlayerInput, handleKeyDown as handlePlayerInputKeyDown, handleKeyUp as handlePlayerInputKeyUp } from "../core/playerInput";
import { tryJoinAsP2, dropOutP2, applyTetherConstraint } from "../core/coop";
import { resolvePlayerSpawn, SpawnSource, SpawnResult } from "./spawnResolver";
import { renderOperationMapScreen } from "../ui/screens/OperationMapScreen";
import type { BaseCampLayoutLoadout, BaseCampPinnedItemFrame } from "../core/types";
import { setBaseCampFieldReturnMap } from "../ui/screens/baseCampReturn";

// ============================================================================
// STATE
// ============================================================================

let fieldState: FieldState | null = null;
let currentMap: FieldMap | null = null;
let animationFrameId: number | null = null;
let lastFrameTime = 0;
// Legacy movementInput kept for backward compatibility, but we'll use getPlayerInput instead
let movementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  dash: false,
};

let activeInteractionPrompt: string | null = null;

// Panel state - simple boolean
let isPanelOpen = false;

// Track if global listeners are attached (prevents duplicates)
let globalListenersAttached = false;

// Spawn debug info (for debug label)
let lastSpawnResult: SpawnResult | null = null;

// Store last interaction zone position for returning to field from nodes
let lastInteractionZonePosition: { x: number; y: number; zoneId: string } | null = null;

// Zoom state
let fieldZoom = 1.0;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
let fieldPinnedResizeHandler: (() => void) | null = null;
let fieldPinnedQuacFeedback = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';

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

const PINNED_NODE_LAYOUT: PinnedNodeDefinition[] = [
  { action: "ops-terminal", icon: "OPS", label: "OPS TERMINAL", desc: "Deploy on operations", variant: "all-nodes-node-btn--primary" },
  { action: "roster", icon: "RST", label: "UNIT ROSTER", desc: "Manage your units" },
  { action: "loadout", icon: "LDT", label: "LOADOUT", desc: "Equipment & inventory" },
  { action: "inventory", icon: "INV", label: "INVENTORY", desc: "View all owned items" },
  { action: "gear-workbench", icon: "WKS", label: "WORKSHOP", desc: "Craft, upgrade & tinker" },
  { action: "shop", icon: "SHP", label: "SHOP", desc: "Buy items & PAKs" },
  { action: "tavern", icon: "TAV", label: "TAVERN", desc: "Recruit new units" },
  { action: "quest-board", icon: "QST", label: "QUEST BOARD", desc: "View active quests" },
  { action: "port", icon: "PRT", label: "PORT", desc: "Trade resources" },
  { action: "quarters", icon: "QTR", label: "QUARTERS", desc: "Rest & heal units" },
  { action: "stable", icon: "STB", label: "STABLE", desc: "Manage mounts", variant: "all-nodes-node-btn--stable" },
  { action: "codex", icon: "CDX", label: "CODEX", desc: "Archives & bestiary", variant: "all-nodes-node-btn--utility" },
  { action: "settings", icon: "CFG", label: "SETTINGS", desc: "Game options", variant: "all-nodes-node-btn--utility" },
  { action: "comms-array", icon: "COM", label: "COMMS ARRAY", desc: "Training & multiplayer", variant: "all-nodes-node-btn--utility" },
];

const PINNED_VALID_ITEM_IDS = new Set([
  PINNED_RESOURCE_LAYOUT_ID,
  ...PINNED_NODE_LAYOUT.map((node) => node.action),
  PINNED_QUAC_LAYOUT_ID,
]);

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
  { action: "gear-workbench", aliases: ["workshop", "workbench", "gear workbench", "craft", "crafting", "upgrade gear"] },
  { action: "shop", aliases: ["shop", "store", "quartermaster", "buy", "market"] },
  { action: "tavern", aliases: ["tavern", "recruit", "recruitment", "hire"] },
  { action: "quest-board", aliases: ["quest", "quests", "quest board", "board", "jobs"] },
  { action: "port", aliases: ["port", "trade", "trading", "manifest", "supply"] },
  { action: "quarters", aliases: ["quarters", "rest", "barracks", "heal"] },
  { action: "stable", aliases: ["stable", "mounts", "mount", "mounted units"] },
  { action: "codex", aliases: ["codex", "archive", "archives", "bestiary"] },
  { action: "settings", aliases: ["settings", "config", "configuration", "options"] },
  { action: "comms-array", aliases: ["comms", "comms array", "multiplayer", "training"] },
  { action: "endless-field-nodes", aliases: ["endless rooms", "debug endless rooms"] },
  { action: "endless-battles", aliases: ["endless battles", "debug endless battles"] },
];

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get the current map ID from field state
 */
export function getCurrentFieldMap(): FieldMap["id"] | null {
  return fieldState?.currentMap || null;
}

/**
 * Store the interaction zone position for returning to field from nodes
 */
export function storeInteractionZonePosition(zoneId: string, x: number, y: number): void {
  lastInteractionZonePosition = { x, y, zoneId };
}

function normalizePinnedQuacCommand(value: string): string {
  return value.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
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
  return pinnedItems.filter((itemId) => PINNED_VALID_ITEM_IDS.has(itemId));
}

function readPinnedOverlayFrames(): Record<string, BaseCampPinnedItemFrame> {
  return getGameState().uiLayout?.baseCampPinnedItemFrames ?? {};
}

function readPinnedOverlayColors(): Record<string, string> {
  return getGameState().uiLayout?.baseCampItemColors ?? {};
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
    case "port":
    case "comms-array":
      return "teal";
    case "tavern":
    case "quarters":
      return "oxide";
    case "stable":
      return "moss";
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

export function renderFieldScreen(mapId: FieldMap["id"] = "base_camp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  setBaseCampFieldReturnMap(mapId);

  // Load map
  currentMap = getFieldMap(mapId);

  // Initialize or restore player avatars from game state
  const state = getGameState();
  const tileSize = 64;
  let playerX: number;
  let playerY: number;

  const isResuming = fieldState && fieldState.currentMap === mapId;

  // Detect spawn source (FCP = key room entry, normal = everything else)
  const spawnSource: SpawnSource = (typeof mapId === "string" && mapId.startsWith("keyroom_")) ? "FCP" : "normal";

  // Check if we have a stored interaction zone position (returning from a node) - prioritize this over resume
  if (mapId === "base_camp" && lastInteractionZonePosition) {
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
    lastSpawnResult = spawnResult;
  } else if (isResuming && mapId !== "quarters") {
    // Restore from fieldState if available, otherwise from game state
    playerX = fieldState!.player.x;
    playerY = fieldState!.player.y;
    // No spawn resolution needed for resume
    lastSpawnResult = null;
  } else {
    // Determine requested spawn position
    let requestedX: number;
    let requestedY: number;

    if (mapId === "quarters") {
      // Spawn in the middle bottom of the walkable area
      // Quarters is 10x8, walkable area is x:1-8, y:1-6
      // Middle of x range (1-8): between 4 and 5, use tile 4 for clean positioning
      // Bottom walkable row: y:6
      const spawnTileX = 4;
      const spawnTileY = 6;
      requestedX = spawnTileX * tileSize + tileSize / 2;
      requestedY = spawnTileY * tileSize + tileSize / 2;
    } else if (mapId === "base_camp") {
      // Quarters station is at x:7, y:3 (size 2x2)
      // Spawn in front of quarters
      requestedX = 7 * tileSize + tileSize / 2;
      requestedY = 5 * tileSize + tileSize / 2;
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
      const requestedTileX = Math.floor(requestedX / tileSize);
      const requestedTileY = Math.floor(requestedY / tileSize);
      lastSpawnResult = {
        x: playerX,
        y: playerY,
        tileX: Math.floor(playerX / tileSize),
        tileY: Math.floor(playerY / tileSize),
        passable: true,
        usedFallback: false,
        candidatesScanned: 0,
        requestedTileX,
        requestedTileY,
      };
    } else {
      // Use centralized spawn resolver
      const spawnResult = resolvePlayerSpawn(
        spawnSource,
        currentMap,
        { x: requestedX, y: requestedY }
      );

      playerX = spawnResult.x;
      playerY = spawnResult.y;
      lastSpawnResult = spawnResult;

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
        active: true,
        color: "#ff8a00",
        inputSource: "keyboard1" as const,
        avatar: null,
        controlledUnitIds: [],
      },
      P2: {
        id: "P2",
        active: false,
        color: "#6849c2",
        inputSource: "none" as const,
        avatar: null,
        controlledUnitIds: [],
      },
    };

    // Always update position for quarters, FCP maps (keyroom_*), or initialize if missing
    const isFCPMap = typeof mapId === "string" && mapId.startsWith("keyroom_");
    const shouldUpdatePosition = mapId === "quarters" || isFCPMap || !players.P1.avatar;

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
            facing: "south",
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
    fieldState = {
      ...fieldState,
      currentMap: mapId,
      player: {
        ...fieldState.player,
        x: playerX,
        y: playerY,
      },
      isPaused: false,
      activeInteraction: null,
      companion,
    };
  } else {
    // Initialize Sable near player
    const companion = createCompanion(playerX - 40, playerY - 40);

    // Initialize NPCs for Base Camp (Headline 15b)
    const npcs: import("./types").FieldNpc[] = [];
    if (mapId === "base_camp") {
      const tileSize = 64;
      // Add NPCs at different locations
      npcs.push(
        createNpc("npc_medic", "Medic", 5 * tileSize + tileSize / 2, 8 * tileSize + tileSize / 2, "npc_medic"),
        createNpc("npc_quartermaster", "Quartermaster", 12 * tileSize + tileSize / 2, 6 * tileSize + tileSize / 2, "npc_quartermaster"),
        createNpc("npc_scout", "Scout", 8 * tileSize + tileSize / 2, 12 * tileSize + tileSize / 2, "npc_scout"),
        createNpc("npc_engineer", "Engineer", 14 * tileSize + tileSize / 2, 10 * tileSize + tileSize / 2, "npc_engineer"),
        // 5 additional NPCs
        createNpc("npc_supply_officer", "Supply Officer", 20 * tileSize + tileSize / 2, 8 * tileSize + tileSize / 2, "npc_supply_officer"),
        createNpc("npc_armorer", "Armorer", 6 * tileSize + tileSize / 2, 6 * tileSize + tileSize / 2, "npc_armorer"),
        createNpc("npc_commander", "Commander", 10 * tileSize + tileSize / 2, 10 * tileSize + tileSize / 2, "npc_commander"),
        createNpc("npc_researcher", "Researcher", 4 * tileSize + tileSize / 2, 10 * tileSize + tileSize / 2, "npc_researcher"),
        createNpc("npc_sentinel", "Sentinel", 18 * tileSize + tileSize / 2, 12 * tileSize + tileSize / 2, "npc_sentinel")
      );
    }

    fieldState = {
      currentMap: mapId,
      player: createPlayerAvatar(playerX, playerY),
      isPaused: false,
      activeInteraction: null,
      companion,
      npcs,
    };
  }

  // Setup input handlers (only once)
  setupGlobalListeners();

  // Restart game loop
  if (animationFrameId !== null) {
    stopGameLoop();
  }

  movementInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
  };

  // Create panel first (outside field-root)
  createAllNodesPanel();

  startGameLoop();
  render();
  createPinnedNodesOverlay();
}

function render(): void {
  const root = document.getElementById("app");
  if (!root || !currentMap || !fieldState) return;

  const tileSize = 64;
  const mapPixelWidth = currentMap.width * tileSize;
  const mapPixelHeight = currentMap.height * tileSize;

  // Build tiles HTML
  let tilesHtml = "";
  for (let y = 0; y < currentMap.height; y++) {
    for (let x = 0; x < currentMap.width; x++) {
      const tile = currentMap.tiles[y][x];
      const tileClass = tile.walkable ? "field-tile-walkable" : "field-tile-wall";
      const tileType = tile.type;
      tilesHtml += `
        <div class="field-tile ${tileClass} field-tile-${tileType}" 
             style="left: ${x * tileSize}px; top: ${y * tileSize}px; width: ${tileSize}px; height: ${tileSize}px;"></div>
      `;
    }
  }

  // Build objects HTML
  let objectsHtml = "";
  for (const obj of currentMap.objects) {
    const associatedZone = currentMap.interactionZones.find((zone) => {
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
    const cursorStyle = associatedZone ? "cursor: pointer;" : "";

    objectsHtml += `
      <div class="field-object field-object-${obj.type}" 
           style="left: ${obj.x * tileSize}px; top: ${obj.y * tileSize}px; width: ${obj.width * tileSize}px; height: ${obj.height * tileSize}px; ${cursorStyle}"
           title="${obj.metadata?.name || obj.type}${associatedZone ? " (Click to interact)" : ""}"
           ${clickAction}>
        <div class="field-object-placeholder">${obj.metadata?.name || obj.type}</div>
      </div>
    `;
  }

  // Player avatars (P1 and P2)
  const state = getGameState();
  // Ensure players object exists (backward compatibility)
  const players = state.players || {
    P1: { id: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, avatar: null, controlledUnitIds: [] },
    P2: { id: "P2", active: false, color: "#6849c2", inputSource: "none" as const, avatar: null, controlledUnitIds: [] },
  };
  const p1Avatar = players.P1.avatar;
  const p2Avatar = players.P2.active ? players.P2.avatar : null;

  let playerHtml = "";

  // P1 Avatar (always present)
  if (p1Avatar) {
    playerHtml += `
      <div class="field-player field-player-p1" 
           style="left: ${p1Avatar.x - 16}px; top: ${p1Avatar.y - 16}px; width: 32px; height: 32px;"
           data-facing="${p1Avatar.facing}">
        <div class="field-player-sprite">A</div>
      </div>
    `;
  }

  // P2 Avatar (if active)
  if (p2Avatar) {
    playerHtml += `
      <div class="field-player field-player-p2" 
           style="left: ${p2Avatar.x - 16}px; top: ${p2Avatar.y - 16}px; width: 32px; height: 32px;"
           data-facing="${p2Avatar.facing}">
        <div class="field-player-sprite">A</div>
      </div>
    `;
  }

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
      <div class="field-npc-sprite">👤</div>
      <div class="field-npc-name">${npc.name}</div>
    </div>
  `).join("") : "";

  // Interaction prompt
  const promptHtml = activeInteractionPrompt
    ? `<div class="field-interaction-prompt">E — ${activeInteractionPrompt}</div>`
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

  // Update only the field-root content (preserves panel)
  fieldRoot.innerHTML = `
    <div class="field-viewport">
      <div class="field-map" style="width: ${mapPixelWidth}px; height: ${mapPixelHeight}px;">
        ${tilesHtml}
        ${objectsHtml}
        ${npcsHtml}
        ${playerHtml}
        ${companionHtml}
      </div>
    </div>
    
    ${promptHtml}
    
    <div class="field-hud">
      <div class="field-hud-instructions">
        WASD to move • Shift to dash • E to interact • Hold ESC for Inventory
      </div>
    </div>
  `;

  centerViewportOnPlayer();

  // Re-attach wheel listener if needed (viewport is recreated on each render)
  const viewport = fieldRoot.querySelector(".field-viewport");
  if (viewport) {
    viewport.addEventListener("wheel", handleWheelZoom, { passive: false });
  }
}

function centerViewportOnPlayer(): void {
  if (!fieldState) return;

  const viewport = document.querySelector(".field-viewport");
  const map = document.querySelector(".field-map");
  if (!viewport || !map) return;

  const viewportRect = viewport.getBoundingClientRect();
  const mapElement = map as HTMLElement;

  const state = getGameState();
  const p1Avatar = state.players.P1.avatar;
  const p2Avatar = state.players.P2.active ? state.players.P2.avatar : null;

  let centerX: number;
  let centerY: number;

  if (p2Avatar && p1Avatar) {
    // Center between both avatars
    centerX = (p1Avatar.x + p2Avatar.x) / 2;
    centerY = (p1Avatar.y + p2Avatar.y) / 2;
  } else if (p1Avatar) {
    // Center on P1 only
    centerX = p1Avatar.x;
    centerY = p1Avatar.y;
  } else {
    // Fallback to fieldState.player (legacy)
    centerX = fieldState.player.x;
    centerY = fieldState.player.y;
  }

  // Account for zoom when calculating offset
  const offsetX = centerX - viewportRect.width / 2;
  const offsetY = centerY - viewportRect.height / 2;

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
  const res = state.resources ?? {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0,
  };

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
        renderAllNodesMenuScreen();
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
  // Navigate to the standalone All Nodes Menu Screen
  // This exits field mode and shows the menu as an independent screen
  const currentMapId = fieldState?.currentMap ?? "base_camp";

  // Stop the game loop and cleanup
  stopGameLoop();
  cleanupGlobalListeners();

  // Remove the overlay panel if it exists
  const panel = document.getElementById("allNodesPanel");
  if (panel) {
    panel.remove();
  }

  removePinnedNodesOverlay();

  isPanelOpen = false;

  // Navigate to the All Nodes Menu Screen
  renderAllNodesMenuScreen(currentMapId);
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

function renderPinnedNodeCard(node: PinnedNodeDefinition): string {
  const variantClass = node.variant ? ` ${node.variant}` : "";
  return `
    <div class="all-nodes-item-shell">
      ${renderPinnedOverlayToolbar(node.action, node.label)}
      <button class="all-nodes-node-btn${variantClass}" type="button" data-field-node-action="${node.action}">
        <span class="node-icon">${node.icon}</span>
        <span class="node-label">${node.label}</span>
        <span class="node-desc">${node.desc}</span>
      </button>
    </div>
  `;
}

function renderPinnedResourceCard(wad: number, resources: { metalScrap: number; wood: number; chaosShards: number; steamComponents: number }): string {
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--resource">
      ${renderPinnedOverlayToolbar(PINNED_RESOURCE_LAYOUT_ID, "resource tracker")}
      <section class="all-nodes-balance-panel" aria-label="Resource balances">
        <div class="all-nodes-balance-heading">
          <span class="all-nodes-balance-kicker">RESOURCE BALANCE</span>
          <span class="all-nodes-balance-subtitle">Live stockpile telemetry</span>
        </div>
        <div class="all-nodes-balance-grid">
          <div class="all-nodes-balance-item">
            <span class="all-nodes-balance-icon">W</span>
            <span class="all-nodes-balance-label">WAD</span>
            <span class="all-nodes-balance-value">${wad.toLocaleString()}</span>
          </div>
          <div class="all-nodes-balance-item">
            <span class="all-nodes-balance-icon">M</span>
            <span class="all-nodes-balance-label">METAL</span>
            <span class="all-nodes-balance-value">${resources.metalScrap}</span>
          </div>
          <div class="all-nodes-balance-item">
            <span class="all-nodes-balance-icon">T</span>
            <span class="all-nodes-balance-label">TIMBER</span>
            <span class="all-nodes-balance-value">${resources.wood}</span>
          </div>
          <div class="all-nodes-balance-item">
            <span class="all-nodes-balance-icon">C</span>
            <span class="all-nodes-balance-label">CHAOS</span>
            <span class="all-nodes-balance-value">${resources.chaosShards}</span>
          </div>
          <div class="all-nodes-balance-item">
            <span class="all-nodes-balance-icon">S</span>
            <span class="all-nodes-balance-label">STEAM</span>
            <span class="all-nodes-balance-value">${resources.steamComponents}</span>
          </div>
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
    const resources = state.resources ?? {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
    };
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
    status.textContent = fieldPinnedQuacFeedback;
    status.classList.add("all-nodes-cli-status--error");
    input.select();
    return;
  }

  fieldPinnedQuacFeedback = `Executing ${resolvedAction.toUpperCase()}...`;
  status.textContent = fieldPinnedQuacFeedback;
  status.classList.remove("all-nodes-cli-status--error");
  input.value = "";
  handleNodeAction(resolvedAction);
}

function handlePinnedOverlayInput(e: Event): void {
  const input = e.target as HTMLInputElement | null;
  if (!input?.classList.contains("all-nodes-cli-input")) return;

  const status = input.closest(".all-nodes-item-shell")?.querySelector<HTMLElement>("[data-field-quac-status]");
  if (!status || !status.classList.contains("all-nodes-cli-status--error")) return;

  status.classList.remove("all-nodes-cli-status--error");
  fieldPinnedQuacFeedback = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';
  status.textContent = fieldPinnedQuacFeedback;
}

function createPinnedNodesOverlay(): void {
  const root = document.getElementById("app");
  if (!root) return;

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

// ============================================================================
// GLOBAL INPUT HANDLING (Attached once, never duplicated)
// ============================================================================

function setupGlobalListeners(): void {
  if (globalListenersAttached) return;

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  document.addEventListener("click", handleFieldObjectClick, true);

  // Also add document-level click handler for All Nodes button as fallback
  document.addEventListener("click", handleAllNodesButtonClick, true);

  // Add wheel event listener for zoom
  const viewport = document.querySelector(".field-viewport");
  if (viewport) {
    viewport.addEventListener("wheel", handleWheelZoom, { passive: false });
  }

  globalListenersAttached = true;
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

function handleAllNodesButtonClick(e: MouseEvent): void {
  // Button removed - no longer needed
}

function cleanupGlobalListeners(): void {
  if (!globalListenersAttached) return;

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
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

  if (isPinnedOverlayInput) {
    return;
  }

  // ESC key: toggle All Nodes panel
  if (key === "escape" || e.code === "Escape" || e.keyCode === 27) {
    e.preventDefault();
    e.stopPropagation();
    toggleAllNodesPanel();
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
    case "e":
      const p1Input = getPlayerInput("P1");
      if (p1Input.interact) {
        handleInteractKey();
        e.preventDefault();
      }
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

  if (isPinnedOverlayInput) {
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

  const target = e.target as HTMLElement;
  const objEl = target.closest(".field-object[data-interaction-zone]") as HTMLElement;
  if (!objEl) return;

  e.stopPropagation();
  e.preventDefault();

  const zoneId = objEl.getAttribute("data-interaction-zone");
  if (!zoneId || !currentMap || !fieldState) return;

  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) return;

  const savedPlayerPos = { x: fieldState.player.x, y: fieldState.player.y };
  fieldState.isPaused = true;

  handleInteraction(zone, currentMap, () => {
    if (fieldState) {
      fieldState.isPaused = false;
      const tileSize = 64;
      const offsetX = savedPlayerPos.x % tileSize < tileSize / 2 ? -8 : 8;
      const offsetY = savedPlayerPos.y % tileSize < tileSize / 2 ? -8 : 8;
      fieldState.player.x = savedPlayerPos.x + offsetX;
      fieldState.player.y = savedPlayerPos.y + offsetY;
      renderFieldScreen(fieldState.currentMap);
    }
  });
}

function handleInteractKey(): void {
  if (!fieldState || !currentMap || fieldState.isPaused) return;

  // Check for NPC interaction first (Headline 15b)
  if (fieldState.npcs) {
    const nearbyNpc = getNpcInRange(fieldState.player, fieldState.npcs);
    if (nearbyNpc && nearbyNpc.dialogueId) {
      const dialogueLines = NPC_DIALOGUE[nearbyNpc.dialogueId] || [
        "Hello there!",
        "This is placeholder dialogue.",
      ];

      // Pause field movement while in dialogue
      fieldState.isPaused = true;

      showDialogue(nearbyNpc.name, dialogueLines, () => {
        // Resume field movement after dialogue
        if (fieldState) {
          fieldState.isPaused = false;
        }
      });

      return;
    }
  }

  const zoneId = getOverlappingInteractionZone(fieldState.player, currentMap);
  if (!zoneId) return;

  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) return;

  const savedPlayerPos = { x: fieldState.player.x, y: fieldState.player.y };
  fieldState.isPaused = true;

  try {
    handleInteraction(zone, currentMap, () => {
      if (fieldState) {
        fieldState.isPaused = false;
        const tileSize = 64;
        const offsetX = savedPlayerPos.x % tileSize < tileSize / 2 ? -8 : 8;
        const offsetY = savedPlayerPos.y % tileSize < tileSize / 2 ? -8 : 8;
        fieldState.player.x = savedPlayerPos.x + offsetX;
        fieldState.player.y = savedPlayerPos.y + offsetY;
        renderFieldScreen(fieldState.currentMap);
      }
    });
  } catch (error) {
    console.error("[FIELD] Error handling interaction:", error);
    if (fieldState) {
      fieldState.isPaused = false;
      renderFieldScreen(fieldState.currentMap);
    }
  }
}

// ============================================================================
// NODE ACTIONS
// ============================================================================

function handleNodeAction(action: string): void {
  if (fieldState) {
    fieldState.isPaused = true;
  }

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
    case "port":
      import("../ui/screens/PortScreen").then(({ renderPortScreen }) => {
        renderPortScreen("field");
      });
      break;
    case "stable":
      import("../ui/screens/StableScreen").then(({ renderStableScreen }) => {
        renderStableScreen("field");
      });
      break;
    case "settings":
      import("../ui/screens/SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("field");
      });
      break;
    case "comms-array":
      import("../ui/screens/CommsArrayScreen").then(({ renderCommsArrayScreen }) => {
        renderCommsArrayScreen("field");
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

  if (!fieldState.isPaused) {
    const state = getGameState();
    // Ensure players object exists (backward compatibility)
    const players = state.players || {
      P1: { id: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, avatar: null, controlledUnitIds: [] },
      P2: { id: "P2", active: false, color: "#6849c2", inputSource: "none" as const, avatar: null, controlledUnitIds: [] },
    };
    const p1 = players.P1;
    const p2 = players.P2;

    // Update P1 avatar movement
    if (p1.active && p1.avatar) {
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
        x: p1.avatar.x,
        y: p1.avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p1.avatar.facing,
      };

      let newP1Avatar = updatePlayerMovement(
        p1PlayerAvatar,
        p1MovementInput,
        currentMap,
        deltaTime,
      );

      // Apply tether constraint if P2 is active
      if (p2.active && p2.avatar) {
        const constrained = applyTetherConstraint(
          { x: newP1Avatar.x, y: newP1Avatar.y },
          { x: newP1Avatar.x, y: newP1Avatar.y },
          p2.avatar
        );
        newP1Avatar.x = constrained.x;
        newP1Avatar.y = constrained.y;
      }

      // Update P1 avatar in game state
      updateGameState(s => ({
        ...s,
        players: {
          ...s.players,
          P1: {
            ...s.players.P1,
            avatar: {
              x: newP1Avatar.x,
              y: newP1Avatar.y,
              facing: newP1Avatar.facing,
            },
          },
        },
      }));
    }

    // Update P2 avatar movement
    if (p2.active && p2.avatar) {
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
        x: p2.avatar.x,
        y: p2.avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p2.avatar.facing,
      };

      let newP2Avatar = updatePlayerMovement(
        p2PlayerAvatar,
        p2MovementInput,
        currentMap,
        deltaTime,
      );

      // Apply tether constraint (P2 constrained by P1)
      if (p1.active && p1.avatar) {
        const constrained = applyTetherConstraint(
          { x: newP2Avatar.x, y: newP2Avatar.y },
          { x: newP2Avatar.x, y: newP2Avatar.y },
          p1.avatar
        );
        newP2Avatar.x = constrained.x;
        newP2Avatar.y = constrained.y;
      }

      // Update P2 avatar in game state
      updateGameState(s => ({
        ...s,
        players: {
          ...s.players,
          P2: {
            ...s.players.P2,
            avatar: {
              x: newP2Avatar.x,
              y: newP2Avatar.y,
              facing: newP2Avatar.facing,
            },
          },
        },
      }));
    }

    // Update legacy fieldState.player for backward compatibility (use P1 position)
    const updatedState = getGameState();
    if (updatedState.players.P1.avatar) {
      fieldState.player = {
        ...fieldState.player,
        x: updatedState.players.P1.avatar.x,
        y: updatedState.players.P1.avatar.y,
        facing: updatedState.players.P1.avatar.facing as any,
      };
    }

    // Update Sable companion (Headline 15a) - follows P1
    if (fieldState.companion && currentMap && updatedState.players.P1.avatar) {
      const p1Avatar = updatedState.players.P1.avatar;
      const p1PlayerAvatar = {
        x: p1Avatar.x,
        y: p1Avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p1Avatar.facing as any,
      };
      fieldState.companion = updateCompanion(fieldState.companion, {
        player: p1PlayerAvatar,
        map: currentMap,
        deltaTime,
        currentTime,
      });
    }

    // Update NPCs (Headline 15b)
    if (fieldState.npcs && currentMap) {
      const map = currentMap; // Type narrowing
      fieldState.npcs = fieldState.npcs.map(npc =>
        updateNpc(npc, map, deltaTime, currentTime)
      );
    }

    // Check interaction zones (use P1 for now, could check both)
    const updatedPlayers = updatedState.players || {
      P1: { id: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, avatar: null, controlledUnitIds: [] },
      P2: { id: "P2", active: false, color: "#6849c2", inputSource: "none" as const, avatar: null, controlledUnitIds: [] },
    };
    const p1Avatar = updatedPlayers.P1.avatar;
    if (p1Avatar) {
      const p1PlayerAvatar = {
        x: p1Avatar.x,
        y: p1Avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p1Avatar.facing as any,
      };
      const overlappingZone = getOverlappingInteractionZone(p1PlayerAvatar, currentMap);
      if (overlappingZone) {
        const zone = getInteractionZone(currentMap, overlappingZone);
        activeInteractionPrompt = zone?.label || null;
      } else {
        activeInteractionPrompt = null;
      }
    }

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

// ============================================================================
// EXIT
// ============================================================================

export function exitFieldMode(returnToOpMap?: boolean): void {
  stopGameLoop();
  cleanupGlobalListeners();

  // Remove panel
  const panel = document.getElementById("allNodesPanel");
  if (panel) {
    panel.remove();
  }

  isPanelOpen = false;
  if (returnToOpMap) {
    renderOperationMapScreen();
  } else {
    renderAllNodesMenuScreen();
  }
}
