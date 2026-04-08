import { getGameState, updateGameState } from "../state/gameStore";
import {
  hasEnoughResources as hasEnoughResourceValues,
  subtractResourceWallet,
  type ResourceWallet,
} from "./resources";

export type DecorAnchorId =
  | "wall_left"
  | "wall_right"
  | "floor_corner"
  | "desk_top"
  | "shelf_top"
  | "window_sill"
  | "bedside_table";

export type DecorResourceCost = Partial<ResourceWallet>;

export interface DecorItem {
  id: string;
  name: string;
  description: string;
  spriteKey: string;
  iconKey?: string;
  rarityTag?: "common" | "uncommon" | "rare" | "epic";
  allowedAnchors: DecorAnchorId[];
  tileWidth: number;
  tileHeight: number;
  fieldPlaceable?: boolean;
  shopCostWad?: number;
  craftCost?: DecorResourceCost;
  sourceRules?: {
    shopEligible?: boolean;
    rewardEligible?: boolean;
    craftEligible?: boolean;
  };
}

export interface FieldDecorPlacement {
  placementId: string;
  decorId: string;
  mapId: string;
  x: number;
  y: number;
}

export interface DecorState {
  owned: string[];
  placedDecorByAnchor: Record<DecorAnchorId, string | null>;
  fieldPlacements?: FieldDecorPlacement[];
  nextFieldPlacementOrdinal?: number;
}

const DEFAULT_ANCHOR_STATE: Record<DecorAnchorId, string | null> = {
  wall_left: null,
  wall_right: null,
  floor_corner: null,
  desk_top: null,
  shelf_top: null,
  window_sill: null,
  bedside_table: null,
};

const DECOR_ITEMS: DecorItem[] = [
  {
    id: "decor_plant_small",
    name: "Small Potted Plant",
    description: "A hardy little plant that makes even hardened steel look inhabited.",
    spriteKey: "plant_small",
    iconKey: "PLANT",
    rarityTag: "common",
    allowedAnchors: ["desk_top", "window_sill", "shelf_top"],
    tileWidth: 1,
    tileHeight: 1,
    fieldPlaceable: true,
    shopCostWad: 55,
    craftCost: { wood: 2, metalScrap: 1 },
    sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
  },
  {
    id: "decor_photo_frame",
    name: "Photo Frame",
    description: "A battered frame that still insists on keeping one quiet memory upright.",
    spriteKey: "photo_frame",
    iconKey: "FRAME",
    rarityTag: "common",
    allowedAnchors: ["wall_left", "wall_right", "desk_top"],
    tileWidth: 1,
    tileHeight: 1,
    fieldPlaceable: true,
    shopCostWad: 45,
    craftCost: { wood: 2 },
    sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
  },
  {
    id: "decor_lamp",
    name: "Desk Lamp",
    description: "Warm light for long planning sessions and the kind of fatigue that follows them.",
    spriteKey: "lamp",
    iconKey: "LAMP",
    rarityTag: "common",
    allowedAnchors: ["desk_top", "bedside_table"],
    tileWidth: 1,
    tileHeight: 1,
    fieldPlaceable: true,
    shopCostWad: 70,
    craftCost: { metalScrap: 2, steamComponents: 1 },
    sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
  },
  {
    id: "decor_book_stack",
    name: "Stack of Books",
    description: "Manuals, notebooks, and a few pages nobody has admitted to reading yet.",
    spriteKey: "book_stack",
    iconKey: "BOOKS",
    rarityTag: "common",
    allowedAnchors: ["shelf_top", "desk_top"],
    tileWidth: 1,
    tileHeight: 1,
    fieldPlaceable: true,
    shopCostWad: 50,
    craftCost: { wood: 1, metalScrap: 1 },
    sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
  },
  {
    id: "decor_trophy",
    name: "Operation Trophy",
    description: "A polished little boast pulled from the wreckage of a hard-earned win.",
    spriteKey: "trophy",
    iconKey: "TROPHY",
    rarityTag: "uncommon",
    allowedAnchors: ["wall_left", "wall_right", "shelf_top"],
    tileWidth: 1,
    tileHeight: 1,
    fieldPlaceable: true,
    shopCostWad: 120,
    craftCost: { metalScrap: 3, chaosShards: 1 },
    sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
  },
  {
    id: "decor_medal",
    name: "Service Medal",
    description: "Proof that somebody noticed, signed off, and filed it where everyone can see.",
    spriteKey: "medal",
    iconKey: "MEDAL",
    rarityTag: "uncommon",
    allowedAnchors: ["wall_left", "wall_right", "desk_top"],
    tileWidth: 1,
    tileHeight: 1,
    fieldPlaceable: true,
    shopCostWad: 110,
    craftCost: { metalScrap: 2, chaosShards: 1 },
    sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
  },
];

