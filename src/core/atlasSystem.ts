import {
  AtlasFloorMap,
  AtlasTheaterSummary,
  OperationRun,
  RadialDirectionVector,
} from "./types";

function createRadialDirection(angleDeg: number): RadialDirectionVector {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: Number(Math.cos(radians).toFixed(4)),
    y: Number(Math.sin(radians).toFixed(4)),
  };
}

function createTheaterSummary(
  summary: Omit<AtlasTheaterSummary, "radialDirection">,
): AtlasTheaterSummary {
  return {
    ...summary,
    radialDirection: createRadialDirection(summary.angleDeg),
  };
}

const ATLAS_FLOOR_MAPS: AtlasFloorMap[] = [
  {
    floorId: "haven_floor_03",
    floorLabel: "FLOOR 03 // CURRENT HAVEN ANCHOR",
    floorOrdinal: 3,
    isCurrentFloor: true,
    ringIndex: 0,
    theaters: [
      createTheaterSummary({
        theaterId: "op_iron_gate_castellan_gateworks",
        operationId: "op_iron_gate",
        zoneName: "CASTELLAN GATEWORKS",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR E-01",
        radialSlotIndex: 0,
        radialSlotCount: 5,
        angleDeg: 0,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "ig_ingress",
        outwardDepth: 5,
        operationAvailable: true,
        currentState: "active",
        recommendedPwr: 24,
        securedRooms: 1,
        totalKnownRooms: 4,
        activeCores: 1,
        passiveEffectText: "Passive Benefit // Supply relay trims first deploy strain by 1.",
        passiveEffectKind: "benefit",
        threatLevel: "High",
        operationCodename: "IRON GATE",
        operationDescription: "Push from the uplink breach and stabilize the eastern lockline.",
      }),
      createTheaterSummary({
        theaterId: "atlas_ashwake_hollows",
        zoneName: "ASHWAKE HOLLOWS",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR S-02",
        radialSlotIndex: 1,
        radialSlotCount: 5,
        angleDeg: 72,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "ah_uplink",
        outwardDepth: 4,
        operationAvailable: false,
        currentState: "warm",
        recommendedPwr: 27,
        securedRooms: 2,
        totalKnownRooms: 5,
        activeCores: 1,
        passiveEffectText: "Passive Penalty // Ember fog raises ranged miss chance.",
        passiveEffectKind: "penalty",
        threatLevel: "Moderate",
        operationCodename: "ASHWAKE PATROL",
        operationDescription: "Survey ash vents and keep the route warm for a future push.",
      }),
      createTheaterSummary({
        theaterId: "atlas_glassmire_vaults",
        zoneName: "GLASSMIRE VAULTS",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR W-03",
        radialSlotIndex: 2,
        radialSlotCount: 5,
        angleDeg: 144,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "gv_uplink",
        outwardDepth: 4,
        operationAvailable: false,
        currentState: "cold",
        recommendedPwr: 22,
        securedRooms: 3,
        totalKnownRooms: 6,
        activeCores: 2,
        passiveEffectText: "Passive Benefit // Vault condensers increase scrap yield.",
        passiveEffectKind: "benefit",
        threatLevel: "Low",
        operationCodename: "VAULT LOCK",
        operationDescription: "Cold-storage sectors are stable but not currently staged for deployment.",
      }),
      createTheaterSummary({
        theaterId: "atlas_mireglass_unknown",
        zoneName: "UNKNOWN CONTACT",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR NW-04",
        radialSlotIndex: 3,
        radialSlotCount: 5,
        angleDeg: 216,
        ringIndex: 0,
        discovered: false,
        uplinkRoomId: "unknown_uplink",
        outwardDepth: 0,
        operationAvailable: false,
        currentState: "undiscovered",
        recommendedPwr: 0,
        securedRooms: 0,
        totalKnownRooms: 0,
        activeCores: 0,
        passiveEffectText: "No telemetry available.",
        passiveEffectKind: "neutral",
        threatLevel: "Unknown",
      }),
      createTheaterSummary({
        theaterId: "atlas_saintwire_orchard",
        zoneName: "SAINTWIRE ORCHARD",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR N-05",
        radialSlotIndex: 4,
        radialSlotCount: 5,
        angleDeg: 288,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "so_uplink",
        outwardDepth: 3,
        operationAvailable: false,
        currentState: "warm",
        recommendedPwr: 25,
        securedRooms: 1,
        totalKnownRooms: 4,
        activeCores: 0,
        passiveEffectText: "Passive Penalty // Wirebloom spores slowly raise strain.",
        passiveEffectKind: "penalty",
        threatLevel: "Moderate",
        operationCodename: "ORCHARD WATCH",
        operationDescription: "The orchard is mapped from the uplink but not greenlit for insertion.",
      }),
    ],
  },
  {
    floorId: "haven_floor_02",
    floorLabel: "FLOOR 02 // ARCHIVED HAVEN ANCHOR",
    floorOrdinal: 2,
    isCurrentFloor: false,
    ringIndex: 1,
    theaters: [
      createTheaterSummary({
        theaterId: "atlas_vesper_docks",
        zoneName: "VESPER DOCKS",
        floorId: "haven_floor_02",
        floorLabel: "FLOOR 02",
        floorOrdinal: 2,
        sectorLabel: "SECTOR E-01",
        radialSlotIndex: 0,
        radialSlotCount: 4,
        angleDeg: 24,
        ringIndex: 1,
        discovered: true,
        uplinkRoomId: "vd_uplink",
        outwardDepth: 3,
        operationAvailable: false,
        currentState: "cold",
        recommendedPwr: 18,
        securedRooms: 4,
        totalKnownRooms: 4,
        activeCores: 2,
        passiveEffectText: "Passive Benefit // Salvage ferries return bonus wood.",
        passiveEffectKind: "benefit",
        threatLevel: "Low",
      }),
      createTheaterSummary({
        theaterId: "atlas_blackglass_shaft",
        zoneName: "BLACKGLASS SHAFT",
        floorId: "haven_floor_02",
        floorLabel: "FLOOR 02",
        floorOrdinal: 2,
        sectorLabel: "SECTOR W-03",
        radialSlotIndex: 2,
        radialSlotCount: 4,
        angleDeg: 204,
        ringIndex: 1,
        discovered: true,
        uplinkRoomId: "bs_uplink",
        outwardDepth: 4,
        operationAvailable: false,
        currentState: "warm",
        recommendedPwr: 20,
        securedRooms: 2,
        totalKnownRooms: 5,
        activeCores: 1,
        passiveEffectText: "Passive Penalty // Residual glass static scrambles comms bursts.",
        passiveEffectKind: "penalty",
        threatLevel: "Moderate",
      }),
    ],
  },
];

