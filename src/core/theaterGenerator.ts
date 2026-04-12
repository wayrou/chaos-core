import { loadCampaignProgress } from "./campaign";
import { getAtlasTheaterByOperationId, getAtlasTheaterSummary } from "./atlasSystem";
import {
  AtlasTheaterState,
  AtlasTheaterSummary,
  OperationRun,
  RadialDirectionVector,
  RoomId,
  TheaterDefinition,
  TheaterNetworkState,
  TheaterRoom,
  TheaterSprawlDirection,
} from "./types";
import {
  createEmptyFortificationPips,
  normalizeTheaterRoomNaturalStock,
  normalizeFortificationPips,
} from "./schemaSystem";
import { createEmptyTheaterAutomationState } from "./theaterAutomation";

type TheaterLayoutStyle = NonNullable<TheaterDefinition["layoutStyle"]>;
type TheaterRoomRole =
  | "ingress"
  | "frontline"
  | "relay"
  | "field"
  | "resource_pocket"
  | "core"
  | "power"
  | "elite"
  | "objective";

type TheaterRoomSeed = Pick<
  TheaterRoom,
  "id" | "label" | "sectorTag" | "localPosition" | "depthFromUplink" | "isUplinkRoom" | "size" | "adjacency" | "status" | "secured" | "tacticalEncounter" | "tags"
> & Omit<Partial<TheaterRoom>, "fortificationPips"> & {
  fortificationPips?: Partial<TheaterRoom["fortificationPips"]>;
};

function getDefaultModuleSlotCapacity(room: Pick<TheaterRoom, "isUplinkRoom" | "roomClass" | "tags">): number {
  if (room.roomClass === "mega") {
    return 2;
  }
  if (
    room.isUplinkRoom
    || room.tags.includes("relay")
    || room.tags.includes("core_candidate")
    || room.tags.includes("command_suitable")
    || room.tags.includes("uplink")
  ) {
    return 1;
  }
  return 0;
}

type TheaterProfile = {
  prefix: string;
  zoneName: string;
  sectorLabel: string;
  passiveEffectText: string;
  threatLevel: string;
  currentState: AtlasTheaterState;
  ingressLabels: string[];
  frontlineLabels: string[];
  relayLabels: string[];
  fieldLabels: string[];
  coreLabels: string[];
  powerLabels: string[];
  eliteLabels: string[];
  objectiveLabels: string[];
};

type LayoutNodeTemplate = {
  key: string;
  role: TheaterRoomRole;
  localPosition: { x: number; y: number };
  depthFromUplink: number;
  adjacency: string[];
};

type LayoutPresentation = {
  angleDeg: number;
  radialDirection: RadialDirectionVector;
  mapAnchor: { x: number; y: number };
  layoutStyle: TheaterLayoutStyle;
  originLabel: string;
};

type SeededRng = {
  nextFloat: () => number;
  nextInt: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
};

const MAP_WIDTH = 4400;
const MAP_HEIGHT = 3200;
const MAP_CENTER_X = Math.round(MAP_WIDTH / 2);
const MAP_CENTER_Y = Math.round(MAP_HEIGHT / 2);
const EDGE_MARGIN_X = 620;
const EDGE_MARGIN_Y = 420;
const DEFAULT_MAP_ANCHOR = { x: EDGE_MARGIN_X, y: MAP_CENTER_Y };
const THEATER_DEPTH_STEP = 430;
const THEATER_LATERAL_STEP = 360;

const THEATER_ROOM_BASE: Omit<
  TheaterRoom,
  "id" | "theaterId" | "label" | "sectorTag" | "position" | "localPosition" | "depthFromUplink" | "isUplinkRoom" | "size" | "adjacency" | "status" | "secured" | "tacticalEncounter" | "tags"
> = {
  fortified: false,
  coreAssignment: null,
  coreSlots: [null],
  coreSlotCapacity: 1,
  roomClass: "standard",
  underThreat: false,
  damaged: false,
  connected: false,
  powered: false,
  supplied: false,
  commsVisible: false,
  commsLinked: false,
  battleMapId: null,
  placedFieldAssets: [],
  fieldAssetRuntimeState: {},
  supplyFlow: 0,
  powerFlow: 0,
  commsFlow: 0,
  intelLevel: 0,
  fortificationPips: createEmptyFortificationPips(),
  isPowerSource: false,
  abandoned: false,
  requiredKeyType: null,
  grantsKeyType: null,
  keyCollected: false,
  enemySite: null,
};

function createEmptyKeyInventory() {
  return {
    triangle: false,
    square: false,
    circle: false,
    spade: false,
    star: false,
  };
}

const DEFAULT_PROFILE: TheaterProfile = {
  prefix: "thr",
  zoneName: "UNMAPPED THEATER",
  sectorLabel: "SECTOR X-00",
  passiveEffectText: "Passive Flux // Theater topology is unstable and resists long-range prediction.",
  threatLevel: "High",
  currentState: "active",
  ingressLabels: ["Ingress Aperture", "Staging Aperture", "Transit Aperture"],
  frontlineLabels: ["Broken Causeway", "Pressure Gate", "Forward Choke"],
  relayLabels: ["Signal Junction", "Relay Gallery", "Conduit Hub"],
  fieldLabels: ["Freight Annex", "Survey Pocket", "Sweep Channel"],
  coreLabels: ["Command Gallery", "Support Annex", "Cold Storage Spur"],
  powerLabels: ["Dyno Chamber", "Power Spine", "Generator Well"],
  eliteLabels: ["Redoubt Mouth", "Pressure Crucible", "Kill Vault"],
  objectiveLabels: ["Objective Lock", "Seal Node", "Command Lattice"],
};