function hasEnoughResources(resources: DecorResourceCost, cost?: DecorResourceCost): boolean {
  return hasEnoughResourceValues(resources, cost);
}

function subtractResources(resources: DecorResourceCost, cost?: DecorResourceCost): DecorResourceCost {
  return subtractResourceWallet(resources, cost);
}

export function getDecorState(state: { quarters?: { decor?: DecorState } }): DecorState {
  return {
    owned: [...(state.quarters?.decor?.owned ?? [])],
    placedDecorByAnchor: {
      ...DEFAULT_ANCHOR_STATE,
      ...(state.quarters?.decor?.placedDecorByAnchor ?? {}),
    },
    fieldPlacements: [...(state.quarters?.decor?.fieldPlacements ?? [])],
    nextFieldPlacementOrdinal: Math.max(1, Number(state.quarters?.decor?.nextFieldPlacementOrdinal ?? 1)),
  };
}

export function getAllDecorItems(): DecorItem[] {
  return DECOR_ITEMS.map((item) => ({ ...item, allowedAnchors: [...item.allowedAnchors] }));
}

export function getDecorItemById(decorId: string): DecorItem | null {
  const item = DECOR_ITEMS.find((decor) => decor.id === decorId);
  return item ? { ...item, allowedAnchors: [...item.allowedAnchors] } : null;
}

export function getPlacedDecor(
  state: { quarters?: { decor?: DecorState } },
): Array<{ anchorId: DecorAnchorId; decor: DecorItem }> {
  const decorState = getDecorState(state);
  const result: Array<{ anchorId: DecorAnchorId; decor: DecorItem }> = [];

  for (const [anchorId, decorId] of Object.entries(decorState.placedDecorByAnchor)) {
    if (!decorId) {
      continue;
    }
    const decor = getDecorItemById(decorId);
    if (!decor) {
      continue;
    }
    result.push({
      anchorId: anchorId as DecorAnchorId,
      decor,
    });
  }

  return result;
}

export function getPlacedFieldDecor(
  state: { quarters?: { decor?: DecorState } },
  mapId?: string,
): Array<{ placement: FieldDecorPlacement; decor: DecorItem }> {
  return getDecorState(state).fieldPlacements
    ?.filter((placement) => !mapId || placement.mapId === mapId)
    .map((placement) => {
      const decor = getDecorItemById(placement.decorId);
      return decor ? { placement, decor } : null;
    })
    .filter((entry): entry is { placement: FieldDecorPlacement; decor: DecorItem } => Boolean(entry)) ?? [];
}

function getAllPlacedDecorIds(state: { quarters?: { decor?: DecorState } }): string[] {
  const decorState = getDecorState(state);
  const anchorIds = Object.values(decorState.placedDecorByAnchor).filter((id): id is string => Boolean(id));
  const fieldIds = (decorState.fieldPlacements ?? []).map((placement) => placement.decorId);
  return [...anchorIds, ...fieldIds];
}

export function getUnplacedDecor(state: { quarters?: { decor?: DecorState } }): DecorItem[] {
  const decorState = getDecorState(state);
  const placedIds = new Set(getAllPlacedDecorIds(state));
  return decorState.owned
    .filter((id) => !placedIds.has(id))
    .map((id) => getDecorItemById(id))
    .filter((item): item is DecorItem => item !== null);
}

export function getAvailableFieldDecor(state: { quarters?: { decor?: DecorState } }): DecorItem[] {
  return getUnplacedDecor(state).filter((decor) => decor.fieldPlaceable !== false);
}

export function getCraftableDecorItems(state: { quarters?: { decor?: DecorState }; resources?: DecorResourceCost }): DecorItem[] {
  const owned = new Set(getDecorState(state).owned);
  return DECOR_ITEMS.filter((decor) => decor.sourceRules?.craftEligible !== false && !owned.has(decor.id));
}

