// ============================================================================
// QUARTERS - BUNK BUFF SYSTEM
// ============================================================================

export interface NextRunBuff {
  id: string;
  name: string;
  description: string;
  appliesUntilRunId?: string; // Run ID when buff expires
  consumed: boolean;
}

export interface QuartersBuffsState {
  currentBuff: NextRunBuff | null;
  lastRestVisitIndex?: number; // Track base camp visit to gate rest usage
}

// ============================================================================
// BUFF DEFINITIONS
// ============================================================================

export interface BuffDefinition {
  id: string;
  name: string;
  description: string;
  effect: (state: any) => any; // Apply effect to run state
}

const BUFF_DEFINITIONS: BuffDefinition[] = [
  {
    id: "buff_hp_bonus",
    name: "Well Rested",
    description: "+10 starting HP for all units next run",
    effect: (state) => {
      // Apply +10 HP to all party units at start of run
      // This will be handled when run starts
      return state;
    },
  },
  {
    id: "buff_resource_bonus",
    name: "Resource Finder",
    description: "+20% resource drops next run",
    effect: (state) => {
      // Resource multiplier will be checked during resource collection
      return state;
    },
  },
  {
    id: "buff_draw_bonus",
    name: "Clear Mind",
    description: "+1 starting hand size for first battle",
    effect: (state) => {
      // First battle will draw extra card
      return state;
    },
  },
  {
    id: "buff_shop_discount",
    name: "Bargain Hunter",
    description: "10% discount at first shop node",
    effect: (state) => {
      // Shop will check for discount flag
      return state;
    },
  },
  {
    id: "buff_first_heal",
    name: "Recovery Boost",
    description: "Heal 15 HP after first room",
    effect: (state) => {
      // First room completion will trigger heal
      return state;
    },
  },
  {
    id: "buff_strain_reduction",
    name: "Relaxed",
    description: "-1 strain cost for first 3 cards next run",
    effect: (state) => {
      // Card play will check for strain reduction
      return state;
    },
  },
  {
    id: "buff_move_bonus",
    name: "Energetic",
    description: "+1 movement range for first 5 moves",
    effect: (state) => {
      // Movement will check for bonus
      return state;
    },
  },
  {
    id: "buff_crit_chance",
    name: "Focused",
    description: "+5% crit chance for first battle",
    effect: (state) => {
      // Battle will check for crit bonus
      return state;
    },
  },
];

// ============================================================================
// BUFF MANAGEMENT
// ============================================================================

/**
 * Get quarters buffs state from game state
 */
export function getQuartersBuffsState(state: {
  quarters?: { buffs?: QuartersBuffsState };
}): QuartersBuffsState {
  return state.quarters?.buffs ?? { currentBuff: null };
}

/**
 * Roll a random buff from available buffs
 */
export function rollRandomBuff(): BuffDefinition {
  return BUFF_DEFINITIONS[Math.floor(Math.random() * BUFF_DEFINITIONS.length)];
}

/**
 * Rest at bunk - grants a random buff for next run
 */
export async function restAtBunk(): Promise<NextRunBuff | null> {
  const { getGameState, updateGameState } = await import("../state/gameStore");
  const state = getGameState();
  const buffsState = getQuartersBuffsState(state);
  const visitIndex = state.baseCampVisitIndex ?? 0;

  // Check if already rested this visit
  if (buffsState.lastRestVisitIndex === visitIndex && buffsState.currentBuff && !buffsState.currentBuff.consumed) {
    // Already have an active buff from this visit
    return buffsState.currentBuff;
  }

  // Roll new buff
  const buffDef = rollRandomBuff();
  const newBuff: NextRunBuff = {
    id: buffDef.id,
    name: buffDef.name,
    description: buffDef.description,
    consumed: false,
  };

  // Save to state
  updateGameState(s => {
    const quarters = s.quarters ?? {};
    return {
      ...s,
      quarters: {
        ...quarters,
        buffs: {
          currentBuff: newBuff,
          lastRestVisitIndex: visitIndex,
        },
      },
    };
  });

  return newBuff;
}

/**
 * Check if player can rest (hasn't rested this visit)
 */
export function canRest(state: {
  quarters?: { buffs?: QuartersBuffsState };
  baseCampVisitIndex?: number;
}): boolean {
  const buffsState = getQuartersBuffsState(state);
  const visitIndex = state.baseCampVisitIndex ?? 0;

  // Can rest if no buff, or buff is from previous visit, or buff is consumed
  if (!buffsState.currentBuff) return true;
  if (buffsState.currentBuff.consumed) return true;
  if (buffsState.lastRestVisitIndex !== visitIndex) return true;

  return false;
}

/**
 * Consume buff when run starts
 */
export async function consumeBuffOnRunStart(): Promise<NextRunBuff | null> {
  const { getGameState, updateGameState } = await import("../state/gameStore");
  const state = getGameState();
  const buffsState = getQuartersBuffsState(state);

  if (!buffsState.currentBuff || buffsState.currentBuff.consumed) {
    return null;
  }

  // Mark as consumed
  const consumedBuff = { ...buffsState.currentBuff, consumed: true };
  
  updateGameState(s => {
    const quarters = s.quarters ?? {};
    return {
      ...s,
      quarters: {
        ...quarters,
        buffs: {
          ...buffsState,
          currentBuff: consumedBuff,
        },
      },
    };
  });

  return consumedBuff;
}

/**
 * Get buff definition by ID
 */
export function getBuffDefinition(buffId: string): BuffDefinition | null {
  return BUFF_DEFINITIONS.find(b => b.id === buffId) ?? null;
}

