// src/core/types.ts
import type { EffectFlowDocument } from "./effectFlow";

import type { BattleState as RuntimeBattleState } from "./battle";

// ---------------------------------------------------------
//  CORE BATTLE TYPES
// ---------------------------------------------------------

export type UnitId = string;
export type CardId = string;
export type RoomId = string;
export const LOCAL_PLAYER_IDS = ["P1", "P2"] as const;
export const SESSION_PLAYER_SLOTS = ["P1", "P2", "P3", "P4"] as const;
export const NETWORK_PLAYER_SLOTS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"] as const;
export type PlayerSlot = typeof LOCAL_PLAYER_IDS[number];
export type SessionPlayerSlot = typeof SESSION_PLAYER_SLOTS[number];
export type NetworkPlayerSlot = typeof NETWORK_PLAYER_SLOTS[number];
export type PlayerId = PlayerSlot;
export type PlayerInputSource =
  | "keyboard1"
  | "keyboard2"
  | "gamepad1"
  | "gamepad2"
  | "gamepad3"
  | "gamepad4"
  | "remote"
  | "none";
export type SessionMode = "singleplayer" | "local_coop" | "squad" | "coop_operations";
export type PlayerPresence = "inactive" | "local" | "remote" | "disconnected";
export type AuthorityRole = "local" | "host" | "client";
export type UnitOwnership = PlayerSlot;
export type EconomyPreset = "shared" | "partitioned";
export type ResourceTransferKind = "wad" | "resource" | "item";
export type ReconnectStagingState = "haven" | "staging" | "theater" | "battle" | "disconnected" | "rejoining";
export type LobbyTransportState = "local_preview" | "hosting" | "joining" | "connected" | "reconnecting" | "closed";
export type SkirmishObjectiveType = "elimination" | "control_relay" | "breakthrough";
export type LobbyChallengeStatus = "pending" | "accepted" | "declined" | "cancelled";
export type LobbySkirmishIntermissionDecision = "redraft" | "reuse";
export type LobbyCoopOperationsStatus = "staging" | "active";

export type WeaponType =
  | "sword"
  | "greatsword"
  | "shortsword"
  | "bow"
  | "greatbow"
  | "gun"
  | "staff"
  | "greatstaff"
  | "dagger"
  | "knife"
  | "fist"
  | "rod"
  | "katana"
  | "shuriken"
  | "spear"
  | "instrument";

export interface CardEffect {
  type: string;
  amount?: number;
  duration?: number;
  stat?: string;
  tiles?: number;
}

export interface Card {
  id: CardId;
  name: string;
  description: string;
  strainCost: number;
  targetType: "enemy" | "self" | "tile" | "ally";
  range?: number;
  effects: CardEffect[];
  effectFlow?: EffectFlowDocument;
  artPath?: string;
}

export interface Unit {
  id: UnitId;
  name: string;
  isEnemy: boolean;
  hp: number;
  maxHp: number;
  agi: number;
  pos: { x: number; y: number } | null;
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  strain: number;
  unitClass?: string;
  loadout?: {
    primaryWeapon: string | null;
    secondaryWeapon: string | null;
    helmet: string | null;
    chestpiece: string | null;
    accessory1: string | null;
    accessory2: string | null;
  };
  buffs?: Array<{
    id: string;
    type: "def_up" | "atk_up" | "agi_up" | string;
    amount: number;
    duration: number;
  }>;
  // Unit Performance System (Headline 14a)
  pwr?: number; // Personnel Warfare Rating
  affinities?: UnitAffinities; // Long-term affinity tracking
  // Local Co-op: Which player controls this unit
  controller?: UnitOwnership;
  // Field Mods System - Hardpoints (run-scoped, stored in ActiveRunState)
  // Mount System
  mountInstanceId?: string;  // ID of the OwnedMount instance assigned to this unit
  operationInjury?: {
    operationId: string;
    theaterId: string;
    squadId: string;
    incapacitatedAtTick: number;
    sourceRoomId: RoomId;
  } | null;
}

export interface BattleTile {
  pos: { x: number; y: number };
  terrain: string;
}

export interface BattleState {
  roomId: RoomId;
  gridWidth: number;
  gridHeight: number;
  units: Record<UnitId, Unit>;
  turnOrder: UnitId[];
  turnIndex: number;
  turnCount: number;
  tiles: BattleTile[];
  log: string[];
  phase: "active" | "victory" | "defeat";
  rewards?: {
    wad: number;
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };
  modeContext?: BattleModeContext;

  // 10za addition:
  loadPenalties?: LoadPenaltyFlags;
}

// ---------------------------------------------------------
//  OPERATION / WORLD
// ---------------------------------------------------------

export type RoomType = "tavern" | "battle" | "event" | "shop" | "rest" | "boss" | "field_node" | "key_room" | "elite" | "treasure";

export interface RoomNode {
  id: RoomId;
  label: string;
  type?: RoomType;
  position?: { x: number; y: number };
  connections?: RoomId[];
  battleTemplate?: string; // ID of battle template from procedural.ts
  eventTemplate?: string;  // ID of event template from procedural.ts
  shopInventory?: string[]; // Equipment IDs available in shop
  fieldNodeSeed?: number;  // Seed for field_node room generation (Headline 14d)
  visited?: boolean;
}

export interface Floor {
  id?: string;
  name: string;
  startingNodeId?: RoomId;
  nodes?: RoomNode[];  // New name for rooms
  rooms?: RoomNode[];  // Keep for backwards compatibility
}

export type TheaterSprawlDirection =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest";

export interface OperationRun {
  id?: string;
  codename: string;
  description: string;
  objective?: string;
  recommendedPWR?: number;
  beginningState?: string;
  endState?: string;
  floors: Floor[];
  currentFloorIndex: number;
  currentRoomId: RoomId | null;
  connections?: Record<string, string[]>; // nodeId -> connected nodeIds (for branching UI)
  launchSource?: "ops_terminal" | "atlas" | "comms";
  atlasTheaterId?: string;
  atlasFloorId?: string;
  sprawlDirection?: TheaterSprawlDirection;
  theater?: TheaterNetworkState;
  theaterFloors?: Record<number, TheaterNetworkState>;
}

