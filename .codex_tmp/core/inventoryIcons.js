export const DEFAULT_INVENTORY_ICON_PATH = "/assets/ui/fallback_inventory_icon.png";
export function getInventoryIconPath(iconPath) {
    const normalized = typeof iconPath === "string" ? iconPath.trim() : "";
    return normalized.length > 0 ? normalized : DEFAULT_INVENTORY_ICON_PATH;
}
