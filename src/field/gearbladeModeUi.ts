import type { Haven3DGearbladeMode } from "./haven3d/coordinates";

export type GearbladeModeSelectorHotspot = "left" | "right";

export const GEARBLADE_MODE_ORDER: Haven3DGearbladeMode[] = ["blade", "launcher", "grapple"];

export const GEARBLADE_MODE_UI: Record<Haven3DGearbladeMode, { key: string; label: string; icon: string }> = {
  blade: {
    key: "1",
    label: "Blade",
    icon: "/assets/ui/gearblade/sword.png",
  },
  launcher: {
    key: "2",
    label: "Launcher",
    icon: "/assets/ui/gearblade/blaster.png",
  },
  grapple: {
    key: "3",
    label: "Grapple",
    icon: "/assets/ui/gearblade/grapple.png",
  },
};

export const GEARBLADE_MODE_SELECTOR_DESTINATIONS: Record<
  Haven3DGearbladeMode,
  Record<GearbladeModeSelectorHotspot, Haven3DGearbladeMode>
> = {
  blade: {
    left: "grapple",
    right: "launcher",
  },
  launcher: {
    left: "blade",
    right: "grapple",
  },
  grapple: {
    left: "launcher",
    right: "blade",
  },
};