export interface PlayerProfile {
  callsign: string;
  squadName: string;
  rosterUnitIds: UnitId[];
}

export interface FieldAvatar {
  x: number;
  y: number;
  facing: "north" | "south" | "east" | "west";
}

export interface Player {
  id: PlayerSlot;
  active: boolean;
  color: string;
  slot: PlayerSlot;
  inputSource: PlayerInputSource;
  presence: PlayerPresence;
  authorityRole: AuthorityRole;
  avatar: FieldAvatar | null;
  controlledUnitIds: UnitId[];
}

export interface ResourceWallet {
  metalScrap: number;
  wood: number;
  chaosShards: number;
  steamComponents: number;
}

export interface ResourcePool {
  wad: number;
  resources: ResourceWallet;
}

export interface TradeTransfer {
  id: string;
  fromPlayerId: SessionPlayerSlot;
  toPlayerId: SessionPlayerSlot;
  kind: ResourceTransferKind;
  status: "pending" | "completed" | "cancelled";
  createdAt: number;
  wadAmount?: number;
  resourceKey?: keyof ResourceWallet;
  resourceAmount?: number;
  itemId?: string;
  itemCount?: number;
  note?: string;
}

export interface TheaterAssignment {
  playerId: SessionPlayerSlot;
  theaterId: string | null;
  squadId: string | null;
  roomId: RoomId | null;
  stagingState: ReconnectStagingState;
}

export interface PendingTheaterBattleConfirmationState {
  roomId: RoomId;
  previousRoomId: RoomId;
  roomLabel: string;
  squadId: string | null;
}

export type CoopTheaterCommand =
  | { type: "move_to_room"; roomId: RoomId }
  | { type: "confirm_pending_battle" }
  | { type: "fallback_pending_battle" }
  | { type: "refuse_defense"; roomId?: RoomId | null };

export interface SessionPlayerState {
  slot: SessionPlayerSlot;
  presence: PlayerPresence;
  authorityRole: AuthorityRole;
  connected: boolean;
  inputSource: PlayerInputSource;
  controlledUnitIds: UnitId[];
  stagingState: ReconnectStagingState;
  currentTheaterId: string | null;
  assignedSquadId: string | null;
  lastSafeRoomId: RoomId | null;
  lastSafeMapId: string | null;
}

export interface ResourceLedger {
  preset: EconomyPreset;
  shared: ResourcePool;
  perPlayer: Record<SessionPlayerSlot, ResourcePool>;
}

export interface CampaignState {
  sharedWorldState: {
    discoveredTheaterIds: string[];
    unlockedFloorIds: string[];
    atlasProgressToken: string | null;
    schemaUnlockIds: string[];
  };
}

export interface SessionState {
  mode: SessionMode;
  authorityRole: AuthorityRole;
  ownerSlot: SessionPlayerSlot;
  maxPlayers: number;
  resourceLedger: ResourceLedger;
  pendingTransfers: TradeTransfer[];
  players: Record<SessionPlayerSlot, SessionPlayerState>;
  theaterAssignments: Record<SessionPlayerSlot, TheaterAssignment>;
  pendingTheaterBattleConfirmation: PendingTheaterBattleConfirmationState | null;
  activeBattleId: string | null;
  campaign: CampaignState;
}

export interface LobbyAvatarState {
  x: number;
  y: number;
  facing: "north" | "south" | "east" | "west";
  mapId: string | null;
  updatedAt: number;
}

export interface LobbyMember {
  slot: NetworkPlayerSlot;
  callsign: string;
  presence: PlayerPresence;
  authorityRole: AuthorityRole;
  connected: boolean;
  joinedAt: number;
  lastHeartbeatAt: number | null;
}

export interface SkirmishRoundSpec {
  id: string;
  gridWidth: number;
  gridHeight: number;
  objectiveType: SkirmishObjectiveType;
  mapId?: string | null;
}

export interface SkirmishPlaylist {
  rounds: SkirmishRoundSpec[];
}

export interface LobbyChallenge {
  challengeId: string;
  challengerSlot: NetworkPlayerSlot;
  challengeeSlot: NetworkPlayerSlot;
  challengerCallsign: string;
  challengeeCallsign: string;
  playlist: SkirmishPlaylist;
  status: LobbyChallengeStatus;
  createdAt: number;
  updatedAt: number;
}

export interface LobbySkirmishActivity {
  activityId: string;
  challengerSlot: NetworkPlayerSlot;
  challengeeSlot: NetworkPlayerSlot;
  challengerCallsign: string;
  challengeeCallsign: string;
  playlist: SkirmishPlaylist;
  currentRoundIndex: number;
  status: "draft" | "confirmation" | "battle" | "result" | "intermission";
  matchSnapshot: string;
  activeBattlePayload: string | null;
  nextRoundDecision: LobbySkirmishIntermissionDecision | null;
  createdAt: number;
  updatedAt: number;
}

export interface LobbyCoopParticipantState {
  slot: NetworkPlayerSlot;
  callsign: string;
  authorityRole: AuthorityRole;
  selected: boolean;
  connected: boolean;
  presence: PlayerPresence;
  sessionSlot: SessionPlayerSlot | null;
  stagingState: ReconnectStagingState;
  lastSafeMapId: string | null;
}

export interface LobbyCoopOperationsActivity {
  activityId: string;
  sessionId: string | null;
  status: LobbyCoopOperationsStatus;
  selectedSlots: NetworkPlayerSlot[];
  economyPreset: EconomyPreset;
  participants: Record<NetworkPlayerSlot, LobbyCoopParticipantState>;
  operationSnapshot: string | null;
  battleSnapshot: string | null;
  operationPhase: GameState["phase"] | null;
  pendingTheaterBattleConfirmation: PendingTheaterBattleConfirmationState | null;
  createdAt: number;
  launchedAt: number | null;
  updatedAt: number;
}

export type LobbyActivity =
  | { kind: "idle" }
  | { kind: "skirmish"; skirmish: LobbySkirmishActivity }
  | { kind: "coop_operations"; coopOperations: LobbyCoopOperationsActivity };

