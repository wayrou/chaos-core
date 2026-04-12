import type { GameState, InventoryItem } from "./types";
import type { ResourceKey } from "./resources";
import { hasSeenOuterDeckNpcEncounter } from "./outerDecks";
import { getInventoryIconPath } from "./inventoryIcons";

export type AdvancedMaterialId =
  | "resource_alloy"
  | "resource_drawcord"
  | "resource_fittings"
  | "resource_resin"
  | "resource_charge_cell";

export type MaterialRefineryContext = "haven" | "expedition";

export interface MaterialRefineryRecipe {
  id: AdvancedMaterialId;
  name: string;
  description: string;
  outputQuantity: number;
  cost: Partial<Record<ResourceKey, number>>;
}

export interface MaterialRefineryShortageEntry {
  resourceKey: ResourceKey;
  required: number;
  available: number;
}

export const MATERIAL_REFINERY_RECIPES: Record<AdvancedMaterialId, MaterialRefineryRecipe> = {
  resource_alloy: {
    id: "resource_alloy",
    name: "ALLOY",
    description: "Refined metal laminate for reinforced fabrication.",
    outputQuantity: 1,
    cost: {
      metalScrap: 2,
      steamComponents: 1,
    },
  },
  resource_drawcord: {
    id: "resource_drawcord",
    name: "DRAWCORD",
    description: "Tension-rated line for scaffold pulls and light rigging.",
    outputQuantity: 1,
    cost: {
      wood: 2,
      steamComponents: 1,
    },
  },
  resource_fittings: {
    id: "resource_fittings",
    name: "FITTINGS",
    description: "Standardized couplings and braces for field assembly.",
    outputQuantity: 1,
    cost: {
      metalScrap: 1,
      wood: 1,
      steamComponents: 1,
    },
  },
  resource_resin: {
    id: "resource_resin",
    name: "RESIN",
    description: "Chaos-treated sealant for patching and insulation.",
    outputQuantity: 1,
    cost: {
      wood: 2,
      chaosShards: 1,
    },
  },
  resource_charge_cell: {
    id: "resource_charge_cell",
    name: "CHARGE CELL",
    description: "Compact power reserve for expedition devices and tools.",
    outputQuantity: 1,
    cost: {
      chaosShards: 2,
      steamComponents: 1,
    },
  },
};

const ADVANCED_MATERIAL_RESOURCE_NAMES: Record<AdvancedMaterialId, string> = {
  resource_alloy: "Alloy",
  resource_drawcord: "Drawcord",
  resource_fittings: "Fittings",
  resource_resin: "Resin",
  resource_charge_cell: "Charge Cell",
};

const ADVANCED_MATERIAL_DESCRIPTIONS: Record<AdvancedMaterialId, string> = {
  resource_alloy: "Refined alloy stock used for advanced fabrication.",
  resource_drawcord: "Braided drawcord useful for cable work and field rigging.",
  resource_fittings: "Precision fittings for modular assemblies and repairs.",
  resource_resin: "Industrial resin for sealing, binding, and insulation.",
  resource_charge_cell: "Portable charge cell containing condensed expedition power.",
};

const MATERIAL_REFINERY_SUPPORT_OUTPUT_BONUS: Record<AdvancedMaterialId, Array<{
  encounterId: "shaft_mechanist" | "scaffold_spotter" | "dropbay_loader" | "intake_quartermaster";
  bonus: number;
}>> = {
  resource_alloy: [{ encounterId: "shaft_mechanist", bonus: 1 }],
  resource_drawcord: [{ encounterId: "scaffold_spotter", bonus: 1 }],
  resource_fittings: [{ encounterId: "dropbay_loader", bonus: 1 }],
  resource_resin: [{ encounterId: "intake_quartermaster", bonus: 1 }],
  resource_charge_cell: [{ encounterId: "intake_quartermaster", bonus: 1 }],
};

function getInventoryBinForContext(context: MaterialRefineryContext): "baseStorage" | "forwardLocker" {
  return context === "expedition" ? "forwardLocker" : "baseStorage";
}

function cloneInventoryItem(item: InventoryItem): InventoryItem {
  return {
    ...item,
    metadata: item.metadata ? { ...item.metadata } : undefined,
  };
}

