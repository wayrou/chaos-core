import { createDefaultAffinities } from "../../core/affinity";
import { getHighestReachedFloorOrdinal, loadCampaignProgress } from "../../core/campaign";
import { getAllStarterEquipment } from "../../core/equipment";
import { getInventoryIconPath } from "../../core/inventoryIcons";
import { getSchemaUnlockState } from "../../core/schemaSystem";
import type { GameState, InventoryItem, Unit } from "../../core/types";
import {
  getAllImportedCards,
  getAllImportedCodexEntries,
  getAllImportedGear,
  getAllImportedItems,
  getAllImportedKeyItems,
  getAllImportedMailEntries,
  getAllImportedUnits,
  isTechnicaContentDisabled,
} from "./index";
import type { ImportedCard, ImportedItem, ImportedKeyItem, ImportedUnitTemplate } from "./types";

type RuntimeFriendlyUnit = Unit & {
  classId?: string;
  description?: string;
  recruitCost?: number;
  startingInRoster?: boolean;
  deployInParty?: boolean;
  pwr?: number;
  stats?: ImportedUnitTemplate["stats"];
  traits?: string[];
  loadout?: NonNullable<Unit["loadout"]> & {
    weapon?: string | null;
  };
};

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map(String).map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeMailCategory(value: unknown): "personal" | "official" | "system" {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "personal":
    case "official":
    case "system":
      return String(value).trim().toLowerCase() as "personal" | "official" | "system";
    default:
      return "system";
  }
}

function getOwnedGearIds(state: GameState): Set<string> {
  return new Set(Object.keys(state.equipmentById ?? {}));
}

function getOwnedItemIds(state: GameState): Set<string> {
  const itemIds = new Set<string>();

  Object.entries(state.consumables ?? {}).forEach(([itemId, quantity]) => {
    if (Number(quantity) > 0) {
      itemIds.add(itemId);
    }
  });

  [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].forEach((item) => {
    if (Number(item.quantity ?? 0) > 0) {
      itemIds.add(item.id);
    }
  });

  return itemIds;
}

function getOwnedFieldModIds(state: GameState): Set<string> {
  const campaignProgress = loadCampaignProgress();
  const fieldModIds = new Set<string>();

  [...(state.runFieldModInventory ?? [])].forEach((instance) => {
    if (instance?.defId) {
      fieldModIds.add(instance.defId);
    }
  });

  [...(campaignProgress.queuedFieldModsForNextRun ?? []), ...(campaignProgress.activeRun?.runFieldModInventory ?? [])].forEach(
    (instance) => {
      if (instance?.defId) {
        fieldModIds.add(instance.defId);
      }
    },
  );

  return fieldModIds;
}

function getUnlockedSchemaIds(state: GameState): Set<string> {
  const schemaState = getSchemaUnlockState(state);
  return new Set([...schemaState.unlockedCoreTypes, ...schemaState.unlockedFortificationPips]);
}

function buildImportedInventoryItem(item: ImportedItem, existing?: InventoryItem): InventoryItem {
  const existingQuantity = Number(existing?.quantity ?? 0);
  const importedQuantity = Number(item.quantity ?? 0);
  const quantity = item.stackable
    ? Math.max(existingQuantity, importedQuantity)
    : Math.max(1, existingQuantity, importedQuantity);

  return {
    ...(existing ?? {}),
    ...item,
    quantity,
    iconPath: getInventoryIconPath(item.iconPath ?? existing?.iconPath),
  };
}

function buildImportedKeyItemInventoryItem(item: ImportedKeyItem, existing: InventoryItem): InventoryItem {
  return {
    ...existing,
    id: item.id,
    name: item.name,
    kind: "key_item",
    stackable: false,
    quantity: Math.max(1, Number(existing.quantity ?? item.quantity ?? 1)),
    massKg: Number(item.massKg ?? existing.massKg ?? 0),
    bulkBu: Number(item.bulkBu ?? existing.bulkBu ?? 0),
    powerW: Number(item.powerW ?? existing.powerW ?? 0),
    description: item.description ?? existing.description,
    iconPath: getInventoryIconPath(item.iconPath ?? existing.iconPath),
    metadata: {
      ...(existing.metadata ?? {}),
      ...(item.metadata ?? {}),
      questOnly: item.questOnly ?? true,
    },
  };
}