export interface LobbyState {
  protocolVersion: number;
  lobbyId: string;
  joinCode: string;
  hostSlot: NetworkPlayerSlot;
  localSlot: NetworkPlayerSlot | null;
  returnContext?: LobbyReturnContext | null;
  transportState: LobbyTransportState;
  members: Record<NetworkPlayerSlot, LobbyMember | null>;
  avatars: Record<NetworkPlayerSlot, LobbyAvatarState | null>;
  pendingChallenge: LobbyChallenge | null;
  activity: LobbyActivity;
  updatedAt: number;
}

export type LobbyReturnContext =
  | { kind: "menu" }
  | { kind: "esc" }
  | { kind: "operation" }
  | {
      kind: "field";
      mapId: string;
      x?: number;
      y?: number;
      facing?: "north" | "south" | "east" | "west";
    };

export interface BaseCampItemSize {
  colSpan: number;
  minHeight?: number;
  rowSpan?: number;
  gridX?: number;
  gridY?: number;
}

export interface BaseCampPinnedItemFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BaseCampFieldNodeLayout {
  x: number;
  y: number;
  hidden?: boolean;
}

export interface BaseCampLayoutLoadout {
  minimizedItems?: string[];
  itemSizes?: Record<string, BaseCampItemSize>;
  pinnedItems?: string[];
  itemColors?: Record<string, string>;
  pinnedItemFrames?: Record<string, BaseCampPinnedItemFrame>;
}

export interface InventoryFolder {
  id: string;
  name: string;
  color: string;
  entryKeys: string[];
}

export interface PlayerNoteTab {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  stickyAnchor?: PlayerNoteStickyAnchor | null;
}

export interface PlayerNotesState {
  tabs: PlayerNoteTab[];
  activeTabId: string;
  nextTabOrdinal: number;
}

export type PlayerNoteStickySurface = "field" | "theater" | "atlas";

export interface PlayerNoteStickyAnchor {
  surfaceType: PlayerNoteStickySurface;
  surfaceId: string;
  x: number;
  y: number;
  colorKey?: string;
}

export interface UILayoutState {
  baseCampLayoutVersion?: number;
  baseCampResetPresetIndex?: number;
  baseCampActiveLoadoutIndex?: number;
  baseCampNodeOrder?: string[];
  baseCampItemOrder?: string[];
  baseCampMinimizedItems?: string[];
  baseCampPinnedItems?: string[];
  baseCampItemSizes?: Record<string, BaseCampItemSize>;
  baseCampItemColors?: Record<string, string>;
  baseCampPinnedItemFrames?: Record<string, BaseCampPinnedItemFrame>;
  baseCampFieldNodeLayouts?: Record<string, BaseCampFieldNodeLayout>;
  baseCampLayoutLoadouts?: Record<string, BaseCampLayoutLoadout>;
  minimapExploredByMap?: Record<string, string[]>;
  inventoryTrayItemLayouts?: Record<string, BaseCampItemSize>;
  inventoryViewNodeLayouts?: Record<string, BaseCampItemSize>;
  inventoryFolders?: Record<string, InventoryFolder>;
  theaterCommandWindowFrames?: Record<string, {
    x: number;
    y: number;
    width: number;
    height: number;
    minimized: boolean;
    zIndex: number;
  }>;
  theaterCommandLayoutVersion?: number;
  theaterCommandWindowColors?: Record<string, string>;
  theaterCommandViewport?: {
    panX: number;
    panY: number;
    zoom: number;
  };
  theaterCommandCoreTab?: "room" | "core" | "fortifications";
  theaterCommandNodeTab?: "room" | "annexes" | "modules" | "partitions" | "core" | "fortifications";
  theaterCommandMapMode?: TheaterMapMode;
  theaterCommandAutomationWindowOpen?: boolean;
  theaterCommandSelectedAnnexId?: string | null;
  theaterCommandSelectedModuleId?: string | null;
  theaterCommandSelectedEdgeId?: string | null;
  atlasSelectedTheaterId?: string;
  opsTerminalAtlasViewport?: {
    panX: number;
    panY: number;
    zoom?: number;
  };
  opsTerminalAtlasMapMode?: TheaterMapMode;
  opsTerminalAtlasWindowFrame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opsTerminalAtlasEconomyWindowFrame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opsTerminalAtlasCoreWindowFrame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opsTerminalAtlasNotesWindowFrame?: {
    x: number;
    y: number;
    width: number;
    height: number;
    minimized?: boolean;
  };
  opsTerminalAtlasNotesWindowColor?: string;
  opsTerminalAtlasDebugFloorBypass?: boolean;
  escDebugPortStableUnlock?: boolean;
  theaterDebugDisableEnemyRoomAttacks?: boolean;
  notesState?: PlayerNotesState;
}

// ---------------------------------------------------------
//  THEATER LOGISTICS / OPERATION NETWORK
// ---------------------------------------------------------

export type RoomState = "unknown" | "mapped" | "secured";
export type RoomStatus = RoomState;
export type AtlasTheaterState = "active" | "warm" | "cold" | "undiscovered";
export type TheaterMapMode = "supply" | "power" | "comms" | "command";
export type TheaterIntelLevel = 0 | 1 | 2;
export type TheaterKeyType = "triangle" | "square" | "circle" | "spade" | "star";
export type TheaterSquadStatus = "idle" | "moving" | "pinned" | "threatened" | "out_of_contact";
export type TheaterSquadAutomationMode = "manual" | "undaring" | "daring";
export type TheaterSquadAutoStatus = "idle" | "intercepting" | "pushing" | "recovering" | "holding";
export type TheaterRoomClass = "standard" | "mega";
export type TheaterThreatType = "patrol" | "siege";
export type TheaterObjectiveType =
  | "deliver_supply"
  | "sustain_occupation"
  | "build_core"
  | "route_power"
  | "establish_comms"
  | "multi_resource";

export interface TheaterKeyInventory {
  triangle: boolean;
  square: boolean;
  circle: boolean;
  spade: boolean;
  star: boolean;
}

