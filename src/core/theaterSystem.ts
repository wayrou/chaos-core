import { createTestBattleForCurrentParty, BattleState as RuntimeBattleState } from "./battle";
import { getAtlasTheaterByOperationId, getAtlasTheaterSummary } from "./atlasSystem";
import { createGeneratedTheaterFloor } from "./theaterGenerator";
import {
  CoreAssignment,
  CoreType,
  FortificationPips,
  GameState,
  OperationRun,
  RoomId,
  TheaterDefinition,
  TheaterNetworkState,
  TheaterObjectiveCompletion,
  TheaterRoom,
  ThreatState,
} from "./types";

type ResourceWallet = GameState["resources"];

type CoreBlueprint = {
  label: string;
  buildCost: Partial<ResourceWallet>;
  upkeepPerTick: Partial<ResourceWallet>;
  wadUpkeepPerTick: number;
  incomePerTick: Partial<ResourceWallet>;
  supportRadius: number;
};

type FortificationType = keyof FortificationPips;

export type TheaterMoveOutcome = {
  state: GameState;
  roomId: RoomId;
  path: RoomId[];
  tickCost: number;
  requiresBattle: boolean;
  requiresField: boolean;
  error?: string;
};

export type TheaterActionOutcome = {
  state: GameState;
  success: boolean;
  message: string;
};

export type TheaterSummary = {
  currentScreen: string;
  currentOperation: string;
  currentTheater: string;
  selectedRoomId: RoomId;
  currentTickCount: number;
  securedRooms: number;
  coreCount: number;
  threatenedRooms: number;
};

export type TheaterEconomyPerTick = {
  wadUpkeep: number;
  incomePerTick: ResourceWallet;
};

type TheaterRoomSeed = Pick<
  TheaterRoom,
  "id" | "label" | "sectorTag" | "localPosition" | "depthFromUplink" | "isUplinkRoom" | "size" | "adjacency" | "status" | "secured" | "tacticalEncounter" | "tags"
> & Partial<TheaterRoom>;

const THEATER_ROOM_BASE: Omit<
  TheaterRoom,
  "id" | "theaterId" | "label" | "sectorTag" | "position" | "localPosition" | "depthFromUplink" | "isUplinkRoom" | "size" | "adjacency" | "status" | "secured" | "tacticalEncounter" | "tags"
> = {
  fortified: false,
  coreAssignment: null,
  underThreat: false,
  damaged: false,
  connected: false,
  powered: false,
  supplied: false,
  commsVisible: false,
  fortificationPips: {
    barricade: 0,
    powerRail: 0,
  },
  isPowerSource: false,
};

export const THEATER_CORE_BLUEPRINTS: Record<CoreType, CoreBlueprint> = {
  supply_depot: {
    label: "Supply Depot",
    buildCost: { metalScrap: 4, wood: 2 },
    upkeepPerTick: {},
    wadUpkeepPerTick: 6,
    incomePerTick: {},
    supportRadius: 1,
  },
  command_center: {
    label: "Command Center",
    buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
    upkeepPerTick: {},
    wadUpkeepPerTick: 8,
    incomePerTick: {},
    supportRadius: 2,
  },
  medical_ward: {
    label: "Medical Ward",
    buildCost: { wood: 3, chaosShards: 1 },
    upkeepPerTick: {},
    wadUpkeepPerTick: 5,
    incomePerTick: {},
    supportRadius: 1,
  },
  armory: {
    label: "Armory",
    buildCost: { metalScrap: 3, steamComponents: 1 },
    upkeepPerTick: {},
    wadUpkeepPerTick: 7,
    incomePerTick: {},
    supportRadius: 1,
  },
  mine: {
    label: "Mine",
    buildCost: { metalScrap: 3, wood: 2, steamComponents: 1 },
    upkeepPerTick: {},
    wadUpkeepPerTick: 4,
    incomePerTick: { metalScrap: 2, wood: 1 },
    supportRadius: 0,
  },
};

const FORTIFICATION_COSTS: Record<FortificationType, Partial<ResourceWallet>> = {
  barricade: { metalScrap: 2, wood: 2 },
  powerRail: { metalScrap: 2, steamComponents: 1 },
};

const THEATER_STARTER_RESERVE: ResourceWallet = {
  metalScrap: 10,
  wood: 8,
  chaosShards: 3,
  steamComponents: 3,
};

const THEATER_MAP_ORIGIN = { x: 230, y: 390 };
const THEATER_DEPTH_STEP = 300;
const THEATER_LATERAL_STEP = 220;

function resolveAtlasSummaryForOperation(operation: OperationRun) {
  return (
    (operation.atlasTheaterId ? getAtlasTheaterSummary(operation.atlasTheaterId) : null)
    ?? getAtlasTheaterByOperationId(operation.id)
  );
}

function projectTheaterPosition(
  definition: Pick<TheaterDefinition, "angleDeg" | "mapAnchor">,
  localPosition: { x: number; y: number },
): { x: number; y: number } {
  const radians = (definition.angleDeg * Math.PI) / 180;
  const forward = { x: Math.cos(radians), y: Math.sin(radians) };
  const lateral = { x: -forward.y, y: forward.x };
  const anchor = definition.mapAnchor ?? THEATER_MAP_ORIGIN;

  return {
    x: Math.round(
      anchor.x
      + (localPosition.x * THEATER_DEPTH_STEP * forward.x)
      + (localPosition.y * THEATER_LATERAL_STEP * lateral.x),
    ),
    y: Math.round(
      anchor.y
      + (localPosition.x * THEATER_DEPTH_STEP * forward.y)
      + (localPosition.y * THEATER_LATERAL_STEP * lateral.y),
    ),
  };
}

function createRoom(definition: TheaterDefinition, room: TheaterRoomSeed): TheaterRoom {
  return {
    ...THEATER_ROOM_BASE,
    theaterId: room.theaterId ?? definition.id,
    ...room,
    position: room.position ?? projectTheaterPosition(definition, room.localPosition),
    clearMode: room.clearMode ?? (room.tacticalEncounter ? "battle" : "empty"),
    fortificationCapacity: room.fortificationCapacity ?? 3,
    fortificationPips: {
      barricade: room.fortificationPips?.barricade ?? THEATER_ROOM_BASE.fortificationPips.barricade,
      powerRail: room.fortificationPips?.powerRail ?? THEATER_ROOM_BASE.fortificationPips.powerRail,
    },
  };
}