function buildRuntimeCard(card: ImportedCard, existing?: GameState["cardsById"][string]) {
  return {
    ...(existing ?? {}),
    id: card.id,
    name: card.name,
    description: card.description,
    strainCost: card.strainCost,
    targetType: card.targetType,
    range: card.range,
    effects: [...(card.effects ?? [])],
    effectFlow: card.effectFlow,
    artPath: card.artPath,
    sourceEquipmentId: card.sourceEquipmentId ?? existing?.sourceEquipmentId,
  };
}

function buildRuntimeUnit(unit: ImportedUnitTemplate, existing?: RuntimeFriendlyUnit): RuntimeFriendlyUnit {
  const currentHp = Number(existing?.hp ?? unit.stats.maxHp);
  const nextHp = Math.max(0, Math.min(currentHp, unit.stats.maxHp));
  const primaryWeapon = existing?.loadout?.primaryWeapon ?? existing?.loadout?.weapon ?? unit.loadout.primaryWeapon ?? null;
  const secondaryWeapon = existing?.loadout?.secondaryWeapon ?? unit.loadout.secondaryWeapon ?? null;
  const helmet = existing?.loadout?.helmet ?? unit.loadout.helmet ?? null;
  const chestpiece = existing?.loadout?.chestpiece ?? unit.loadout.chestpiece ?? null;
  const accessory1 = existing?.loadout?.accessory1 ?? unit.loadout.accessory1 ?? null;
  const accessory2 = existing?.loadout?.accessory2 ?? unit.loadout.accessory2 ?? null;
  const controller = existing?.controller ?? (unit.deployInParty ? "P1" : undefined);

  return {
    ...(existing ?? {}),
    id: unit.id,
    name: unit.name,
    isEnemy: false,
    hp: nextHp,
    maxHp: unit.stats.maxHp,
    agi: unit.stats.agi,
    pos: existing?.pos ?? null,
    hand: [...(existing?.hand ?? [])],
    drawPile: [...(existing?.drawPile ?? [])],
    discardPile: [...(existing?.discardPile ?? [])],
    strain: Number(existing?.strain ?? 0),
    classId: unit.currentClassId,
    unitClass: unit.currentClassId,
    description: unit.description,
    recruitCost: unit.recruitCost,
    startingInRoster: unit.startingInRoster ?? true,
    deployInParty: unit.deployInParty ?? false,
    stats: {
      maxHp: unit.stats.maxHp,
      atk: unit.stats.atk,
      def: unit.stats.def,
      agi: unit.stats.agi,
      acc: unit.stats.acc,
    },
    affinities: existing?.affinities ?? createDefaultAffinities(),
    pwr: unit.pwr ?? existing?.pwr,
    traits: [...(unit.traits ?? existing?.traits ?? [])],
    loadout: {
      primaryWeapon,
      secondaryWeapon,
      helmet,
      chestpiece,
      accessory1,
      accessory2,
      weapon: primaryWeapon,
    },
    controller,
  };
}

function syncDisabledUnits(state: GameState): GameState {
  const disabledUnitIds = new Set<string>();
  const collectIfDisabled = (unitId: unknown): void => {
    if (typeof unitId === "string" && isTechnicaContentDisabled("unit", unitId)) {
      disabledUnitIds.add(unitId);
    }
  };

  Object.keys(state.unitsById ?? {}).forEach(collectIfDisabled);
  (state.profile?.rosterUnitIds ?? []).forEach(collectIfDisabled);
  (state.partyUnitIds ?? []).forEach(collectIfDisabled);
  Object.values(state.players ?? {}).forEach((player) => {
    (player?.controlledUnitIds ?? []).forEach(collectIfDisabled);
  });
  (state.theaterDeploymentPreset?.squads ?? []).forEach((squad) => {
    (squad?.unitIds ?? []).forEach(collectIfDisabled);
  });

  if (disabledUnitIds.size === 0) {
    return state;
  }

  const unitsById = Object.fromEntries(
    Object.entries(state.unitsById ?? {}).filter(([unitId]) => !disabledUnitIds.has(unitId)),
  ) as GameState["unitsById"];

  const players = state.players
    ? (Object.fromEntries(
        Object.entries(state.players).map(([playerId, player]) => [
          playerId,
          {
            ...player,
            controlledUnitIds: (player?.controlledUnitIds ?? []).filter((unitId) => !disabledUnitIds.has(unitId)),
          },
        ]),
      ) as GameState["players"])
    : state.players;

  const theaterDeploymentPreset = state.theaterDeploymentPreset
    ? {
        ...state.theaterDeploymentPreset,
        squads: (state.theaterDeploymentPreset.squads ?? [])
          .map((squad) => ({
            ...squad,
            unitIds: (squad?.unitIds ?? []).filter((unitId) => !disabledUnitIds.has(unitId)),
          }))
          .filter((squad) => squad.unitIds.length > 0),
      }
    : state.theaterDeploymentPreset;

  return {
    ...state,
    profile: state.profile
      ? {
          ...state.profile,
          rosterUnitIds: (state.profile.rosterUnitIds ?? []).filter((unitId) => !disabledUnitIds.has(unitId)),
        }
      : state.profile,
    partyUnitIds: (state.partyUnitIds ?? []).filter((unitId) => !disabledUnitIds.has(unitId)),
    players,
    theaterDeploymentPreset,
    unitsById,
  };
}

