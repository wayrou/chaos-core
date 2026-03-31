// ============================================================================
// FIELD MOD REWARD SCREEN
// Shown when player completes treasure/elite nodes - choose 1 of 3 Field Mods
// ============================================================================

import { FieldModDef, FieldModInstance, FieldModRarity } from "../../core/fieldMods";
import { getAllFieldModDefs, getFieldModDef } from "../../core/fieldModDefinitions";
import { loadCampaignProgress, saveCampaignProgress } from "../../core/campaign";
import { renderOperationMapScreen, markRoomVisited } from "./OperationMapScreen";
import { syncCampaignToGameState } from "../../core/campaignSync";

// Debug flag for Field Mod rewards
const DEBUG_FIELD_MOD_REWARDS = true;

// Rarity weights for treasure nodes
const TREASURE_RARITY_WEIGHTS: Record<FieldModRarity, number> = {
  common: 60,
  uncommon: 30,
  rare: 10,
};

// Rarity weights for elite nodes (higher rare chance)
const ELITE_RARITY_WEIGHTS: Record<FieldModRarity, number> = {
  common: 40,
  uncommon: 35,
  rare: 25,
};

// Seeded RNG for deterministic rewards
interface SeededRNG {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
}

function createSeededRNG(seed: string): SeededRNG {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  let state = Math.abs(hash) || 1;

  return {
    nextInt(min: number, max: number): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const normalized = state / 0x7fffffff;
      return Math.floor(min + normalized * (max - min + 1));
    },
    nextFloat(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
  };
}

/**
 * Generate 3 Field Mod choices for reward
 */
export function generateFieldModChoices(
  seed: string,
  rarityWeights: Record<FieldModRarity, number> = TREASURE_RARITY_WEIGHTS
): FieldModDef[] {
  const rng = createSeededRNG(seed);
  const allMods = getAllFieldModDefs();
  const choices: FieldModDef[] = [];
  const usedIds = new Set<string>();

  // Group mods by rarity
  const modsByRarity: Record<FieldModRarity, FieldModDef[]> = {
    common: allMods.filter(m => m.rarity === "common"),
    uncommon: allMods.filter(m => m.rarity === "uncommon"),
    rare: allMods.filter(m => m.rarity === "rare"),
  };

  // Calculate total weight
  const totalWeight = Object.values(rarityWeights).reduce((a, b) => a + b, 0);

  // Pick 3 mods
  for (let i = 0; i < 3; i++) {
    // Roll for rarity
    let roll = rng.nextFloat() * totalWeight;
    let selectedRarity: FieldModRarity = "common";

    for (const [rarity, weight] of Object.entries(rarityWeights)) {
      roll -= weight;
      if (roll <= 0) {
        selectedRarity = rarity as FieldModRarity;
        break;
      }
    }

    // Get available mods of that rarity (not already chosen)
    const available = modsByRarity[selectedRarity].filter(m => !usedIds.has(m.id));

    if (available.length === 0) {
      // Fallback: try any mod not already chosen
      const anyAvailable = allMods.filter(m => !usedIds.has(m.id));
      if (anyAvailable.length === 0) break;
      const idx = rng.nextInt(0, anyAvailable.length - 1);
      choices.push(anyAvailable[idx]);
      usedIds.add(anyAvailable[idx].id);
    } else {
      const idx = rng.nextInt(0, available.length - 1);
      choices.push(available[idx]);
      usedIds.add(available[idx].id);
    }
  }

  if (DEBUG_FIELD_MOD_REWARDS) {
    console.log(`[FieldMods] Reward offered: [${choices.map(c => c.id).join(", ")}]`);
  }

  return choices;
}

/**
 * Add Field Mod to run inventory (merge stacks if duplicate)
 */