function createIronGateTheater(operation: OperationRun): TheaterNetworkState {
  const atlasSummary = resolveAtlasSummaryForOperation(operation);
  const operationId = operation.id ?? "op_iron_gate";
  const objective = operation.objective ?? operation.description ?? "Advance through the Gateworks, stabilize a logistics chain, and crack the eastern lockline.";
  const recommendedPWR = operation.recommendedPWR ?? atlasSummary?.recommendedPwr ?? 24;
  const beginningState = operation.beginningState ?? `${atlasSummary?.zoneName ?? "CASTELLAN GATEWORKS"} uplink secured. Forward routes mapped only one room deep. Generator sector offline.`;
  const endState = operation.endState ?? "Eastern objective node secured with a powered support chain and at least one C.O.R.E. online.";
  const currentState = atlasSummary?.currentState === "undiscovered" ? "active" : (atlasSummary?.currentState ?? "active");
  const angleDeg = atlasSummary?.angleDeg ?? 0;
  const zoneName = atlasSummary?.zoneName ?? "CASTELLAN GATEWORKS";
  const sectorLabel = atlasSummary?.sectorLabel ?? "SECTOR E-01";
  const uplinkRoomId = atlasSummary?.uplinkRoomId ?? "ig_ingress";

  const definition: TheaterDefinition = {
    id: atlasSummary?.theaterId ?? `${operationId}_castellan_gateworks`,
    name: zoneName,
    zoneName,
    theaterStatus: currentState === "cold" ? "cold" : currentState === "warm" ? "warm" : "active",
    currentState,
    operationId,
    objective,
    recommendedPWR,
    beginningState,
    endState,
    floorId: atlasSummary?.floorId ?? operation.atlasFloorId ?? "haven_floor_03",
    floorOrdinal: atlasSummary?.floorOrdinal ?? 3,
    sectorLabel,
    radialSlotIndex: atlasSummary?.radialSlotIndex ?? 0,
    radialSlotCount: atlasSummary?.radialSlotCount ?? 5,
    angleDeg,
    radialDirection: atlasSummary?.radialDirection ?? { x: 1, y: 0 },
    discovered: atlasSummary?.discovered ?? true,
    operationAvailable: atlasSummary?.operationAvailable ?? true,
    passiveEffectText: atlasSummary?.passiveEffectText ?? "Passive Benefit // Forward relay improves early deployment stability.",
    threatLevel: atlasSummary?.threatLevel ?? "High",
    ingressRoomId: uplinkRoomId,
    uplinkRoomId,
    outwardDepth: atlasSummary?.outwardDepth ?? 5,
    powerSourceRoomIds: ["ig_ingress", "ig_generator"],
  };

  const makeRoom = (room: TheaterRoomSeed): TheaterRoom => createRoom(definition, room);
  const rooms: Record<RoomId, TheaterRoom> = {
    ig_ingress: makeRoom({
      id: "ig_ingress",
      label: "Ingress Yard",
      sectorTag: "A0",
      localPosition: { x: 0, y: 0 },
      depthFromUplink: 0,
      isUplinkRoom: true,
      size: { width: 230, height: 138 },
      adjacency: ["ig_checkpoint"],
      status: "secured",
      secured: true,
      clearMode: "empty",
      fortificationCapacity: 4,
      fortified: true,
      tacticalEncounter: null,
      tags: ["ingress", "uplink"],
      fortificationPips: { barricade: 1, powerRail: 1 },
      isPowerSource: true,
    }),
    ig_checkpoint: makeRoom({
      id: "ig_checkpoint",
      label: "Broken Causeway",
      sectorTag: "A1",
      localPosition: { x: 1, y: 0 },
      depthFromUplink: 1,
      isUplinkRoom: false,
      size: { width: 250, height: 150 },
      adjacency: ["ig_ingress", "ig_junction", "ig_depot"],
      status: "mapped",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 2,
      tacticalEncounter: "gate_skirmish",
      tags: ["frontier"],
    }),
    ig_depot: makeRoom({
      id: "ig_depot",
      label: "Freight Annex",
      sectorTag: "B1",
      localPosition: { x: 1.3, y: 1.1 },
      depthFromUplink: 2,
      isUplinkRoom: false,
      size: { width: 250, height: 156 },
      adjacency: ["ig_checkpoint", "ig_storage"],
      status: "mapped",
      secured: false,
      clearMode: "field",
      fortificationCapacity: 4,
      tacticalEncounter: null,
      tags: ["core_candidate", "resource_metal", "resource_wood"],
    }),
    ig_junction: makeRoom({
      id: "ig_junction",
      label: "Signal Junction",
      sectorTag: "B0",
      localPosition: { x: 2, y: 0 },
      depthFromUplink: 2,
      isUplinkRoom: false,
      size: { width: 250, height: 152 },
      adjacency: ["ig_checkpoint", "ig_generator", "ig_command", "ig_redoubt"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 3,
      tacticalEncounter: "junction_melee",
      tags: ["junction"],
    }),
    ig_generator: makeRoom({
      id: "ig_generator",
      label: "Dyno Chamber",
      sectorTag: "B-1",
      localPosition: { x: 2.1, y: -1.1 },
      depthFromUplink: 3,
      isUplinkRoom: false,
      size: { width: 250, height: 150 },
      adjacency: ["ig_junction"],
      status: "unknown",
      secured: false,
      clearMode: "empty",
      fortificationCapacity: 4,
      tacticalEncounter: null,
      tags: ["power_source"],
      isPowerSource: true,
    }),
    ig_command: makeRoom({
      id: "ig_command",
      label: "Overwatch Gallery",
      sectorTag: "C0",
      localPosition: { x: 3.1, y: -0.55 },
      depthFromUplink: 3,
      isUplinkRoom: false,
      size: { width: 280, height: 152 },
      adjacency: ["ig_junction", "ig_storage"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 4,
      tacticalEncounter: "command_gallery",
      tags: ["core_candidate"],
    }),
    ig_storage: makeRoom({
      id: "ig_storage",
      label: "Cold Storage Spur",
      sectorTag: "C1",
      localPosition: { x: 3.1, y: 0.85 },
      depthFromUplink: 3,
      isUplinkRoom: false,
      size: { width: 280, height: 150 },
      adjacency: ["ig_depot", "ig_command"],
      status: "unknown",
      secured: false,
      clearMode: "empty",
      fortificationCapacity: 2,
      tacticalEncounter: null,
      tags: ["side_branch", "resource_wood"],
    }),
    ig_redoubt: makeRoom({
      id: "ig_redoubt",
      label: "Redoubt Mouth",
      sectorTag: "D0",
      localPosition: { x: 4, y: 0 },
      depthFromUplink: 4,
      isUplinkRoom: false,
      size: { width: 250, height: 152 },
      adjacency: ["ig_junction", "ig_objective"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 3,
      tacticalEncounter: "elite_redoubt",
      tags: ["elite", "frontier"],
    }),
    ig_objective: makeRoom({
      id: "ig_objective",
      label: "Iron Gate Lock",
      sectorTag: "E0",
      localPosition: { x: 5, y: 0 },
      depthFromUplink: 5,
      isUplinkRoom: false,
      size: { width: 260, height: 160 },
      adjacency: ["ig_redoubt"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 4,
      tacticalEncounter: "objective_lock",
      tags: ["objective", "elite"],
    }),
  };

  return recomputeTheaterNetwork({
    definition,
    rooms,
    currentRoomId: uplinkRoomId,
    selectedRoomId: uplinkRoomId,
    tickCount: 0,
    activeThreats: [],
    recentEvents: ["S/COM :: Ingress Yard secured. Push outward, build C.O.R.E.s, and hold the line."],
    objectiveComplete: false,
    completion: null,
  });
}

function cloneTheater(theater: TheaterNetworkState): TheaterNetworkState {
  return {
    definition: {
      ...theater.definition,
      radialDirection: { ...theater.definition.radialDirection },
      powerSourceRoomIds: [...theater.definition.powerSourceRoomIds],
      mapAnchor: theater.definition.mapAnchor ? { ...theater.definition.mapAnchor } : undefined,
    },
    rooms: Object.fromEntries(
      Object.entries(theater.rooms).map(([roomId, room]) => [
        roomId,
        {
          ...room,
          position: { ...room.position },
          localPosition: { ...room.localPosition },
          size: { ...room.size },
          adjacency: [...room.adjacency],
          fortificationPips: { ...room.fortificationPips },
          coreAssignment: room.coreAssignment ? {
            ...room.coreAssignment,
            buildCost: { ...room.coreAssignment.buildCost },
            upkeepPerTick: { ...room.coreAssignment.upkeepPerTick },
          } : null,
          tags: [...room.tags],
        },
      ]),
    ),
    currentRoomId: theater.currentRoomId,
    selectedRoomId: theater.selectedRoomId,
    tickCount: theater.tickCount,
    activeThreats: theater.activeThreats.map((threat) => ({ ...threat })),
    recentEvents: [...theater.recentEvents],
    objectiveComplete: theater.objectiveComplete,
    completion: theater.completion
      ? {
          ...theater.completion,
          reward: { ...theater.completion.reward },
          recapLines: [...theater.completion.recapLines],
        }
      : null,
  };
}

function addTheaterEvent(theater: TheaterNetworkState, message: string): TheaterNetworkState {
  return {
    ...theater,
    recentEvents: [message, ...theater.recentEvents].slice(0, 8),
  };
}

function hasEnoughResources(resources: ResourceWallet, cost: Partial<ResourceWallet>): boolean {
  return (
    resources.metalScrap >= (cost.metalScrap ?? 0) &&
    resources.wood >= (cost.wood ?? 0) &&
    resources.chaosShards >= (cost.chaosShards ?? 0) &&
    resources.steamComponents >= (cost.steamComponents ?? 0)
  );
}

function subtractResources(resources: ResourceWallet, cost: Partial<ResourceWallet>): ResourceWallet {
  return {
    metalScrap: resources.metalScrap - (cost.metalScrap ?? 0),
    wood: resources.wood - (cost.wood ?? 0),
    chaosShards: resources.chaosShards - (cost.chaosShards ?? 0),
    steamComponents: resources.steamComponents - (cost.steamComponents ?? 0),
  };
}

function sumWadUpkeep(theater: TheaterNetworkState, ticks: number): number {
  return Object.values(theater.rooms).reduce((total, room) => {
    if (!room.secured || !room.coreAssignment) {
      return total;
    }

    return total + ((room.coreAssignment.wadUpkeepPerTick ?? 0) * ticks);
  }, 0);
}

function sumResourceIncome(theater: TheaterNetworkState, ticks: number): ResourceWallet {
  const upkeep: ResourceWallet = {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0,
  };

  Object.values(theater.rooms).forEach((room) => {
    if (!room.secured || !room.coreAssignment || room.damaged || !room.supplied || !room.connected) {
      return;
    }

    upkeep.metalScrap += (room.coreAssignment.incomePerTick?.metalScrap ?? 0) * ticks;
    upkeep.wood += (room.coreAssignment.incomePerTick?.wood ?? 0) * ticks;
    upkeep.chaosShards += (room.coreAssignment.incomePerTick?.chaosShards ?? 0) * ticks;
    upkeep.steamComponents += (room.coreAssignment.incomePerTick?.steamComponents ?? 0) * ticks;
  });

  return upkeep;
}

function addResources(base: ResourceWallet, delta: Partial<ResourceWallet>): ResourceWallet {
  return {
    metalScrap: base.metalScrap + (delta.metalScrap ?? 0),
    wood: base.wood + (delta.wood ?? 0),
    chaosShards: base.chaosShards + (delta.chaosShards ?? 0),
    steamComponents: base.steamComponents + (delta.steamComponents ?? 0),
  };
}

function getObjectiveRoom(theater: TheaterNetworkState): TheaterRoom | null {
  return Object.values(theater.rooms).find((room) => room.tags.includes("objective")) ?? null;
}

function createCompletionSummary(theater: TheaterNetworkState, room: TheaterRoom): TheaterObjectiveCompletion {
  const securedCount = Object.values(theater.rooms).filter((candidate) => candidate.secured).length;
  const coreCount = Object.values(theater.rooms).filter((candidate) => candidate.coreAssignment).length;
  const poweredCount = Object.values(theater.rooms).filter((candidate) => candidate.powered).length;

  return {
    roomId: room.id,
    completedAtTick: theater.tickCount,
    reward: {
      wad: 120,
      metalScrap: 8,
      wood: 6,
      chaosShards: 3,
      steamComponents: 3,
    },
    recapLines: [
      `${room.label} secured at tick ${theater.tickCount}.`,
      `${securedCount}/${Object.keys(theater.rooms).length} rooms secured across ${theater.definition.name}.`,
      `${coreCount} C.O.R.E. facilities online, ${poweredCount} secured rooms powered by rail.`,
    ],
  };
}

function resolveCompletionRoom(theater: TheaterNetworkState): TheaterRoom | null {
  const objectiveRoom = getObjectiveRoom(theater);
  if (objectiveRoom?.secured) {
    return objectiveRoom;
  }

  const rooms = Object.values(theater.rooms);
  if (rooms.length > 0 && rooms.every((room) => room.secured)) {
    return objectiveRoom ?? theater.rooms[theater.currentRoomId] ?? rooms[0] ?? null;
  }

  return null;
}

function reconcileTheaterCompletion(theater: TheaterNetworkState): TheaterNetworkState {
  const completionRoom = resolveCompletionRoom(theater);
  if (!completionRoom) {
    return theater;
  }

  if (theater.objectiveComplete && theater.completion) {
    return theater;
  }

  const next = cloneTheater(theater);
  const nextCompletionRoom = next.rooms[completionRoom.id] ?? completionRoom;
  next.objectiveComplete = true;
  next.completion = next.completion ?? createCompletionSummary(next, nextCompletionRoom);

  return addTheaterEvent(
    next,
    `OBJECTIVE :: ${nextCompletionRoom.label} secured. ${next.definition.name} operation complete.`,
  );
}

function getVisibleRoomIds(theater: TheaterNetworkState): Set<RoomId> {
  const visible = new Set<RoomId>();
  const rooms = theater.rooms;
  const queue: Array<{ roomId: RoomId; depth: number; limit: number }> = [];

  Object.values(rooms).forEach((room) => {
    if (!room.secured) {
      return;
    }

    visible.add(room.id);
    const commandRange =
      room.coreAssignment?.type === "command_center" && room.powered
        ? room.coreAssignment.supportRadius
        : 1;

    queue.push({ roomId: room.id, depth: 0, limit: commandRange });
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= current.limit) {
      continue;
    }

    const room = rooms[current.roomId];
    if (!room) {
      continue;
    }

    room.adjacency.forEach((adjacentId) => {
      visible.add(adjacentId);
      queue.push({
        roomId: adjacentId,
        depth: current.depth + 1,
        limit: current.limit,
      });
    });
  }

  return visible;
}

function recomputeSupplyAndPower(theater: TheaterNetworkState): TheaterNetworkState {
  const next = cloneTheater(theater);
  const rooms = next.rooms;
  const ingressId = next.definition.ingressRoomId;
  const supplyQueue: RoomId[] = [];

  Object.values(rooms).forEach((room) => {
    room.supplied = false;
    room.connected = false;
    room.powered = false;
  });

  const ingress = rooms[ingressId];
  if (ingress?.secured) {
    ingress.supplied = true;
    ingress.connected = true;
    supplyQueue.push(ingressId);
  }

  Object.values(rooms).forEach((room) => {
    if (room.secured && room.coreAssignment?.type === "supply_depot") {
      room.supplied = true;
      room.connected = true;
      supplyQueue.push(room.id);
    }
  });

  const supplySeen = new Set<RoomId>(supplyQueue);
  while (supplyQueue.length > 0) {
    const currentRoomId = supplyQueue.shift()!;
    const currentRoom = rooms[currentRoomId];
    if (!currentRoom) {
      continue;
    }

    currentRoom.adjacency.forEach((adjacentId) => {
      const adjacentRoom = rooms[adjacentId];
      if (!adjacentRoom || !adjacentRoom.secured || supplySeen.has(adjacentId)) {
        return;
      }

      if (currentRoom.damaged || adjacentRoom.damaged) {
        return;
      }

      adjacentRoom.supplied = true;
      adjacentRoom.connected = true;
      supplySeen.add(adjacentId);
      supplyQueue.push(adjacentId);
    });
  }

  const powerQueue: RoomId[] = [];
  const powerSeen = new Set<RoomId>();

  next.definition.powerSourceRoomIds.forEach((roomId) => {
    const room = rooms[roomId];
    if (!room || !room.secured || room.damaged || room.fortificationPips.powerRail <= 0) {
      return;
    }
    room.powered = true;
    powerQueue.push(roomId);
    powerSeen.add(roomId);
  });

  while (powerQueue.length > 0) {
    const currentRoomId = powerQueue.shift()!;
    const currentRoom = rooms[currentRoomId];
    if (!currentRoom || currentRoom.damaged || currentRoom.fortificationPips.powerRail <= 0) {
      continue;
    }

    currentRoom.adjacency.forEach((adjacentId) => {
      const adjacentRoom = rooms[adjacentId];
      if (
        !adjacentRoom ||
        !adjacentRoom.secured ||
        adjacentRoom.damaged ||
        adjacentRoom.fortificationPips.powerRail <= 0 ||
        powerSeen.has(adjacentId)
      ) {
        return;
      }

      adjacentRoom.powered = true;
      powerSeen.add(adjacentId);
      powerQueue.push(adjacentId);
    });
  }

  const visibleRoomIds = getVisibleRoomIds(next);
  Object.values(rooms).forEach((room) => {
    room.commsVisible = visibleRoomIds.has(room.id) || room.secured;
    if (room.status === "unknown" && room.commsVisible) {
      room.status = "mapped";
    }
  });

  return next;
}

function pickThreatCandidate(theater: TheaterNetworkState): TheaterRoom | null {
  const currentRoomId = theater.currentRoomId;
  const rooms = Object.values(theater.rooms).filter((room) => (
    room.secured &&
    room.id !== currentRoomId &&
    !room.underThreat
  ));

  let bestRoom: TheaterRoom | null = null;
  let bestScore = 0;

  rooms.forEach((room) => {
    const frontierLinks = room.adjacency.filter((adjacentId) => {
      const adjacent = theater.rooms[adjacentId];
      return adjacent && !adjacent.secured && adjacent.status !== "unknown";
    }).length;

    const score =
      frontierLinks * 3 +
      (room.coreAssignment && !room.powered ? 3 : 0) +
      (!room.supplied ? 4 : 0) +
      (!room.connected ? 3 : 0) +
      (room.damaged ? 2 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestRoom = room;
    }
  });

  return bestScore >= 3 ? bestRoom : null;
}

function triggerThreatIfNeeded(theater: TheaterNetworkState): TheaterNetworkState {
  if (theater.objectiveComplete) {
    return theater;
  }

  if (theater.activeThreats.filter((threat) => threat.active).length >= 2) {
    return theater;
  }

  if (theater.tickCount < 4 || theater.tickCount % 4 !== 0) {
    return theater;
  }

  const candidate = pickThreatCandidate(theater);
  if (!candidate) {
    return theater;
  }

  const next = cloneTheater(theater);
  const room = next.rooms[candidate.id];
  if (!room) {
    return theater;
  }

  room.underThreat = true;
  if (room.fortificationPips.barricade <= 0) {
    room.damaged = true;
  }

  const threat: ThreatState = {
    id: `threat_${next.tickCount}_${room.id}`,
    roomId: room.id,
    cause: room.coreAssignment
      ? "Isolated C.O.R.E. and exposed perimeter"
      : "Frontier exposure and damaged line pressure",
    severity: room.coreAssignment ? 2 : 1,
    spawnedAtTick: next.tickCount,
    active: true,
  };

  next.activeThreats = [...next.activeThreats, threat].slice(-4);
  console.log("[THEATER] threat event triggered", threat.id, threat.roomId, threat.cause);
  return addTheaterEvent(
    next,
    `THREAT :: ${room.label} destabilized (${threat.cause}). Tactical pressure increased near adjacent rooms.`,
  );
}

function resolveOperationFields(operation: OperationRun, theater: TheaterNetworkState): OperationRun {
  const floorIndex = Math.max(0, (theater.definition.floorOrdinal ?? 1) - 1);
  return {
    ...operation,
    objective: theater.definition.objective,
    recommendedPWR: theater.definition.recommendedPWR,
    beginningState: theater.definition.beginningState,
    endState: theater.definition.endState,
    currentFloorIndex: floorIndex,
    currentRoomId: theater.currentRoomId,
    theater,
    theaterFloors: {
      ...(operation.theaterFloors ?? {}),
      [floorIndex]: cloneTheater(theater),
    },
  };
}

function isValidTheaterNetwork(theater: TheaterNetworkState | null | undefined): theater is TheaterNetworkState {
  return Boolean(
    theater
    && typeof theater.definition?.uplinkRoomId === "string"
    && typeof theater.definition?.floorId === "string"
    && Object.values(theater.rooms).every((room) => (
      typeof room.theaterId === "string"
      && room.localPosition !== undefined
      && typeof room.depthFromUplink === "number"
      && typeof room.isUplinkRoom === "boolean"
    )),
  );
}

function getClampedOperationFloorIndex(operation: OperationRun): number {
  const maxFloorIndex = Math.max(0, operation.floors.length - 1);
  return Math.max(0, Math.min(operation.currentFloorIndex ?? 0, maxFloorIndex));
}

function getTheaterFloorIndex(theater: TheaterNetworkState): number {
  return Math.max(0, (theater.definition.floorOrdinal ?? 1) - 1);
}

function prepareTheaterForOperation(theater: TheaterNetworkState): TheaterNetworkState {
  return reconcileTheaterCompletion(recomputeTheaterNetwork(theater));
}

function generateTheaterForFloor(operation: OperationRun, floorIndex: number): TheaterNetworkState {
  try {
    return createGeneratedTheaterFloor(operation, floorIndex);
  } catch (error) {
    console.error("[THEATER] generated floor fallback", operation.id, floorIndex, error);
    return createIronGateTheater(operation);
  }
}

export function ensureOperationHasTheater(operation: OperationRun | null): OperationRun | null {
  if (!operation) {
    return null;
  }

  const currentFloorIndex = getClampedOperationFloorIndex(operation);
  const normalizedOperation =
    currentFloorIndex === operation.currentFloorIndex
      ? operation
      : {
          ...operation,
          currentFloorIndex,
        };

  if (
    isValidTheaterNetwork(normalizedOperation.theater)
    && getTheaterFloorIndex(normalizedOperation.theater) === currentFloorIndex
  ) {
    return resolveOperationFields(normalizedOperation, prepareTheaterForOperation(normalizedOperation.theater));
  }

  const storedFloorTheater = normalizedOperation.theaterFloors?.[currentFloorIndex];
  if (isValidTheaterNetwork(storedFloorTheater)) {
    return resolveOperationFields(
      {
        ...normalizedOperation,
        theater: storedFloorTheater,
      },
      prepareTheaterForOperation(storedFloorTheater),
    );
  }

  return resolveOperationFields(
    normalizedOperation,
    prepareTheaterForOperation(generateTheaterForFloor(normalizedOperation, currentFloorIndex)),
  );
}

export function hasTheaterOperation(operation: OperationRun | null | undefined): boolean {
  return Boolean(operation?.theater);
}

export function getMoveTickCost(theater: TheaterNetworkState, roomId: RoomId): number {
  const room = theater.rooms[roomId];
  if (!room) {
    return 0;
  }
  return room.secured ? 1 : 2;
}

function getInstalledFortificationCount(room: TheaterRoom): number {
  return room.fortificationPips.barricade + room.fortificationPips.powerRail;
}

function isDefenseBattleRoom(room: TheaterRoom): boolean {
  return room.secured && (room.underThreat || room.damaged);
}

function findTheaterRoute(theater: TheaterNetworkState, roomId: RoomId): RoomId[] | null {
  const originId = theater.currentRoomId;
  if (originId === roomId) {
    return [originId];
  }

  const destination = theater.rooms[roomId];
  if (!destination || (destination.status === "unknown" && !destination.commsVisible)) {
    return null;
  }

  const bestCost = new Map<RoomId, number>([[originId, 0]]);
  const previous = new Map<RoomId, RoomId | null>([[originId, null]]);
  const queue: Array<{ roomId: RoomId; cost: number }> = [{ roomId: originId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost > (bestCost.get(current.roomId) ?? Number.POSITIVE_INFINITY)) {
      continue;
    }
    if (current.roomId === roomId) {
      break;
    }

    const currentRoom = theater.rooms[current.roomId];
    if (!currentRoom) {
      continue;
    }

    currentRoom.adjacency.forEach((adjacentId) => {
      const adjacentRoom = theater.rooms[adjacentId];
      if (!adjacentRoom) {
        return;
      }
      if (adjacentId !== roomId && !adjacentRoom.secured) {
        return;
      }
      if (adjacentRoom.status === "unknown" && !adjacentRoom.commsVisible) {
        return;
      }

      const nextCost = current.cost + getMoveTickCost(theater, adjacentId);
      if (nextCost >= (bestCost.get(adjacentId) ?? Number.POSITIVE_INFINITY)) {
        return;
      }

      bestCost.set(adjacentId, nextCost);
      previous.set(adjacentId, current.roomId);
      queue.push({ roomId: adjacentId, cost: nextCost });
    });
  }

  if (!previous.has(roomId)) {
    return null;
  }

  const path: RoomId[] = [];
  let cursor: RoomId | null = roomId;
  while (cursor) {
    path.push(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return path.reverse();
}

function getMineRewardBonus(theater: TheaterNetworkState, room: TheaterRoom): ResourceWallet {
  const activeMineCount = Object.values(theater.rooms).filter((candidate) => (
    candidate.secured &&
    candidate.supplied &&
    !candidate.damaged &&
    candidate.coreAssignment?.type === "mine"
  )).length;

  if (activeMineCount <= 0 || !room.supplied) {
    return {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
    };
  }

  return {
    metalScrap: activeMineCount * (room.tags.includes("resource_metal") ? 3 : 1),
    wood: activeMineCount * (room.tags.includes("resource_wood") ? 2 : 1),
    chaosShards: 0,
    steamComponents: 0,
  };
}

function autoResolveNonCombatRoom(theater: TheaterNetworkState, roomId: RoomId): TheaterNetworkState {
  const room = theater.rooms[roomId];
  if (!room || room.secured || (room.clearMode !== "empty" && room.clearMode !== "field")) {
    return theater;
  }

  room.status = "secured";
  room.secured = true;
  room.underThreat = false;
  room.damaged = false;
  room.fortified = getInstalledFortificationCount(room) > 0;

  const logLine = room.clearMode === "field"
    ? `FIELD SWEEP :: ${room.label} cleared through patrol floors.`
    : `CLEAR :: ${room.label} checked and secured. No hostile contact.`;

  return addTheaterEvent(theater, logLine);
}

export function setTheaterSelectedRoom(state: GameState, roomId: RoomId): GameState {
  const operation = ensureOperationHasTheater(state.operation);
  if (!operation?.theater || !operation.theater.rooms[roomId]) {
    return state;
  }

  return {
    ...state,
    phase: "operation",
    operation: resolveOperationFields(operation, {
      ...operation.theater,
      selectedRoomId: roomId,
    }),
  };
}

export function moveToTheaterRoom(state: GameState, roomId: RoomId): TheaterMoveOutcome {
  const operation = ensureOperationHasTheater(state.operation);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return {
      state,
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "No active theater operation.",
    };
  }

  const currentRoom = theater.rooms[theater.currentRoomId];
  const destination = theater.rooms[roomId];
  if (!currentRoom || !destination) {
    return {
      state,
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "Target room is not part of this theater.",
    };
  }

  const route = findTheaterRoute(theater, roomId);
  if (!route) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "No secured route reaches that room yet.",
    };
  }

  if (currentRoom.id === destination.id) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: route,
      tickCost: 0,
      requiresBattle: isDefenseBattleRoom(destination) || (!destination.secured && destination.clearMode === "battle" && destination.tacticalEncounter !== null),
      requiresField: !destination.secured && destination.clearMode === "field",
    };
  }

  if (destination.status === "unknown" && !destination.commsVisible) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: route,
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "Comms cannot verify this room yet.",
    };
  }

  const tickCost = route.slice(1).reduce((total, stepRoomId) => total + getMoveTickCost(theater, stepRoomId), 0);
  const wadUpkeep = sumWadUpkeep(theater, tickCost);
  const resourceIncome = sumResourceIncome(theater, tickCost);
  let resources = { ...state.resources };
  let wad = state.wad ?? 0;
  let nextTheater = cloneTheater(theater);
  const destinationRoom = nextTheater.rooms[roomId];

  if (wad >= wadUpkeep) {
    wad -= wadUpkeep;
    resources = addResources(resources, resourceIncome);
  } else {
    Object.values(nextTheater.rooms).forEach((room) => {
      if (room.coreAssignment) {
        room.underThreat = true;
        room.damaged = room.damaged || room.fortificationPips.barricade <= 0;
      }
    });
    nextTheater = addTheaterEvent(nextTheater, "UPKEEP :: Wad reserves too low for maintenance. Unsupported C.O.R.E.s are destabilizing.");
  }

  nextTheater.currentRoomId = roomId;
  nextTheater.selectedRoomId = roomId;
  nextTheater.tickCount += tickCost;
  if (destinationRoom.status === "unknown") {
    destinationRoom.status = "mapped";
  }
  nextTheater = autoResolveNonCombatRoom(nextTheater, roomId);

  nextTheater = triggerThreatIfNeeded(recomputeTheaterNetwork(nextTheater));

  return {
    state: {
      ...state,
      phase: "operation",
      wad,
      resources,
      operation: resolveOperationFields(operation, nextTheater),
    },
    roomId,
    path: route,
    tickCost,
    requiresBattle: isDefenseBattleRoom(destinationRoom) || (!destinationRoom.secured && destinationRoom.clearMode === "battle" && destinationRoom.tacticalEncounter !== null),
    requiresField: !destinationRoom.secured && destinationRoom.clearMode === "field",
  };
}