function cloneTheaterSummary(summary: AtlasTheaterSummary): AtlasTheaterSummary {
  return {
    ...summary,
    radialDirection: { ...summary.radialDirection },
  };
}

function cloneFloorMap(floor: AtlasFloorMap): AtlasFloorMap {
  return {
    ...floor,
    theaters: floor.theaters.map(cloneTheaterSummary),
  };
}

export function getAtlasFloorMaps(): AtlasFloorMap[] {
  return ATLAS_FLOOR_MAPS
    .map(cloneFloorMap)
    .map((floor) => ({
      ...floor,
      theaters: floor.theaters.filter((theater) => theater.discovered),
    }))
    .filter((floor) => floor.theaters.length > 0);
}

export function getAtlasTheaterSummary(theaterId: string): AtlasTheaterSummary | null {
  for (const floor of ATLAS_FLOOR_MAPS) {
    const match = floor.theaters.find((theater) => theater.theaterId === theaterId);
    if (match) {
      return cloneTheaterSummary(match);
    }
  }

  return null;
}

export function getAtlasTheaterByOperationId(operationId: string | undefined): AtlasTheaterSummary | null {
  if (!operationId) {
    return null;
  }

  for (const floor of ATLAS_FLOOR_MAPS) {
    const match = floor.theaters.find((theater) => theater.operationId === operationId);
    if (match) {
      return cloneTheaterSummary(match);
    }
  }

  return null;
}

export function createAtlasOperation(theaterId: string): OperationRun | null {
  const theater = getAtlasTheaterSummary(theaterId);
  if (!theater || !theater.discovered || !theater.operationAvailable) {
    return null;
  }

  return {
    id: theater.operationId ?? theater.theaterId,
    codename: theater.operationCodename ?? theater.zoneName,
    description: theater.operationDescription ?? `Launch into ${theater.zoneName} from the HAVEN-facing uplink.`,
    objective: `Establish control from ${theater.sectorLabel} and push outward from the uplink room.`,
    recommendedPWR: theater.recommendedPwr,
    beginningState: `${theater.zoneName} synchronized. The uplink corridor is the HAVEN-side insertion root.`,
    endState: `${theater.zoneName} stabilized from the uplink wedge outward.`,
    floors: [
      {
        id: theater.floorId,
        name: theater.floorLabel,
        nodes: [],
      },
    ],
    currentFloorIndex: 0,
    currentRoomId: theater.uplinkRoomId,
    launchSource: "atlas",
    atlasTheaterId: theater.theaterId,
    atlasFloorId: theater.floorId,
  };
}
