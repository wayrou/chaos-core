import {
  AtlasTheaterState,
  CoreType,
  GameState,
  OperationRun,
  TheaterKeyInventory,
  TheaterKeyType,
  TheaterNetworkState,
  TheaterRoom,
  TheaterSprawlDirection,
} from "./types";
import {
  CampaignProgress,
  completeOperation,
  loadCampaignProgress,
  OperationId,
  saveCampaignProgress,
} from "./campaign";
import {
  buildCampaignRegionZoneName,
  getActiveRegionPresentation,
} from "./campaignRegions";
import {
  ensureOperationHasTheater,
  getTheaterCoreOfflineReason,
  getTheaterUpkeepPerTick,
  isTheaterCoreOperational,
} from "./theaterSystem";
import {
  addResourceWallet as addResourceWalletValues,
  createEmptyResourceWallet,
  RESOURCE_KEYS,
} from "./resources";
import {
  getLocalSessionPlayerSlot,
  getSessionResourcePool,
  grantSessionResources,
  spendSessionCost,
} from "./session";

export interface OpsTerminalAtlasSectorState {
  theaterId: string;
  operationId: string;
  linkedOperationId?: OperationId;
  floorId: string;
  floorOrdinal: number;
  sectorIndex: number;
  sectorLabel: string;
  zoneName: string;
  codename: string;
  description: string;
  sprawlDirection: TheaterSprawlDirection;
  passiveEffectText: string;
  threatLevel: string;
  theater: TheaterNetworkState;
}

export interface OpsTerminalAtlasFloorState {
  floorId: string;
  floorLabel: string;
  floorOrdinal: number;
  discovered: boolean;
  keyInventory: TheaterKeyInventory;
  sectors: OpsTerminalAtlasSectorState[];
}

export interface OpsTerminalAtlasState {
  seed: string;
  generationVersion: number;
  currentFloorOrdinal: number;
  lastEnteredTheaterId?: string;
  floorsById: Record<string, OpsTerminalAtlasFloorState>;
}

export interface OpsTerminalAtlasEconomySummary {
  theaterId: string;
  floorId: string;
  floorOrdinal: number;
  sectorLabel: string;
  zoneName: string;
  currentState: AtlasTheaterState;
  tickCount: number;
  wadUpkeepPerTick: number;
  incomePerTick: GameState["resources"];
}

export interface OpsTerminalAtlasCoreSummary {
  theaterId: string;
  floorId: string;
  floorOrdinal: number;
  sectorLabel: string;
  zoneName: string;
  roomId: string;
  roomLabel: string;
  coreType: CoreType;
  currentState: AtlasTheaterState;
  operational: boolean;
  offlineReason: "damaged" | "low_supply" | "low_power" | "low_comms" | null;
  wadUpkeepPerTick: number;
  incomePerTick: GameState["resources"];
  supplyFlow: number;
  powerFlow: number;
  commsFlow: number;
}

export const OPS_ATLAS_MAP_WIDTH = 6200;
export const OPS_ATLAS_MAP_HEIGHT = 6200;
export const OPS_ATLAS_HAVEN_ANCHOR = { x: 3100, y: 3100 };

const OPS_ATLAS_SECTOR_PREFIX = "ops_atlas_sector";
const OPS_ATLAS_OPERATION_PREFIX = "op_ops_atlas";
const OPS_ATLAS_SEED_KEY = "ops_terminal_atlas_seed";
const OPS_ATLAS_GENERATION_VERSION = 3;
const LEGACY_OPERATION_LINKS: OperationId[] = [
  "op_iron_gate",
  "op_black_spire",
  "op_ghost_run",
  "op_ember_siege",
  "op_final_dawn",
];
const DIRECTION_ORDER: TheaterSprawlDirection[] = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
];

const KEY_TYPES: TheaterKeyType[] = ["triangle", "square", "circle", "spade", "star"];

type SeededRng = {
  nextFloat: () => number;
  nextInt: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
};

type ResourceWallet = GameState["resources"];

function createSeededRng(seed: string): SeededRng {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let state = hash >>> 0;
  const step = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };

  return {
    nextFloat: () => step() / 4294967295,
    nextInt: (min: number, max: number) => {
      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      return lower + Math.floor((step() / 4294967295) * (upper - lower + 1));
    },
    pick: <T>(items: T[]): T => items[Math.floor((step() / 4294967295) * items.length)] ?? items[0],
  };
}

function cloneTheater(theater: TheaterNetworkState): TheaterNetworkState {
  return JSON.parse(JSON.stringify(theater)) as TheaterNetworkState;
}

function cloneSector(sector: OpsTerminalAtlasSectorState): OpsTerminalAtlasSectorState {
  return {
    ...sector,
    theater: cloneTheater(sector.theater),
  };
}

function cloneFloor(floor: OpsTerminalAtlasFloorState): OpsTerminalAtlasFloorState {
  return {
    ...floor,
    keyInventory: { ...floor.keyInventory },
    sectors: floor.sectors.map(cloneSector),
  };
}

function cloneAtlasState(state: OpsTerminalAtlasState): OpsTerminalAtlasState {
  return {
    ...state,
    floorsById: Object.fromEntries(
      Object.entries(state.floorsById).map(([floorId, floor]) => [floorId, cloneFloor(floor)]),
    ),
  };
}

function addResourceWallet(base: ResourceWallet, delta: Partial<ResourceWallet>): ResourceWallet {
  return addResourceWalletValues(base, delta);
}

function scaleResourceWallet(wallet: Partial<ResourceWallet>, ticks: number): ResourceWallet {
  const scaled = createEmptyResourceWallet();
  RESOURCE_KEYS.forEach((key) => {
    scaled[key] = (wallet[key] ?? 0) * ticks;
  });
  return scaled;
}

