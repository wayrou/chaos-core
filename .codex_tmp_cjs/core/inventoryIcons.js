"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INVENTORY_ICON_PATH = void 0;
exports.getInventoryIconPath = getInventoryIconPath;
exports.DEFAULT_INVENTORY_ICON_PATH = "/assets/ui/fallback_inventory_icon.png";
function getInventoryIconPath(iconPath) {
    const normalized = typeof iconPath === "string" ? iconPath.trim() : "";
    return normalized.length > 0 ? normalized : exports.DEFAULT_INVENTORY_ICON_PATH;
}