const PROFILE_BY_OPERATION: Record<string, Partial<TheaterProfile>> = {
  op_iron_gate: {
    prefix: "ig",
    zoneName: "CASTELLAN GATEWORKS",
    sectorLabel: "SECTOR E-01",
    passiveEffectText: "Passive Benefit // Forward relay trims early deploy strain and stabilizes the lockline push.",
    threatLevel: "High",
    ingressLabels: ["Gateworks Aperture", "Breach Aperture", "Entry Aperture"],
    frontlineLabels: ["Broken Causeway", "Gate Checkpoint", "Shielded Span"],
    relayLabels: ["Signal Junction", "Overwatch Split", "Relay Spine"],
    fieldLabels: ["Freight Annex", "Cold Storage Spur", "Scrap Transit"],
    coreLabels: ["Overwatch Gallery", "Forward Storehouse", "Causeway Loft"],
    powerLabels: ["Dyno Chamber", "Generator Wing", "Rail Dynamo"],
    eliteLabels: ["Redoubt Mouth", "Lockline Bastion", "Breaker Court"],
    objectiveLabels: ["Iron Gate Lock", "Eastern Lockline", "Gate Crown"],
  },
  op_black_spire: {
    prefix: "bs",
    zoneName: "BLACK SPIRE ASCENT",
    sectorLabel: "SECTOR N-02",
    passiveEffectText: "Passive Penalty // Artillery shear rattles power rails and exposes long lanes to fire.",
    threatLevel: "Severe",
    ingressLabels: ["Spire Aperture", "Anchor Aperture", "Base Aperture"],
    frontlineLabels: ["Shard Ramp", "Gunline Arch", "Broken Stair"],
    relayLabels: ["Ballast Gallery", "Signal Niche", "Spire Switchyard"],
    fieldLabels: ["Powder Loft", "Survey Ledge", "Windbreak Crawl"],
    coreLabels: ["Command Belfry", "Supply Loft", "Cinder Archive"],
    powerLabels: ["Turbine Vault", "Lift Dynamo", "Spire Capacitor"],
    eliteLabels: ["Battery Roost", "Crown Bastion", "Sharpshot Redoubt"],
    objectiveLabels: ["Artillery Crown", "Spire Apex", "Bastion Seal"],
  },
  op_ghost_run: {
    prefix: "gr",
    zoneName: "GHOSTLINE TRANSIT",
    sectorLabel: "SECTOR W-05",
    passiveEffectText: "Passive Benefit // Phase vents shorten recovery windows between room pushes.",
    threatLevel: "High",
    ingressLabels: ["Ghost Aperture", "Phase Aperture", "Transit Aperture"],
    frontlineLabels: ["Silent Span", "Transit Choke", "Echo Lane"],
    relayLabels: ["Signal Drift", "Relay Hollow", "Spectral Switch"],
    fieldLabels: ["Cargo Pocket", "Survey Berm", "Dry Channel"],
    coreLabels: ["Transit Loft", "Switch Gallery", "Silent Annex"],
    powerLabels: ["Vent Chamber", "Static Coil", "Line Dynamo"],
    eliteLabels: ["Phantom Redoubt", "Null Bastion", "Specter Court"],
    objectiveLabels: ["Ghost Seal", "Transit Crown", "Shadow Junction"],
  },
  op_ember_siege: {
    prefix: "es",
    zoneName: "EMBER BASTION",
    sectorLabel: "SECTOR S-04",
    passiveEffectText: "Passive Penalty // Emberfall heats the grid and strains every exposed support lane.",
    threatLevel: "Severe",
    ingressLabels: ["Ash Aperture", "Siege Aperture", "Cinder Aperture"],
    frontlineLabels: ["Burnt Ramp", "Siege Furrow", "Cracked Emplacement"],
    relayLabels: ["Cinder Junction", "War Relay", "Bastion Spine"],
    fieldLabels: ["Ash Store", "Survey Furnace", "Coal Slip"],
    coreLabels: ["Breach Magazine", "Support Alcove", "Shell Loft"],
    powerLabels: ["Smelter Core", "Heat Rail", "Furnace Vault"],
    eliteLabels: ["Bastion Maw", "Firebreak Redoubt", "Crucible Gate"],
    objectiveLabels: ["Ember Keep", "Siege Crown", "Flame Seal"],
  },
  op_final_dawn: {
    prefix: "fd",
    zoneName: "FINAL DAWN CITADEL",
    sectorLabel: "SECTOR C-00",
    passiveEffectText: "Passive Benefit // Citadel relays amplify command coverage across the floor.",
    threatLevel: "Critical",
    ingressLabels: ["Dawn Aperture", "Citadel Aperture", "Crown Aperture"],
    frontlineLabels: ["Judgment Hall", "Crown Span", "Aurora Gate"],
    relayLabels: ["Command Junction", "Relay Basilica", "Crown Spine"],
    fieldLabels: ["Archive Walk", "Survey Cloister", "Dust Quadrant"],
    coreLabels: ["Command Choir", "Support Chapel", "North Annex"],
    powerLabels: ["Sunwell Core", "Halo Dynamo", "Citadel Capacitor"],
    eliteLabels: ["Crown Redoubt", "Final Bastion", "Aurora Killbox"],
    objectiveLabels: ["Dawn Throne", "Citadel Crown", "Final Seal"],
  },
  op_custom: {
    prefix: "cu",
    zoneName: "PROCEDURAL THEATER",
    sectorLabel: "SECTOR X-99",
    passiveEffectText: "Passive Flux // Procedural theater topology mutates every floor insertion.",
    threatLevel: "Variable",
    ingressLabels: ["Procedural Aperture", "Adaptive Aperture", "Survey Aperture"],
    frontlineLabels: ["Flux Choke", "Fracture Lane", "Adaptive Span"],
    relayLabels: ["Survey Junction", "Logistics Spine", "Thread Relay"],
    fieldLabels: ["Dust Pocket", "Harvest Annex", "Unmapped Pocket"],
    coreLabels: ["Support Scaffold", "Command Pocket", "Spool Gallery"],
    powerLabels: ["Pulse Well", "Grid Spine", "Runtime Dynamo"],
    eliteLabels: ["Pressure Nexus", "Breach Redoubt", "Adaptive Killbox"],
    objectiveLabels: ["Final Thread", "Descent Seal", "Runtime Crown"],
  },
};