export function secureTheaterRoomInState(state: GameState, roomId: RoomId): GameState {
  const operation = ensureOperationHasTheater(state.operation);
  if (!operation?.theater) {
    return state;
  }

  const theater = cloneTheater(operation.theater);
  const room = theater.rooms[roomId];
  if (!room) {
    return state;
  }

  room.status = "secured";
  room.secured = true;
  room.underThreat = false;
  room.damaged = false;
  room.fortified = getInstalledFortificationCount(room) > 0;
  theater.currentRoomId = roomId;
  theater.selectedRoomId = roomId;
  theater.activeThreats = theater.activeThreats.map((threat) =>
    threat.roomId === roomId ? { ...threat, active: false } : threat,
  );

  console.log("[THEATER] room secured", roomId);

  const recomputedTheater = recomputeTheaterNetwork(theater);
  const completedTheater = reconcileTheaterCompletion(recomputedTheater);
  const mineBonus = getMineRewardBonus(recomputedTheater, recomputedTheater.rooms[roomId] ?? room);
  const nextResources = addResources(state.resources, mineBonus);
  if (!operation.theater?.objectiveComplete && completedTheater.objectiveComplete && completedTheater.completion) {
    const completion = completedTheater.completion;

    return {
      ...state,
      wad: (state.wad ?? 0) + completion.reward.wad,
      resources: {
        metalScrap: nextResources.metalScrap + completion.reward.metalScrap,
        wood: nextResources.wood + completion.reward.wood,
        chaosShards: nextResources.chaosShards + completion.reward.chaosShards,
        steamComponents: nextResources.steamComponents + completion.reward.steamComponents,
      },
      phase: "operation",
      currentBattle: null,
      operation: resolveOperationFields(
        operation,
        completedTheater,
      ),
    };
  }

  return {
    ...state,
    phase: "operation",
    currentBattle: null,
    resources: nextResources,
    operation: resolveOperationFields(
      operation,
      addTheaterEvent(
        triggerThreatIfNeeded(recomputedTheater),
        mineBonus.metalScrap > 0 || mineBonus.wood > 0
          ? `SECURE :: ${room.label} locked down. Mine support added ${formatResourceCost(mineBonus)}.`
          : `SECURE :: ${room.label} locked down. Logistics paths recalculated.`,
      ),
    ),
  };
}

