// ============================================================================
// QUARTERS - DECOR SYSTEM
// ============================================================================

export type DecorAnchorId =
  | "wall_left"
  | "wall_right"
  | "floor_corner"
  | "desk_top"
  | "shelf_top"
  | "window_sill"
  | "bedside_table";

export interface DecorItem {
  id: string;
  name: string;
  description: string;
  spriteKey?: string;
  iconKey?: string;
  rarityTag?: "common" | "uncommon" | "rare" | "epic";
  allowedAnchors: DecorAnchorId[];
}

export interface DecorState {
  owned: string[]; // Decor item IDs
  placedDecorByAnchor: Record<DecorAnchorId, string | null>; // anchorId -> decorItemId
}

// ============================================================================
// DECOR DEFINITIONS
// ============================================================================

const DECOR_ITEMS: DecorItem[] = [
  {
    id: "decor_plant_small",
    name: "Small Potted Plant",
    description: "A small green plant in a ceramic pot.",
    iconKey: "🌱",
    rarityTag: "common",
    allowedAnchors: ["desk_top", "window_sill", "shelf_top"],
  },
  {
    id: "decor_photo_frame",
    name: "Photo Frame",
    description: "A simple wooden frame with a faded photo.",
    iconKey: "🖼️",
    rarityTag: "common",
    allowedAnchors: ["wall_left", "wall_right", "desk_top"],
  },
  {
    id: "decor_lamp",
    name: "Desk Lamp",
    description: "A small lamp with a warm glow.",
    iconKey: "💡",
    rarityTag: "common",
    allowedAnchors: ["desk_top", "bedside_table"],
  },
  {
    id: "decor_book_stack",
    name: "Stack of Books",
    description: "A neat stack of technical manuals.",
    iconKey: "📚",
    rarityTag: "common",
    allowedAnchors: ["shelf_top", "desk_top"],
  },
  {
    id: "decor_trophy",
    name: "Operation Trophy",
    description: "A small trophy from a completed operation.",
    iconKey: "🏆",
    rarityTag: "uncommon",
    allowedAnchors: ["wall_left", "wall_right", "shelf_top"],
  },
  {
    id: "decor_medal",
    name: "Service Medal",
    description: "A medal awarded for service.",
    iconKey: "🎖️",
    rarityTag: "uncommon",
    allowedAnchors: ["wall_left", "wall_right", "desk_top"],
  },
];

// ============================================================================
// DECOR MANAGEMENT
// ============================================================================

/**
 * Get decor state from game state
 */
export function getDecorState(state: {
  quarters?: { decor?: DecorState };
}): DecorState {
  return (
    state.quarters?.decor ?? {
      owned: [],
      placedDecorByAnchor: {
        wall_left: null,
        wall_right: null,
        floor_corner: null,
        desk_top: null,
        shelf_top: null,
        window_sill: null,
        bedside_table: null,
      },
    }
  );
}

/**
 * Get all decor item definitions
 */
export function getAllDecorItems(): DecorItem[] {
  return DECOR_ITEMS;
}

/**
 * Get decor item by ID
 */
export function getDecorItemById(decorId: string): DecorItem | null {
  return DECOR_ITEMS.find(d => d.id === decorId) ?? null;
}

/**
 * Get owned decor items (not placed)
 */
export function getUnplacedDecor(
  state: { quarters?: { decor?: DecorState } }
): DecorItem[] {
  const decorState = getDecorState(state);
  const placedIds = Object.values(decorState.placedDecorByAnchor).filter(
    (id): id is string => id !== null
  );
  const unplacedIds = decorState.owned.filter(id => !placedIds.includes(id));
  return unplacedIds
    .map(id => getDecorItemById(id))
    .filter((item): item is DecorItem => item !== null);
}

/**
 * Get placed decor items
 */
export function getPlacedDecor(
  state: { quarters?: { decor?: DecorState } }
): Array<{ anchorId: DecorAnchorId; decor: DecorItem }> {
  const decorState = getDecorState(state);
  const result: Array<{ anchorId: DecorAnchorId; decor: DecorItem }> = [];

  for (const [anchorId, decorId] of Object.entries(
    decorState.placedDecorByAnchor
  )) {
    if (decorId) {
      const decor = getDecorItemById(decorId);
      if (decor) {
        result.push({
          anchorId: anchorId as DecorAnchorId,
          decor,
        });
      }
    }
  }

  return result;
}