const LAYOUT_TEMPLATES: Record<TheaterLayoutStyle, LayoutNodeTemplate[]> = {
  vector_lance: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline", "field"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.9, y: 0 }, depthFromUplink: 1, adjacency: ["ingress", "relay"] },
    { key: "field", role: "field", localPosition: { x: 1.05, y: 0.95 }, depthFromUplink: 1, adjacency: ["ingress", "core"] },
    { key: "core", role: "core", localPosition: { x: 1.95, y: 1.15 }, depthFromUplink: 2, adjacency: ["field", "relay"] },
    { key: "relay", role: "relay", localPosition: { x: 1.95, y: 0 }, depthFromUplink: 2, adjacency: ["frontline", "core", "power", "elite"] },
    { key: "power", role: "power", localPosition: { x: 2.2, y: -0.95 }, depthFromUplink: 3, adjacency: ["relay"] },
    { key: "elite", role: "elite", localPosition: { x: 3.2, y: 0.05 }, depthFromUplink: 4, adjacency: ["relay", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 4.2, y: 0.05 }, depthFromUplink: 5, adjacency: ["elite"] },
  ],
  split_fan: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.85, y: 0 }, depthFromUplink: 1, adjacency: ["ingress", "relay", "field"] },
    { key: "relay", role: "relay", localPosition: { x: 1.8, y: -0.9 }, depthFromUplink: 2, adjacency: ["frontline", "power", "elite"] },
    { key: "field", role: "field", localPosition: { x: 1.85, y: 0.95 }, depthFromUplink: 2, adjacency: ["frontline", "core", "elite"] },
    { key: "power", role: "power", localPosition: { x: 2.55, y: -1.4 }, depthFromUplink: 3, adjacency: ["relay"] },
    { key: "core", role: "core", localPosition: { x: 2.85, y: 1.15 }, depthFromUplink: 3, adjacency: ["field", "elite"] },
    { key: "elite", role: "elite", localPosition: { x: 3.75, y: 0.1 }, depthFromUplink: 4, adjacency: ["relay", "field", "core", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 4.7, y: 0.15 }, depthFromUplink: 5, adjacency: ["elite"] },
  ],
  central_bloom: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline", "relay", "field"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.9, y: -0.8 }, depthFromUplink: 1, adjacency: ["ingress", "core", "power"] },
    { key: "relay", role: "relay", localPosition: { x: 1.05, y: 0 }, depthFromUplink: 1, adjacency: ["ingress", "core", "elite"] },
    { key: "field", role: "field", localPosition: { x: 0.9, y: 0.9 }, depthFromUplink: 1, adjacency: ["ingress", "field_core", "elite"] },
    { key: "core", role: "core", localPosition: { x: 2.0, y: -0.25 }, depthFromUplink: 2, adjacency: ["frontline", "relay", "elite"] },
    { key: "field_core", role: "core", localPosition: { x: 1.9, y: 1.2 }, depthFromUplink: 2, adjacency: ["field", "elite"] },
    { key: "power", role: "power", localPosition: { x: 2.2, y: -1.2 }, depthFromUplink: 2, adjacency: ["frontline"] },
    { key: "elite", role: "elite", localPosition: { x: 3.05, y: 0.15 }, depthFromUplink: 3, adjacency: ["relay", "field", "core", "field_core", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 3.95, y: 0.1 }, depthFromUplink: 4, adjacency: ["elite"] },
  ],
  offset_arc: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.9, y: 0.15 }, depthFromUplink: 1, adjacency: ["ingress", "field", "core"] },
    { key: "field", role: "field", localPosition: { x: 1.65, y: -0.8 }, depthFromUplink: 2, adjacency: ["frontline", "power", "core"] },
    { key: "core", role: "core", localPosition: { x: 1.95, y: 0.95 }, depthFromUplink: 2, adjacency: ["frontline", "field", "relay"] },
    { key: "relay", role: "relay", localPosition: { x: 2.75, y: 1.05 }, depthFromUplink: 3, adjacency: ["core", "elite"] },
    { key: "power", role: "power", localPosition: { x: 3.0, y: -0.35 }, depthFromUplink: 3, adjacency: ["field", "elite"] },
    { key: "elite", role: "elite", localPosition: { x: 3.85, y: 0.6 }, depthFromUplink: 4, adjacency: ["relay", "power", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 4.65, y: 0.95 }, depthFromUplink: 5, adjacency: ["elite"] },
  ],
};

const DIRECTION_ANGLE_MAP: Record<TheaterSprawlDirection, number> = {
  east: 0,
  southeast: 45,
  south: 90,
  southwest: 135,
  west: 180,
  northwest: 225,
  north: 270,
  northeast: 315,
};

function createDirection(angleDeg: number): RadialDirectionVector {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: Number(Math.cos(radians).toFixed(4)),
    y: Number(Math.sin(radians).toFixed(4)),
  };
}