export interface RadialDirectionVector {
  x: number;
  y: number;
}

export interface AtlasTheaterSummary {
  theaterId: string;
  operationId?: string;
  zoneName: string;
  floorId: string;
  floorLabel: string;
  floorOrdinal: number;
  sectorLabel: string;
  radialSlotIndex: number;
  radialSlotCount: number;
  angleDeg: number;
  radialDirection: RadialDirectionVector;
  ringIndex: number;
  discovered: boolean;
  uplinkRoomId: RoomId;
  outwardDepth: number;
  operationAvailable: boolean;
  currentState: AtlasTheaterState;
  recommendedPwr: number;
  securedRooms: number;
  totalKnownRooms: number;
  activeCores: number;
  passiveEffectText: string;
  passiveEffectKind?: "benefit" | "penalty" | "neutral";
  threatLevel: string;
  operationCodename?: string;
  operationDescription?: string;
}

export interface AtlasFloorMap {
  floorId: string;
  floorLabel: string;
  floorOrdinal: number;
  isCurrentFloor: boolean;
  ringIndex: number;
  theaters: AtlasTheaterSummary[];
}

export type TheaterRoomTag =
  | "ingress"
  | "uplink"
  | "frontier"
  | "objective"
  | "power_source"
  | "elite"
  | "side_branch"
  | "junction"
  | "core_candidate"
  | "relay"
  | "metal_rich"
  | "timber_rich"
  | "steam_vent"
  | "survey_highground"
  | "transit_junction"
  | "command_suitable"
  | "salvage_rich"
  | "medical_supplies"
  | "stable_suitable"
  | "tavern_suitable"
  | "resource_pocket"
  | "enemy_staging"
  | string;

export type CoreType =
  | "supply_depot"
  | "command_center"
  | "medical_ward"
  | "armory"
  | "mine"
  | "generator"
  | "logistics_hub"
  | "prototype_systems_lab"
  | "forward_maintenance_bay"
  | "emergency_supply_cache"
  | "forward_fire_support_post"
  | "operations_planning_cell"
  | "tactics_school"
  | "quartermaster_cell"
  | "stable"
  | "fabrication_bay"
  | "survey_array"
  | "recovery_yard"
  | "transit_hub"
  | "tavern"
  | "refinery";

export type CoreBuildCategory =
  | "logistics"
  | "command"
  | "support"
  | "industry"
  | "combat"
  | "civic"
  | "mobility"
  | "research";

export type FortificationType =
  | "barricade"
  | "powerRail"
  | "bulkhead"
  | "turret"
  | "substation"
  | "capacitor"
  | "switchgear"
  | "overcharger"
  | "repeater"
  | "sensorArray"
  | "signalBooster"
  | "waystation"
  | "bridgeRig"
  | "repairBench"
  | "securityTerminal";

export type FieldAssetType =
  | "barricade_wall"
  | "med_station"
  | "ammo_crate"
  | "proximity_mine"
  | "smoke_emitter"
  | "portable_ladder"
  | "light_tower"
  | "box"
  | "spike_strip"
  | "blast_charge"
  | "field_door"
  | "turret"
  | "shock_node"
  | "supply_cache"
  | "grapple_anchor";

export interface SchemaUnlockState {
  unlockedCoreTypes: CoreType[];
  unlockedFortificationPips: FortificationType[];
  unlockedFieldAssetTypes: FieldAssetType[];
}

export interface FoundryUnlockState {
  unlockedModuleTypes: AutomationModuleType[];
  unlockedPartitionTypes: PartitionType[];
}

export type AnnexFrameType =
  | "lightweight_annex"
  | "standard_annex"
  | "heavy_annex";

export type AnnexAttachmentEdge = "north" | "east" | "south" | "west";

export type AutomationModuleCategory =
  | "sensor"
  | "logic"
  | "actuator"
  | "buffer"
  | "storage"
  | "stabilizer"
  | "router";

export type AutomationModuleType =
  | "threat_sensor"
  | "motion_sensor"
  | "power_sensor"
  | "supply_threshold_sensor"
  | "bandwidth_sensor"
  | "room_state_sensor"
  | "loom_terminal"
  | "and_gate"
  | "or_gate"
  | "not_gate"
  | "threshold_switch"
  | "delay_timer"
  | "turret_controller"
  | "cache_release"
  | "power_redirector"
  | "bandwidth_redirector"
  | "artillery_uplink"
  | "door_controller"
  | "capacitor"
  | "supply_cache"
  | "bandwidth_buffer"
  | "latch"
  | "memory_cell"
  | "delay_buffer"
  | "accumulator"
  | "power_stabilizer"
  | "supply_stabilizer"
  | "comms_stabilizer"
  | "power_router"
  | "supply_router"
  | "bandwidth_router"
  | "signal_splitter"
  | "signal_relay"
  | "signal_merger"
  | "cross_branch_relay";

export type PartitionType = "blast_door";

export interface AutomationTargetRef {
  kind: "node" | "edge";
  nodeId?: string | null;
  edgeId?: string | null;
}

export type AutomationSignalValue =
  | {
      kind: "boolean";
      value: boolean;
    }
  | {
      kind: "number";
      value: number;
    }
  | {
      kind: "empty";
      value: 0;
    };

export interface AutomationSignalSnapshot {
  moduleId: string;
  label: string;
  output: AutomationSignalValue;
  active: boolean;
}

export interface AnnexFrameDefinition {
  id: AnnexFrameType;
  displayName: string;
  frameCategory: "light" | "standard" | "heavy";
  buildCost: Partial<ResourceWallet>;
  durability: number;
  slotBonus: number;
  restrictions?: string[];
}

export interface AnnexInstance {
  annexId: string;
  parentNodeId: string;
  parentRoomId: RoomId;
  frameType: AnnexFrameType;
  attachedEdge: AnnexAttachmentEdge;
  position: { x: number; y: number };
  size: { width: number; height: number };
  moduleSlotCapacity: number;
  moduleSlots: Array<string | null>;
  integrity: number;
  inheritedControl: boolean;
  inheritedSupply: number;
  inheritedPower: number;
  inheritedComms: number;
}