function hasPositiveResourceGain(wallet: Partial<ResourceWallet> | null | undefined): boolean {
  return RESOURCE_KEYS.some((key) => Number(wallet?.[key] ?? 0) > 0);
}

function createEmptyKeyInventory(): TheaterKeyInventory {
  return {
    triangle: false,
    square: false,
    circle: false,
    spade: false,
    star: false,
  };
}

function cloneKeyInventory(inventory?: Partial<TheaterKeyInventory> | null): TheaterKeyInventory {
  return {
    triangle: Boolean(inventory?.triangle),
    square: Boolean(inventory?.square),
    circle: Boolean(inventory?.circle),
    spade: Boolean(inventory?.spade),
    star: Boolean(inventory?.star),
  };
}

function mergeKeyInventories(...inventories: Array<Partial<TheaterKeyInventory> | null | undefined>): TheaterKeyInventory {
  return inventories.reduce<TheaterKeyInventory>((merged, inventory) => ({
    triangle: merged.triangle || Boolean(inventory?.triangle),
    square: merged.square || Boolean(inventory?.square),
    circle: merged.circle || Boolean(inventory?.circle),
    spade: merged.spade || Boolean(inventory?.spade),
    star: merged.star || Boolean(inventory?.star),
  }), createEmptyKeyInventory());
}

function applyFloorKeyInventoryToSector(sector: OpsTerminalAtlasSectorState, keyInventory: TheaterKeyInventory): void {
  sector.theater.definition.floorKeyInventory = cloneKeyInventory(keyInventory);
}

function syncFloorKeyInventoryToSectors(floor: OpsTerminalAtlasFloorState): OpsTerminalAtlasFloorState {
  floor.keyInventory = cloneKeyInventory(floor.keyInventory);
  floor.sectors.forEach((sector) => {
    applyFloorKeyInventoryToSector(sector, floor.keyInventory);
  });
  return floor;
}

function createAtlasSeed(): string {
  return `${OPS_ATLAS_SEED_KEY}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getFloorId(floorOrdinal: number): string {
  return `ops_atlas_floor_${String(floorOrdinal).padStart(2, "0")}`;
}

function getSectorId(floorOrdinal: number, sectorIndex: number): string {
  return `${OPS_ATLAS_SECTOR_PREFIX}_${String(floorOrdinal).padStart(2, "0")}_${String(sectorIndex + 1).padStart(2, "0")}`;
}

function getOperationId(floorOrdinal: number, sectorIndex: number): string {
  return `${OPS_ATLAS_OPERATION_PREFIX}_${String(floorOrdinal).padStart(2, "0")}_${String(sectorIndex + 1).padStart(2, "0")}`;
}

function getSectorCompassLabel(direction: TheaterSprawlDirection): string {
  switch (direction) {
    case "north": return "N";
    case "northeast": return "NE";
    case "east": return "E";
    case "southeast": return "SE";
    case "south": return "S";
    case "southwest": return "SW";
    case "west": return "W";
    case "northwest": return "NW";
  }
}

function formatFloorLabel(floorOrdinal: number): string {
  const presentation = getActiveRegionPresentation(floorOrdinal);
  return `FLOOR ${String(floorOrdinal).padStart(2, "0")} // ${presentation.regionName.toUpperCase()} SURVEY`;
}

function resolveSectorState(
  atlas: OpsTerminalAtlasState,
  sector: OpsTerminalAtlasSectorState,
): AtlasTheaterState {
  if (!sector.theater.definition.discovered) {
    return "undiscovered";
  }

  if (sector.floorOrdinal !== atlas.currentFloorOrdinal) {
    return "cold";
  }

  if (atlas.lastEnteredTheaterId && sector.theaterId === atlas.lastEnteredTheaterId) {
    return "active";
  }

  return "warm";
}

function applyPresentationStateToSector(
  atlas: OpsTerminalAtlasState,
  sector: OpsTerminalAtlasSectorState,
): void {
  const currentState = resolveSectorState(atlas, sector);
  sector.theater.definition.currentState = currentState;
  sector.theater.definition.theaterStatus = currentState === "cold"
    ? "cold"
    : currentState === "warm"
      ? "warm"
      : "active";
}

function decorateAtlasState(atlas: OpsTerminalAtlasState): OpsTerminalAtlasState {
  const nextAtlas = cloneAtlasState(atlas);
  Object.values(nextAtlas.floorsById).forEach((floor) => {
    floor.sectors.forEach((sector) => {
      applyPresentationStateToSector(nextAtlas, sector);
    });
  });
  return nextAtlas;
}

function createEconomySummary(
  atlas: OpsTerminalAtlasState,
  sector: OpsTerminalAtlasSectorState,
): OpsTerminalAtlasEconomySummary {
  const economy = getTheaterUpkeepPerTick(sector.theater);
  return {
    theaterId: sector.theaterId,
    floorId: sector.floorId,
    floorOrdinal: sector.floorOrdinal,
    sectorLabel: sector.sectorLabel,
    zoneName: sector.zoneName,
    currentState: resolveSectorState(atlas, sector),
    tickCount: sector.theater.tickCount ?? 0,
    wadUpkeepPerTick: economy.wadUpkeep,
    incomePerTick: createEmptyResourceWallet(economy.incomePerTick),
  };
}

function createCoreSummary(
  atlas: OpsTerminalAtlasState,
  sector: OpsTerminalAtlasSectorState,
  room: TheaterRoom,
): OpsTerminalAtlasCoreSummary {
  const coreAssignment = room.coreAssignment!;
  return {
    theaterId: sector.theaterId,
    floorId: sector.floorId,
    floorOrdinal: sector.floorOrdinal,
    sectorLabel: sector.sectorLabel,
    zoneName: sector.zoneName,
    roomId: room.id,
    roomLabel: room.label,
    coreType: coreAssignment.type,
    currentState: resolveSectorState(atlas, sector),
    operational: isTheaterCoreOperational(room),
    offlineReason: getTheaterCoreOfflineReason(room),
    wadUpkeepPerTick: coreAssignment.wadUpkeepPerTick ?? 0,
    incomePerTick: createEmptyResourceWallet(coreAssignment.incomePerTick),
    supplyFlow: room.supplyFlow ?? 0,
    powerFlow: room.powerFlow ?? 0,
    commsFlow: room.commsFlow ?? 0,
  };
}