function syncImportedItems(state: GameState): GameState {
  const starterItems = getAllImportedItems().filter((item) => item.acquisition?.startsWithPlayer !== false);
  if (starterItems.length === 0) {
    return state;
  }

  const baseStorage = [...(state.inventory?.baseStorage ?? [])];
  const consumables = { ...(state.consumables ?? {}) };

  starterItems.forEach((item) => {
    const existingIndex = baseStorage.findIndex((entry) => entry.id === item.id);
    const existing = existingIndex >= 0 ? baseStorage[existingIndex] : undefined;
    const mergedItem = buildImportedInventoryItem(item, existing);

    if (existingIndex >= 0) {
      baseStorage[existingIndex] = mergedItem;
    } else {
      baseStorage.push(mergedItem);
    }

    if (item.kind === "consumable") {
      consumables[item.id] = Math.max(consumables[item.id] ?? 0, Number(item.quantity ?? 0));
    }
  });

  return {
    ...state,
    consumables,
    inventory: {
      ...state.inventory,
      baseStorage,
    },
  };
}

function syncImportedKeyItemDefinitions(state: GameState): GameState {
  const keyItems = getAllImportedKeyItems();
  if (keyItems.length === 0) {
    return state;
  }

  const keyItemsById = new Map(keyItems.map((item) => [item.id, item]));
  const updateContainer = (items: InventoryItem[]) =>
    items.map((item) => {
      if (item.kind !== "key_item") {
        return item;
      }

      const importedDefinition = keyItemsById.get(item.id);
      return importedDefinition ? buildImportedKeyItemInventoryItem(importedDefinition, item) : item;
    });

  return {
    ...state,
    inventory: {
      ...state.inventory,
      baseStorage: updateContainer([...(state.inventory?.baseStorage ?? [])]),
      forwardLocker: updateContainer([...(state.inventory?.forwardLocker ?? [])]),
    },
  };
}

function syncImportedGear(state: GameState): GameState {
  const importedGear = getAllImportedGear();
  if (importedGear.length === 0) {
    return state;
  }

  const runtimeEquipment = getAllStarterEquipment();
  const equipmentById = { ...(state.equipmentById ?? {}) };
  const equipmentPool = new Set(state.equipmentPool ?? []);

  importedGear.forEach((gear) => {
    equipmentById[gear.id] = runtimeEquipment[gear.id] ?? (gear as unknown as Record<string, unknown>);
    if (gear.inventory?.startingOwned !== false) {
      equipmentPool.add(gear.id);
    }
  });

  return {
    ...state,
    equipmentById,
    equipmentPool: Array.from(equipmentPool),
  };
}

function syncImportedCards(state: GameState): GameState {
  const importedCards = getAllImportedCards();
  if (importedCards.length === 0) {
    return state;
  }

  const cardsById = { ...(state.cardsById ?? {}) };
  const cardLibrary = { ...(state.cardLibrary ?? {}) };

  importedCards.forEach((card) => {
    cardsById[card.id] = buildRuntimeCard(card, cardsById[card.id]);
    cardLibrary[card.id] = Math.max(cardLibrary[card.id] ?? 0, 1);
  });

  return {
    ...state,
    cardsById,
    cardLibrary,
  };
}