export interface ModuleDefinition {
  id: AutomationModuleType;
  displayName: string;
  category: AutomationModuleCategory;
  description: string;
  buildCost: Partial<ResourceWallet>;
  powerRequirement?: number;
  commsRequirement?: number;
  localOnly?: boolean;
  remoteTargetMinBw?: number;
  placeholder?: boolean;
}

export interface ModuleInstanceConfig {
  monitorTarget?: AutomationTargetRef | null;
  target?: AutomationTargetRef | null;
  secondaryTarget?: AutomationTargetRef | null;
  inputModuleIds?: string[];
  comparison?: ">=" | "<=";
  threshold?: number;
  delayTicks?: number;
  transferAmount?: number;
  floorAmount?: number;
  desiredDoorState?: "open" | "closed";
}

export interface ModuleInstance {
  instanceId: string;
  moduleType: AutomationModuleType;
  category: AutomationModuleCategory;
  installedNodeId: string;
  installedRoomId?: RoomId | null;
  installedAnnexId?: string | null;
  configuration: ModuleInstanceConfig;
  active: boolean;
}

export interface PartitionDefinition {
  id: PartitionType;
  displayName: string;
  partitionType: PartitionType;
  buildCost: Partial<ResourceWallet>;
  powerRequirement?: number;
}

export interface PartitionInstance {
  edgeId: string;
  partitionType: PartitionType;
  state: "open" | "closed";
  automationHooks?: {
    controllingModuleIds?: string[];
  };
}

export interface TheaterAutomationModuleRuntime {
  lastOutput: AutomationSignalValue;
  active: boolean;
  latched: boolean;
  timerTicks: number;
  storedAmount: number;
  lastTriggeredTick: number;
}

export interface TheaterAutomationRuntimeState {
  moduleInstancesById: Record<string, ModuleInstance>;
  moduleRuntimeById: Record<string, TheaterAutomationModuleRuntime>;
  powerOverlayByRoomId: Record<RoomId, number>;
  supplyOverlayByRoomId: Record<RoomId, number>;
  commsOverlayByRoomId: Record<RoomId, number>;
  activeSignalSnapshots: AutomationSignalSnapshot[];
}

export type CoreNetworkOutputMode = "fixed" | "add_input";

export interface CoreBuildDefinition {
  id: CoreType;
  displayName: string;
  shortCode?: string;
  category: CoreBuildCategory;
  description: string;
  operationalRequirements?: {
    powerWatts?: number;
    commsBw?: number;
    supplyCrates?: number;
  };
  powerOutputWatts?: number;
  powerOutputMode?: CoreNetworkOutputMode;
  commsOutputBw?: number;
  commsOutputMode?: CoreNetworkOutputMode;
  supplyOutputCrates?: number;
  supplyOutputMode?: CoreNetworkOutputMode;
  buildCost: Partial<GameState["resources"]>;
  upkeep: Partial<GameState["resources"]>;
  wadUpkeepPerTick: number;
  incomePerTick: Partial<GameState["resources"]>;
  supportRadius: number;
  unlockSource: "starter" | "schema";
  unlockCost?: Partial<GameState["resources"]>;
  unlockWadCost?: number;
  preferredRoomTags?: TheaterRoomTag[];
  tagOutputModifiers?: Array<{
    tag: TheaterRoomTag;
    output: Partial<GameState["resources"]>;
    note?: string;
  }>;
  placeholder?: boolean;
}

export interface FortificationDefinition {
  id: FortificationType;
  displayName: string;
  description: string;
  buildCost: Partial<GameState["resources"]>;
  unlockSource: "starter" | "schema";
  unlockCost?: Partial<GameState["resources"]>;
  unlockWadCost?: number;
  preferredRoomTags?: TheaterRoomTag[];
  placeholder?: boolean;
}

export interface TheaterObjectiveProgress {
  cratesDelivered: number;
  ticksHeld: number;
  powerRouted: number;
  bwEstablished: number;
  builtCoreType: CoreType | null;
  completed: boolean;
}

export interface TheaterObjectiveDefinition {
  objectiveType: TheaterObjectiveType;
  targetRoomId: RoomId;
  label: string;
  cratesRequired?: number;
  ticksRequired?: number;
  powerRequired?: number;
  bwRequired?: number;
  requiredCoreType?: CoreType | null;
  multiResource?: {
    crates?: number;
    power?: number;
    bw?: number;
  };
  progress: TheaterObjectiveProgress;
}

export interface TheaterSquadPreset {
  squadId: string;
  displayName: string;
  icon: string;
  colorKey: string;
  unitIds: UnitId[];
}

export interface TheaterDeploymentPreset {
  squads: TheaterSquadPreset[];
}

export interface TheaterSquadState {
  squadId: string;
  displayName: string;
  icon: string;
  colorKey: string;
  unitIds: UnitId[];
  currentRoomId: RoomId;
  currentNodeId?: string;
  currentTheaterId: string;
  bwRequired: number;
  bwAvailable: number;
  isInContact: boolean;
  status: TheaterSquadStatus;
  automationMode: TheaterSquadAutomationMode;
  autoStatus: TheaterSquadAutoStatus;
  autoTargetRoomId: RoomId | null;
}

export interface CoreAssignment {
  type: CoreType;
  assignedAtTick: number;
  buildCost: Partial<GameState["resources"]>;
  upkeepPerTick: Partial<GameState["resources"]>;
  wadUpkeepPerTick?: number;
  incomePerTick?: Partial<GameState["resources"]>;
  supportRadius: number;
}

export type FortificationPips = Record<FortificationType, number>;