export function buildCoreInTheaterRoom(state: GameState, roomId: RoomId, coreType: CoreType): TheaterActionOutcome {
  const operation = ensureOperationHasTheater(state.operation);
  const blueprint = THEATER_CORE_BLUEPRINTS[coreType];
  if (!operation?.theater || !blueprint) {
    return {
      state,
      success: false,
      message: "No active theater C.O.R.E. target.",
    };
  }

  const theater = cloneTheater(operation.theater);
  const room = theater.rooms[roomId];
  if (!room || !room.secured) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Secure the room before assigning a C.O.R.E.",
    };
  }

  if (room.coreAssignment) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "A C.O.R.E. is already assigned here.",
    };
  }

  if (!hasEnoughResources(state.resources, blueprint.buildCost)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Insufficient build resources.",
    };
  }

  const coreAssignment: CoreAssignment = {
    type: coreType,
    assignedAtTick: theater.tickCount,
    buildCost: { ...blueprint.buildCost },
    upkeepPerTick: { ...blueprint.upkeepPerTick },
    wadUpkeepPerTick: blueprint.wadUpkeepPerTick,
    incomePerTick: { ...blueprint.incomePerTick },
    supportRadius: blueprint.supportRadius,
  };

  room.coreAssignment = coreAssignment;
  room.status = "secured";
  room.secured = true;

  console.log("[THEATER] core built", roomId, coreType);

  return {
    state: {
      ...state,
      resources: subtractResources(state.resources, blueprint.buildCost),
      phase: "operation",
      operation: resolveOperationFields(
        operation,
        addTheaterEvent(
          recomputeTheaterNetwork(theater),
          `C.O.R.E. :: ${blueprint.label} online at ${room.label}. Wad upkeep ${blueprint.wadUpkeepPerTick}/tick.`,
        ),
      ),
    },
    success: true,
    message: `${blueprint.label} assigned.`,
  };
}