function syncImportedUnits(state: GameState): GameState {
  const importedUnits = getAllImportedUnits().filter(
    (unit) => unit.spawnRole !== "enemy" && (unit.startingInRoster !== false || unit.deployInParty),
  );
  if (importedUnits.length === 0) {
    return state;
  }

  const unitsById = { ...(state.unitsById ?? {}) };
  const rosterUnitIds = new Set(state.profile?.rosterUnitIds ?? []);
  const partyUnitIds = new Set(state.partyUnitIds ?? []);
  const players = Object.fromEntries(
    Object.entries(state.players).map(([playerId, player]) => [
      playerId,
      {
        ...player,
        controlledUnitIds: [...(player.controlledUnitIds ?? [])],
      },
    ]),
  ) as GameState["players"];
  const controlledUnitIdsByPlayer = Object.fromEntries(
    Object.entries(players).map(([playerId, player]) => [playerId, new Set(player.controlledUnitIds)]),
  ) as Record<string, Set<string>>;

  importedUnits.forEach((unit) => {
    const existing = unitsById[unit.id] as RuntimeFriendlyUnit | undefined;
    const runtimeUnit = buildRuntimeUnit(unit, existing);
    unitsById[unit.id] = runtimeUnit;

    if (unit.startingInRoster !== false) {
      rosterUnitIds.add(unit.id);
    }

    if (unit.deployInParty) {
      partyUnitIds.add(unit.id);
      const preferredController =
        runtimeUnit.controller && runtimeUnit.controller in controlledUnitIdsByPlayer ? runtimeUnit.controller : "P1";
      runtimeUnit.controller = preferredController;
      controlledUnitIdsByPlayer[preferredController].add(unit.id);
    }
  });

  (Object.keys(players) as Array<keyof GameState["players"]>).forEach((playerId) => {
    players[playerId] = {
      ...players[playerId],
      controlledUnitIds: Array.from(controlledUnitIdsByPlayer[playerId] ?? []),
    };
  });

  return {
    ...state,
    profile: {
      ...state.profile,
      rosterUnitIds: Array.from(rosterUnitIds),
    },
    partyUnitIds: Array.from(partyUnitIds),
    players,
    unitsById,
  };
}

function syncImportedMail(state: GameState): GameState {
  const importedMailEntries = getAllImportedMailEntries();
  if (importedMailEntries.length === 0) {
    return state;
  }

  const highestReachedFloorOrdinal = getHighestReachedFloorOrdinal(loadCampaignProgress());
  const completedDialogueIds = new Set(state.completedDialogueIds ?? []);
  const ownedGearIds = getOwnedGearIds(state);
  const ownedItemIds = getOwnedItemIds(state);
  const unlockedSchemaIds = getUnlockedSchemaIds(state);
  const ownedFieldModIds = getOwnedFieldModIds(state);
  const inbox = [...(state.quarters?.mail?.inbox ?? [])];
  const deliveredIds = new Set(inbox.map((entry) => entry.id));
  let nextReceivedAt = Date.now();
  let changed = false;

  importedMailEntries.forEach((entry) => {
    const normalizedCategory = normalizeMailCategory(entry.category);
    const normalizedFrom = String(entry.from ?? "S/COM_OS");
    const normalizedSubject = String(entry.subject ?? entry.id);
    const normalizedBodyPages =
      Array.isArray(entry.bodyPages) && entry.bodyPages.length > 0
        ? entry.bodyPages.map((page) => String(page).trim()).filter(Boolean)
        : [normalizedSubject];

    const existingIndex = inbox.findIndex((mail) => mail.id === entry.id);
    if (existingIndex >= 0) {
      const existing = inbox[existingIndex];
      const bodyPagesChanged = JSON.stringify(existing.bodyPages ?? []) !== JSON.stringify(normalizedBodyPages);
      if (
        existing.category !== normalizedCategory ||
        existing.from !== normalizedFrom ||
        existing.subject !== normalizedSubject ||
        bodyPagesChanged
      ) {
        inbox[existingIndex] = {
          ...existing,
          category: normalizedCategory,
          from: normalizedFrom,
          subject: normalizedSubject,
          bodyPages: normalizedBodyPages,
        };
        changed = true;
      }
      return;
    }

    const unlockAfterFloor =
      Number.isFinite(Number(entry.unlockAfterFloor)) && Number(entry.unlockAfterFloor) > 0
        ? Math.round(Number(entry.unlockAfterFloor))
        : 0;
    const requiredDialogueIds = toStringList(entry.requiredDialogueIds);
    const requiredGearIds = toStringList(entry.requiredGearIds);
    const requiredItemIds = toStringList(entry.requiredItemIds);
    const requiredSchemaIds = toStringList(entry.requiredSchemaIds);
    const requiredFieldModIds = toStringList(entry.requiredFieldModIds);

    if (unlockAfterFloor > 0 && highestReachedFloorOrdinal < unlockAfterFloor) {
      return;
    }
    if (requiredDialogueIds.some((dialogueId) => !completedDialogueIds.has(dialogueId))) {
      return;
    }
    if (requiredGearIds.some((gearId) => !ownedGearIds.has(gearId))) {
      return;
    }
    if (requiredItemIds.some((itemId) => !ownedItemIds.has(itemId))) {
      return;
    }
    if (requiredSchemaIds.some((schemaId) => !unlockedSchemaIds.has(schemaId))) {
      return;
    }
    if (requiredFieldModIds.some((fieldModId) => !ownedFieldModIds.has(fieldModId))) {
      return;
    }

    inbox.push({
      id: entry.id,
      category: normalizedCategory,
      from: normalizedFrom,
      subject: normalizedSubject,
      bodyPages: normalizedBodyPages,
      receivedAt: nextReceivedAt,
      read: false,
    });
    deliveredIds.add(entry.id);
    nextReceivedAt += 1;
    changed = true;
  });

  if (!changed) {
    return state;
  }

  return {
    ...state,
    quarters: {
      ...(state.quarters ?? {}),
      mail: {
        inbox,
      },
    },
  };
}