export interface TheaterRoom {
  id: RoomId;
  theaterId: string;
  label: string;
  sectorTag: string;
  position: { x: number; y: number };
  localPosition: { x: number; y: number };
  depthFromUplink: number;
  isUplinkRoom: boolean;
  size: { width: number; height: number };
  roomClass?: TheaterRoomClass;
  adjacency: RoomId[];
  powerGateWatts?: Partial<Record<RoomId, number>>;
  status: RoomStatus;
  clearMode?: "battle" | "field" | "empty";
  fortificationCapacity?: number;
  coreSlotCapacity?: number;
  moduleSlotCapacity?: number;
  moduleSlots?: Array<string | null>;
  moduleSlotUpgradeLevel?: number;
  secured: boolean;
  fortified: boolean;
  coreAssignment: CoreAssignment | null;
  coreSlots?: Array<CoreAssignment | null>;
  underThreat: boolean;
  damaged: boolean;
  connected: boolean;
  powered: boolean;
  supplied: boolean;
  commsVisible: boolean;
  commsLinked: boolean;
  battleMapId?: string | null;
  placedFieldAssets?: Array<{
    id: string;
    type: FieldAssetType;
    x: number;
    y: number;
    active?: boolean;
    charges?: number;
  }>;
  fieldAssetRuntimeState?: Record<string, {
    destroyed?: boolean;
    consumed?: boolean;
    charges?: number;
  }>;
  supplyFlow: number;
  powerFlow: number;
  commsFlow: number;
  intelLevel: TheaterIntelLevel;
  fortificationPips: FortificationPips;
  tacticalEncounter: string | null;
  tags: TheaterRoomTag[];
  isPowerSource?: boolean;
  abandoned: boolean;
  requiredKeyType: TheaterKeyType | null;
  grantsKeyType: TheaterKeyType | null;
  keyCollected: boolean;
  enemySite?: {
    type: "staging";
    reserveStrength: number;
    dispatchInterval: number;
    nextDispatchTick: number;
    patrolStrength: number;
  } | null;
  battleSizeOverride?: {
    width: number;
    height: number;
  };
}

export interface ThreatState {
  id: string;
  type: TheaterThreatType;
  roomId: RoomId;
  sourceRoomId: RoomId;
  currentRoomId: RoomId;
  targetRoomId: RoomId;
  route: RoomId[];
  routeIndex: number;
  etaTick: number;
  strength: number;
  cause: string;
  severity: number;
  spawnedAtTick: number;
  active: boolean;
}

export interface TheaterObjectiveCompletion {
  roomId: RoomId;
  completedAtTick: number;
  reward: {
    wad: number;
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };
  recapLines: string[];
}

export interface TheaterDefinition {
  id: string;
  name: string;
  zoneName: string;
  theaterStatus: "active" | "warm" | "cold";
  currentState: AtlasTheaterState;
  operationId: string;
  objective: string;
  recommendedPWR: number;
  beginningState: string;
  endState: string;
  floorId: string;
  floorOrdinal: number;
  sectorLabel: string;
  radialSlotIndex: number;
  radialSlotCount: number;
  angleDeg: number;
  radialDirection: RadialDirectionVector;
  discovered: boolean;
  operationAvailable: boolean;
  passiveEffectText: string;
  threatLevel: string;
  ingressRoomId: RoomId;
  uplinkRoomId: RoomId;
  outwardDepth: number;
  powerSourceRoomIds: RoomId[];
  mapAnchor?: { x: number; y: number };
  layoutStyle?: "vector_lance" | "split_fan" | "central_bloom" | "offset_arc";
  originLabel?: string;
  floorKeyInventory: TheaterKeyInventory;
}

export interface TheaterNetworkState {
  definition: TheaterDefinition;
  rooms: Record<RoomId, TheaterRoom>;
  currentRoomId: RoomId;
  selectedRoomId: RoomId;
  currentNodeId?: string;
  selectedNodeId?: string;
  annexesById?: Record<string, AnnexInstance>;
  partitionsByEdgeId?: Record<string, PartitionInstance>;
  automation?: TheaterAutomationRuntimeState;
  squads: TheaterSquadState[];
  selectedSquadId: string | null;
  tickCount: number;
  activeThreats: ThreatState[];
  recentEvents: string[];
  objectiveDefinition: TheaterObjectiveDefinition | null;
  objectiveComplete: boolean;
  completion: TheaterObjectiveCompletion | null;
}

// ============================================================================
// UNIT RECRUITMENT & PERFORMANCE SYSTEM (Headline 14a/14az)
// ============================================================================

/**
 * Affinity values for a unit (0-100 scale)
 * Tracks long-term combat preferences and specializations
 */
export interface UnitAffinities {
  melee: number;      // Melee attacks performed
  ranged: number;     // Ranged skills used
  magic: number;      // Spells cast
  support: number;    // Buffs/heals/shields applied
  mobility: number;   // Movement/mobility skills used
  survival: number;   // Damage taken and survived / operations completed
}

/**
 * Recruitment candidate unit (before hiring)
 */
export interface RecruitmentCandidate {
  id: string; // Temporary candidate ID
  name: string;
  portraitSeed?: string; // For appearance generation
  baseClass: string;
  currentClass: string;
  pwr: number;
  affinities: UnitAffinities;
  contractCost: number; // WAD cost for Standard Contract
  traits?: string[]; // 1-2 trait tags for display
  stats: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
}

export type EchoFieldId = "ember_zone" | "bastion_zone" | "flux_zone";
export type EchoEncounterType = "standard" | "elite" | "checkpoint";
export type EchoRunStage = "initial_units" | "initial_field" | "reward" | "results";
export type EchoChallengeType = "no_losses" | "turn_limit" | "field_triggers";
export type EchoRewardLane = "unit" | "field" | "modifier";
export type EchoRewardOptionType = "unit_draft" | "field_draft" | "field_upgrade" | "modifier_draft";

export interface EchoUnitDraftOption {
  id: string;
  name: string;
  baseClass: string;
  portraitPath?: string;
  pwr: number;
  pwrBand: import("./pwr").PWRBand;
  affinityLean: Array<keyof UnitAffinities>;
  affinities: UnitAffinities;
  traitLabel?: string | null;
  stats: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
  loadout: {
    primaryWeapon: string | null;
    secondaryWeapon: string | null;
    helmet: string | null;
    chestpiece: string | null;
    accessory1: string | null;
    accessory2: string | null;
  };
  loadoutPreview: string[];
}

