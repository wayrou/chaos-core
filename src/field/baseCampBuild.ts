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
  { id: "shop", label: "SHOP", objectId: "shop_station", zoneId: "interact_shop", width: 7, height: 5, defaultX: 6, defaultY: 6 },
  { id: "quarters", label: "QUARTERS", objectId: "quarters_station", zoneId: "interact_quarters", width: 7, height: 5, defaultX: 17, defaultY: 6 },
  { id: "roster", label: "UNIT ROSTER", objectId: "roster_station", zoneId: "interact_roster", width: 8, height: 5, defaultX: 28, defaultY: 6 },
  { id: "loadout", label: "LOADOUT", objectId: "loadout_station", zoneId: "interact_loadout", width: 8, height: 5, defaultX: 46, defaultY: 7 },
  { id: "ops-terminal", label: "OPS TERMINAL", objectId: "ops_terminal", zoneId: "interact_ops", width: 8, height: 5, defaultX: 58, defaultY: 7 },
  { id: "quest-board", label: "QUEST BOARD", objectId: "quest_board", zoneId: "interact_quest_board", width: 7, height: 5, defaultX: 6, defaultY: 18 },
  { id: "tavern", label: "TAVERN", objectId: "tavern_station", zoneId: "interact_tavern", width: 7, height: 5, defaultX: 17, defaultY: 18 },
  { id: "gear-workbench", label: "WORKSHOP", objectId: "gear_workbench_station", zoneId: "interact_gear_workbench", width: 8, height: 5, defaultX: 28, defaultY: 18 },
  { id: "comms-array", label: "COMMS ARRAY", objectId: "comms_array_station", zoneId: "interact_comms_array", width: 8, height: 5, defaultX: 70, defaultY: 7 },
  { id: "schema", label: "S.C.H.E.M.A.", objectId: "schema_station", zoneId: "interact_schema", width: 8, height: 5, defaultX: 46, defaultY: 25 },
  { id: "stable", label: "STABLE", objectId: "stable_station", zoneId: "interact_stable", width: 8, height: 5, defaultX: 70, defaultY: 25 },
  { id: "dispatch", label: "DISPATCH", objectId: "dispatch_station", zoneId: "interact_dispatch", width: 8, height: 5, defaultX: 58, defaultY: 25 },
  { id: "foundry-annex", label: "FOUNDRY + ANNEX", objectId: "foundry_annex_station", zoneId: "interact_foundry_annex", width: 10, height: 6, defaultX: 46, defaultY: 38 },
  { id: "port", label: "PORT", objectId: "port_station", zoneId: "interact_port", width: 8, height: 6, defaultX: 59, defaultY: 38 },
  { id: "black-market", label: "BLACK MARKET", objectId: "black_market_station", zoneId: "interact_black_market", width: 8, height: 6, defaultX: 70, defaultY: 38 },
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
