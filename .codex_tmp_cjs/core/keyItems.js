"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRegisteredKeyItem = isRegisteredKeyItem;
exports.getOwnedKeyItemQuantity = getOwnedKeyItemQuantity;
exports.getOwnedKeyItemIds = getOwnedKeyItemIds;
exports.grantKeyItemToState = grantKeyItemToState;
exports.consumeKeyItemFromState = consumeKeyItemFromState;
const technica_1 = require("../content/technica");
const inventoryIcons_1 = require("./inventoryIcons");
function humanizeId(value) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase());
}
function buildKeyItemInventoryItem(itemId, quantity, existing) {
    const definition = (0, technica_1.getImportedKeyItem)(itemId);
    return {
        id: itemId,
        name: definition?.name ?? existing?.name ?? humanizeId(itemId),
        kind: "key_item",
        stackable: false,
        quantity: Math.max(1, quantity),
        massKg: 0,
        bulkBu: 0,
        powerW: 0,
        description: definition?.description ?? existing?.description,
        iconPath: (0, inventoryIcons_1.getInventoryIconPath)(definition?.iconPath ?? existing?.iconPath),
        metadata: {
            ...(existing?.metadata ?? {}),
            ...(definition?.metadata ?? {}),
            questOnly: true,
        },
    };
}
function isRegisteredKeyItem(itemId) {
    return Boolean((0, technica_1.getImportedKeyItem)(itemId));
}
function getOwnedKeyItemQuantity(state, itemId) {
    return [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].reduce((total, item) => {
        if (item.kind !== "key_item" || item.id !== itemId) {
            return total;
        }
        return total + Math.max(1, Number(item.quantity ?? 1));
    }, 0);
}
function getOwnedKeyItemIds(state) {
    const keyItemIds = new Set();
    [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].forEach((item) => {
        if (item.kind === "key_item" && Number(item.quantity ?? 0) > 0) {
            keyItemIds.add(item.id);
        }
    });
    return keyItemIds;
}
function grantKeyItemToState(state, itemId, quantity = 1) {
    if (quantity <= 0) {
        return state;
    }
    const baseStorage = [...(state.inventory?.baseStorage ?? [])];
    const existingIndex = baseStorage.findIndex((entry) => entry.id === itemId && entry.kind === "key_item");
    if (existingIndex >= 0) {
        const existing = baseStorage[existingIndex];
        baseStorage[existingIndex] = buildKeyItemInventoryItem(itemId, Math.max(1, existing.quantity) + quantity, existing);
    }
    else {
        baseStorage.push(buildKeyItemInventoryItem(itemId, quantity));
    }
    return {
        ...state,
        inventory: {
            ...state.inventory,
            baseStorage,
        },
    };
}
function consumeKeyItemFromState(state, itemId, quantity = 1) {
    if (quantity <= 0) {
        return { state, consumed: 0 };
    }
    let remaining = quantity;
    const consumeFrom = (items) => items.flatMap((item) => {
        if (remaining <= 0 || item.kind !== "key_item" || item.id !== itemId) {
            return [item];
        }
        const available = Math.max(1, Number(item.quantity ?? 1));
        const used = Math.min(available, remaining);
        remaining -= used;
        const nextQuantity = available - used;
        return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
    });
    const nextForwardLocker = consumeFrom([...(state.inventory?.forwardLocker ?? [])]);
    const nextBaseStorage = consumeFrom([...(state.inventory?.baseStorage ?? [])]);
    const consumed = quantity - remaining;
    if (consumed <= 0) {
        return { state, consumed: 0 };
    }
    return {
        consumed,
        state: {
            ...state,
            inventory: {
                ...state.inventory,
                forwardLocker: nextForwardLocker,
                baseStorage: nextBaseStorage,
            },
        },
    };
}
