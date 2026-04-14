"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFieldDecorRotationQuarterTurns = normalizeFieldDecorRotationQuarterTurns;
exports.getFieldDecorFootprintSize = getFieldDecorFootprintSize;
exports.getDecorState = getDecorState;
exports.getAllDecorItems = getAllDecorItems;
exports.getDecorItemById = getDecorItemById;
exports.isFieldDecorBlocking = isFieldDecorBlocking;
exports.getFieldDecorTurretProfile = getFieldDecorTurretProfile;
exports.getPlacedDecor = getPlacedDecor;
exports.getPlacedFieldDecor = getPlacedFieldDecor;
exports.getUnplacedDecor = getUnplacedDecor;
exports.getAvailableFieldDecor = getAvailableFieldDecor;
exports.getCraftableDecorItems = getCraftableDecorItems;
exports.canCraftDecorItem = canCraftDecorItem;
exports.placeDecor = placeDecor;
exports.removeDecor = removeDecor;
exports.placeFieldDecor = placeFieldDecor;
exports.moveFieldDecor = moveFieldDecor;
exports.setFieldDecorRotation = setFieldDecorRotation;
exports.removeFieldDecor = removeFieldDecor;
exports.grantDecorItem = grantDecorItem;
exports.craftDecorItem = craftDecorItem;
exports.seedInitialDecor = seedInitialDecor;
exports.getShopEligibleDecorItems = getShopEligibleDecorItems;
exports.getRewardEligibleDecorItems = getRewardEligibleDecorItems;
exports.renderDecorSpriteSvg = renderDecorSpriteSvg;
const gameStore_1 = require("../state/gameStore");
const resources_1 = require("./resources");
const DEFAULT_ANCHOR_STATE = {
    wall_left: null,
    wall_right: null,
    floor_corner: null,
    desk_top: null,
    shelf_top: null,
    window_sill: null,
    bedside_table: null,
};
function normalizeFieldDecorRotationQuarterTurns(rotationQuarterTurns) {
    const normalized = Math.round(Number(rotationQuarterTurns ?? 0));
    const wrapped = ((normalized % 4) + 4) % 4;
    return wrapped;
}
function getFieldDecorFootprintSize(decor, rotationQuarterTurns) {
    const normalized = normalizeFieldDecorRotationQuarterTurns(rotationQuarterTurns);
    const rotated = normalized === 1 || normalized === 3;
    return {
        width: rotated ? decor.tileHeight : decor.tileWidth,
        height: rotated ? decor.tileWidth : decor.tileHeight,
    };
}
const DECOR_ITEMS = [
    {
        id: "decor_plant_small",
        name: "Small Potted Plant",
        description: "A hardy little plant that makes even hardened steel look inhabited.",
        spriteKey: "plant_small",
        iconKey: "PLANT",
        rarityTag: "common",
        allowedAnchors: ["desk_top", "window_sill", "shelf_top"],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        shopCostWad: 55,
        craftCost: { wood: 2, metalScrap: 1 },
        sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
    },
    {
        id: "decor_photo_frame",
        name: "Photo Frame",
        description: "A battered frame that still insists on keeping one quiet memory upright.",
        spriteKey: "photo_frame",
        iconKey: "FRAME",
        rarityTag: "common",
        allowedAnchors: ["wall_left", "wall_right", "desk_top"],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        shopCostWad: 45,
        craftCost: { wood: 2 },
        sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
    },
    {
        id: "decor_lamp",
        name: "Desk Lamp",
        description: "Warm light for long planning sessions and the kind of fatigue that follows them.",
        spriteKey: "lamp",
        iconKey: "LAMP",
        rarityTag: "common",
        allowedAnchors: ["desk_top", "bedside_table"],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        shopCostWad: 70,
        craftCost: { metalScrap: 2, steamComponents: 1 },
        sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
    },
    {
        id: "decor_book_stack",
        name: "Stack of Books",
        description: "Manuals, notebooks, and a few pages nobody has admitted to reading yet.",
        spriteKey: "book_stack",
        iconKey: "BOOKS",
        rarityTag: "common",
        allowedAnchors: ["shelf_top", "desk_top"],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        shopCostWad: 50,
        craftCost: { wood: 1, metalScrap: 1 },
        sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
    },
    {
        id: "decor_trophy",
        name: "Operation Trophy",
        description: "A polished little boast pulled from the wreckage of a hard-earned win.",
        spriteKey: "trophy",
        iconKey: "TROPHY",
        rarityTag: "uncommon",
        allowedAnchors: ["wall_left", "wall_right", "shelf_top"],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        shopCostWad: 120,
        craftCost: { metalScrap: 3, chaosShards: 1 },
        sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
    },
    {
        id: "decor_medal",
        name: "Service Medal",
        description: "Proof that somebody noticed, signed off, and filed it where everyone can see.",
        spriteKey: "medal",
        iconKey: "MEDAL",
        rarityTag: "uncommon",
        allowedAnchors: ["wall_left", "wall_right", "desk_top"],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        shopCostWad: 110,
        craftCost: { metalScrap: 2, chaosShards: 1 },
        sourceRules: { shopEligible: true, rewardEligible: true, craftEligible: true },
    },
    {
        id: "decor_field_barricade",
        name: "Barricade",
        description: "Portable barrier plating for sealing a lane or carving a quick chokepoint into the field.",
        spriteKey: "field_barricade",
        iconKey: "BARR",
        rarityTag: "common",
        allowedAnchors: [],
        tileWidth: 2,
        tileHeight: 1,
        fieldPlaceable: true,
        craftCost: { wood: 1 },
        fieldCollision: "blocking",
        sourceRules: { shopEligible: false, rewardEligible: false, craftEligible: true },
    },
    {
        id: "decor_field_ammo_crate",
        name: "Ammo Crate",
        description: "A forward resupply crate stashed wherever you expect a rough lane to turn into a hold.",
        spriteKey: "field_ammo_crate",
        iconKey: "AMMO",
        rarityTag: "common",
        allowedAnchors: [],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        craftCost: { wood: 1, metalScrap: 1 },
        sourceRules: { shopEligible: false, rewardEligible: false, craftEligible: true },
    },
    {
        id: "decor_field_med_station",
        name: "Med Station",
        description: "Compact treatment stand for patching up a forward position without pulling all the way back.",
        spriteKey: "field_med_station",
        iconKey: "MED",
        rarityTag: "uncommon",
        allowedAnchors: [],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        craftCost: { wood: 1, chaosShards: 1 },
        sourceRules: { shopEligible: false, rewardEligible: false, craftEligible: true },
    },
    {
        id: "decor_field_turret",
        name: "Turret",
        description: "A light autonomous turret that tracks and peppers nearby hostiles while you work the lane.",
        spriteKey: "field_turret",
        iconKey: "TUR",
        rarityTag: "uncommon",
        allowedAnchors: [],
        tileWidth: 1,
        tileHeight: 1,
        fieldPlaceable: true,
        craftCost: { metalScrap: 3, steamComponents: 1 },
        fieldCollision: "blocking",
        autoTurret: {
            damage: 2,
            rangePx: 320,
            cooldownMs: 950,
            projectileSpeed: 560,
        },
        sourceRules: { shopEligible: false, rewardEligible: false, craftEligible: true },
    },
];
function hasEnoughResources(resources, cost) {
    return (0, resources_1.hasEnoughResources)(resources, cost);
}
function subtractResources(resources, cost) {
    return (0, resources_1.subtractResourceWallet)(resources, cost);
}
function getDecorState(state) {
    return {
        owned: [...(state.quarters?.decor?.owned ?? [])],
        placedDecorByAnchor: {
            ...DEFAULT_ANCHOR_STATE,
            ...(state.quarters?.decor?.placedDecorByAnchor ?? {}),
        },
        fieldPlacements: (state.quarters?.decor?.fieldPlacements ?? []).map((placement) => ({
            ...placement,
            rotationQuarterTurns: normalizeFieldDecorRotationQuarterTurns(placement.rotationQuarterTurns),
        })),
        nextFieldPlacementOrdinal: Math.max(1, Number(state.quarters?.decor?.nextFieldPlacementOrdinal ?? 1)),
    };
}
function getAllDecorItems() {
    return DECOR_ITEMS.map((item) => ({ ...item, allowedAnchors: [...item.allowedAnchors] }));
}
function getDecorItemById(decorId) {
    const item = DECOR_ITEMS.find((decor) => decor.id === decorId);
    return item ? { ...item, allowedAnchors: [...item.allowedAnchors] } : null;
}
function isFieldDecorBlocking(decorId) {
    return getDecorItemById(decorId)?.fieldCollision === "blocking";
}
function getFieldDecorTurretProfile(decorId) {
    return getDecorItemById(decorId)?.autoTurret ?? null;
}
function getPlacedDecor(state) {
    const decorState = getDecorState(state);
    const result = [];
    for (const [anchorId, decorId] of Object.entries(decorState.placedDecorByAnchor)) {
        if (!decorId) {
            continue;
        }
        const decor = getDecorItemById(decorId);
        if (!decor) {
            continue;
        }
        result.push({
            anchorId: anchorId,
            decor,
        });
    }
    return result;
}
function getPlacedFieldDecor(state, mapId) {
    return getDecorState(state).fieldPlacements
        ?.filter((placement) => !mapId || placement.mapId === mapId)
        .map((placement) => {
        const decor = getDecorItemById(placement.decorId);
        return decor ? { placement, decor } : null;
    })
        .filter((entry) => Boolean(entry)) ?? [];
}
function incrementDecorCount(counts, decorId) {
    counts.set(decorId, (counts.get(decorId) ?? 0) + 1);
}
function getOwnedDecorCounts(state) {
    const counts = new Map();
    getDecorState(state).owned.forEach((decorId) => incrementDecorCount(counts, decorId));
    return counts;
}
function getPlacedDecorCounts(state) {
    const decorState = getDecorState(state);
    const counts = new Map();
    Object.values(decorState.placedDecorByAnchor).forEach((decorId) => {
        if (decorId) {
            incrementDecorCount(counts, decorId);
        }
    });
    (decorState.fieldPlacements ?? []).forEach((placement) => incrementDecorCount(counts, placement.decorId));
    return counts;
}
function getUnplacedDecorCount(state, decorId) {
    const ownedCount = getOwnedDecorCounts(state).get(decorId) ?? 0;
    const placedCount = getPlacedDecorCounts(state).get(decorId) ?? 0;
    return Math.max(0, ownedCount - placedCount);
}
function getUnplacedDecor(state) {
    const decorState = getDecorState(state);
    const remainingPlacedCounts = getPlacedDecorCounts(state);
    return decorState.owned
        .filter((decorId) => {
        const placedCount = remainingPlacedCounts.get(decorId) ?? 0;
        if (placedCount <= 0) {
            return true;
        }
        remainingPlacedCounts.set(decorId, placedCount - 1);
        return false;
    })
        .map((id) => getDecorItemById(id))
        .filter((item) => item !== null);
}
function getAvailableFieldDecor(state) {
    return getUnplacedDecor(state).filter((decor) => decor.fieldPlaceable !== false);
}
function getCraftableDecorItems(state) {
    return DECOR_ITEMS.filter((decor) => decor.sourceRules?.craftEligible !== false);
}
function canCraftDecorItem(decorId, state) {
    const decor = getDecorItemById(decorId);
    if (!decor || decor.sourceRules?.craftEligible === false) {
        return false;
    }
    return hasEnoughResources(state.resources ?? {}, decor.craftCost);
}
function placeDecor(decorId, anchorId) {
    const state = (0, gameStore_1.getGameState)();
    const decorState = getDecorState(state);
    const decor = getDecorItemById(decorId);
    if (!decor) {
        console.warn(`[DECOR] Decor item not found: ${decorId}`);
        return false;
    }
    if (!decorState.owned.includes(decorId)) {
        console.warn(`[DECOR] Decor item not owned: ${decorId}`);
        return false;
    }
    if (!decor.allowedAnchors.includes(anchorId)) {
        console.warn(`[DECOR] Anchor ${anchorId} not allowed for decor ${decorId}`);
        return false;
    }
    const availableCopies = getUnplacedDecorCount(state, decorId);
    const currentAnchor = Object.entries(decorState.placedDecorByAnchor)
        .find(([existingAnchor, id]) => existingAnchor !== anchorId && id === decorId)?.[0];
    if (availableCopies <= 0 && !currentAnchor && decorState.placedDecorByAnchor[anchorId] !== decorId) {
        console.warn(`[DECOR] Decor item not available to place: ${decorId}`);
        return false;
    }
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        const nextPlaced = { ...currentDecorState.placedDecorByAnchor };
        if (availableCopies <= 0 && currentAnchor) {
            nextPlaced[currentAnchor] = null;
        }
        nextPlaced[anchorId] = decorId;
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    placedDecorByAnchor: nextPlaced,
                },
            },
        };
    });
    return true;
}
function removeDecor(anchorId) {
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        const nextPlaced = { ...currentDecorState.placedDecorByAnchor };
        nextPlaced[anchorId] = null;
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    placedDecorByAnchor: nextPlaced,
                },
            },
        };
    });
    return true;
}
function placeFieldDecor(decorId, mapId, x, y, rotationQuarterTurns = 0) {
    const state = (0, gameStore_1.getGameState)();
    const decor = getDecorItemById(decorId);
    if (!decor || decor.fieldPlaceable === false) {
        console.warn(`[DECOR] Decor item is not field placeable: ${decorId}`);
        return false;
    }
    if (getUnplacedDecorCount(state, decorId) <= 0) {
        console.warn(`[DECOR] Decor item is not available to place: ${decorId}`);
        return false;
    }
    const normalizedRotation = normalizeFieldDecorRotationQuarterTurns(rotationQuarterTurns);
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        const nextOrdinal = Math.max(1, Number(currentDecorState.nextFieldPlacementOrdinal ?? 1));
        const nextPlacement = {
            placementId: `field_decor_${nextOrdinal}`,
            decorId,
            mapId,
            x,
            y,
            rotationQuarterTurns: normalizedRotation,
        };
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    fieldPlacements: [...(currentDecorState.fieldPlacements ?? []), nextPlacement],
                    nextFieldPlacementOrdinal: nextOrdinal + 1,
                },
            },
        };
    });
    return true;
}
function moveFieldDecor(placementId, x, y) {
    const state = (0, gameStore_1.getGameState)();
    const decorState = getDecorState(state);
    if (!(decorState.fieldPlacements ?? []).some((placement) => placement.placementId === placementId)) {
        return false;
    }
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    fieldPlacements: (currentDecorState.fieldPlacements ?? []).map((placement) => placement.placementId === placementId
                        ? { ...placement, x, y }
                        : placement),
                },
            },
        };
    });
    return true;
}
function setFieldDecorRotation(placementId, rotationQuarterTurns) {
    const state = (0, gameStore_1.getGameState)();
    const decorState = getDecorState(state);
    if (!(decorState.fieldPlacements ?? []).some((placement) => placement.placementId === placementId)) {
        return false;
    }
    const normalizedRotation = normalizeFieldDecorRotationQuarterTurns(rotationQuarterTurns);
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    fieldPlacements: (currentDecorState.fieldPlacements ?? []).map((placement) => placement.placementId === placementId
                        ? { ...placement, rotationQuarterTurns: normalizedRotation }
                        : placement),
                },
            },
        };
    });
    return true;
}
function removeFieldDecor(placementId) {
    const state = (0, gameStore_1.getGameState)();
    const decorState = getDecorState(state);
    if (!(decorState.fieldPlacements ?? []).some((placement) => placement.placementId === placementId)) {
        return false;
    }
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    fieldPlacements: (currentDecorState.fieldPlacements ?? []).filter((placement) => placement.placementId !== placementId),
                },
            },
        };
    });
    return true;
}
function grantDecorItem(decorId) {
    const state = (0, gameStore_1.getGameState)();
    const decorState = getDecorState(state);
    if (decorState.owned.includes(decorId)) {
        return false;
    }
    const decor = getDecorItemById(decorId);
    if (!decor) {
        console.warn(`[DECOR] Cannot grant unknown decor: ${decorId}`);
        return false;
    }
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    owned: [...currentDecorState.owned, decorId],
                },
            },
        };
    });
    return true;
}
function craftDecorItem(decorId) {
    const state = (0, gameStore_1.getGameState)();
    const decor = getDecorItemById(decorId);
    if (!decor || decor.sourceRules?.craftEligible === false) {
        return false;
    }
    if (!hasEnoughResources(state.resources ?? {}, decor.craftCost)) {
        return false;
    }
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        return {
            ...current,
            resources: subtractResources(current.resources ?? {}, decor.craftCost),
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    owned: [...currentDecorState.owned, decorId],
                },
            },
        };
    });
    return true;
}
function seedInitialDecor() {
    const state = (0, gameStore_1.getGameState)();
    const decorState = getDecorState(state);
    if (decorState.owned.length > 0) {
        return;
    }
    (0, gameStore_1.updateGameState)((current) => {
        const currentDecorState = getDecorState(current);
        return {
            ...current,
            quarters: {
                ...(current.quarters ?? {}),
                decor: {
                    ...currentDecorState,
                    owned: ["decor_plant_small", "decor_photo_frame", "decor_lamp"],
                },
            },
        };
    });
}
function getShopEligibleDecorItems() {
    return DECOR_ITEMS.filter((decor) => decor.sourceRules?.shopEligible !== false);
}
function getRewardEligibleDecorItems() {
    return DECOR_ITEMS.filter((decor) => decor.sourceRules?.rewardEligible !== false);
}
function renderDecorSpriteSvg(decor) {
    switch (decor.spriteKey) {
        case "plant_small":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--plant" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="10" y="20" width="12" height="8" rx="2"></rect>
          <path d="M16 8 C13 12 12 15 12 19"></path>
          <path d="M16 8 C19 12 20 15 20 19"></path>
          <path d="M16 11 C11 12 9 14 8 18"></path>
          <path d="M16 11 C21 12 23 14 24 18"></path>
        </svg>
      `;
        case "photo_frame":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--frame" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="6" y="7" width="20" height="18" rx="2"></rect>
          <rect x="10" y="11" width="12" height="10" rx="1"></rect>
          <path d="M12 19 L16 15 L20 19"></path>
          <circle cx="12" cy="13" r="1.5"></circle>
        </svg>
      `;
        case "lamp":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--lamp" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M10 10 H22 L19 16 H13 Z"></path>
          <path d="M16 16 V23"></path>
          <path d="M12 25 H20"></path>
          <circle cx="16" cy="13" r="1.5"></circle>
        </svg>
      `;
        case "book_stack":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--books" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="7" y="20" width="18" height="5" rx="1"></rect>
          <rect x="9" y="15" width="15" height="4" rx="1"></rect>
          <rect x="11" y="10" width="12" height="4" rx="1"></rect>
        </svg>
      `;
        case "trophy":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--trophy" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M11 8 H21 V13 C21 17 18.5 19 16 19 C13.5 19 11 17 11 13 Z"></path>
          <path d="M11 10 H8 C8 14 9.5 16 12 16"></path>
          <path d="M21 10 H24 C24 14 22.5 16 20 16"></path>
          <path d="M16 19 V23"></path>
          <rect x="12" y="23" width="8" height="3" rx="1"></rect>
        </svg>
      `;
        case "medal":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--medal" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M12 6 L16 13 L20 6"></path>
          <path d="M14 6 L16 10 L18 6"></path>
          <circle cx="16" cy="19" r="6"></circle>
          <path d="M16 15 L17.6 18.2 L21 18.7 L18.5 21.2 L19.1 24.5 L16 22.9 L12.9 24.5 L13.5 21.2 L11 18.7 L14.4 18.2 Z"></path>
        </svg>
      `;
        case "field_barricade":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--barricade" viewBox="0 0 64 32" aria-hidden="true">
          <rect x="4" y="12" width="56" height="14" rx="2"></rect>
          <path d="M10 12 V6 M22 12 V4 M34 12 V6 M46 12 V4 M58 12 V6"></path>
        </svg>
      `;
        case "field_ammo_crate":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--ammo" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="6" y="10" width="20" height="14" rx="2"></rect>
          <path d="M10 10 V7 H22 V10"></path>
          <path d="M12 17 H20"></path>
        </svg>
      `;
        case "field_med_station":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--med-station" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="7" y="7" width="18" height="18" rx="3"></rect>
          <path d="M16 11 V21"></path>
          <path d="M11 16 H21"></path>
        </svg>
      `;
        case "field_turret":
            return `
        <svg class="decor-sprite-svg decor-sprite-svg--turret" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="11" y="19" width="10" height="6" rx="1"></rect>
          <rect x="9" y="12" width="14" height="8" rx="2"></rect>
          <path d="M23 15 H28"></path>
          <path d="M16 12 V8"></path>
        </svg>
      `;
        default:
            return `
        <svg class="decor-sprite-svg" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="8" y="8" width="16" height="16" rx="2"></rect>
        </svg>
      `;
    }
}
