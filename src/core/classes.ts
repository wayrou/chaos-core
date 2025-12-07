// ============================================================================
// CLASS SYSTEM - Headline 14
// FFT-style branching class progression based on GDD
// ============================================================================

import { UnitId, WeaponType } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export type ClassId =
  // TIER 0 - Starter
  | "squire" | "ranger"
  // TIER 1 - Core Unlockable
  | "magician" | "thief" | "academic" | "freelancer"
  // TIER 2 - Squire Branches
  | "sentry" | "paladin" | "watch_guard"
  // TIER 2 - Ranger Branches
  | "hunter" | "bowmaster" | "trapper"
  // TIER 2 - Magician Branches
  | "cleric" | "wizard" | "chaosmancer"
  // TIER 2 - Thief Branches
  | "scout" | "shadow" | "trickster"
  // TIER 3 - Prestige Hybrids
  | "spellblade" | "dragoon" | "gladiator" | "geomancer" | "oracle"
  | "summoner" | "chronomancer" | "warsmith" | "necrotec" | "battle_alchemist";

export interface ClassDefinition {
  id: ClassId;
  name: string;
  description: string;
  tier: 0 | 1 | 2 | 3;
  baseStats: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
  weaponTypes: WeaponType[];
  unlockConditions: UnlockCondition[];
  innateAbility?: string;
}

export interface UnlockCondition {
  type: "always_unlocked" | "class_rank" | "milestone" | "special";
  requiredClass?: ClassId;
  requiredRank?: number;
  description?: string;
}

export interface UnitClassProgress {
  unitId: UnitId;
  classRanks: Record<ClassId, number>; // Rank/mastery for each class (0-5+)
  currentClass: ClassId;
  unlockedClasses: ClassId[];
  battlesWon: number;
  milestones: string[]; // Track special unlock conditions
}

// ============================================================================
// CLASS DEFINITIONS
// ============================================================================

