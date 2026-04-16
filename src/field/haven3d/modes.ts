import type { Haven3DGearbladeMode, Haven3DModeController } from "./coordinates";

export const HAVEN3D_GEARBLADE_MODES: readonly Haven3DGearbladeMode[] = [
  "blade",
  "launcher",
  "grapple",
];

interface Haven3DModeGateOptions {
  enableGearbladeModes?: boolean;
  enabledModes?: readonly Haven3DGearbladeMode[];
  initialMode?: Haven3DGearbladeMode;
}

export function createHaven3DModeController(
  options: Haven3DModeGateOptions = {},
): Haven3DModeController {
  if (!options.enableGearbladeModes) {
    return {
      activeMode: null,
      enabledModes: new Set(),
    };
  }

  const enabledModes = new Set(options.enabledModes ?? HAVEN3D_GEARBLADE_MODES);
  const requestedMode = options.initialMode ?? "blade";
  return {
    activeMode: enabledModes.has(requestedMode) ? requestedMode : enabledModes.values().next().value ?? null,
    enabledModes,
  };
}