/**
 * Place decor item at anchor
 */
export async function placeDecor(
  decorId: string,
  anchorId: DecorAnchorId
): Promise<boolean> {
  const { getGameState, updateGameState } = await import("../state/gameStore");
  const state = getGameState();
  const decorState = getDecorState(state);
  const decor = getDecorItemById(decorId);

  if (!decor) {
    console.warn(`[DECOR] Decor item not found: ${decorId}`);
    return false;
  }

  // Check if decor is owned
  if (!decorState.owned.includes(decorId)) {
    console.warn(`[DECOR] Decor item not owned: ${decorId}`);
    return false;
  }

  // Check if anchor is allowed
  if (!decor.allowedAnchors.includes(anchorId)) {
    console.warn(
      `[DECOR] Anchor ${anchorId} not allowed for decor ${decorId}`
    );
    return false;
  }

  // Remove from current anchor if already placed
  const currentAnchor = Object.entries(decorState.placedDecorByAnchor).find(
    ([_, id]) => id === decorId
  )?.[0] as DecorAnchorId | undefined;

  updateGameState(s => {
    const quarters = s.quarters ?? {};
    const currentDecorState = getDecorState(s);
    const newPlaced = { ...currentDecorState.placedDecorByAnchor };

    // Remove from old anchor
    if (currentAnchor) {
      newPlaced[currentAnchor] = null;
    }

    // Place at new anchor
    newPlaced[anchorId] = decorId;

    return {
      ...s,
      quarters: {
        ...quarters,
        decor: {
          ...currentDecorState,
          placedDecorByAnchor: newPlaced,
        },
      },
    };
  });

  return true;
}

/**
 * Remove decor from anchor
 */
export async function removeDecor(anchorId: DecorAnchorId): Promise<boolean> {
  const { updateGameState } = await import("../state/gameStore");
  updateGameState(s => {
    const quarters = s.quarters ?? {};
    const decorState = getDecorState(s);
    const newPlaced = { ...decorState.placedDecorByAnchor };
    newPlaced[anchorId] = null;

    return {
      ...s,
      quarters: {
        ...quarters,
        decor: {
          ...decorState,
          placedDecorByAnchor: newPlaced,
        },
      },
    };
  });

  return true;
}

/**
 * Grant decor item to player
 */
export async function grantDecorItem(decorId: string): Promise<boolean> {
  const { getGameState, updateGameState } = await import("../state/gameStore");
  const state = getGameState();
  const decorState = getDecorState(state);

  // Check if already owned
  if (decorState.owned.includes(decorId)) {
    return false;
  }

  // Check if decor exists
  const decor = getDecorItemById(decorId);
  if (!decor) {
    console.warn(`[DECOR] Cannot grant unknown decor: ${decorId}`);
    return false;
  }

  updateGameState(s => {
    const quarters = s.quarters ?? {};
    const currentDecorState = getDecorState(s);

    return {
      ...s,
      quarters: {
        ...quarters,
        decor: {
          ...currentDecorState,
          owned: [...currentDecorState.owned, decorId],
        },
      },
    };
  });

  return true;
}

/**
 * Seed initial decor items for testing
 */
export function seedInitialDecor(): void {
  import("../state/gameStore").then(({ getGameState, updateGameState }) => {
    const state = getGameState();
    const decorState = getDecorState(state);

    // Grant 2-3 starter decor items if none owned
    if (decorState.owned.length === 0) {
      const starterIds = [
        "decor_plant_small",
        "decor_photo_frame",
        "decor_lamp",
      ];

      updateGameState(s => {
        const quarters = s.quarters ?? {};
        const currentDecorState = getDecorState(s);

        return {
          ...s,
          quarters: {
            ...quarters,
            decor: {
              ...currentDecorState,
              owned: [...starterIds],
            },
          },
        };
      });
    }
  });
}