export interface EchoFieldDefinition {
  draftId: string;
  id: EchoFieldId;
  name: string;
  description: string;
  effectLabel: string;
  color: string;
  level: number;
  maxLevel: number;
  radius: number;
}

export interface EchoFieldPlacement {
  draftId: string;
  fieldId: EchoFieldId;
  x: number;
  y: number;
  radius: number;
  level: number;
}

export interface EchoRewardChoice {
  id: string;
  lane: EchoRewardLane;
  optionType: EchoRewardOptionType;
  title: string;
  subtitle: string;
  description: string;
  unitOption?: EchoUnitDraftOption;
  fieldDefinition?: EchoFieldDefinition;
  modifierDefId?: string;
}

export interface EchoChallenge {
  id: string;
  type: EchoChallengeType;
  title: string;
  description: string;
  target: number;
  rewardRerolls: number;
  scoreBonus: number;
}

export interface EchoScoreSummary {
  totalScore: number;
  encountersCleared: number;
  unitsDrafted: number;
  unitsLost: number;
  fieldsDrafted: number;
  fieldsUpgraded: number;
  tacticalModifiersDrafted: number;
  challengesCompleted: number;
}

export interface EchoEncounterSummary {
  encounterNumber: number;
  encounterType: EchoEncounterType;
  challenge?: EchoChallenge | null;
  challengeCompleted: boolean;
  challengeFailed: boolean;
  rerollsEarned: number;
  scoreGained: number;
  survivingUnitIds: UnitId[];
  lostUnitIds: UnitId[];
  fieldTriggerCount: number;
  turnCount: number;
}

export interface EchoBattleContext {
  runId: string;
  encounterNumber: number;
  encounterType: EchoEncounterType;
  placementMode: "units" | "fields";
  availableFields: EchoFieldDefinition[];
  fieldPlacements: EchoFieldPlacement[];
  selectedFieldDraftId?: string | null;
  activeChallenge?: EchoChallenge | null;
  fieldTriggerCount: number;
  startUnitIds: UnitId[];
}

export interface SquadBattleTurnState {
  unitId: string | null;
  hasMoved: boolean;
  hasCommittedMove: boolean;
  hasActed: boolean;
  movementRemaining: number;
  originalPosition: { x: number; y: number } | null;
  isFacingSelection: boolean;
}

export type SquadBattleSide = "friendly" | "enemy";

export interface SquadBattleObjectiveState {
  kind: "control_relay" | "breakthrough";
  label: string;
  description: string;
  controlTiles: Array<{ x: number; y: number }>;
  breachTiles?: Record<SquadBattleSide, Array<{ x: number; y: number }>>;
  targetScore: number;
  score: Record<SquadBattleSide, number>;
  controllingSide: SquadBattleSide | null;
  winnerSide: SquadBattleSide | null;
  extractedUnitIds?: UnitId[];
}

export interface SquadBattleContext {
  matchId: string;
  hostSlot: SessionPlayerSlot;
  winCondition: SkirmishObjectiveType;
  mapId?: string | null;
  slotSides: Record<SessionPlayerSlot, SquadBattleSide | null>;
  slotCallsigns: Record<SessionPlayerSlot, string | null>;
  mapSeed: number;
  objective?: SquadBattleObjectiveState | null;
  turnState?: SquadBattleTurnState | null;
}

export interface BattleModeContext {
  kind: "story" | "training" | "endless" | "echo" | "squad";
  echo?: EchoBattleContext;
  squad?: SquadBattleContext;
}

export interface EchoRunState {
  id: string;
  seed: string;
  stage: EchoRunStage;
  encounterNumber: number;
  unitsById: Record<UnitId, Unit>;
  squadUnitIds: UnitId[];
  fields: EchoFieldDefinition[];
  tacticalModifiers: import("./fieldMods").FieldModInstance[];
  rerolls: number;
  draftChoices: EchoRewardChoice[];
  currentChallenge?: EchoChallenge | null;
  lastEncounterSummary?: EchoEncounterSummary | null;
  resultsSummary?: EchoScoreSummary | null;
  unitsDrafted: number;
  unitsLost: number;
  fieldsDrafted: number;
  fieldsUpgraded: number;
  tacticalModifiersDrafted: number;
  challengesCompleted: number;
  totalScore: number;
}

/**
 * Guild roster limits
 */
export const GUILD_ROSTER_LIMITS = {
  MAX_ACTIVE_PARTY: 10,
  MAX_TOTAL_MEMBERS: 30,
} as const;

// ---------------------------------------------------------
//  MOUNT SYSTEM
// ---------------------------------------------------------

export type MountId = string;

export type MountType =
  | "horse"      // Standard cavalry - balanced stats
  | "warhorse"   // Heavy cavalry - high HP, low AGI
  | "lizard"     // Reptilian mount - terrain flexibility
  | "mechanical" // Steam-powered - high stats, maintenance cost
  | "beast"      // Magical creature - special abilities
  | "bird";      // Flying mount - terrain ignore

export interface MountTerrainModifier {
  terrain: string;  // e.g. "mud", "plains", "forest", "water"
  effect: "ignore_penalty" | "bonus_movement" | "damage_reduction";
  value?: number;   // Amount for bonus_movement or damage_reduction
}

export interface MountStatModifiers {
  hp?: number;
  atk?: number;
  def?: number;
  agi?: number;
  acc?: number;
  movement?: number;  // Flat movement bonus
}

export type MountPassiveTrait =
  | "trample"        // Deal damage when moving through enemy tiles
  | "charge"         // Bonus damage when attacking after moving 3+ tiles
  | "surefooted"     // Immune to knockback/push effects
  | "swift"          // +1 movement on first turn
  | "armored"        // Reduce incoming damage by 1
  | "intimidate"     // Adjacent enemies have -10 ACC
  | "loyal"          // Mount cannot be removed by enemy effects
  | "heat_resistant" // Immune to burn status
  | "cold_resistant" // Immune to freeze status
  | "aquatic";       // Can traverse water tiles