export function canCraftDecorItem(decorId: string, state: { quarters?: { decor?: DecorState }; resources?: DecorResourceCost }): boolean {
  const decor = getDecorItemById(decorId);
  if (!decor || decor.sourceRules?.craftEligible === false) {
    return false;
  }
  if (getDecorState(state).owned.includes(decorId)) {
    return false;
  }
  return hasEnoughResources(state.resources ?? {}, decor.craftCost);
}

export function placeDecor(decorId: string, anchorId: DecorAnchorId): boolean {
  const state = getGameState();
  const decorState = getDecorState(state);
  const decor = getDecorItemById(decorId);
  if (!decor) {
    console.warn(`[DECOR] Decor item not found: ${decorId}`);
    return false;
  }
  if (!decorState.owned.includes(decorId)) {
    console.warn(`[DECOR] Decor item not owned: ${decorId}`);
    return false;
  }
  if (!decor.allowedAnchors.includes(anchorId)) {
    console.warn(`[DECOR] Anchor ${anchorId} not allowed for decor ${decorId}`);
    return false;
  }

  const currentAnchor = Object.entries(decorState.placedDecorByAnchor).find(([, id]) => id === decorId)?.[0] as DecorAnchorId | undefined;
  const fieldPlacements = (decorState.fieldPlacements ?? []).filter((placement) => placement.decorId !== decorId);

  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    const nextPlaced = { ...currentDecorState.placedDecorByAnchor };
    if (currentAnchor) {
      nextPlaced[currentAnchor] = null;
    }
    nextPlaced[anchorId] = decorId;
    return {
      ...current,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          placedDecorByAnchor: nextPlaced,
          fieldPlacements,
        },
      },
    };
  });

  return true;
}

export function removeDecor(anchorId: DecorAnchorId): boolean {
  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    const nextPlaced = { ...currentDecorState.placedDecorByAnchor };
    nextPlaced[anchorId] = null;
    return {
      ...current,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          placedDecorByAnchor: nextPlaced,
        },
      },
    };
  });
  return true;
}

export function placeFieldDecor(decorId: string, mapId: string, x: number, y: number): boolean {
  const state = getGameState();
  const decorState = getDecorState(state);
  const decor = getDecorItemById(decorId);
  if (!decor || decor.fieldPlaceable === false) {
    console.warn(`[DECOR] Decor item is not field placeable: ${decorId}`);
    return false;
  }
  if (!decorState.owned.includes(decorId)) {
    console.warn(`[DECOR] Decor item not owned: ${decorId}`);
    return false;
  }
  if (getAllPlacedDecorIds(state).includes(decorId)) {
    console.warn(`[DECOR] Decor item is already placed: ${decorId}`);
    return false;
  }

  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    const nextOrdinal = Math.max(1, Number(currentDecorState.nextFieldPlacementOrdinal ?? 1));
    const nextPlacement: FieldDecorPlacement = {
      placementId: `field_decor_${nextOrdinal}`,
      decorId,
      mapId,
      x,
      y,
    };
    return {
      ...current,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          fieldPlacements: [...(currentDecorState.fieldPlacements ?? []), nextPlacement],
          nextFieldPlacementOrdinal: nextOrdinal + 1,
        },
      },
    };
  });

  return true;
}

export function moveFieldDecor(placementId: string, x: number, y: number): boolean {
  const state = getGameState();
  const decorState = getDecorState(state);
  if (!(decorState.fieldPlacements ?? []).some((placement) => placement.placementId === placementId)) {
    return false;
  }

  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    return {
      ...current,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          fieldPlacements: (currentDecorState.fieldPlacements ?? []).map((placement) =>
            placement.placementId === placementId
              ? { ...placement, x, y }
              : placement,
          ),
        },
      },
    };
  });

  return true;
}

export function removeFieldDecor(placementId: string): boolean {
  const state = getGameState();
  const decorState = getDecorState(state);
  if (!(decorState.fieldPlacements ?? []).some((placement) => placement.placementId === placementId)) {
    return false;
  }

  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    return {
      ...current,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          fieldPlacements: (currentDecorState.fieldPlacements ?? []).filter((placement) => placement.placementId !== placementId),
        },
      },
    };
  });

  return true;
}

export function grantDecorItem(decorId: string): boolean {
  const state = getGameState();
  const decorState = getDecorState(state);
  if (decorState.owned.includes(decorId)) {
    return false;
  }

  const decor = getDecorItemById(decorId);
  if (!decor) {
    console.warn(`[DECOR] Cannot grant unknown decor: ${decorId}`);
    return false;
  }

  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    return {
      ...current,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          owned: [...currentDecorState.owned, decorId],
        },
      },
    };
  });

  return true;
}