export function fortifyTheaterRoom(state: GameState, roomId: RoomId, fortificationType: FortificationType): TheaterActionOutcome {
  const operation = ensureOperationHasTheater(state.operation);
  if (!operation?.theater) {
    return {
      state,
      success: false,
      message: "No active theater room selected.",
    };
  }

  const cost = FORTIFICATION_COSTS[fortificationType];
  const theater = cloneTheater(operation.theater);
  const room = theater.rooms[roomId];
  if (!room || !room.secured) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Only secured rooms can be fortified.",
    };
  }

  if (!hasEnoughResources(state.resources, cost)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Insufficient resources for fortification construction.",
    };
  }

  const maxSlots = room.fortificationCapacity ?? 3;
  if (getInstalledFortificationCount(room) >= maxSlots) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "No fortification slots remain in this room.",
    };
  }

  room.fortificationPips[fortificationType] += 1;
  room.fortified = getInstalledFortificationCount(room) > 0;
  if (fortificationType === "barricade") {
    room.damaged = false;
    room.underThreat = false;
    theater.activeThreats = theater.activeThreats.map((threat) =>
      threat.roomId === roomId ? { ...threat, active: false } : threat,
    );
  }

  const label = fortificationType === "barricade" ? "Barricade" : "Power Rail";

  return {
    state: {
      ...state,
      resources: subtractResources(state.resources, cost),
      phase: "operation",
      operation: resolveOperationFields(
        operation,
        addTheaterEvent(
          recomputeTheaterNetwork(theater),
          `FORTIFY :: ${label} installed at ${room.label}.`,
        ),
      ),
    },
    success: true,
    message: `${label} fortified.`,
  };
}

