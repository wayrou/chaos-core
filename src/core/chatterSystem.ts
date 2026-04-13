import { getAllImportedChatterEntries } from "../content/technica";

export type ChatterLocation = "black_market" | "tavern" | "port";

export interface AmbientChatterLine {
  name: string;
  text: string;
  aerissResponse?: string;
  contentId?: string;
  updatedAt?: string;
}

const SPEAKER_NAME_POOLS: Record<ChatterLocation, string[]> = {
  black_market: [
    "SHADY DEALER",
    "UNDERGROUND TECH",
    "SMUGGLER",
    "MOD BROKER",
    "BLACK MARKET VENDOR",
  ],
  tavern: [
    "BARTENDER",
    "SQUAD LEADER",
    "RUMOR MONGER",
    "INTEL CLERK",
    "TAVERN REGULAR",
  ],
  port: [
    "DOCK MASTER",
    "CARAVAN MERCHANT",
    "WAREHOUSE KEEPER",
    "PORT SCRIBE",
    "QUARTERMASTER",
  ],
};

const surfacedImportedChatterKeys: Record<ChatterLocation, Set<string>> = {
  black_market: new Set<string>(),
  tavern: new Set<string>(),
  port: new Set<string>(),
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickSpeakerName(location: ChatterLocation, contentId: string) {
  const pool = SPEAKER_NAME_POOLS[location];
  return pool[hashString(contentId) % pool.length] ?? pool[0];
}

function compareImportedChatterRecency(
  left: { id: string; createdAt?: string; updatedAt?: string },
  right: { id: string; createdAt?: string; updatedAt?: string },
): number {
  const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? "");
  const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? "");

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  if (Number.isFinite(leftTime) && !Number.isFinite(rightTime)) {
    return -1;
  }

  if (!Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return 1;
  }

  return left.id.localeCompare(right.id);
}

function buildImportedAmbientChatterLines(location: ChatterLocation): AmbientChatterLine[] {
  return getAllImportedChatterEntries()
    .filter((entry) => entry.location === location)
    .sort(compareImportedChatterRecency)
    .map((entry) => ({
      name: pickSpeakerName(location, entry.id),
      text: entry.content,
      aerissResponse: entry.aerissResponse,
      contentId: entry.id,
      updatedAt: entry.updatedAt ?? entry.createdAt,
    }));
}

function getImportedSurfacingKey(line: AmbientChatterLine): string {
  return `${line.contentId ?? line.text}:${line.updatedAt ?? ""}:${line.text}:${line.aerissResponse ?? ""}`;
}

export function resetAmbientChatterSurfacing(location?: ChatterLocation): void {
  if (location) {
    surfacedImportedChatterKeys[location].clear();
    return;
  }

  surfacedImportedChatterKeys.black_market.clear();
  surfacedImportedChatterKeys.tavern.clear();
  surfacedImportedChatterKeys.port.clear();
}

export function pickAmbientChatterLine(
  location: ChatterLocation,
  defaults: AmbientChatterLine[],
): AmbientChatterLine {
  const imported = buildImportedAmbientChatterLines(location);
  const surfacedKeys = surfacedImportedChatterKeys[location];
  const unseenImported = imported.filter((line) => !surfacedKeys.has(getImportedSurfacingKey(line)));

  if (unseenImported.length > 0) {
    const nextImported = unseenImported[0];
    surfacedKeys.add(getImportedSurfacingKey(nextImported));
    return nextImported;
  }

  const combined = imported.length > 0 ? [...imported, ...defaults] : defaults;
  return combined[Math.floor(Math.random() * combined.length)] ?? defaults[0] ?? {
    name: "SCANNER STATIC",
    text: "...",
  };
}

export function extendAmbientChatterPool(
  location: ChatterLocation,
  defaults: AmbientChatterLine[],
): AmbientChatterLine[] {
  const imported = buildImportedAmbientChatterLines(location);

  return [...defaults, ...imported];
}