export const CLASS_DEFINITIONS: Record<ClassId, ClassDefinition> = {
  // ==========================================================================
  // TIER 0 - STARTER JOBS
  // ==========================================================================

  squire: {
    id: "squire",
    name: "Squire",
    description: "Balanced frontline unit, adaptive and reliable.",
    tier: 0,
    baseStats: { maxHp: 100, atk: 8, def: 6, agi: 5, acc: 6 },
    weaponTypes: ["sword"],
    unlockConditions: [{ type: "always_unlocked" }],
    innateAbility: "Gained Ground: +1 DEF when adjacent to ally",
  },

  ranger: {
    id: "ranger",
    name: "Ranger",
    description: "Long-range attacker with strong mobility options.",
    tier: 0,
    baseStats: { maxHp: 90, atk: 8, def: 4, agi: 7, acc: 8 },
    weaponTypes: ["bow"],
    unlockConditions: [{ type: "always_unlocked" }],
    innateAbility: "Far Shot: +1 range on bow attacks",
  },

  // ==========================================================================
  // TIER 1 - CORE UNLOCKABLE CLASSES
  // ==========================================================================

  magician: {
    id: "magician",
    name: "Magician",
    description: "Damage + utility casting. Harnesses chaos energy.",
    tier: 1,
    baseStats: { maxHp: 75, atk: 9, def: 3, agi: 5, acc: 7 },
    weaponTypes: ["staff"],
    unlockConditions: [
      { type: "milestone", description: "Bring 5 Chaos Shards to Base Camp" },
    ],
    innateAbility: "Mana Flow: -1 strain cost on magic cards",
  },

  thief: {
    id: "thief",
    name: "Thief",
    description: "Stealth, mobility, debuffs, and critical strikes.",
    tier: 1,
    baseStats: { maxHp: 85, atk: 7, def: 4, agi: 10, acc: 8 },
    weaponTypes: ["shortsword"],
    unlockConditions: [
      { type: "milestone", description: "Successfully steal from an enemy" },
    ],
    innateAbility: "Steal: Can pilfer items from enemies",
  },

  academic: {
    id: "academic",
    name: "Academic",
    description: "Tactical analysis, buffing, and intel gathering.",
    tier: 1,
    baseStats: { maxHp: 80, atk: 6, def: 4, agi: 6, acc: 7 },
    weaponTypes: ["bow", "shortsword"],
    unlockConditions: [
      { type: "milestone", description: "Scan 10 unique enemy types" },
    ],
    innateAbility: "Analysis: Reveal enemy HP and weaknesses",
  },

  freelancer: {
    id: "freelancer",
    name: "Freelancer",
    description: "Adaptive generalist. Can use any weapon with minor penalties.",
    tier: 1,
    baseStats: { maxHp: 95, atk: 7, def: 5, agi: 6, acc: 6 },
    weaponTypes: ["sword", "bow", "staff", "shortsword"], // Can use any
    unlockConditions: [
      { type: "class_rank", requiredClass: "squire", requiredRank: 2 },
      { type: "class_rank", requiredClass: "ranger", requiredRank: 2 },
    ],
    innateAbility: "Versatile: No weapon restrictions",
  },

  // ==========================================================================
  // TIER 2 - SQUIRE BRANCHES
  // ==========================================================================

  sentry: {
    id: "sentry",
    name: "Sentry",
    description: "Defensive vanguard. Anti-rush frontline specialist.",
    tier: 2,
    baseStats: { maxHp: 130, atk: 9, def: 11, agi: 4, acc: 6 },
    weaponTypes: ["sword", "greatsword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
      { type: "milestone", description: "Complete 3 battles with no ally KOs" },
    ],
    innateAbility: "Guardian: Adjacent allies take -2 damage",
  },

  paladin: {
    id: "paladin",
    name: "Paladin",
    description: "Protector with healing and mitigation abilities.",
    tier: 2,
    baseStats: { maxHp: 125, atk: 9, def: 10, agi: 4, acc: 7 },
    weaponTypes: ["sword", "greatsword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
      { type: "milestone", description: "Save an ally from lethal damage 5 times" },
    ],
    innateAbility: "Auto-Regen: Heal 5 HP per turn",
  },

  watch_guard: {
    id: "watch_guard",
    name: "Watch Guard",
    description: "Hybrid melee-ranged control and overwatch.",
    tier: 2,
    baseStats: { maxHp: 110, atk: 8, def: 7, agi: 6, acc: 8 },
    weaponTypes: ["sword", "bow"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
      { type: "milestone", description: "Deal melee and ranged damage in one battle" },
    ],
    innateAbility: "Overwatch: Free attack on enemies entering range",
  },

  // ==========================================================================
  // TIER 2 - RANGER BRANCHES
  // ==========================================================================

  hunter: {
    id: "hunter",
    name: "Hunter",
    description: "Precision ranged crits and single-target burst.",
    tier: 2,
    baseStats: { maxHp: 95, atk: 10, def: 4, agi: 8, acc: 10 },
    weaponTypes: ["bow", "gun"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
      { type: "milestone", description: "Score 3 max-range critical hits" },
    ],
    innateAbility: "Sharpshooter: +2 damage at max range",
  },

  bowmaster: {
    id: "bowmaster",
    name: "Bowmaster",
    description: "Long-range power shots and piercing attacks.",
    tier: 2,
    baseStats: { maxHp: 100, atk: 11, def: 4, agi: 7, acc: 9 },
    weaponTypes: ["bow", "greatbow"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
      { type: "milestone", description: "Fire 50 arrows total" },
    ],
    innateAbility: "Pierce: Attacks pass through first target",
  },

  trapper: {
    id: "trapper",
    name: "Trapper",
    description: "Battlefield control through traps, snares, and lures.",
    tier: 2,
    baseStats: { maxHp: 90, atk: 7, def: 5, agi: 8, acc: 8 },
    weaponTypes: ["bow", "gun"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
      { type: "milestone", description: "Trigger 5 traps in Free Zones" },
    ],
    innateAbility: "Set Trap: Place hazards on tiles",
  },

  // ==========================================================================
  // TIER 2 - MAGICIAN BRANCHES
  // ==========================================================================

  cleric: {
    id: "cleric",
    name: "Cleric",
    description: "Heals, shields, and purifies corruption.",
    tier: 2,
    baseStats: { maxHp: 80, atk: 5, def: 5, agi: 5, acc: 7 },
    weaponTypes: ["staff"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
      { type: "milestone", description: "Heal 500 HP cumulatively" },
    ],
    innateAbility: "Holy Light: Heals also damage undead",
  },

  wizard: {
    id: "wizard",
    name: "Wizard",
    description: "High-damage elemental casting specialist.",
    tier: 2,
    baseStats: { maxHp: 70, atk: 12, def: 3, agi: 5, acc: 8 },
    weaponTypes: ["staff", "greatstaff"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
      { type: "milestone", description: "Deal 1000 total magic damage" },
    ],
    innateAbility: "Arcane Mastery: +3 damage on elemental spells",
  },

  chaosmancer: {
    id: "chaosmancer",
    name: "Chaosmancer",
    description: "Chaos-infused hybrid of melee and magic.",
    tier: 2,
    baseStats: { maxHp: 90, atk: 10, def: 5, agi: 6, acc: 7 },
    weaponTypes: ["staff", "sword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
      { type: "milestone", description: "Survive 3 Chaos Surges" },
    ],
    innateAbility: "Chaos Blade: Melee attacks deal magic damage",
  },

  // ==========================================================================
  // TIER 2 - THIEF BRANCHES
  // ==========================================================================

  scout: {
    id: "scout",
    name: "Scout",
    description: "Recon specialist. Vision range boosts and picking off stragglers.",
    tier: 2,
    baseStats: { maxHp: 85, atk: 8, def: 4, agi: 9, acc: 9 },
    weaponTypes: ["bow"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "thief", requiredRank: 3 },
      { type: "milestone", description: "Discover 10 secrets in Free Zones" },
    ],
    innateAbility: "Far Sight: +2 vision range",
  },

  shadow: {
    id: "shadow",
    name: "Shadow",
    description: "Assassination master with evasion and backstab crits.",
    tier: 2,
    baseStats: { maxHp: 80, atk: 11, def: 3, agi: 12, acc: 9 },
    weaponTypes: ["shortsword", "bow"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "thief", requiredRank: 3 },
      { type: "milestone", description: "Perform 5 backstab kills" },
    ],
    innateAbility: "Backstab: +100% damage from behind",
  },

  trickster: {
    id: "trickster",
    name: "Trickster",
    description: "Confusion, displacement, and debuff specialist.",
    tier: 2,
    baseStats: { maxHp: 90, atk: 7, def: 5, agi: 10, acc: 8 },
    weaponTypes: ["sword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "thief", requiredRank: 3 },
      { type: "milestone", description: "Apply 20+ debuffs across operations" },
    ],
    innateAbility: "Misdirection: Enemies have -2 ACC vs this unit",
  },

  // ==========================================================================
  // TIER 3 - PRESTIGE HYBRID CLASSES
  // ==========================================================================

  spellblade: {
    id: "spellblade",
    name: "Spellblade",
    description: "Magic-infused melee warrior.",
    tier: 3,
    baseStats: { maxHp: 110, atk: 11, def: 7, agi: 6, acc: 8 },
    weaponTypes: ["sword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
      { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
      { type: "milestone", description: "Wield a magic-infused sword" },
    ],
    innateAbility: "Spellstrike: Melee attacks trigger spell effects",
  },

  dragoon: {
    id: "dragoon",
    name: "Dragoon",
    description: "Aerial assault specialist with jump attacks.",
    tier: 3,
    baseStats: { maxHp: 120, atk: 11, def: 7, agi: 7, acc: 8 },
    weaponTypes: ["spear"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "squire", requiredRank: 4 },
      { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
      { type: "milestone", description: "Kill flying enemy via jump card" },
    ],
    innateAbility: "Jump: Leap to distant tiles, avoiding attacks",
  },

  gladiator: {
    id: "gladiator",
    name: "Gladiator",
    description: "Stance master with counters and duel-style combat.",
    tier: 3,
    baseStats: { maxHp: 125, atk: 12, def: 8, agi: 6, acc: 7 },
    weaponTypes: ["greatsword", "fist"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "squire", requiredRank: 4 },
      { type: "class_rank", requiredClass: "freelancer", requiredRank: 3 },
      { type: "milestone", description: "Win a 1vX duel" },
    ],
    innateAbility: "Counter Stance: 30% chance to counter melee attacks",
  },

  geomancer: {
    id: "geomancer",
    name: "Geomancer",
    description: "Terrain manipulation and AoE zone specialist.",
    tier: 3,
    baseStats: { maxHp: 100, atk: 9, def: 6, agi: 6, acc: 8 },
    weaponTypes: ["staff", "shortsword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
      { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
      { type: "milestone", description: "Encounter 3 terrain anomalies" },
    ],
    innateAbility: "Terrain Mastery: Abilities change based on tile type",
  },

  oracle: {
    id: "oracle",
    name: "Oracle",
    description: "Status magic, foresight, and predictive buffs.",
    tier: 3,
    baseStats: { maxHp: 85, atk: 7, def: 5, agi: 7, acc: 9 },
    weaponTypes: ["staff"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
      { type: "class_rank", requiredClass: "academic", requiredRank: 2 },
      { type: "milestone", description: "Win with 5+ active debuffs on enemies" },
    ],
    innateAbility: "Prescience: See enemy intentions for next turn",
  },

  summoner: {
    id: "summoner",
    name: "Summoner",
    description: "Calls forth eidolons, sigils, and temporary allies.",
    tier: 3,
    baseStats: { maxHp: 80, atk: 8, def: 4, agi: 5, acc: 7 },
    weaponTypes: ["greatstaff"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "cleric", requiredRank: 3 },
      { type: "class_rank", requiredClass: "wizard", requiredRank: 3 },
      { type: "milestone", description: "Defeat a Sigil Beast in Free Zone" },
    ],
    innateAbility: "Summon: Call temporary allied units",
  },

  chronomancer: {
    id: "chronomancer",
    name: "Chronomancer",
    description: "Time manipulation: haste, slow, turn order control.",
    tier: 3,
    baseStats: { maxHp: 75, atk: 7, def: 4, agi: 9, acc: 8 },
    weaponTypes: ["staff"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "wizard", requiredRank: 4 },
      { type: "class_rank", requiredClass: "academic", requiredRank: 3 },
      { type: "milestone", description: "Defeat miniboss within 5 turns" },
    ],
    innateAbility: "Temporal Flux: Can manipulate turn order",
  },

  warsmith: {
    id: "warsmith",
    name: "Warsmith",
    description: "Engineer deploying turrets, drones, and gadgets.",
    tier: 3,
    baseStats: { maxHp: 105, atk: 9, def: 7, agi: 5, acc: 8 },
    weaponTypes: ["gun"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "academic", requiredRank: 3 },
      { type: "class_rank", requiredClass: "freelancer", requiredRank: 3 },
      { type: "milestone", description: "Craft an advanced Steam Component" },
    ],
    innateAbility: "Deploy Turret: Place automated gun emplacement",
  },

  necrotec: {
    id: "necrotec",
    name: "Necrotec",
    description: "Reanimates fallen enemies as mechanical husks.",
    tier: 3,
    baseStats: { maxHp: 95, atk: 10, def: 6, agi: 5, acc: 7 },
    weaponTypes: ["staff", "sword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "chaosmancer", requiredRank: 3 },
      { type: "class_rank", requiredClass: "warsmith", requiredRank: 3 },
      { type: "milestone", description: "Perform reactivation ritual" },
    ],
    innateAbility: "Reanimate: Raise defeated enemies as allies",
  },

  battle_alchemist: {
    id: "battle_alchemist",
    name: "Battle Alchemist",
    description: "Grenades, chain reactions, and status payloads.",
    tier: 3,
    baseStats: { maxHp: 90, atk: 9, def: 5, agi: 7, acc: 8 },
    weaponTypes: ["shortsword"],
    unlockConditions: [
      { type: "class_rank", requiredClass: "magician", requiredRank: 2 },
      { type: "class_rank", requiredClass: "thief", requiredRank: 2 },
      { type: "milestone", description: "Craft 5 alchemical weapons" },
    ],
    innateAbility: "Throw Bomb: AoE damage and status effects",
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getClassDefinition(classId: ClassId): ClassDefinition {
  return CLASS_DEFINITIONS[classId];
}

export function getAvailableClasses(): ClassId[] {
  return Object.keys(CLASS_DEFINITIONS) as ClassId[];
}

export function isClassUnlocked(
  classId: ClassId,
  progress: UnitClassProgress
): boolean {
  // Check if already unlocked
  if (progress.unlockedClasses.includes(classId)) {
    return true;
  }

  const classDef = CLASS_DEFINITIONS[classId];
  const conditions = classDef.unlockConditions;

  // Check all conditions
  return conditions.every(condition => {
    switch (condition.type) {
      case "always_unlocked":
        return true;

      case "class_rank":
        if (!condition.requiredClass || condition.requiredRank === undefined) {
          return false;
        }
        const rank = progress.classRanks[condition.requiredClass] || 0;
        return rank >= condition.requiredRank;

      case "milestone":
      case "special":
        // For now, treat milestones as locked (will implement milestone tracking later)
        return false;

      default:
        return false;
    }
  });
}

export function getUnlockableClasses(progress: UnitClassProgress): ClassId[] {
  const allClasses = getAvailableClasses();
  return allClasses.filter(classId => {
    // Not already unlocked
    if (progress.unlockedClasses.includes(classId)) {
      return false;
    }
    // Check if can be unlocked
    return isClassUnlocked(classId, progress);
  });
}

export function getClassTier(classId: ClassId): number {
  return CLASS_DEFINITIONS[classId].tier;
}

export function getClassesByTier(tier: 0 | 1 | 2 | 3): ClassId[] {
  return getAvailableClasses().filter(classId =>
    CLASS_DEFINITIONS[classId].tier === tier
  );
}

export function getUnlockRequirementsText(classId: ClassId): string[] {
  const classDef = CLASS_DEFINITIONS[classId];
  const texts: string[] = [];

  classDef.unlockConditions.forEach(condition => {
    switch (condition.type) {
      case "always_unlocked":
        texts.push("Always available");
        break;

      case "class_rank":
        if (condition.requiredClass && condition.requiredRank) {
          const reqClass = CLASS_DEFINITIONS[condition.requiredClass];
          texts.push(`${reqClass.name} Rank ${condition.requiredRank}`);
        }
        break;

      case "milestone":
      case "special":
        if (condition.description) {
          texts.push(condition.description);
        }
        break;
    }
  });

  return texts;
}

export function createDefaultClassProgress(unitId: UnitId): UnitClassProgress {
  return {
    unitId,
    classRanks: {
      squire: 1,
      ranger: 1,
    } as Record<ClassId, number>,
    currentClass: "squire",
    unlockedClasses: ["squire", "ranger"],
    battlesWon: 0,
    milestones: [],
  };
}

export function changeUnitClass(
  progress: UnitClassProgress,
  newClass: ClassId
): UnitClassProgress {
  // Must be unlocked
  if (!isClassUnlocked(newClass, progress)) {
    console.warn("[CLASS] Cannot change to locked class:", newClass);
    return progress;
  }

  // Add to unlocked if not already
  const unlockedClasses = progress.unlockedClasses.includes(newClass)
    ? progress.unlockedClasses
    : [...progress.unlockedClasses, newClass];

  // Initialize class rank if needed
  const classRanks = { ...progress.classRanks };
  if (!classRanks[newClass]) {
    classRanks[newClass] = 1;
  }

  return {
    ...progress,
    currentClass: newClass,
    unlockedClasses,
    classRanks,
  };
}

export function addClassXP(
  progress: UnitClassProgress,
  classId: ClassId,
  xp: number
): UnitClassProgress {
  const currentRank = progress.classRanks[classId] || 0;
  const newRank = currentRank + Math.floor(xp / 100); // Simple: 100 XP per rank

  return {
    ...progress,
    classRanks: {
      ...progress.classRanks,
      [classId]: Math.min(newRank, 5), // Cap at rank 5
    },
  };
}

export function addMilestone(
  progress: UnitClassProgress,
  milestone: string
): UnitClassProgress {
  if (progress.milestones.includes(milestone)) {
    return progress; // Already have this milestone
  }

  return {
    ...progress,
    milestones: [...progress.milestones, milestone],
  };
}