export function createTheaterBattleState(state: GameState, roomId: RoomId): RuntimeBattleState | null {
  const operation = ensureOperationHasTheater(state.operation);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return null;
  }

  const room = theater.rooms[roomId];
  if (!room) {
    return null;
  }

  const patchedState: GameState = {
    ...state,
    operation: resolveOperationFields(operation, {
      ...theater,
      currentRoomId: roomId,
      selectedRoomId: roomId,
    }),
  };

  const battle = createTestBattleForCurrentParty(patchedState);
  if (!battle) {
    return null;
  }

  const neighborPressure = room.adjacency.some((adjacentId) => {
    const adjacent = theater.rooms[adjacentId];
    return Boolean(adjacent?.underThreat || adjacent?.damaged || (adjacent?.secured && !adjacent?.supplied));
  });

  const isCutOff = room.secured ? !room.supplied : neighborPressure;
  const hasCommandSupport = Object.values(theater.rooms).some((candidate) => (
    candidate.secured &&
    candidate.supplied &&
    candidate.powered &&
    candidate.coreAssignment?.type === "command_center"
  ));
  const hasMedicalSupport = Object.values(theater.rooms).some((candidate) => (
    candidate.secured &&
    candidate.supplied &&
    candidate.coreAssignment?.type === "medical_ward"
  ));
  const hasArmorySupport = Object.values(theater.rooms).some((candidate) => (
    candidate.secured &&
    candidate.supplied &&
    candidate.coreAssignment?.type === "armory"
  ));
  const hasMineSupport = Object.values(theater.rooms).some((candidate) => (
    candidate.secured &&
    candidate.supplied &&
    !candidate.damaged &&
    candidate.coreAssignment?.type === "mine"
  ));

  const units = { ...battle.units };
  Object.values(units).forEach((unit) => {
    if (unit.isEnemy && (room.underThreat || room.damaged || isCutOff || room.tags.includes("elite") || room.tags.includes("objective"))) {
      const hpBonus = (room.tags.includes("elite") || room.tags.includes("objective")) ? 4 : 2;
      unit.maxHp += hpBonus;
      unit.hp += hpBonus;
      unit.atk += room.damaged || isCutOff ? 1 : 0;
    }

    if (!unit.isEnemy) {
      if (hasCommandSupport && room.supplied && room.powered) {
        unit.def += 1;
      }
      if (hasArmorySupport && room.supplied) {
        unit.atk += 1;
      }
      if (hasMedicalSupport && room.supplied) {
        unit.maxHp += 1;
        unit.hp += 1;
      }
    }
  });

  const theaterBattleLog = [
    `THEATER//ROOM :: ${room.label} [${room.sectorTag}]`,
    `THEATER//LOGISTICS :: SUP=${room.supplied ? "ONLINE" : "CUT"} PWR=${room.powered ? "RAILED" : "OFF"} COMMS=${room.commsVisible ? "VISIBLE" : "BLIND"}`,
  ];

  if (room.underThreat || room.damaged || isCutOff || neighborPressure) {
    theaterBattleLog.push("THEATER//PRESSURE :: Active theater instability is strengthening the hostile response.");
  }

  if (hasCommandSupport || hasArmorySupport || hasMedicalSupport) {
    theaterBattleLog.push(
      `THEATER//SUPPORT :: ${[
        hasCommandSupport ? "Command Center" : null,
        hasArmorySupport ? "Armory" : null,
        hasMedicalSupport ? "Medical Ward" : null,
      ].filter(Boolean).join(", ")} support is affecting the squad.`,
    );
  }
  if (hasMineSupport && room.supplied) {
    theaterBattleLog.push("THEATER//MINE :: Linked Mine C.O.R.E. will improve recovered Metal Scrap and Wood after this fight.");
  }

  return {
    ...battle,
    roomId,
    units,
    log: [...theaterBattleLog, ...battle.log],
    defenseObjective: isDefenseBattleRoom(room)
      ? {
          type: "survive_turns",
          turnsRequired: 3,
          turnsRemaining: 3,
          keyRoomId: room.id,
        }
      : battle.defenseObjective,
  };
}