export function addFieldModToInventory(modId: string): void {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    console.error("[FieldMods] No active run to add mod to");
    return;
  }

  const modDef = getFieldModDef(modId);
  if (!modDef) {
    console.error(`[FieldMods] Unknown mod ID: ${modId}`);
    return;
  }

  const inventory = progress.activeRun.runFieldModInventory || [];

  // Check if we already have this mod
  const existing = inventory.find(inst => inst.defId === modId);

  if (existing) {
    // Merge stacks (up to max)
    const maxStacks = modDef.maxStacks || 99;
    const newStacks = Math.min(existing.stacks + 1, maxStacks);
    existing.stacks = newStacks;

    if (DEBUG_FIELD_MOD_REWARDS) {
      console.log(`[FieldMods] Acquired: ${modId} stacks=${newStacks} (merged)`);
    }
  } else {
    // Add new instance
    const newInstance: FieldModInstance = {
      defId: modId,
      stacks: 1,
      instanceId: `${modId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    };
    inventory.push(newInstance);

    if (DEBUG_FIELD_MOD_REWARDS) {
      console.log(`[FieldMods] Acquired: ${modId} stacks=1 (new)`);
    }
  }

  // Save updated inventory
  const updated = {
    ...progress,
    activeRun: {
      ...progress.activeRun,
      runFieldModInventory: inventory,
    },
  };

  saveCampaignProgress(updated);
}

/**
 * Render Field Mod reward selection screen
 * @param nodeId - The node that triggered the reward
 * @param rewardSeed - Deterministic seed for reward generation
 * @param isElite - Whether this is an elite reward (better rarity weights)
 */
export function renderFieldModRewardScreen(
  nodeId: string,
  rewardSeed: string,
  isElite: boolean = false
): void {
  const root = document.getElementById("app");
  if (!root) return;

  const rarityWeights = isElite ? ELITE_RARITY_WEIGHTS : TREASURE_RARITY_WEIGHTS;
  const choices = generateFieldModChoices(rewardSeed, rarityWeights);

  const getRarityClass = (rarity: FieldModRarity): string => {
    switch (rarity) {
      case "common": return "field-mod-common";
      case "uncommon": return "field-mod-uncommon";
      case "rare": return "field-mod-rare";
      default: return "";
    }
  };

  const getScopeLabel = (scope: string): string => {
    return scope === "squad" ? "SQUAD-WIDE" : "UNIT";
  };

  root.innerHTML = `
    <div class="field-mod-reward-root">
      <div class="field-mod-reward-card">
        <div class="field-mod-reward-header">
          <h1 class="field-mod-reward-title">${isElite ? "ELITE SPOILS" : "TREASURE FOUND"}</h1>
          <p class="field-mod-reward-subtitle">Choose a Field Mod to add to your inventory</p>
        </div>

        <div class="field-mod-reward-options">
          ${choices.map(mod => `
            <div class="field-mod-option ${getRarityClass(mod.rarity)}" data-mod-id="${mod.id}">
              <div class="field-mod-option-header">
                <span class="field-mod-rarity-badge">${mod.rarity.toUpperCase()}</span>
                <span class="field-mod-scope-badge">${getScopeLabel(mod.scope)}</span>
              </div>
              <h2 class="field-mod-option-name">${mod.name}</h2>
              <p class="field-mod-option-description">${mod.description}</p>
              <div class="field-mod-option-meta">
                <span class="field-mod-stack-info">Max Stacks: ${mod.maxStacks || "∞"}</span>
                ${mod.chance ? `<span class="field-mod-chance-info">Proc: ${Math.round(mod.chance * 100)}%</span>` : ""}
              </div>
              <button class="field-mod-option-select" data-mod-id="${mod.id}">
                SELECT
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  root.querySelectorAll(".field-mod-option-select, .field-mod-option").forEach(element => {
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      const modId = (e.currentTarget as HTMLElement).getAttribute("data-mod-id");
      if (modId) {
        selectFieldMod(nodeId, modId);
      }
    });
  });
}

/**
 * Handle Field Mod selection
 */
function selectFieldMod(nodeId: string, modId: string): void {
  // Add mod to inventory
  addFieldModToInventory(modId);

  // Mark the room as visited/cleared
  markRoomVisited(nodeId);

  // Sync campaign state
  syncCampaignToGameState();

  // Return to operation map
  renderOperationMapScreen();
}

// Export rarity weights for use in shop
export { TREASURE_RARITY_WEIGHTS, ELITE_RARITY_WEIGHTS };
