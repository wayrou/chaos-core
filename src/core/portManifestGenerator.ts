// ============================================================================
// PORT MANIFEST GENERATOR
// ============================================================================

import {
  TradeOffer,
  BulkShipmentOffer,
  PortManifest,
  ResourceType,
  ResourceAmount,
  BASIC_RESOURCES,
  getNormalTradeTemplates,
  getBulkShipmentBasicPayouts,
  getBulkShipmentInterestingPayouts,
} from "./portTrades";
import { GameState } from "./types";
import { CampaignProgress, isOperationCompleted } from "./campaign";

// ----------------------------------------------------------------------------
// MANIFEST GENERATION
// ----------------------------------------------------------------------------

/**
 * Generate a new Port manifest based on visit index and player state
 */
export function generatePortManifest(
  visitIndex: number,
  campaignProgress: CampaignProgress,
  playerInventory: GameState["resources"]
): PortManifest {
  // Create seeded RNG from visit index
  const seed = visitIndex;
  const rng = createSeededRNG(seed);
  
  // Generate normal trade offers (3-5 offers)
  const numOffers = 3 + Math.floor(rng() * 3); // 3-5 offers
  const normalOffers = generateNormalOffers(numOffers, rng, playerInventory);
  
  // Generate bulk shipment offer
  const bulkShipmentOffer = generateBulkShipmentOffer(
    rng,
    campaignProgress,
    playerInventory
  );
  
  return {
    normalOffers,
    bulkShipmentOffer,
    generatedAtVisitIndex: visitIndex,
    generatedAtTime: Date.now(),
  };
}

/**
 * Generate normal trade offers with weighted selection
 */
function generateNormalOffers(
  count: number,
  rng: () => number,
  playerInventory: GameState["resources"]
): TradeOffer[] {
  const templates = getNormalTradeTemplates();
  const offers: TradeOffer[] = [];
  const usedTemplateIndices = new Set<number>();
  
  // Apply hoarding penalty (subtle weighting)
  const weightedTemplates = templates.map((template, index) => {
    const playerAmount = playerInventory[template.input.resource] || 0;
    // If player has 3x+ the input amount, reduce weight by 30%
    const hoardingPenalty = playerAmount >= template.input.amount * 3 ? 0.7 : 1.0;
    return {
      ...template,
      weight: template.weight * hoardingPenalty,
      originalIndex: index,
    };
  });
  
  for (let i = 0; i < count; i++) {
    // Select template using weighted random
    let selectedTemplate: typeof weightedTemplates[0] | null = null;
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!selectedTemplate && attempts < maxAttempts) {
      const totalWeight = weightedTemplates.reduce((sum, t) => {
        if (usedTemplateIndices.has(t.originalIndex)) return sum;
        return sum + t.weight;
      }, 0);
      
      if (totalWeight === 0) break; // All templates used
      
      let random = rng() * totalWeight;
      for (const template of weightedTemplates) {
        if (usedTemplateIndices.has(template.originalIndex)) continue;
        random -= template.weight;
        if (random <= 0) {
          selectedTemplate = template;
          usedTemplateIndices.add(template.originalIndex);
          break;
        }
      }
      attempts++;
    }
    
    if (!selectedTemplate) {
      // Fallback: use any unused template
      const available = weightedTemplates.filter(
        t => !usedTemplateIndices.has(t.originalIndex)
      );
      if (available.length > 0) {
        selectedTemplate = available[Math.floor(rng() * available.length)];
        usedTemplateIndices.add(selectedTemplate.originalIndex);
      } else {
        // Reuse a template if we've exhausted all options
        selectedTemplate = weightedTemplates[Math.floor(rng() * weightedTemplates.length)];
      }
    }
    
    if (selectedTemplate) {
      offers.push({
        ...selectedTemplate,
        id: `trade_${visitIndex}_${i}`,
        fulfilled: false,
      });
    }
  }
  
  return offers;
}

/**
 * Generate bulk shipment offer
 */
function generateBulkShipmentOffer(
  rng: () => number,
  campaignProgress: CampaignProgress,
  playerInventory: GameState["resources"]
): BulkShipmentOffer {
  // Determine eligible resource types
  const eligibleResources: ResourceType[] = [];
  
  // Check if player can target rare resources (Operation 4/5 completed)
  const canTargetRare = 
    isOperationCompleted("op_ember_siege", campaignProgress) ||
    isOperationCompleted("op_final_dawn", campaignProgress);
  
  // For now, only basic resources are available
  // Filter to resources the player actually has
  for (const resource of BASIC_RESOURCES) {
    const amount = playerInventory[resource] || 0;
    if (amount > 0) {
      eligibleResources.push(resource);
    }
  }
  
  // If no eligible resources, default to first basic resource
  const targetResource = eligibleResources.length > 0
    ? eligibleResources[Math.floor(rng() * eligibleResources.length)]
    : BASIC_RESOURCES[0];
  
  // Select payout (90% basic, 10% interesting)
  const isInteresting = rng() < 0.1;
  const payoutPool = isInteresting
    ? getBulkShipmentInterestingPayouts()
    : getBulkShipmentBasicPayouts();
  
  const payout = payoutPool[Math.floor(rng() * payoutPool.length)];
  
  return {
    id: `bulk_shipment_${Date.now()}`,
    name: "Bulk Shipment",
    description: `Ship all ${targetResource} for consolidated resources`,
    targetResource,
    basicPayout: isInteresting ? [] : payout,
    interestingPayout: isInteresting ? payout : [],
  };
}

// ----------------------------------------------------------------------------
// SEEDED RNG
// ----------------------------------------------------------------------------

/**
 * Create a seeded random number generator
 * Simple LCG (Linear Congruential Generator)
 */
function createSeededRNG(seed: number): () => number {
  let state = seed;
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  return () => {
    state = (a * state + c) % m;
    return state / m;
  };
}

