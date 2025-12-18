// ============================================================================
// CHAOS CORE - GEAR DOCTRINE REGISTRY
// Behavior/intent layer for gear builder system
// ============================================================================

export type IntentTag = "assault" | "skirmish" | "suppression" | "sustain" | "control";

export interface GearDoctrine {
  id: string;
  name: string;
  shortDescription: string;
  
  // Intent classification
  intentTags: IntentTag[];
  
  // Stability modifier (adds to chassis base stability)
  stabilityModifier: number; // -20 to +20 typical range
  
  // Strain bias (if applicable - affects strain costs)
  strainBias?: number; // -1 to +1, affects strain calculations
  
  // Proc bias (if applicable - affects proc chances)
  procBias?: number; // -0.1 to +0.1, affects proc systems
  
  // Build cost modifier (adds to chassis base cost)
  buildCostModifier: {
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };
  
  // Flavor text rules (v1: text only, no heavy logic)
  doctrineRules?: string;
  
  // Description
  description: string;
}

// ============================================================================
// DOCTRINE DEFINITIONS
// ============================================================================

export const ALL_DOCTRINES: GearDoctrine[] = [
  {
    id: "doctrine_assault",
    name: "Assault Doctrine",
    shortDescription: "Aggressive forward combat focus",
    intentTags: ["assault"],
    stabilityModifier: -10,
    strainBias: 0.2,
    buildCostModifier: {
      metalScrap: 5,
      wood: 2,
      chaosShards: 0,
      steamComponents: 1,
    },
    doctrineRules: "Assault Doctrine: Cards cost 20% more strain. Gain bonus damage on first attack each turn.",
    description: "Optimized for aggressive engagements. Higher strain costs but increased offensive output.",
  },
  {
    id: "doctrine_suppression",
    name: "Suppression Doctrine",
    shortDescription: "Area control and battlefield denial",
    intentTags: ["suppression", "control"],
    stabilityModifier: -5,
    procBias: 0.1,
    buildCostModifier: {
      metalScrap: 3,
      wood: 1,
      chaosShards: 1,
      steamComponents: 2,
    },
    doctrineRules: "Suppression Doctrine: Area effect cards gain +10% proc chance. Reduced movement penalties.",
    description: "Designed for area control. Enhanced proc rates on suppression abilities.",
  },
  {
    id: "doctrine_skirmish",
    name: "Skirmish Doctrine",
    shortDescription: "Mobility and hit-and-run tactics",
    intentTags: ["skirmish", "mobility"],
    stabilityModifier: 5,
    strainBias: -0.1,
    buildCostModifier: {
      metalScrap: 2,
      wood: 3,
      chaosShards: 0,
      steamComponents: 1,
    },
    doctrineRules: "Skirmish Doctrine: Movement cards cost 10% less strain. +1 move range on first move each turn.",
    description: "Emphasizes mobility and efficiency. Lower strain costs, improved movement capabilities.",
  },
  {
    id: "doctrine_sustain",
    name: "Sustain Doctrine",
    shortDescription: "Endurance and resource efficiency",
    intentTags: ["sustain"],
    stabilityModifier: 15,
    strainBias: -0.15,
    buildCostModifier: {
      metalScrap: 4,
      wood: 2,
      chaosShards: 0,
      steamComponents: 1,
    },
    doctrineRules: "Sustain Doctrine: All cards cost 15% less strain. Gain +5 stability. Reduced wear on equipment.",
    description: "Built for long engagements. Lower strain costs and higher stability for sustained operations.",
  },
  {
    id: "doctrine_control",
    name: "Control Doctrine",
    shortDescription: "Debuffs and battlefield manipulation",
    intentTags: ["control"],
    stabilityModifier: 0,
    procBias: 0.15,
    buildCostModifier: {
      metalScrap: 3,
      wood: 1,
      chaosShards: 2,
      steamComponents: 3,
    },
    doctrineRules: "Control Doctrine: Debuff cards gain +15% proc chance. Status effects last 1 turn longer.",
    description: "Focused on battlefield control. Enhanced effectiveness of debuff and status effects.",
  },
  {
    id: "doctrine_balanced",
    name: "Balanced Doctrine",
    shortDescription: "No specialization, reliable baseline",
    intentTags: ["assault", "sustain"],
    stabilityModifier: 5,
    buildCostModifier: {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
    },
    doctrineRules: "Balanced Doctrine: No special bonuses or penalties. Reliable performance across all situations.",
    description: "No specialization. Solid baseline performance without tradeoffs.",
  },
];

// ============================================================================
// UTILITIES
// ============================================================================

export function getDoctrineById(id: string): GearDoctrine | undefined {
  return ALL_DOCTRINES.find(d => d.id === id);
}

export function getAllDoctrineIds(): string[] {
  return ALL_DOCTRINES.map(d => d.id);
}

export function getDoctrinesByIntent(intent: IntentTag): GearDoctrine[] {
  return ALL_DOCTRINES.filter(d => d.intentTags.includes(intent));
}
