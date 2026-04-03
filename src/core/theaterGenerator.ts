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
} from "./types";

type TheaterLayoutStyle = NonNullable<TheaterDefinition["layoutStyle"]>;
type TheaterRoomRole =
  | "ingress"
  | "frontline"
  | "relay"
  | "field"
  | "core"
  | "power"
  | "elite"
  | "objective";

type TheaterRoomSeed = Pick<
  TheaterRoom,
  "id" | "label" | "sectorTag" | "localPosition" | "depthFromUplink" | "isUplinkRoom" | "size" | "adjacency" | "status" | "secured" | "tacticalEncounter" | "tags"
> & Partial<TheaterRoom>;

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

const MAP_WIDTH = 3200;
const MAP_HEIGHT = 2200;
const DEFAULT_MAP_ANCHOR = { x: 520, y: 1100 };
const THEATER_DEPTH_STEP = 380;
const THEATER_LATERAL_STEP = 320;

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

const DEFAULT_PROFILE: TheaterProfile = {
  prefix: "thr",
  zoneName: "UNMAPPED THEATER",
  sectorLabel: "SECTOR X-00",
  passiveEffectText: "Passive Flux // Theater topology is unstable and resists long-range prediction.",
  threatLevel: "High",
  currentState: "active",
  ingressLabels: ["Ingress Yard", "Staging Lock", "Transit Breach"],
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
    ingressLabels: ["Ingress Yard", "Breach Court", "Entry Causeway"],
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
    ingressLabels: ["Spire Foot", "Anchor Lift", "Base Chapel"],
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
    ingressLabels: ["Ghost Dock", "Phase Lock", "Transit Mouth"],
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
    ingressLabels: ["Ash Sluice", "Siege Lock", "Cinder Threshold"],
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
    ingressLabels: ["Dawn Vestibule", "Citadel Lock", "First Court"],
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
    ingressLabels: ["Procedural Lock", "Adaptive Ingress", "Survey Breach"],
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

function createPresentation(
  floorIndex: number,
  atlasSummary: AtlasTheaterSummary | null,
  rng: SeededRng,
): LayoutPresentation {
  const layoutStyles: TheaterLayoutStyle[] = ["vector_lance", "split_fan", "central_bloom", "offset_arc"];
  const style = layoutStyles[(floorIndex + rng.nextInt(0, layoutStyles.length - 1)) % layoutStyles.length] ?? "vector_lance";
  const allowedAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const angleDeg = floorIndex === 0 && atlasSummary
    ? atlasSummary.angleDeg
    : allowedAngles[(floorIndex * 3 + rng.nextInt(0, allowedAngles.length - 1)) % allowedAngles.length] ?? 0;
  const direction = createDirection(angleDeg);

  if (style === "central_bloom") {
    return {
      angleDeg,
      radialDirection: direction,
      mapAnchor: {
        x: Math.round((MAP_WIDTH / 2) + rng.nextInt(-180, 180)),
        y: Math.round((MAP_HEIGHT / 2) + rng.nextInt(-150, 150)),
      },
      layoutStyle: style,
      originLabel: "CENTER BREACH",
    };
  }

  if (style === "offset_arc") {
    const bucket = getAngleBucket(angleDeg);
    const mapAnchor =
      bucket === "east"
        ? { x: 980, y: 920 + rng.nextInt(-160, 160) }
        : bucket === "south"
          ? { x: 1600 + rng.nextInt(-260, 260), y: 520 }
          : bucket === "west"
            ? { x: 2220, y: 1280 + rng.nextInt(-160, 160) }
            : { x: 1600 + rng.nextInt(-260, 260), y: 1680 };
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
      ? { x: 460, y: 1100 + rng.nextInt(-180, 180) }
      : edgeBucket === "south"
        ? { x: 1600 + rng.nextInt(-260, 260), y: 360 }
        : edgeBucket === "west"
          ? { x: 2740, y: 1100 + rng.nextInt(-180, 180) }
          : { x: 1600 + rng.nextInt(-260, 260), y: 1840 };

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
      return ["core_candidate", "resource_metal", "resource_wood"];
    case "core":
      return ["core_candidate"];
    case "power":
      return ["power_source"];
    case "elite":
      return ["elite", "frontier"];
    case "objective":
      return ["objective", "elite"];
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
  return {
    ...THEATER_ROOM_BASE,
    theaterId: definition.id,
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

function createExpandedLayoutTemplate(style: TheaterLayoutStyle, rng: SeededRng): LayoutNodeTemplate[] {
  const baseTemplate = (LAYOUT_TEMPLATES[style] ?? LAYOUT_TEMPLATES.vector_lance).map((node, index) => ({
    ...node,
    localPosition: jitterTemplatePosition(node.localPosition, node.role, style, rng, index),
    adjacency: [...node.adjacency],
  }));

  const extraRoomCount = 2 + rng.nextInt(0, style === "central_bloom" ? 3 : 2);
  for (let index = 0; index < extraRoomCount; index++) {
    const eligibleParents = baseTemplate.filter((node) => (
      node.role !== "objective" &&
      node.depthFromUplink >= 1 &&
      node.depthFromUplink <= 4
    ));
    const parent = eligibleParents.length > 0 ? rng.pick(eligibleParents) : null;
    if (!parent) {
      break;
    }

    const rolePool: TheaterRoomRole[] =
      parent.depthFromUplink >= 3
        ? ["field", "core", "relay", "field", "core", "elite"]
        : ["field", "core", "relay", "field", "core"];
    const role = rng.pick(rolePool);
    const branchDepth =
      role === "elite"
        ? Math.max(4, parent.depthFromUplink + 1)
        : parent.depthFromUplink + 1;
    const depthFromUplink = Math.min(5, branchDepth);
    const lateralSeed =
      Math.abs(parent.localPosition.y) < 0.5
        ? (rng.nextFloat() < 0.5 ? -1 : 1) * (0.95 + rng.nextFloat() * 1.35)
        : parent.localPosition.y + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.55 + rng.nextFloat() * 1.05);

    const spurKey = `spur_${index}`;
    baseTemplate.push({
      key: spurKey,
      role,
      localPosition: {
        x: roundLocalCoordinate(parent.localPosition.x + 0.95 + (rng.nextFloat() * 1.65) + ((depthFromUplink - parent.depthFromUplink - 1) * 0.3)),
        y: roundLocalCoordinate(lateralSeed + ((rng.nextFloat() - 0.5) * 0.75)),
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
        Math.abs(candidate.localPosition.x - parent.localPosition.x) <= 2.6
      ));
      if (secondaryCandidates.length > 0) {
        connectTemplateNodes(baseTemplate, spurKey, rng.pick(secondaryCandidates).key);
      }
    }
  }

  return baseTemplate;
}

function buildRoomSeeds(
  operation: OperationRun,
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
      label: `${rng.pick(labelPool)}${node.role === "objective" && floorIndex === operation.floors.length - 1 ? " // FINAL" : ""}`,
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
      fortificationCapacity: node.role === "ingress" ? 4 : node.role === "objective" ? 4 : 3,
      fortificationPips: node.role === "ingress" ? { barricade: 1, powerRail: 1 } : undefined,
      isPowerSource: node.role === "ingress" || node.role === "power",
    };
  });

  const rooms = Object.fromEntries(
    roomSeeds.map((room) => [room.id, createRoom(definition, room)]),
  );
  const uplinkRoomId = roomIdByKey.get("ingress")!;
  const powerSourceRoomIds = roomSeeds.filter((room) => room.isPowerSource).map((room) => room.id);
  return { rooms, uplinkRoomId, powerSourceRoomIds };
}