export interface MountRestriction {
  type: "unit_class" | "armor_weight" | "unit_size";
  allowed?: string[];   // Allowed values (whitelist)
  disallowed?: string[]; // Disallowed values (blacklist)
}

/**
 * Mount definition - the template/data for a mount type
 */
export interface Mount {
  id: MountId;
  name: string;
  description: string;
  mountType: MountType;

  // Stat modifications applied when mounted
  statModifiers: MountStatModifiers;

  // Terrain-specific bonuses
  terrainModifiers: MountTerrainModifier[];

  // Passive traits/abilities
  passiveTraits: MountPassiveTrait[];

  // Cards added to unit's deck when mounted
  grantedCards: string[];

  // Restrictions on which units can use this mount
  restrictions: MountRestriction[];

  // Visual/flavor
  spriteId?: string;

  // Unlock/acquisition
  unlockCost?: number;         // WAD cost to unlock
  isStarterMount?: boolean;    // Available from game start
}

/**
 * Instance of a mount owned by the player
 * Tracks ownership and assignment state
 */
export interface OwnedMount {
  mountId: MountId;           // Reference to Mount definition
  instanceId: string;         // Unique instance ID
  assignedToUnitId: UnitId | null;  // Currently assigned unit
  condition?: number;         // 0-100, for wear/maintenance (mechanical mounts)
}

/**
 * Stable state - tracks unlocked mounts and assignments
 */
export interface StableState {
  unlockedMountIds: MountId[];        // Which mount types are unlocked
  ownedMounts: OwnedMount[];          // Mount instances the player owns
}

// ---------------------------------------------------------
//  INVENTORY
// ---------------------------------------------------------

export type MuleWeightClass = "E" | "D" | "C" | "B" | "A" | "S";

export interface InventoryItem {
  id: string;
  name: string;
  kind: "resource" | "equipment" | "consumable" | "unit";
  stackable: boolean;
  quantity: number;
  massKg: number;
  bulkBu: number;
  powerW: number;
  description?: string;
  iconPath?: string;
  metadata?: Record<string, unknown>;
}

export interface InventoryState {
  muleClass: MuleWeightClass;
  capacityMassKg: number;
  capacityBulkBu: number;
  capacityPowerW: number;

  forwardLocker: InventoryItem[];
  baseStorage: InventoryItem[];
}

// 10za load penalty flags

export interface LoadPenaltyFlags {
  massOver: boolean;
  bulkOver: boolean;
  powerOver: boolean;
  massPct: number;
  bulkPct: number;
  powerPct: number;
}

// ---------------------------------------------------------
//  GAME STATE
// ---------------------------------------------------------

export interface GameState {
  phase: "shell" | "battle" | "map" | "field" | "loadout" | "operation" | "atlas" | "echo";
  profile: PlayerProfile;
  operation: OperationRun | null;
  session: SessionState;
  lobby: LobbyState | null;
  unitsById: Record<UnitId, Unit>;
  cardsById: Record<CardId, Card>;
  partyUnitIds: UnitId[];
  theaterDeploymentPreset: TheaterDeploymentPreset;

  // Card Library - all cards the player owns (Headline 11da)
  cardLibrary: Record<string, number>;  // cardId -> count owned

  // Gear Slots - card configurations for each piece of equipment
  gearSlots: Record<string, GearSlotData>;  // equipmentId -> slot config

  equipmentById?: Record<string, any>;
  modulesById?: Record<string, any>;
  equipmentPool?: string[];

  wad: number;

  knownRecipeIds: string[];           // Recipe IDs the player knows
  consumables: Record<string, number>; // Consumable ID -> quantity

  // Legacy numeric counters (kept for compatibility but not used in UI)
  resources: ResourceWallet;
  schema?: SchemaUnlockState;
  foundry?: FoundryUnlockState;

  inventory: InventoryState;

  currentBattle: RuntimeBattleState | null;

  // Quest System
  quests?: import("../quests/types").QuestState;

  // Unit Recruitment System (Headline 14az)
  recruitmentCandidates?: RecruitmentCandidate[]; // Current pool of candidates at active recruitment hub

  // Class progression / mastery state
  unitClassProgress?: Record<UnitId, import("./classes").UnitClassProgress>;

  // Local Co-op System
  players: Record<PlayerSlot, Player>;

  // Port System - Base Camp Visit Tracking
  baseCampVisitIndex?: number; // Increments each time player enters base camp
  portManifest?: import("./portTrades").PortManifest; // Current port manifest
  portTradesRemaining?: number; // Tracks remaining normal trades this visit (max 2)

  // Quarters System
  quarters?: {
    mail?: import("./mailSystem").MailState;
    buffs?: import("./quartersBuffs").QuartersBuffsState;
    decor?: import("./decorSystem").DecorState;
    pinboard?: {
      completedOperations?: string[];
      failedOperations?: string[];
      log?: Array<{ timestamp: number; message: string }>;
    };
  };
  tavern?: {
    queuedMealBuff?: import("./tavernMeals").TavernMealBuff | null;
    activeRunMealBuff?: import("./tavernMeals").TavernMealBuff | null;
  };
  // Field Mods System - Run inventory (synced from ActiveRunState)
  runFieldModInventory?: import("./fieldMods").FieldModInstance[];
  unitHardpoints?: Record<UnitId, import("./fieldMods").HardpointState>;

  // Gear Builder System - Unlock flags
  unlockedChassisIds?: string[];
  unlockedDoctrineIds?: string[];

  // Codex System - Meta progression
  unlockedCodexEntries?: string[];
  completedDialogueIds?: string[];

  // Dispatch / Expeditions
  dispatch?: import("./dispatchSystem").DispatchState;

  // Mount/Stable System
  stable?: StableState;

  // Lightweight UI persistence for shell/menu layout customizations
  uiLayout?: UILayoutState;

  // Tracks one-time Technica content merges into existing saves.
  technicaSync?: {
    starterGearIds?: string[];
  };
}

interface GearSlotData {
  lockedCards: string[];    // Permanent cards that come with gear
  freeSlots: number;        // Number of customizable slots
  slottedCards: string[];   // Player-chosen cards in free slots
}