function hasEconomyActivity(summary: OpsTerminalAtlasEconomySummary): boolean {
  return (
    summary.wadUpkeepPerTick > 0
    || RESOURCE_KEYS.some((key) => summary.incomePerTick[key] > 0)
  );
}

function isOperationalEconomyState(state: AtlasTheaterState): boolean {
  return state === "warm" || state === "active";
}

function findSectorInAtlas(
  atlas: OpsTerminalAtlasState,
  theaterId: string,
): { floor: OpsTerminalAtlasFloorState; sector: OpsTerminalAtlasSectorState } | null {
  for (const floor of Object.values(atlas.floorsById)) {
    const sector = floor.sectors.find((entry) => entry.theaterId === theaterId);
    if (sector) {
      return { floor, sector };
    }
  }
  return null;
}

function shuffleInPlace<T>(items: T[], rng: SeededRng): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextInt(0, index);
    const current = items[index];
    items[index] = items[swapIndex]!;
    items[swapIndex] = current!;
  }
  return items;
}

function findObjectiveRoom(theater: TheaterNetworkState): TheaterRoom | null {
  return Object.values(theater.rooms).find((room) => room.tags.includes("objective")) ?? null;
}

function findObjectivePath(theater: TheaterNetworkState): string[] {
  const originId = theater.definition.uplinkRoomId;
  const objectiveRoom = findObjectiveRoom(theater);
  if (!objectiveRoom) {
    return [originId];
  }

  const queue: string[] = [originId];
  const previous = new Map<string, string | null>([[originId, null]]);

  while (queue.length > 0) {
    const currentRoomId = queue.shift()!;
    if (currentRoomId === objectiveRoom.id) {
      break;
    }

    const room = theater.rooms[currentRoomId];
    if (!room) {
      continue;
    }

    room.adjacency.forEach((adjacentId) => {
      if (!theater.rooms[adjacentId] || previous.has(adjacentId)) {
        return;
      }
      previous.set(adjacentId, currentRoomId);
      queue.push(adjacentId);
    });
  }

  if (!previous.has(objectiveRoom.id)) {
    return [originId, objectiveRoom.id];
  }

  const route: string[] = [];
  let cursor: string | null = objectiveRoom.id;
  while (cursor) {
    route.push(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return route.reverse();
}

function chooseLockRoomIdOnObjectivePath(
  theater: TheaterNetworkState,
  path: string[],
  usedRoomIds: Set<string>,
  rng: SeededRng,
): string | null {
  const preferredCandidates = path
    .slice(1, Math.max(1, path.length - 1))
    .filter((roomId) => {
      const room = theater.rooms[roomId];
      return Boolean(
        room
        && !usedRoomIds.has(roomId)
        && !room.isUplinkRoom
        && !room.grantsKeyType
        && room.depthFromUplink >= 2,
      );
    });
  const candidates = preferredCandidates.length > 0 ? preferredCandidates : path.slice(1, Math.max(1, path.length - 1));
  if (candidates.length === 0) {
    return path[path.length - 1] ?? null;
  }

  const lateStartIndex = Math.floor(candidates.length * 0.45);
  const weightedPool = candidates.slice(lateStartIndex);
  return rng.pick(weightedPool.length > 0 ? weightedPool : candidates);
}

function chooseKeyRoomId(
  theater: TheaterNetworkState,
  path: string[],
  lockRoomId: string | null,
  usedRoomIds: Set<string>,
  rng: SeededRng,
): string | null {
  const lockIndex = lockRoomId ? path.indexOf(lockRoomId) : -1;
  const startIndex = lockIndex >= 0 ? Math.min(path.length - 1, lockIndex + 1) : Math.max(1, path.length - 2);
  const preferredCandidates = path
    .slice(startIndex)
    .filter((roomId) => {
      const room = theater.rooms[roomId];
      return Boolean(room && !usedRoomIds.has(roomId) && !room.requiredKeyType);
    });
  if (preferredCandidates.length === 0) {
    const fallbackRoom = path[path.length - 1] ?? null;
    return fallbackRoom && !usedRoomIds.has(fallbackRoom) ? fallbackRoom : null;
  }

  const lateStartIndex = Math.floor(preferredCandidates.length * 0.55);
  const weightedPool = preferredCandidates.slice(lateStartIndex);
  return rng.pick(weightedPool.length > 0 ? weightedPool : preferredCandidates);
}

function assignFloorLocksAndKeys(
  floor: OpsTerminalAtlasFloorState,
  rng: SeededRng,
): OpsTerminalAtlasFloorState {
  const nextFloor = cloneFloor(floor);
  nextFloor.keyInventory = createEmptyKeyInventory();
  syncFloorKeyInventoryToSectors(nextFloor);

  nextFloor.sectors.forEach((sector) => {
    Object.values(sector.theater.rooms).forEach((room) => {
      room.requiredKeyType = null;
      room.grantsKeyType = null;
      room.keyCollected = false;
    });
  });

  const sectorOrder = shuffleInPlace(nextFloor.sectors.map((_, index) => index), rng);
  const keyOrder = shuffleInPlace([...KEY_TYPES], rng);
  const maxChainLength = Math.min(4, Math.max(2, nextFloor.sectors.length - 3));
  const chainLength = Math.min(keyOrder.length, Math.max(2, rng.nextInt(2, maxChainLength)));
  const chainSectorIndexes = sectorOrder.slice(0, chainLength + 1);
  const usedKeyRoomIds = new Set<string>();
  const usedLockRoomIds = new Set<string>();
  const lockRoomIdBySectorIndex = new Map<number, string>();

  for (let chainIndex = 0; chainIndex < chainLength; chainIndex += 1) {
    const keyType = keyOrder[chainIndex]!;
    const sourceSectorIndex = chainSectorIndexes[chainIndex]!;
    const targetSectorIndex = chainSectorIndexes[chainIndex + 1]!;
    const sourceSector = nextFloor.sectors[sourceSectorIndex];
    const targetSector = nextFloor.sectors[targetSectorIndex];
    if (!sourceSector || !targetSector) {
      continue;
    }

    const sourcePath = findObjectivePath(sourceSector.theater);
    const inheritedLockRoomId = lockRoomIdBySectorIndex.get(sourceSectorIndex) ?? null;
    const keyRoomId = chooseKeyRoomId(sourceSector.theater, sourcePath, inheritedLockRoomId, usedKeyRoomIds, rng);
    if (keyRoomId && sourceSector.theater.rooms[keyRoomId]) {
      sourceSector.theater.rooms[keyRoomId]!.grantsKeyType = keyType;
      sourceSector.theater.rooms[keyRoomId]!.keyCollected = false;
      usedKeyRoomIds.add(keyRoomId);
    }

    const targetPath = findObjectivePath(targetSector.theater);
    const lockRoomId = chooseLockRoomIdOnObjectivePath(targetSector.theater, targetPath, usedLockRoomIds, rng);
    if (lockRoomId && targetSector.theater.rooms[lockRoomId]) {
      targetSector.theater.rooms[lockRoomId]!.requiredKeyType = keyType;
      usedLockRoomIds.add(lockRoomId);
      lockRoomIdBySectorIndex.set(targetSectorIndex, lockRoomId);
    }
  }

  return syncFloorKeyInventoryToSectors(nextFloor);
}

function countActiveCores(theater: TheaterNetworkState): number {
  return Object.values(theater.rooms).filter((room) => room.coreAssignment).length;
}

function buildSectorOperationPrototype(
  floorOrdinal: number,
  floorId: string,
  sectorIndex: number,
  zoneName: string,
  codename: string,
  description: string,
  sprawlDirection: TheaterSprawlDirection,
  seed: string,
): OperationRun {
  return {
    id: getOperationId(floorOrdinal, sectorIndex),
    codename,
    description: `${description} // seed:${seed}`,
    objective: `Deploy into ${zoneName}, secure the outer objective room, and report back to HAVEN.`,
    recommendedPWR: Math.max(18, 16 + (floorOrdinal * 4) + sectorIndex),
    beginningState: `${zoneName} synchronized from the ops terminal atlas. Uplink-side ingress confirmed.`,
    endState: `${zoneName} stabilized. Sector remains charted in the floor atlas.`,
    floors: [
      {
        id: floorId,
        name: `${formatFloorLabel(floorOrdinal)} // ${zoneName}`,
        nodes: [],
      },
    ],
    currentFloorIndex: 0,
    currentRoomId: null,
    launchSource: "ops_terminal",
    atlasTheaterId: getSectorId(floorOrdinal, sectorIndex),
    atlasFloorId: floorId,
    sprawlDirection,
    theater: undefined,
    theaterFloors: undefined,
  };
}

function buildSectorTheater(
  floorOrdinal: number,
  floorId: string,
  sectorIndex: number,
  sprawlDirection: TheaterSprawlDirection,
  seed: string,
  rng: SeededRng,
): OpsTerminalAtlasSectorState {
  const regionPresentation = getActiveRegionPresentation(floorOrdinal);
  const sectorId = getSectorId(floorOrdinal, sectorIndex);
  const operationId = getOperationId(floorOrdinal, sectorIndex);
  const linkedOperationId = floorOrdinal === 1 ? LEGACY_OPERATION_LINKS[sectorIndex] : undefined;
  const sectorLabel = `SECTOR ${getSectorCompassLabel(sprawlDirection)}-${String(sectorIndex + 1).padStart(2, "0")}`;
  const zoneName = buildCampaignRegionZoneName(floorOrdinal, rng.pick);
  const codename = zoneName;
  const passiveEffectText = regionPresentation.passiveEffectText;
  const threatLevel = regionPresentation.threatLevel;
  const description = `${regionPresentation.regionName} Region // ${regionPresentation.variantLabel} // ingress through ${sectorLabel}. Push from the HAVEN-facing uplink and stabilize the sector lattice.`;
  const prototype = buildSectorOperationPrototype(
    floorOrdinal,
    floorId,
    sectorIndex,
    zoneName,
    codename,
    description,
    sprawlDirection,
    seed,
  );
  const generatedOperation = ensureOperationHasTheater(prototype);
  const theater = generatedOperation?.theater ? cloneTheater(generatedOperation.theater) : null;
  if (!theater) {
    throw new Error(`Failed to generate sector theater for ${sectorId}`);
  }

  theater.definition.id = sectorId;
  theater.definition.name = zoneName;
  theater.definition.zoneName = zoneName;
  theater.definition.operationId = operationId;
  theater.definition.floorId = floorId;
  theater.definition.floorOrdinal = floorOrdinal;
  theater.definition.sectorLabel = sectorLabel;
  theater.definition.radialSlotIndex = sectorIndex;
  theater.definition.radialSlotCount = DIRECTION_ORDER.length;
  theater.definition.discovered = true;
  theater.definition.operationAvailable = true;
  theater.definition.currentState = "active";
  theater.definition.theaterStatus = "active";
  theater.definition.passiveEffectText = passiveEffectText;
  theater.definition.threatLevel = threatLevel;
  theater.definition.recommendedPWR = prototype.recommendedPWR ?? theater.definition.recommendedPWR;
  theater.definition.beginningState = prototype.beginningState ?? theater.definition.beginningState;
  theater.definition.endState = prototype.endState ?? theater.definition.endState;
  theater.definition.floorKeyInventory = createEmptyKeyInventory();
  theater.currentRoomId = theater.definition.uplinkRoomId;
  theater.selectedRoomId = theater.definition.uplinkRoomId;
  theater.recentEvents = [
    `A.T.L.A.S. :: ${zoneName} generated on ${formatFloorLabel(floorOrdinal)}. Sector vector ${sectorLabel}; origin ${theater.definition.originLabel ?? "EDGE INSERT"}.`,
    ...theater.recentEvents.slice(0, 5),
  ];
  theater.rooms = Object.fromEntries(
    Object.entries(theater.rooms).map(([roomId, room]) => [
      roomId,
      {
        ...room,
        theaterId: sectorId,
      },
    ]),
  );

  return {
    theaterId: sectorId,
    operationId,
    linkedOperationId,
    floorId,
    floorOrdinal,
    sectorIndex,
    sectorLabel,
    zoneName,
    codename,
    description,
    sprawlDirection,
    passiveEffectText,
    threatLevel,
    theater,
  };
}

function createFloorState(seed: string, floorOrdinal: number): OpsTerminalAtlasFloorState {
  const floorId = getFloorId(floorOrdinal);
  const floorSeed = `${seed}:${floorId}`;
  const rng = createSeededRng(floorSeed);
  return assignFloorLocksAndKeys({
    floorId,
    floorLabel: formatFloorLabel(floorOrdinal),
    floorOrdinal,
    discovered: true,
    keyInventory: createEmptyKeyInventory(),
    sectors: DIRECTION_ORDER.map((direction, sectorIndex) => (
      buildSectorTheater(
        floorOrdinal,
        floorId,
        sectorIndex,
        direction,
        `${floorSeed}:${sectorIndex}`,
        createSeededRng(`${floorSeed}:${sectorIndex}:${direction}:${rng.nextInt(0, 99999)}`),
      )
    )),
  }, rng);
}

function ensureFloorGenerated(atlas: OpsTerminalAtlasState, floorOrdinal: number): OpsTerminalAtlasState {
  const floorId = getFloorId(floorOrdinal);
  if (atlas.floorsById[floorId]) {
    return atlas;
  }

  return {
    ...atlas,
    floorsById: {
      ...atlas.floorsById,
      [floorId]: createFloorState(atlas.seed, floorOrdinal),
    },
  };
}

function ensureCurrentFloorInitialized(progress: CampaignProgress): CampaignProgress {
  const existingAtlas = progress.opsTerminalAtlas;
  const needsRegeneration =
    Boolean(existingAtlas) && existingAtlas?.generationVersion !== OPS_ATLAS_GENERATION_VERSION;
  const highestKnownFloorOrdinal = existingAtlas
    ? Math.max(
        existingAtlas.currentFloorOrdinal,
        ...Object.values(existingAtlas.floorsById).map((floor) => floor.floorOrdinal),
      )
    : 1;
  let baseAtlas: OpsTerminalAtlasState = existingAtlas && !needsRegeneration
    ? cloneAtlasState(existingAtlas)
    : {
        seed: existingAtlas?.seed ?? createAtlasSeed(),
        generationVersion: OPS_ATLAS_GENERATION_VERSION,
        currentFloorOrdinal: Math.max(1, existingAtlas?.currentFloorOrdinal ?? 1),
        lastEnteredTheaterId: undefined,
        floorsById: {},
      };

  if (!existingAtlas) {
    baseAtlas.generationVersion = OPS_ATLAS_GENERATION_VERSION;
  }

  if (needsRegeneration) {
    for (let floorOrdinal = 1; floorOrdinal <= highestKnownFloorOrdinal; floorOrdinal += 1) {
      baseAtlas = ensureFloorGenerated(baseAtlas, floorOrdinal);
    }
  }

  const atlasWithCurrentFloor = decorateAtlasState(
    ensureFloorGenerated(baseAtlas, Math.max(1, baseAtlas.currentFloorOrdinal)),
  );
  if (existingAtlas && JSON.stringify(existingAtlas) === JSON.stringify(atlasWithCurrentFloor)) {
    return progress;
  }

  return {
    ...progress,
    opsTerminalAtlas: atlasWithCurrentFloor,
  };
}

function updateCurrentFloorIfCleared(progress: CampaignProgress): CampaignProgress {
  if (!progress.opsTerminalAtlas) {
    return progress;
  }

  const atlas = cloneAtlasState(progress.opsTerminalAtlas);
  const currentFloorId = getFloorId(atlas.currentFloorOrdinal);
  const currentFloor = atlas.floorsById[currentFloorId];
  if (!currentFloor) {
    return progress;
  }

  const allSectorsComplete = currentFloor.sectors.every((sector) => sector.theater.objectiveComplete);
  if (!allSectorsComplete) {
    return progress;
  }

  atlas.currentFloorOrdinal += 1;
  atlas.lastEnteredTheaterId = undefined;
  const withNextFloor = decorateAtlasState(ensureFloorGenerated(atlas, atlas.currentFloorOrdinal));
  return {
    ...progress,
    opsTerminalAtlas: withNextFloor,
  };
}

export function loadOpsTerminalAtlasProgress(): CampaignProgress {
  const progress = loadCampaignProgress();
  const initialized = ensureCurrentFloorInitialized(progress);
  if (initialized !== progress) {
    saveCampaignProgress(initialized);
  }
  return initialized;
}

export function getCurrentOpsTerminalAtlasFloor(
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): OpsTerminalAtlasFloorState {
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = decorateAtlasState(ensured.opsTerminalAtlas!);
  const floor = atlas.floorsById[getFloorId(atlas.currentFloorOrdinal)];
  if (!floor) {
    throw new Error("Current ops terminal atlas floor is not available.");
  }
  return cloneFloor(floor);
}

export function getOpsTerminalAtlasWarmEconomySummaries(
  floorOrdinal?: number,
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): OpsTerminalAtlasEconomySummary[] {
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = decorateAtlasState(ensured.opsTerminalAtlas!);
  const resolvedFloorOrdinal = floorOrdinal ?? atlas.currentFloorOrdinal;
  const floor = atlas.floorsById[getFloorId(resolvedFloorOrdinal)];
  if (!floor) {
    return [];
  }

  return floor.sectors
    .filter((sector) => isOperationalEconomyState(resolveSectorState(atlas, sector)))
    .map((sector) => createEconomySummary(atlas, sector))
    .filter(hasEconomyActivity);
}

export function getOpsTerminalAtlasOtherWarmEconomySummaries(
  activeTheaterId: string,
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): OpsTerminalAtlasEconomySummary[] {
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = decorateAtlasState(ensured.opsTerminalAtlas!);
  const located = findSectorInAtlas(atlas, activeTheaterId);
  if (!located) {
    return [];
  }

  return located.floor.sectors
    .filter((sector) => sector.theaterId !== activeTheaterId && resolveSectorState(atlas, sector) === "warm")
    .map((sector) => createEconomySummary(atlas, sector))
    .filter(hasEconomyActivity);
}

export function getHighestGeneratedOpsTerminalAtlasFloorOrdinal(
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): number {
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = ensured.opsTerminalAtlas;
  if (!atlas) {
    return 1;
  }

  return Math.max(
    atlas.currentFloorOrdinal,
    ...Object.values(atlas.floorsById).map((floor) => floor.floorOrdinal),
  );
}

export function setCurrentOpsTerminalAtlasFloorOrdinal(
  floorOrdinal: number,
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
  allowObjectiveBypass = false,
): OpsTerminalAtlasFloorState {
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = ensured.opsTerminalAtlas ? cloneAtlasState(ensured.opsTerminalAtlas) : null;
  if (!atlas) {
    throw new Error("Ops terminal atlas state is not initialized.");
  }

  const nextFloorOrdinal = Math.max(1, Math.floor(floorOrdinal || 1));
  const currentFloor = atlas.floorsById[getFloorId(atlas.currentFloorOrdinal)];
  if (nextFloorOrdinal > atlas.currentFloorOrdinal) {
    const currentFloorComplete = Boolean(currentFloor?.sectors.every((sector) => sector.theater.objectiveComplete));
    if (!currentFloorComplete && !allowObjectiveBypass) {
      throw new Error("Clear every sector objective on the current floor before descending.");
    }
  }

  const nextAtlas = decorateAtlasState({
    ...ensureFloorGenerated(atlas, nextFloorOrdinal),
    currentFloorOrdinal: nextFloorOrdinal,
  });

  saveCampaignProgress({
    ...ensured,
    opsTerminalAtlas: nextAtlas,
  });

  const nextFloor = nextAtlas.floorsById[getFloorId(nextFloorOrdinal)];
  if (!nextFloor) {
    throw new Error(`Ops terminal atlas floor ${nextFloorOrdinal} could not be generated.`);
  }

  return cloneFloor(nextFloor);
}

export function regenerateOpsTerminalAtlasFloor(
  floorOrdinal?: number,
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): OpsTerminalAtlasFloorState {
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = ensured.opsTerminalAtlas ? cloneAtlasState(ensured.opsTerminalAtlas) : null;
  if (!atlas) {
    throw new Error("Ops terminal atlas state is not initialized.");
  }

  const targetFloorOrdinal = Math.max(1, Math.floor(floorOrdinal || atlas.currentFloorOrdinal || 1));
  const floorId = getFloorId(targetFloorOrdinal);
  const replacementFloor = createFloorState(createAtlasSeed(), targetFloorOrdinal);
  const nextAtlas = decorateAtlasState({
    ...atlas,
    currentFloorOrdinal: targetFloorOrdinal,
    lastEnteredTheaterId: undefined,
    floorsById: {
      ...atlas.floorsById,
      [floorId]: replacementFloor,
    },
  });

  saveCampaignProgress({
    ...ensured,
    opsTerminalAtlas: nextAtlas,
  });

  return cloneFloor(replacementFloor);
}

export function restartOpsTerminalAtlas(
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): OpsTerminalAtlasFloorState {
  const ensured = ensureCurrentFloorInitialized(progress);
  const nextAtlas = decorateAtlasState(ensureFloorGenerated({
    seed: createAtlasSeed(),
    generationVersion: OPS_ATLAS_GENERATION_VERSION,
    currentFloorOrdinal: 1,
    lastEnteredTheaterId: undefined,
    floorsById: {},
  }, 1));

  saveCampaignProgress({
    ...ensured,
    opsTerminalAtlas: nextAtlas,
  });

  const floor = nextAtlas.floorsById[getFloorId(1)];
  if (!floor) {
    throw new Error("Ops terminal atlas floor 1 could not be regenerated.");
  }

  return cloneFloor(floor);
}

export function applyWarmTheaterEconomyToState(
  state: GameState,
  activeTheaterId: string,
  tickCost: number,
): GameState {
  if (tickCost <= 0) {
    return state;
  }

  const progress = loadOpsTerminalAtlasProgress();
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = ensured.opsTerminalAtlas ? decorateAtlasState(cloneAtlasState(ensured.opsTerminalAtlas)) : null;
  if (!atlas) {
    return state;
  }

  const located = findSectorInAtlas(atlas, activeTheaterId);
  if (!located) {
    return state;
  }

  const playerSlot = getLocalSessionPlayerSlot(state);
  let availableWad = getSessionResourcePool(state, playerSlot).wad;
  let totalWadSpent = 0;
  let totalIncomeGain = createEmptyResourceWallet();
  let mutated = false;

  located.floor.sectors = located.floor.sectors.map((sector) => {
    if (sector.theaterId === activeTheaterId || resolveSectorState(atlas, sector) !== "warm") {
      return sector;
    }

    const nextSector = cloneSector(sector);
    const economy = getTheaterUpkeepPerTick(nextSector.theater);
    if (
      economy.wadUpkeep <= 0
      && (economy.incomePerTick.metalScrap ?? 0) <= 0
      && (economy.incomePerTick.wood ?? 0) <= 0
      && (economy.incomePerTick.chaosShards ?? 0) <= 0
      && (economy.incomePerTick.steamComponents ?? 0) <= 0
    ) {
      return sector;
    }
    const wadCost = economy.wadUpkeep * tickCost;
    const incomeGain = scaleResourceWallet(economy.incomePerTick, tickCost);

    nextSector.theater.tickCount += tickCost;
    if (wadCost <= availableWad) {
      availableWad -= wadCost;
      totalWadSpent += wadCost;
      totalIncomeGain = addResourceWallet(totalIncomeGain, incomeGain);
    }

    mutated = true;
    return nextSector;
  });

  if (!mutated) {
    return state;
  }

  saveCampaignProgress({
    ...ensured,
    opsTerminalAtlas: decorateAtlasState(atlas),
  });

  let nextState = state;
  if (totalWadSpent > 0) {
    const spendResult = spendSessionCost(nextState, { wad: totalWadSpent }, playerSlot);
    if (spendResult.success) {
      nextState = spendResult.state;
    }
  }
  if (hasPositiveResourceGain(totalIncomeGain)) {
    nextState = grantSessionResources(nextState, { resources: totalIncomeGain }, playerSlot);
  }

  return nextState;
}

export function holdPositionInOpsTerminalAtlas(
  state: GameState,
  floorOrdinal: number,
  ticks = 1,
): GameState {
  const resolvedTicks = Math.max(1, Math.floor(ticks));
  const progress = loadOpsTerminalAtlasProgress();
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = ensured.opsTerminalAtlas ? decorateAtlasState(cloneAtlasState(ensured.opsTerminalAtlas)) : null;
  if (!atlas) {
    return state;
  }

  const floor = atlas.floorsById[getFloorId(Math.max(1, Math.floor(floorOrdinal || atlas.currentFloorOrdinal)))];
  if (!floor) {
    return state;
  }

  const playerSlot = getLocalSessionPlayerSlot(state);
  let availableWad = getSessionResourcePool(state, playerSlot).wad;
  let totalWadSpent = 0;
  let totalIncomeGain = createEmptyResourceWallet();
  let mutated = false;

  floor.sectors = floor.sectors.map((sector) => {
    if (!isOperationalEconomyState(resolveSectorState(atlas, sector))) {
      return sector;
    }

    const nextSector = cloneSector(sector);
    const economy = getTheaterUpkeepPerTick(nextSector.theater);
    const wadCost = economy.wadUpkeep * resolvedTicks;
    const incomeGain = scaleResourceWallet(economy.incomePerTick, resolvedTicks);

    nextSector.theater.tickCount += resolvedTicks;
    if (wadCost <= availableWad) {
      availableWad -= wadCost;
      totalWadSpent += wadCost;
      totalIncomeGain = addResourceWallet(totalIncomeGain, incomeGain);
    }

    mutated = true;
    return nextSector;
  });

  if (!mutated) {
    return state;
  }

  saveCampaignProgress({
    ...ensured,
    opsTerminalAtlas: decorateAtlasState(atlas),
  });

  let nextState = state;
  if (totalWadSpent > 0) {
    const spendResult = spendSessionCost(nextState, { wad: totalWadSpent }, playerSlot);
    if (spendResult.success) {
      nextState = spendResult.state;
    }
  }
  if (hasPositiveResourceGain(totalIncomeGain)) {
    nextState = grantSessionResources(nextState, { resources: totalIncomeGain }, playerSlot);
  }

  return nextState;
}

export function getOpsTerminalAtlasSectorState(
  theaterId: string,
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): OpsTerminalAtlasSectorState | null {
  const atlas = decorateAtlasState(ensureCurrentFloorInitialized(progress).opsTerminalAtlas!);
  if (!atlas) {
    return null;
  }

  for (const floor of Object.values(atlas.floorsById)) {
    const sector = floor.sectors.find((entry) => entry.theaterId === theaterId);
    if (sector) {
      return cloneSector(sector);
    }
  }

  return null;
}

export function createOpsTerminalSectorOperation(theaterId: string): OperationRun | null {
  const progress = loadOpsTerminalAtlasProgress();
  const sector = getOpsTerminalAtlasSectorState(theaterId, progress);
  if (!sector) {
    return null;
  }

  const atlas = progress.opsTerminalAtlas ? cloneAtlasState(progress.opsTerminalAtlas) : null;
  if (atlas) {
    atlas.lastEnteredTheaterId = theaterId;
    saveCampaignProgress({
      ...progress,
      opsTerminalAtlas: decorateAtlasState(atlas),
    });
  }

  const theater = cloneTheater(sector.theater);
  theater.definition.currentState = "active";
  theater.definition.theaterStatus = "active";
  theater.definition.floorKeyInventory = cloneKeyInventory(sector.theater.definition.floorKeyInventory);
  return {
    id: sector.operationId,
    codename: sector.codename,
    description: sector.description,
    objective: theater.definition.objective,
    recommendedPWR: theater.definition.recommendedPWR,
    beginningState: theater.definition.beginningState,
    endState: theater.definition.endState,
    floors: [
      {
        id: sector.floorId,
        name: `Floor ${sector.floorOrdinal} // ${sector.zoneName}`,
        nodes: [],
      },
    ],
    currentFloorIndex: 0,
    currentRoomId: theater.currentRoomId,
    launchSource: "ops_terminal",
    atlasTheaterId: sector.theaterId,
    atlasFloorId: sector.floorId,
    sprawlDirection: sector.sprawlDirection,
    theater,
    theaterFloors: {
      0: cloneTheater(theater),
    },
  };
}

export function isOpsTerminalAtlasOperation(operation: OperationRun | null | undefined): boolean {
  return Boolean(
    operation?.launchSource === "ops_terminal"
    && typeof operation.atlasTheaterId === "string"
    && operation.atlasTheaterId.startsWith(OPS_ATLAS_SECTOR_PREFIX),
  );
}

export function syncOpsTerminalOperationState(operation: OperationRun | null | undefined): boolean {
  if (!isOpsTerminalAtlasOperation(operation) || !operation?.theater || !operation.atlasFloorId || !operation.atlasTheaterId) {
    return false;
  }

  const progress = loadOpsTerminalAtlasProgress();
  const atlas = progress.opsTerminalAtlas;
  if (!atlas) {
    return false;
  }

  const floor = atlas.floorsById[operation.atlasFloorId];
  if (!floor) {
    return false;
  }

  const sectorIndex = floor.sectors.findIndex((sector) => sector.theaterId === operation.atlasTheaterId);
  if (sectorIndex < 0) {
    return false;
  }

  const nextSector = cloneSector(floor.sectors[sectorIndex]);
  nextSector.theater = cloneTheater(operation.theater);
  const mergedFloorKeyInventory = mergeKeyInventories(
    floor.keyInventory,
    nextSector.theater.definition.floorKeyInventory,
  );
  nextSector.theater.definition.id = nextSector.theaterId;
  nextSector.theater.definition.operationId = nextSector.operationId;
  nextSector.theater.definition.floorId = nextSector.floorId;
  nextSector.theater.definition.floorOrdinal = nextSector.floorOrdinal;
  nextSector.theater.definition.sectorLabel = nextSector.sectorLabel;
  nextSector.theater.definition.zoneName = nextSector.zoneName;
  nextSector.theater.definition.name = nextSector.zoneName;
  nextSector.theater.definition.passiveEffectText = nextSector.passiveEffectText;
  nextSector.theater.definition.threatLevel = nextSector.threatLevel;
  nextSector.theater.definition.discovered = true;
  nextSector.theater.definition.operationAvailable = true;
  nextSector.theater.definition.floorKeyInventory = cloneKeyInventory(mergedFloorKeyInventory);
  nextSector.theater.rooms = Object.fromEntries(
    Object.entries(nextSector.theater.rooms).map(([roomId, room]) => [
      roomId,
      {
        ...room,
        theaterId: nextSector.theaterId,
      },
    ]),
  );

  const updatedFloor: OpsTerminalAtlasFloorState = {
    ...floor,
    keyInventory: cloneKeyInventory(mergedFloorKeyInventory),
    sectors: floor.sectors.map((sector, index) => (index === sectorIndex ? nextSector : sector)),
  };
  syncFloorKeyInventoryToSectors(updatedFloor);

  let updatedProgress = updateCurrentFloorIfCleared({
    ...progress,
    opsTerminalAtlas: {
      ...atlas,
      lastEnteredTheaterId: nextSector.theaterId,
      floorsById: {
        ...atlas.floorsById,
        [floor.floorId]: updatedFloor,
      },
    },
  });

  if (updatedProgress.opsTerminalAtlas) {
    updatedProgress = {
      ...updatedProgress,
      opsTerminalAtlas: decorateAtlasState(updatedProgress.opsTerminalAtlas),
    };
  }

  if (
    nextSector.linkedOperationId
    && nextSector.theater.objectiveComplete
    && !updatedProgress.completedOperations.includes(nextSector.linkedOperationId)
  ) {
    updatedProgress = completeOperation(nextSector.linkedOperationId, updatedProgress);
  }

  saveCampaignProgress(updatedProgress);
  return true;
}

export function getSectorSecuredRoomCount(sector: OpsTerminalAtlasSectorState): number {
  return Object.values(sector.theater.rooms).filter((room) => room.secured).length;
}

export function getSectorKnownRoomCount(sector: OpsTerminalAtlasSectorState): number {
  return Object.values(sector.theater.rooms).length;
}

export function getSectorStateLabel(sector: OpsTerminalAtlasSectorState): AtlasTheaterState {
  return sector.theater.definition.currentState;
}

export function getSectorCoreCount(sector: OpsTerminalAtlasSectorState): number {
  return countActiveCores(sector.theater);
}

export function getOpsTerminalAtlasCoreSummaries(
  floorOrdinal?: number,
  progress: CampaignProgress = loadOpsTerminalAtlasProgress(),
): OpsTerminalAtlasCoreSummary[] {
  const ensured = ensureCurrentFloorInitialized(progress);
  const atlas = decorateAtlasState(ensured.opsTerminalAtlas!);
  const resolvedFloorOrdinal = floorOrdinal ?? atlas.currentFloorOrdinal;
  const floor = atlas.floorsById[getFloorId(resolvedFloorOrdinal)];
  if (!floor) {
    return [];
  }

  return floor.sectors.flatMap((sector) => (
    Object.values(sector.theater.rooms)
      .filter((room) => room.coreAssignment)
      .map((room) => createCoreSummary(atlas, sector, room))
  )).sort((left, right) => (
    left.sectorLabel.localeCompare(right.sectorLabel)
    || left.roomLabel.localeCompare(right.roomLabel)
  ));
}
