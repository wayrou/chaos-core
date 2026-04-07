import type { BaseCampFieldNodeLayout, UILayoutState } from "../core/types";
import {
  isBlackMarketNodeUnlocked,
  isDispatchNodeUnlocked,
  isFoundryAnnexUnlocked,
  isPortNodeUnlocked,
  isSchemaNodeUnlocked,
  isStableNodeUnlocked,
} from "../core/campaign";

export type BaseCampNodeId =
  | "shop"
  | "roster"
  | "loadout"
  | "ops-terminal"
  | "quest-board"
  | "tavern"
  | "gear-workbench"
  | "quarters"
  | "schema"
  | "foundry-annex"
  | "black-market"
  | "stable"
  | "dispatch"
  | "port"
  | "comms-array";

export interface BaseCampNodeDefinition {
  id: BaseCampNodeId;
  label: string;
  objectId: string;
  zoneId: string;
  width: number;
  height: number;
  defaultX: number;
  defaultY: number;
}

export const BASE_CAMP_NODE_DEFINITIONS: BaseCampNodeDefinition[] = [
  { id: "shop", label: "SHOP", objectId: "shop_station", zoneId: "interact_shop", width: 2, height: 2, defaultX: 3, defaultY: 3 },
  { id: "quarters", label: "QUARTERS", objectId: "quarters_station", zoneId: "interact_quarters", width: 2, height: 2, defaultX: 7, defaultY: 3 },
  { id: "roster", label: "UNIT ROSTER", objectId: "roster_station", zoneId: "interact_roster", width: 2, height: 2, defaultX: 11, defaultY: 3 },
  { id: "loadout", label: "LOADOUT", objectId: "loadout_station", zoneId: "interact_loadout", width: 2, height: 2, defaultX: 27, defaultY: 5 },
  { id: "ops-terminal", label: "OPS TERMINAL", objectId: "ops_terminal", zoneId: "interact_ops", width: 2, height: 2, defaultX: 27, defaultY: 8 },
  { id: "quest-board", label: "QUEST BOARD", objectId: "quest_board", zoneId: "interact_quest_board", width: 2, height: 2, defaultX: 3, defaultY: 10 },
  { id: "tavern", label: "TAVERN", objectId: "tavern_station", zoneId: "interact_tavern", width: 2, height: 2, defaultX: 7, defaultY: 10 },
  { id: "gear-workbench", label: "WORKSHOP", objectId: "gear_workbench_station", zoneId: "interact_gear_workbench", width: 2, height: 2, defaultX: 11, defaultY: 10 },
  { id: "comms-array", label: "COMMS ARRAY", objectId: "comms_array_station", zoneId: "interact_comms_array", width: 2, height: 2, defaultX: 30, defaultY: 14 },
  { id: "schema", label: "S.C.H.E.M.A.", objectId: "schema_station", zoneId: "interact_schema", width: 2, height: 2, defaultX: 37, defaultY: 13 },
  { id: "stable", label: "STABLE", objectId: "stable_station", zoneId: "interact_stable", width: 2, height: 2, defaultX: 43, defaultY: 13 },
  { id: "dispatch", label: "DISPATCH", objectId: "dispatch_station", zoneId: "interact_dispatch", width: 2, height: 2, defaultX: 37, defaultY: 16 },
  { id: "foundry-annex", label: "FOUNDRY + ANNEX", objectId: "foundry_annex_station", zoneId: "interact_foundry_annex", width: 2, height: 2, defaultX: 43, defaultY: 16 },
  { id: "port", label: "PORT", objectId: "port_station", zoneId: "interact_port", width: 2, height: 2, defaultX: 43, defaultY: 18 },
  { id: "black-market", label: "BLACK MARKET", objectId: "black_market_station", zoneId: "interact_black_market", width: 2, height: 2, defaultX: 46, defaultY: 18 },
];

export function getBaseCampNodeDefinitions(): BaseCampNodeDefinition[] {
  return [...BASE_CAMP_NODE_DEFINITIONS];
}

export function getBaseCampNodeDefinition(nodeId: BaseCampNodeId): BaseCampNodeDefinition | null {
  return BASE_CAMP_NODE_DEFINITIONS.find((definition) => definition.id === nodeId) ?? null;
}

export function isBaseCampNodeUnlocked(nodeId: BaseCampNodeId): boolean {
  switch (nodeId) {
    case "port":
      return isPortNodeUnlocked();
    case "dispatch":
      return isDispatchNodeUnlocked();
    case "stable":
      return isStableNodeUnlocked();
    case "black-market":
      return isBlackMarketNodeUnlocked();
    case "schema":
      return isSchemaNodeUnlocked();
    case "foundry-annex":
      return isFoundryAnnexUnlocked();
    default:
      return true;
  }
}

export function getUnlockedBaseCampNodeDefinitions(): BaseCampNodeDefinition[] {
  return BASE_CAMP_NODE_DEFINITIONS.filter((definition) => isBaseCampNodeUnlocked(definition.id));
}

export function getBaseCampNodeLayout(uiLayout: UILayoutState | undefined, nodeId: BaseCampNodeId): BaseCampFieldNodeLayout {
  const definition = getBaseCampNodeDefinition(nodeId);
  const saved = uiLayout?.baseCampFieldNodeLayouts?.[nodeId];
  return {
    x: saved?.x ?? definition?.defaultX ?? 0,
    y: saved?.y ?? definition?.defaultY ?? 0,
    hidden: Boolean(saved?.hidden),
  };
}

export function isBaseCampNodeHidden(uiLayout: UILayoutState | undefined, nodeId: BaseCampNodeId): boolean {
  return Boolean(getBaseCampNodeLayout(uiLayout, nodeId).hidden);
}