function addInventoryItemToBin(
  items: InventoryItem[],
  nextItem: InventoryItem,
): InventoryItem[] {
  const clonedItems = items.map(cloneInventoryItem);
  const existingIndex = clonedItems.findIndex((entry) => entry.id === nextItem.id);
  if (existingIndex >= 0 && nextItem.stackable) {
    const existing = clonedItems[existingIndex];
    clonedItems[existingIndex] = {
      ...existing,
      quantity: Math.max(0, Number(existing.quantity ?? 0)) + Math.max(1, Number(nextItem.quantity ?? 1)),
    };
    return clonedItems;
  }

  clonedItems.push(cloneInventoryItem(nextItem));
  return clonedItems;
}

export function getMaterialRefineryRecipes(): MaterialRefineryRecipe[] {
  return Object.values(MATERIAL_REFINERY_RECIPES);
}

export function getMaterialRefineryRecipe(recipeId: AdvancedMaterialId): MaterialRefineryRecipe {
  return MATERIAL_REFINERY_RECIPES[recipeId];
}

export function getMaterialRefineryEffectiveOutputQuantity(
  state: GameState,
  recipeId: AdvancedMaterialId,
): number {
  const recipe = getMaterialRefineryRecipe(recipeId);
  const supportBonus = (MATERIAL_REFINERY_SUPPORT_OUTPUT_BONUS[recipeId] ?? []).reduce((total, entry) => (
    hasSeenOuterDeckNpcEncounter(state, entry.encounterId) ? total + entry.bonus : total
  ), 0);
  return recipe.outputQuantity + supportBonus;
}

export function createAdvancedMaterialInventoryItem(
  materialId: AdvancedMaterialId,
  quantity = 1,
): InventoryItem {
  return {
    id: materialId,
    name: ADVANCED_MATERIAL_RESOURCE_NAMES[materialId],
    kind: "resource",
    stackable: true,
    quantity: Math.max(1, Math.floor(quantity)),
    massKg: 0,
    bulkBu: 0,
    powerW: 0,
    description: ADVANCED_MATERIAL_DESCRIPTIONS[materialId],
    iconPath: getInventoryIconPath(),
    metadata: {
      resourceType: materialId,
      advancedResource: true,
    },
  };
}

export function countAdvancedMaterialOwned(state: GameState, materialId: AdvancedMaterialId): number {
  return [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])]
    .filter((item) => item.kind === "resource" && item.id === materialId)
    .reduce((total, item) => total + Math.max(0, Number(item.quantity ?? 0)), 0);
}

export function getMaterialRefineryShortage(
  state: GameState,
  recipeId: AdvancedMaterialId,
): MaterialRefineryShortageEntry[] {
  const recipe = getMaterialRefineryRecipe(recipeId);
  return Object.entries(recipe.cost).flatMap(([resourceKey, requiredValue]) => {
    const required = Math.max(0, Number(requiredValue ?? 0));
    if (required <= 0) {
      return [];
    }

    const typedKey = resourceKey as ResourceKey;
    const available = Math.max(0, Number(state.resources?.[typedKey] ?? 0));
    if (available >= required) {
      return [];
    }

    return [{
      resourceKey: typedKey,
      required,
      available,
    }];
  });
}

export function canCraftMaterialRefineryRecipe(
  state: GameState,
  recipeId: AdvancedMaterialId,
): boolean {
  return getMaterialRefineryShortage(state, recipeId).length === 0;
}

export function craftMaterialRefineryRecipe(
  state: GameState,
  recipeId: AdvancedMaterialId,
  context: MaterialRefineryContext,
): GameState {
  const recipe = getMaterialRefineryRecipe(recipeId);
  if (!canCraftMaterialRefineryRecipe(state, recipeId)) {
    return state;
  }

  const inventoryBin = getInventoryBinForContext(context);
  const nextResources = {
    ...(state.resources ?? {}),
  };

  Object.entries(recipe.cost).forEach(([resourceKey, costValue]) => {
    const typedKey = resourceKey as ResourceKey;
    const cost = Math.max(0, Number(costValue ?? 0));
    nextResources[typedKey] = Math.max(0, Number(nextResources[typedKey] ?? 0) - cost);
  });

  const nextInventory = {
    ...state.inventory,
    [inventoryBin]: addInventoryItemToBin(
      state.inventory?.[inventoryBin] ?? [],
      createAdvancedMaterialInventoryItem(recipeId, getMaterialRefineryEffectiveOutputQuantity(state, recipeId)),
    ),
  };

  return {
    ...state,
    resources: nextResources,
    inventory: nextInventory,
  };
}