export function craftDecorItem(decorId: string): boolean {
  const state = getGameState();
  const decor = getDecorItemById(decorId);
  if (!decor || decor.sourceRules?.craftEligible === false) {
    return false;
  }
  if (getDecorState(state).owned.includes(decorId)) {
    return false;
  }
  if (!hasEnoughResources(state.resources ?? {}, decor.craftCost)) {
    return false;
  }

  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    return {
      ...current,
      resources: subtractResources(current.resources ?? {}, decor.craftCost) as typeof current.resources,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          owned: [...currentDecorState.owned, decorId],
        },
      },
    };
  });

  return true;
}

export function seedInitialDecor(): void {
  const state = getGameState();
  const decorState = getDecorState(state);
  if (decorState.owned.length > 0) {
    return;
  }

  updateGameState((current) => {
    const currentDecorState = getDecorState(current);
    return {
      ...current,
      quarters: {
        ...(current.quarters ?? {}),
        decor: {
          ...currentDecorState,
          owned: ["decor_plant_small", "decor_photo_frame", "decor_lamp"],
        },
      },
    };
  });
}

export function getShopEligibleDecorItems(): DecorItem[] {
  return DECOR_ITEMS.filter((decor) => decor.sourceRules?.shopEligible !== false);
}

export function getRewardEligibleDecorItems(): DecorItem[] {
  return DECOR_ITEMS.filter((decor) => decor.sourceRules?.rewardEligible !== false);
}

export function renderDecorSpriteSvg(decor: DecorItem): string {
  switch (decor.spriteKey) {
    case "plant_small":
      return `
        <svg class="decor-sprite-svg decor-sprite-svg--plant" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="10" y="20" width="12" height="8" rx="2"></rect>
          <path d="M16 8 C13 12 12 15 12 19"></path>
          <path d="M16 8 C19 12 20 15 20 19"></path>
          <path d="M16 11 C11 12 9 14 8 18"></path>
          <path d="M16 11 C21 12 23 14 24 18"></path>
        </svg>
      `;
    case "photo_frame":
      return `
        <svg class="decor-sprite-svg decor-sprite-svg--frame" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="6" y="7" width="20" height="18" rx="2"></rect>
          <rect x="10" y="11" width="12" height="10" rx="1"></rect>
          <path d="M12 19 L16 15 L20 19"></path>
          <circle cx="12" cy="13" r="1.5"></circle>
        </svg>
      `;
    case "lamp":
      return `
        <svg class="decor-sprite-svg decor-sprite-svg--lamp" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M10 10 H22 L19 16 H13 Z"></path>
          <path d="M16 16 V23"></path>
          <path d="M12 25 H20"></path>
          <circle cx="16" cy="13" r="1.5"></circle>
        </svg>
      `;
    case "book_stack":
      return `
        <svg class="decor-sprite-svg decor-sprite-svg--books" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="7" y="20" width="18" height="5" rx="1"></rect>
          <rect x="9" y="15" width="15" height="4" rx="1"></rect>
          <rect x="11" y="10" width="12" height="4" rx="1"></rect>
        </svg>
      `;
    case "trophy":
      return `
        <svg class="decor-sprite-svg decor-sprite-svg--trophy" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M11 8 H21 V13 C21 17 18.5 19 16 19 C13.5 19 11 17 11 13 Z"></path>
          <path d="M11 10 H8 C8 14 9.5 16 12 16"></path>
          <path d="M21 10 H24 C24 14 22.5 16 20 16"></path>
          <path d="M16 19 V23"></path>
          <rect x="12" y="23" width="8" height="3" rx="1"></rect>
        </svg>
      `;
    case "medal":
      return `
        <svg class="decor-sprite-svg decor-sprite-svg--medal" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M12 6 L16 13 L20 6"></path>
          <path d="M14 6 L16 10 L18 6"></path>
          <circle cx="16" cy="19" r="6"></circle>
          <path d="M16 15 L17.6 18.2 L21 18.7 L18.5 21.2 L19.1 24.5 L16 22.9 L12.9 24.5 L13.5 21.2 L11 18.7 L14.4 18.2 Z"></path>
        </svg>
      `;
    default:
      return `
        <svg class="decor-sprite-svg" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="8" y="8" width="16" height="16" rx="2"></rect>
        </svg>
      `;
  }
}