export function getTheaterSummary(state: GameState): TheaterSummary {
  const operation = ensureOperationHasTheater(state.operation);
  const theater = operation?.theater;

  const rooms = theater ? Object.values(theater.rooms) : [];
  return {
    currentScreen: "THEATER_COMMAND",
    currentOperation: operation?.codename ?? "NONE",
    currentTheater: theater?.definition.name ?? "NONE",
    selectedRoomId: theater?.selectedRoomId ?? "none",
    currentTickCount: theater?.tickCount ?? 0,
    securedRooms: rooms.filter((room) => room.secured).length,
    coreCount: rooms.filter((room) => room.coreAssignment).length,
    threatenedRooms: rooms.filter((room) => room.underThreat || room.damaged).length,
  };
}

export function getTheaterStarterResources(): ResourceWallet {
  return { ...THEATER_STARTER_RESERVE };
}

export function getFortificationCost(type: FortificationType): Partial<ResourceWallet> {
  return { ...FORTIFICATION_COSTS[type] };
}

export function formatResourceCost(cost: Partial<ResourceWallet>): string {
  return [
    cost.metalScrap ? `${cost.metalScrap} Metal Scrap` : null,
    cost.wood ? `${cost.wood} Wood` : null,
    cost.chaosShards ? `${cost.chaosShards} Chaos Shards` : null,
    cost.steamComponents ? `${cost.steamComponents} Steam Components` : null,
  ].filter(Boolean).join(" / ") || "0";
}

export function getTheaterUpkeepPerTick(theater: TheaterNetworkState): TheaterEconomyPerTick {
  return {
    wadUpkeep: sumWadUpkeep(theater, 1),
    incomePerTick: sumResourceIncome(theater, 1),
  };
}

export function hasCompletedTheaterObjective(theater: TheaterNetworkState): boolean {
  return theater.objectiveComplete && theater.completion !== null;
}

export function recomputeTheaterNetwork(theater: TheaterNetworkState): TheaterNetworkState {
  return recomputeSupplyAndPower(theater);
}