function syncImportedCodex(state: GameState): GameState {
  const importedCodexEntries = getAllImportedCodexEntries();
  if (importedCodexEntries.length === 0) {
    return state;
  }

  const highestReachedFloorOrdinal = getHighestReachedFloorOrdinal(loadCampaignProgress());
  const completedDialogueIds = new Set(state.completedDialogueIds ?? []);
  const completedQuestIds = new Set(state.quests?.completedQuests ?? []);
  const ownedGearIds = getOwnedGearIds(state);
  const ownedItemIds = getOwnedItemIds(state);
  const unlockedSchemaIds = getUnlockedSchemaIds(state);
  const ownedFieldModIds = getOwnedFieldModIds(state);
  const unlockedCodexEntries = new Set(state.unlockedCodexEntries ?? []);
  const initialUnlockedCount = unlockedCodexEntries.size;

  importedCodexEntries.forEach((entry) => {
    if (unlockedCodexEntries.has(entry.id)) {
      return;
    }

    const unlockAfterFloor =
      Number.isFinite(Number(entry.unlockAfterFloor)) && Number(entry.unlockAfterFloor) > 0
        ? Math.round(Number(entry.unlockAfterFloor))
        : 0;
    const requiredDialogueIds = toStringList(entry.requiredDialogueIds);
    const requiredQuestIds = toStringList(entry.requiredQuestIds);
    const requiredGearIds = toStringList(entry.requiredGearIds);
    const requiredItemIds = toStringList(entry.requiredItemIds);
    const requiredSchemaIds = toStringList(entry.requiredSchemaIds);
    const requiredFieldModIds = toStringList(entry.requiredFieldModIds);

    if (unlockAfterFloor > 0 && highestReachedFloorOrdinal < unlockAfterFloor) {
      return;
    }
    if (requiredDialogueIds.some((dialogueId) => !completedDialogueIds.has(dialogueId))) {
      return;
    }
    if (requiredQuestIds.some((questId) => !completedQuestIds.has(questId))) {
      return;
    }
    if (requiredGearIds.some((gearId) => !ownedGearIds.has(gearId))) {
      return;
    }
    if (requiredItemIds.some((itemId) => !ownedItemIds.has(itemId))) {
      return;
    }
    if (requiredSchemaIds.some((schemaId) => !unlockedSchemaIds.has(schemaId))) {
      return;
    }
    if (requiredFieldModIds.some((fieldModId) => !ownedFieldModIds.has(fieldModId))) {
      return;
    }

    unlockedCodexEntries.add(entry.id);
  });

  if (unlockedCodexEntries.size === initialUnlockedCount) {
    return state;
  }

  return {
    ...state,
    unlockedCodexEntries: Array.from(unlockedCodexEntries),
  };
}

export function syncPublishedTechnicaContentState(state: GameState, registryFingerprint: string): GameState {
  if ((state.technicaSync?.registryFingerprint ?? "") === registryFingerprint) {
    return state;
  }

  let nextState = state;
  nextState = syncImportedItems(nextState);
  nextState = syncImportedKeyItemDefinitions(nextState);
  nextState = syncImportedGear(nextState);
  nextState = syncImportedCards(nextState);
  nextState = syncImportedUnits(nextState);
  nextState = syncDisabledUnits(nextState);
  nextState = syncImportedMail(nextState);
  nextState = syncImportedCodex(nextState);

  return {
    ...nextState,
    technicaSync: {
      ...nextState.technicaSync,
      registryFingerprint,
    },
  };
}