function createSeededRng(seed: string): SeededRng {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
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

function resolveAtlasSummaryForOperation(operation: OperationRun): AtlasTheaterSummary | null {
  return (
    (operation.atlasTheaterId ? getAtlasTheaterSummary(operation.atlasTheaterId) : null)
    ?? getAtlasTheaterByOperationId(operation.id)
  );
}

function resolveRunSeed(operation: OperationRun, floorIndex: number): string {
  const progress = loadCampaignProgress();
  const activeRun = progress.activeRun?.operationId === operation.id ? progress.activeRun : null;
  return [
    operation.id ?? operation.codename,
    operation.codename,
    activeRun?.rngSeed ?? operation.description,
    String(floorIndex),
    String(operation.floors.length),
  ].join("::");
}

function resolveProfile(operation: OperationRun, floorIndex: number, atlasSummary: AtlasTheaterSummary | null): TheaterProfile {
  const profileOverride = PROFILE_BY_OPERATION[operation.id ?? ""] ?? {};
  const floor = operation.floors[floorIndex];
  const zoneName = atlasSummary?.zoneName ?? profileOverride.zoneName ?? operation.codename;
  const sectorLabel = atlasSummary?.sectorLabel ?? profileOverride.sectorLabel ?? `SECTOR ${(operation.id ?? "op").slice(0, 2).toUpperCase()}-${String(floorIndex + 1).padStart(2, "0")}`;

  return {
    ...DEFAULT_PROFILE,
    ...profileOverride,
    sectorLabel,
    currentState: atlasSummary?.currentState ?? profileOverride.currentState ?? "active",
    threatLevel: atlasSummary?.threatLevel ?? profileOverride.threatLevel ?? "High",
    passiveEffectText: atlasSummary?.passiveEffectText ?? profileOverride.passiveEffectText ?? DEFAULT_PROFILE.passiveEffectText,
    prefix: profileOverride.prefix ?? (operation.id ?? "thr").replace(/[^a-z0-9]/gi, "").slice(0, 3).toLowerCase(),
    zoneName: floor?.name?.includes("//")
      ? `${zoneName} // ${floor.name.split("//")[1]?.trim() ?? `FLOOR ${floorIndex + 1}`}`
      : zoneName,
  };
}

function normalizeAngle(angleDeg: number): number {
  const normalized = angleDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getAngleBucket(angleDeg: number): "east" | "south" | "west" | "north" {
  const normalized = normalizeAngle(angleDeg);
  if (normalized < 45 || normalized >= 315) return "east";
  if (normalized < 135) return "south";
  if (normalized < 225) return "west";
  return "north";
}

function getRequestedSprawlDirection(operation: OperationRun): TheaterSprawlDirection | null {
  return operation.sprawlDirection ?? null;
}

function createDirectionalAnchor(
  direction: TheaterSprawlDirection,
  style: Exclude<TheaterLayoutStyle, "central_bloom">,
  rng: SeededRng,
): { x: number; y: number } {
  const edgeY = MAP_CENTER_Y + rng.nextInt(-240, 240);
  const edgeX = MAP_CENTER_X + rng.nextInt(-360, 360);
  const offsetX = Math.round(MAP_WIDTH * 0.29);
  const offsetY = Math.round(MAP_HEIGHT * 0.24);
  const edgeAnchors: Record<TheaterSprawlDirection, { x: number; y: number }> = {
    east: { x: EDGE_MARGIN_X, y: edgeY },
    southeast: { x: EDGE_MARGIN_X + 180 + rng.nextInt(-100, 100), y: EDGE_MARGIN_Y + 140 + rng.nextInt(-80, 120) },
    south: { x: edgeX, y: EDGE_MARGIN_Y },
    southwest: { x: MAP_WIDTH - EDGE_MARGIN_X - 180 + rng.nextInt(-100, 100), y: EDGE_MARGIN_Y + 140 + rng.nextInt(-80, 120) },
    west: { x: MAP_WIDTH - EDGE_MARGIN_X, y: edgeY },
    northwest: { x: MAP_WIDTH - EDGE_MARGIN_X - 180 + rng.nextInt(-100, 100), y: MAP_HEIGHT - EDGE_MARGIN_Y - 140 + rng.nextInt(-120, 80) },
    north: { x: edgeX, y: MAP_HEIGHT - EDGE_MARGIN_Y },
    northeast: { x: EDGE_MARGIN_X + 180 + rng.nextInt(-100, 100), y: MAP_HEIGHT - EDGE_MARGIN_Y - 140 + rng.nextInt(-120, 80) },
  };

  if (style === "offset_arc") {
    return {
      east: { x: offsetX, y: MAP_CENTER_Y - 260 + rng.nextInt(-180, 180) },
      southeast: { x: offsetX + rng.nextInt(-160, 160), y: offsetY + rng.nextInt(-90, 120) },
      south: { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: offsetY },
      southwest: { x: MAP_WIDTH - offsetX + rng.nextInt(-160, 160), y: offsetY + rng.nextInt(-90, 120) },
      west: { x: MAP_WIDTH - offsetX, y: MAP_CENTER_Y + 260 + rng.nextInt(-180, 180) },
      northwest: { x: MAP_WIDTH - offsetX + rng.nextInt(-160, 160), y: MAP_HEIGHT - offsetY + rng.nextInt(-120, 90) },
      north: { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: MAP_HEIGHT - offsetY },
      northeast: { x: offsetX + rng.nextInt(-160, 160), y: MAP_HEIGHT - offsetY + rng.nextInt(-120, 90) },
    }[direction];
  }

  return edgeAnchors[direction];
}

function createPresentation(
  operation: OperationRun,
  floorIndex: number,
  atlasSummary: AtlasTheaterSummary | null,
  rng: SeededRng,
): LayoutPresentation {
  const preferredDirection = getRequestedSprawlDirection(operation);
  const layoutStyles: TheaterLayoutStyle[] = preferredDirection
    ? ["vector_lance", "split_fan", "offset_arc"]
    : ["vector_lance", "split_fan", "central_bloom", "offset_arc"];
  const style = layoutStyles[(floorIndex + rng.nextInt(0, layoutStyles.length - 1)) % layoutStyles.length] ?? "vector_lance";
  const allowedAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const angleDeg =
    floorIndex === 0 && atlasSummary
      ? atlasSummary.angleDeg
      : preferredDirection
        ? DIRECTION_ANGLE_MAP[preferredDirection]
        : allowedAngles[(floorIndex * 3 + rng.nextInt(0, allowedAngles.length - 1)) % allowedAngles.length] ?? 0;
  const direction = createDirection(angleDeg);

  if (preferredDirection && style !== "central_bloom") {
    return {
      angleDeg,
      radialDirection: direction,
      mapAnchor: createDirectionalAnchor(preferredDirection, style, rng),
      layoutStyle: style,
      originLabel: style === "split_fan" ? "FAN INSERT" : style === "offset_arc" ? "OFFSET BREACH" : "EDGE INSERT",
    };
  }

  if (style === "central_bloom") {
    return {
      angleDeg,
      radialDirection: direction,
      mapAnchor: {
        x: Math.round((MAP_WIDTH / 2) + rng.nextInt(-240, 240)),
        y: Math.round((MAP_HEIGHT / 2) + rng.nextInt(-220, 220)),
      },
      layoutStyle: style,
      originLabel: "CENTER BREACH",
    };
  }

  if (style === "offset_arc") {
    const bucket = getAngleBucket(angleDeg);
    const offsetX = Math.round(MAP_WIDTH * 0.29);
    const offsetY = Math.round(MAP_HEIGHT * 0.24);
    const mapAnchor =
      bucket === "east"
        ? { x: offsetX, y: MAP_CENTER_Y - 260 + rng.nextInt(-180, 180) }
        : bucket === "south"
          ? { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: offsetY }
          : bucket === "west"
            ? { x: MAP_WIDTH - offsetX, y: MAP_CENTER_Y + 260 + rng.nextInt(-180, 180) }
            : { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: MAP_HEIGHT - offsetY };
    return {
      angleDeg,
      radialDirection: direction,
      mapAnchor,
      layoutStyle: style,
      originLabel: "OFFSET BREACH",
    };
  }

  const edgeBucket = getAngleBucket(angleDeg);
  const mapAnchor =
    edgeBucket === "east"
      ? { x: EDGE_MARGIN_X, y: MAP_CENTER_Y + rng.nextInt(-240, 240) }
      : edgeBucket === "south"
        ? { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: EDGE_MARGIN_Y }
        : edgeBucket === "west"
          ? { x: MAP_WIDTH - EDGE_MARGIN_X, y: MAP_CENTER_Y + rng.nextInt(-240, 240) }
          : { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: MAP_HEIGHT - EDGE_MARGIN_Y };

  return {
    angleDeg,
    radialDirection: direction,
    mapAnchor,
    layoutStyle: style,
    originLabel: style === "split_fan" ? "FAN INSERT" : "EDGE INSERT",
  };
}

function projectTheaterPosition(
  definition: Pick<TheaterDefinition, "angleDeg" | "mapAnchor">,
  localPosition: { x: number; y: number },
): { x: number; y: number } {
  const radians = (definition.angleDeg * Math.PI) / 180;
  const forward = { x: Math.cos(radians), y: Math.sin(radians) };
  const lateral = { x: -forward.y, y: forward.x };
  const anchor = definition.mapAnchor ?? DEFAULT_MAP_ANCHOR;

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

function createSectorTag(depth: number, lateral: number): string {
  const row = String.fromCharCode(65 + Math.max(0, Math.min(25, Math.floor(depth))));
  const lane = Math.round(lateral);
  return `${row}${lane >= 0 ? lane : `${lane}`}`;
}

function getRoomSize(role: TheaterRoomRole): { width: number; height: number } {
  switch (role) {
    case "ingress":
      return { width: 250, height: 146 };
    case "resource_pocket":
      return { width: 520, height: 292 };
    case "objective":
      return { width: 278, height: 164 };
    case "elite":
      return { width: 264, height: 154 };
    case "power":
      return { width: 236, height: 144 };
    default:
      return { width: 248, height: 148 };
  }
}

function getClearMode(role: TheaterRoomRole, rng: SeededRng): "battle" | "field" | "empty" {
  switch (role) {
    case "ingress":
    case "power":
      return "empty";
    case "field":
      return "field";
    case "resource_pocket":
      return rng.nextFloat() < 0.55 ? "battle" : "field";
    case "core":
      return rng.nextFloat() < 0.42 ? "battle" : "empty";
    default:
      return "battle";
  }
}

function getTagsForRole(role: TheaterRoomRole): string[] {
  switch (role) {
    case "ingress":
      return ["ingress", "uplink"];
    case "frontline":
      return ["frontier"];
    case "relay":
      return ["junction"];
    case "field":
      return ["core_candidate", "metal_rich", "timber_rich", "salvage_rich"];
    case "resource_pocket":
      return ["core_candidate", "resource_pocket", "salvage_rich"];
    case "core":
      return ["core_candidate", "command_suitable"];
    case "power":
      return ["power_source", "steam_vent"];
    case "elite":
      return ["elite", "frontier"];
    case "objective":
      return ["objective", "elite", "survey_highground"];
    default:
      return [];
  }
}

function getLabelPool(profile: TheaterProfile, role: TheaterRoomRole): string[] {
  switch (role) {
    case "ingress":
      return profile.ingressLabels;
    case "frontline":
      return profile.frontlineLabels;
    case "relay":
      return profile.relayLabels;
    case "field":
      return profile.fieldLabels;
    case "resource_pocket":
      return profile.fieldLabels;
    case "core":
      return profile.coreLabels;
    case "power":
      return profile.powerLabels;
    case "elite":
      return profile.eliteLabels;
    case "objective":
      return profile.objectiveLabels;
    default:
      return [DEFAULT_PROFILE.zoneName];
  }
}

function createRoom(
  definition: TheaterDefinition,
  room: TheaterRoomSeed,
): TheaterRoom {
  const naturalStock = normalizeTheaterRoomNaturalStock(
    room.tags,
    room.naturalResourceStock,
    room.naturalResourceStockMax,
  );
  const coreSlots = Array.isArray(room.coreSlots)
    ? room.coreSlots.map((assignment) => assignment ? {
      ...assignment,
      buildCost: { ...assignment.buildCost },
      upkeepPerTick: { ...assignment.upkeepPerTick },
      incomePerTick: { ...assignment.incomePerTick },
    } : null)
    : [room.coreAssignment ? {
      ...room.coreAssignment,
      buildCost: { ...room.coreAssignment.buildCost },
      upkeepPerTick: { ...room.coreAssignment.upkeepPerTick },
      incomePerTick: { ...room.coreAssignment.incomePerTick },
    } : null];
  return {
    ...THEATER_ROOM_BASE,
    theaterId: definition.id,
    ...room,
    position: room.position ?? projectTheaterPosition(definition, room.localPosition),
    clearMode: room.clearMode ?? (room.tacticalEncounter ? "battle" : "empty"),
    fortificationCapacity: room.fortificationCapacity ?? 3,
    fortificationPips: normalizeFortificationPips(room.fortificationPips),
    roomClass: room.roomClass ?? "standard",
    coreSlotCapacity: Math.max(1, room.coreSlotCapacity ?? coreSlots.length ?? 1),
    moduleSlotCapacity: Math.max(0, room.moduleSlotCapacity ?? getDefaultModuleSlotCapacity({
      isUplinkRoom: room.isUplinkRoom,
      roomClass: room.roomClass ?? "standard",
      tags: room.tags,
    })),
    moduleSlots: Array.from({
      length: Math.max(0, room.moduleSlotCapacity ?? getDefaultModuleSlotCapacity({
        isUplinkRoom: room.isUplinkRoom,
        roomClass: room.roomClass ?? "standard",
        tags: room.tags,
      })),
    }, (_, index) => room.moduleSlots?.[index] ?? null),
    moduleSlotUpgradeLevel: Math.max(0, Number(room.moduleSlotUpgradeLevel ?? 0)),
    coreSlots,
    coreAssignment: room.coreAssignment ?? coreSlots.find((assignment) => assignment !== null) ?? null,
    enemySite: room.enemySite ? { ...room.enemySite } : null,
    naturalResourceStock: naturalStock.current,
    naturalResourceStockMax: naturalStock.max,
    battleSizeOverride: room.battleSizeOverride ? { ...room.battleSizeOverride } : undefined,
  };
}

function uniqueRoomTags(tags: string[]): string[] {
  return [...new Set(tags.filter(Boolean))];
}

function chooseAffinityTags(rng: SeededRng, count: number): string[] {
  const pool = ["metal_rich", "timber_rich", "steam_vent"];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const next = rng.pick(pool);
    picked.push(next);
    pool.splice(pool.indexOf(next), 1);
  }
  return picked;
}

function pickMegaRoomSeed(roomSeeds: TheaterRoomSeed[], rng: SeededRng): TheaterRoomSeed | null {
  if (rng.nextFloat() > 0.6) {
    return null;
  }

  const candidates = roomSeeds
    .filter((seed) => (
      !seed.isUplinkRoom
      && !seed.secured
      && !seed.tags.includes("objective")
      && !seed.tags.includes("elite")
      && (
        seed.clearMode === "field"
        || seed.tags.includes("metal_rich")
        || seed.tags.includes("timber_rich")
        || seed.tags.includes("salvage_rich")
      )
    ))
    .sort((left, right) => (
      right.depthFromUplink - left.depthFromUplink
      || Math.abs(right.localPosition.y) - Math.abs(left.localPosition.y)
    ));

  if (candidates.length <= 0) {
    return null;
  }

  return candidates[Math.min(candidates.length - 1, rng.nextInt(0, Math.min(2, candidates.length - 1)))] ?? candidates[0];
}

function applyMegaRoomSeed(seed: TheaterRoomSeed, rng: SeededRng): void {
  const affinityTags = chooseAffinityTags(rng, 2);
  seed.roomClass = "mega";
  seed.coreSlotCapacity = 4;
  seed.coreSlots = [null, null, null, null];
  seed.fortificationCapacity = 8;
  seed.battleSizeOverride = { width: 10, height: 8 };
  seed.size = getRoomSize("resource_pocket");
  seed.tags = uniqueRoomTags([
    ...seed.tags.filter((tag) => tag !== "enemy_staging"),
    "resource_pocket",
    "core_candidate",
    "salvage_rich",
    ...affinityTags,
  ]);
  if (seed.clearMode === "empty") {
    seed.clearMode = "field";
  }
}

function pickStagingRoomSeed(roomSeeds: TheaterRoomSeed[], excludedRoomId: RoomId | null, rng: SeededRng): TheaterRoomSeed | null {
  const candidates = roomSeeds
    .filter((seed) => (
      seed.id !== excludedRoomId
      && !seed.isUplinkRoom
      && !seed.secured
      && !seed.tags.includes("objective")
      && (seed.depthFromUplink >= 3 || seed.tags.includes("elite") || seed.tags.includes("frontier"))
    ))
    .sort((left, right) => (
      right.depthFromUplink - left.depthFromUplink
      || Math.abs(right.localPosition.y) - Math.abs(left.localPosition.y)
    ));

  if (candidates.length <= 0) {
    return null;
  }

  return candidates[Math.min(candidates.length - 1, rng.nextInt(0, Math.min(3, candidates.length - 1)))] ?? candidates[0];
}

function applyStagingRoomSeed(seed: TheaterRoomSeed, definition: TheaterDefinition, rng: SeededRng): void {
  seed.tags = uniqueRoomTags([
    ...seed.tags,
    "enemy_staging",
    "frontier",
  ]);
  seed.clearMode = "battle";
  seed.tacticalEncounter = seed.tacticalEncounter ?? `${definition.id}_staging_${seed.id}`;
  seed.enemySite = {
    type: "staging",
    reserveStrength: rng.nextInt(2, 4),
    dispatchInterval: rng.nextInt(3, 5),
    nextDispatchTick: rng.nextInt(2, 4),
    patrolStrength: rng.nextInt(1, 3),
  };
}

function roundLocalCoordinate(value: number): number {
  return Number(value.toFixed(2));
}

function connectTemplateNodes(nodes: LayoutNodeTemplate[], sourceKey: string, targetKey: string): void {
  const source = nodes.find((node) => node.key === sourceKey);
  const target = nodes.find((node) => node.key === targetKey);
  if (!source || !target) {
    return;
  }

  if (!source.adjacency.includes(targetKey)) {
    source.adjacency.push(targetKey);
  }
  if (!target.adjacency.includes(sourceKey)) {
    target.adjacency.push(sourceKey);
  }
}

function jitterTemplatePosition(
  basePosition: { x: number; y: number },
  role: TheaterRoomRole,
  style: TheaterLayoutStyle,
  rng: SeededRng,
  index: number,
): { x: number; y: number } {
  if (role === "ingress") {
    return { ...basePosition };
  }

  const forwardVariance =
    role === "objective"
      ? 0.16
      : role === "elite"
        ? 0.28
        : 0.44;
  const lateralVariance =
    style === "central_bloom"
      ? 0.95
      : style === "offset_arc"
        ? 0.82
        : 0.72;
  const laneBias =
    Math.abs(basePosition.y) < 0.35 && role !== "objective"
      ? (index % 2 === 0 ? 1 : -1) * (0.2 + rng.nextFloat() * 0.36)
      : 0;

  return {
    x: roundLocalCoordinate(basePosition.x + ((rng.nextFloat() - 0.5) * forwardVariance)),
    y: roundLocalCoordinate(basePosition.y + laneBias + ((rng.nextFloat() - 0.5) * lateralVariance)),
  };
}

function stretchTemplatePosition(
  basePosition: { x: number; y: number },
  role: TheaterRoomRole,
  style: TheaterLayoutStyle,
  rng: SeededRng,
): { x: number; y: number } {
  if (role === "ingress") {
    return { ...basePosition };
  }

  const forwardScale =
    role === "objective"
      ? 1.5 + (rng.nextFloat() * 0.25)
      : role === "elite"
        ? 1.34 + (rng.nextFloat() * 0.22)
        : 1.18 + (rng.nextFloat() * 0.24);
  const lateralScale =
    style === "central_bloom"
      ? 1.2 + (rng.nextFloat() * 0.24)
      : 1.34 + (rng.nextFloat() * 0.34);
  const laneBias =
    Math.abs(basePosition.y) < 0.35 && role !== "objective"
      ? (rng.nextFloat() < 0.5 ? -1 : 1) * (0.18 + (rng.nextFloat() * 0.46))
      : 0;
  const forwardBias =
    role === "objective"
      ? 0.4 + (rng.nextFloat() * 0.8)
      : role === "elite"
        ? 0.22 + (rng.nextFloat() * 0.42)
        : rng.nextFloat() * 0.28;

  return {
    x: roundLocalCoordinate((basePosition.x * forwardScale) + forwardBias),
    y: roundLocalCoordinate((basePosition.y * lateralScale) + laneBias),
  };
}

function createExpandedLayoutTemplate(style: TheaterLayoutStyle, rng: SeededRng): LayoutNodeTemplate[] {
  const baseTemplate = (LAYOUT_TEMPLATES[style] ?? LAYOUT_TEMPLATES.vector_lance).map((node, index) => ({
    ...node,
    localPosition: jitterTemplatePosition(
      stretchTemplatePosition(node.localPosition, node.role, style, rng),
      node.role,
      style,
      rng,
      index,
    ),
    adjacency: [...node.adjacency],
  }));

  const extraRoomCount = 5 + rng.nextInt(1, style === "central_bloom" ? 4 : 5);
  for (let index = 0; index < extraRoomCount; index++) {
    const eligibleParents = baseTemplate.filter((node) => (
      node.role !== "objective" &&
      node.depthFromUplink >= 1 &&
      node.depthFromUplink <= 6
    ));
    const parent = eligibleParents.length > 0 ? rng.pick(eligibleParents) : null;
    if (!parent) {
      break;
    }

    const rolePool: TheaterRoomRole[] =
      parent.depthFromUplink >= 3
        ? ["field", "core", "relay", "field", "core", "elite", "power"]
        : ["field", "core", "relay", "field", "core", "power"];
    const role = rng.pick(rolePool);
    const branchDepth =
      role === "elite"
        ? Math.max(4, parent.depthFromUplink + 1)
        : parent.depthFromUplink + 1;
    const depthFromUplink = Math.min(7, branchDepth);
    const lateralSeed =
      Math.abs(parent.localPosition.y) < 0.5
        ? (rng.nextFloat() < 0.5 ? -1 : 1) * (1.15 + rng.nextFloat() * 1.75)
        : parent.localPosition.y + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.9 + rng.nextFloat() * 1.4);

    const spurKey = `spur_${index}`;
    baseTemplate.push({
      key: spurKey,
      role,
      localPosition: {
        x: roundLocalCoordinate(parent.localPosition.x + 1.2 + (rng.nextFloat() * 2.15) + ((depthFromUplink - parent.depthFromUplink - 1) * 0.45)),
        y: roundLocalCoordinate(lateralSeed + ((rng.nextFloat() - 0.5) * 1.1)),
      },
      depthFromUplink,
      adjacency: [parent.key],
    });
    connectTemplateNodes(baseTemplate, parent.key, spurKey);

    if (rng.nextFloat() < 0.42) {
      const secondaryCandidates = baseTemplate.filter((candidate) => (
        candidate.key !== spurKey &&
        candidate.key !== parent.key &&
        candidate.role !== "objective" &&
        Math.abs(candidate.depthFromUplink - depthFromUplink) <= 1 &&
        Math.abs(candidate.localPosition.x - parent.localPosition.x) <= 3.4
      ));
      if (secondaryCandidates.length > 0) {
        connectTemplateNodes(baseTemplate, spurKey, rng.pick(secondaryCandidates).key);
      }
    }
  }

  return baseTemplate;
}

function buildRoomSeeds(
  _operation: OperationRun,
  floorIndex: number,
  profile: TheaterProfile,
  definition: TheaterDefinition,
  style: TheaterLayoutStyle,
  rng: SeededRng,
): { rooms: Record<RoomId, TheaterRoom>; uplinkRoomId: RoomId; powerSourceRoomIds: RoomId[] } {
  const template = createExpandedLayoutTemplate(style, rng);
  const roomIdByKey = new Map<string, RoomId>();

  template.forEach((node) => {
    roomIdByKey.set(node.key, `${profile.prefix}_f${floorIndex + 1}_${node.key}`);
  });

  const roomSeeds: TheaterRoomSeed[] = template.map((node, index) => {
    const roomId = roomIdByKey.get(node.key)!;
    const clearMode = getClearMode(node.role, rng);
    const tags = getTagsForRole(node.role);
    const labelPool = getLabelPool(profile, node.role);

    return {
      id: roomId,
      label: rng.pick(labelPool),
      sectorTag: createSectorTag(node.depthFromUplink, node.localPosition.y),
      localPosition: node.localPosition,
      depthFromUplink: node.depthFromUplink,
      isUplinkRoom: node.role === "ingress",
      size: getRoomSize(node.role),
      adjacency: node.adjacency.map((adjacentKey) => roomIdByKey.get(adjacentKey)!).filter(Boolean),
      status: node.role === "ingress" ? "secured" : node.depthFromUplink <= 1 ? "mapped" : "unknown",
      secured: node.role === "ingress",
      tacticalEncounter: clearMode === "battle" ? `${definition.id}_${node.role}_${index}` : null,
      tags,
      clearMode,
      fortified: node.role === "ingress",
      roomClass: "standard",
      coreSlotCapacity: 1,
      coreSlots: [null],
      fortificationCapacity: node.role === "ingress" ? 4 : node.role === "objective" ? 4 : 3,
      fortificationPips: node.role === "ingress" ? { barricade: 1, powerRail: 1 } : undefined,
      isPowerSource: node.role === "ingress" || node.role === "power",
    };
  });

  const megaRoomSeed = pickMegaRoomSeed(roomSeeds, rng);
  if (megaRoomSeed) {
    applyMegaRoomSeed(megaRoomSeed, rng);
  }

  const stagingRoomSeed = pickStagingRoomSeed(roomSeeds, megaRoomSeed?.id ?? null, rng);
  if (stagingRoomSeed) {
    applyStagingRoomSeed(stagingRoomSeed, definition, rng);
  }

  const rooms = Object.fromEntries(
    roomSeeds.map((room) => [room.id, createRoom(definition, room)]),
  );
  const uplinkRoomId = roomIdByKey.get("ingress")!;
  const powerSourceRoomIds = roomSeeds.filter((room) => room.isPowerSource).map((room) => room.id);
  return { rooms, uplinkRoomId, powerSourceRoomIds };
}

function hasAlternateEdgeRoute(
  rooms: Record<RoomId, TheaterRoom>,
  fromRoomId: RoomId,
  toRoomId: RoomId,
): boolean {
  const queue: RoomId[] = [fromRoomId];
  const visited = new Set<RoomId>([fromRoomId]);

  while (queue.length > 0) {
    const currentRoomId = queue.shift()!;
    const room = rooms[currentRoomId];
    if (!room) {
      continue;
    }

    for (const adjacentId of room.adjacency) {
      const isIgnoredDirectEdge =
        (currentRoomId === fromRoomId && adjacentId === toRoomId)
        || (currentRoomId === toRoomId && adjacentId === fromRoomId);
      if (isIgnoredDirectEdge) {
        continue;
      }
      if (adjacentId === toRoomId) {
        return true;
      }
      if (visited.has(adjacentId) || !rooms[adjacentId]) {
        continue;
      }
      visited.add(adjacentId);
      queue.push(adjacentId);
    }
  }

  return false;
}

function assignPowerGatedPassages(
  rooms: Record<RoomId, TheaterRoom>,
  rng: SeededRng,
): void {
  Object.values(rooms).forEach((room) => {
    room.powerGateWatts = { ...(room.powerGateWatts ?? {}) };
  });

  const candidates: Array<{ roomId: RoomId; adjacentId: RoomId }> = [];
  const seenEdges = new Set<string>();

  Object.values(rooms).forEach((room) => {
    room.adjacency.forEach((adjacentId) => {
      const adjacentRoom = rooms[adjacentId];
      if (!adjacentRoom) {
        return;
      }

      const edgeKey = [room.id, adjacentId].sort().join("__");
      if (seenEdges.has(edgeKey)) {
        return;
      }
      seenEdges.add(edgeKey);

      if (room.isUplinkRoom || adjacentRoom.isUplinkRoom) {
        return;
      }
      if (Math.min(room.depthFromUplink, adjacentRoom.depthFromUplink) < 2) {
        return;
      }
      if (!hasAlternateEdgeRoute(rooms, room.id, adjacentId)) {
        return;
      }

      candidates.push({ roomId: room.id, adjacentId });
    });
  });

  let gatedCount = 0;
  const maxGateCount = Math.max(1, Math.min(4, Math.ceil(candidates.length * 0.35)));

  candidates.forEach(({ roomId, adjacentId }) => {
    if (gatedCount >= maxGateCount || rng.nextFloat() > 0.4) {
      return;
    }

    const room = rooms[roomId];
    const adjacentRoom = rooms[adjacentId];
    if (!room || !adjacentRoom) {
      return;
    }

    const wattsRequired = rng.nextInt(1, 5) * 100;
    room.powerGateWatts![adjacentId] = wattsRequired;
    adjacentRoom.powerGateWatts![roomId] = wattsRequired;
    gatedCount += 1;
  });
}

export function createGeneratedTheaterFloor(operation: OperationRun, floorIndex: number): TheaterNetworkState {
  const atlasSummary = floorIndex === 0 ? resolveAtlasSummaryForOperation(operation) : null;
  const seed = resolveRunSeed(operation, floorIndex);
  const rng = createSeededRng(seed);
  const profile = resolveProfile(operation, floorIndex, atlasSummary);
  const presentation = createPresentation(operation, floorIndex, atlasSummary, rng);
  const floor = operation.floors[floorIndex];
  const isFinalFloor = floorIndex >= operation.floors.length - 1;
  const floorIdBase = atlasSummary?.floorId ?? operation.atlasFloorId ?? `${operation.id ?? profile.prefix}_floor`;
  const floorId = floorIndex === 0 ? floorIdBase : `${floorIdBase}_${floorIndex + 1}`;
  const floorName = floor?.name ?? `Floor ${floorIndex + 1}`;
  const objective = operation.objective ?? (
    isFinalFloor
      ? `Secure ${profile.zoneName} and stabilize the final objective room at the outer edge of the theater.`
      : `Secure ${profile.zoneName}, push outward from the uplink, and reach the descent point for the next floor.`
  );
  const beginningState = operation.beginningState ?? `${profile.zoneName} synchronized for ${floorName}. Uplink root online at ${presentation.originLabel}.`;
  const endState = operation.endState ?? (
    isFinalFloor
      ? `${profile.zoneName} stabilized on ${floorName}. Final objective secured.`
      : `${profile.zoneName} stabilized on ${floorName}. Descent corridor opened to the next floor.`
  );

  const definition: TheaterDefinition = {
    id: `${operation.id ?? profile.prefix}_${profile.prefix}_floor_${floorIndex + 1}`,
    name: profile.zoneName,
    zoneName: profile.zoneName,
    theaterStatus: profile.currentState === "cold" ? "cold" : profile.currentState === "warm" ? "warm" : "active",
    currentState: profile.currentState,
    operationId: operation.id ?? profile.prefix,
    objective,
    recommendedPWR: operation.recommendedPWR ?? atlasSummary?.recommendedPwr ?? 24,
    beginningState,
    endState,
    floorId,
    floorOrdinal: atlasSummary?.floorOrdinal ?? (floorIndex + 1),
    sectorLabel: atlasSummary?.sectorLabel ?? profile.sectorLabel,
    radialSlotIndex: atlasSummary?.radialSlotIndex ?? ((floorIndex + rng.nextInt(0, 3)) % 6),
    radialSlotCount: atlasSummary?.radialSlotCount ?? 6,
    angleDeg: presentation.angleDeg,
    radialDirection: presentation.radialDirection,
    discovered: atlasSummary?.discovered ?? true,
    operationAvailable: atlasSummary?.operationAvailable ?? true,
    passiveEffectText: profile.passiveEffectText,
    threatLevel: profile.threatLevel,
    ingressRoomId: "",
    uplinkRoomId: "",
    outwardDepth: 7,
    powerSourceRoomIds: [],
    mapAnchor: presentation.mapAnchor,
    layoutStyle: presentation.layoutStyle,
    originLabel: presentation.originLabel,
    floorKeyInventory: createEmptyKeyInventory(),
  };

  const { rooms, uplinkRoomId, powerSourceRoomIds } = buildRoomSeeds(operation, floorIndex, profile, definition, presentation.layoutStyle, rng);
  assignPowerGatedPassages(rooms, rng);
  definition.outwardDepth = Math.max(0, ...Object.values(rooms).map((room) => room.depthFromUplink));
  definition.ingressRoomId = uplinkRoomId;
  definition.uplinkRoomId = uplinkRoomId;
  definition.powerSourceRoomIds = powerSourceRoomIds;

  return {
    definition,
    rooms,
    currentRoomId: uplinkRoomId,
    selectedRoomId: uplinkRoomId,
    currentNodeId: uplinkRoomId,
    selectedNodeId: uplinkRoomId,
    annexesById: {},
    partitionsByEdgeId: {},
    automation: createEmptyTheaterAutomationState(),
    squads: [],
    selectedSquadId: null,
    tickCount: 0,
    activeThreats: [],
    recentEvents: [
      `S/COM :: ${profile.zoneName} synchronized on ${floorName}. Root origin ${presentation.originLabel}; theater vector ${Math.round(normalizeAngle(presentation.angleDeg))} degrees.`,
    ],
    objectiveDefinition: null,
    objectiveComplete: false,
    completion: null,
  };
}