export function createGeneratedTheaterFloor(operation: OperationRun, floorIndex: number): TheaterNetworkState {
  const atlasSummary = floorIndex === 0 ? resolveAtlasSummaryForOperation(operation) : null;
  const seed = resolveRunSeed(operation, floorIndex);
  const rng = createSeededRng(seed);
  const profile = resolveProfile(operation, floorIndex, atlasSummary);
  const presentation = createPresentation(floorIndex, atlasSummary, rng);
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
    floorOrdinal: floorIndex + 1,
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
    outwardDepth: 5,
    powerSourceRoomIds: [],
    mapAnchor: presentation.mapAnchor,
    layoutStyle: presentation.layoutStyle,
    originLabel: presentation.originLabel,
  };

  const { rooms, uplinkRoomId, powerSourceRoomIds } = buildRoomSeeds(operation, floorIndex, profile, definition, presentation.layoutStyle, rng);
  definition.ingressRoomId = uplinkRoomId;
  definition.uplinkRoomId = uplinkRoomId;
  definition.powerSourceRoomIds = powerSourceRoomIds;

  return {
    definition,
    rooms,
    currentRoomId: uplinkRoomId,
    selectedRoomId: uplinkRoomId,
    tickCount: 0,
    activeThreats: [],
    recentEvents: [
      `S/COM :: ${profile.zoneName} synchronized on ${floorName}. Root origin ${presentation.originLabel}; theater vector ${Math.round(normalizeAngle(presentation.angleDeg))} degrees.`,
    ],
    objectiveComplete: false,
    completion: null,
  };
}
