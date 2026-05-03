import type { BattleState } from "../../core/battle";
import type { SessionPlayerSlot } from "../../core/types";

type BattleScreenModule = typeof import("./BattleScreen");

let battleScreenModulePromise: Promise<BattleScreenModule> | null = null;

function loadBattleScreenModule(): Promise<BattleScreenModule> {
  if (!battleScreenModulePromise) {
    battleScreenModulePromise = import("./BattleScreen").catch((error) => {
      battleScreenModulePromise = null;
      throw error;
    });
  }
  return battleScreenModulePromise;
}

function logBattleScreenLoadError(action: string, error: unknown): void {
  console.error(`[BATTLE] Failed to ${action}.`, error);
}

export function renderBattleScreenDeferred(): void {
  void loadBattleScreenModule()
    .then(({ renderBattleScreen }) => {
      renderBattleScreen();
    })
    .catch((error) => {
      logBattleScreenLoadError("load the battle screen", error);
    });
}

export function applyExternalBattleStateDeferred(
  battle: BattleState | null,
  renderMode: "always" | "if_mounted" = "if_mounted",
): void {
  void loadBattleScreenModule()
    .then(({ applyExternalBattleState }) => {
      applyExternalBattleState(battle, renderMode);
    })
    .catch((error) => {
      logBattleScreenLoadError("sync the external battle state", error);
    });
}

export function applyRemoteSquadBattleCommandDeferred(sourceSlot: SessionPlayerSlot, payload: string): void {
  void loadBattleScreenModule()
    .then(({ applyRemoteSquadBattleCommand }) => {
      applyRemoteSquadBattleCommand(sourceSlot, payload);
    })
    .catch((error) => {
      logBattleScreenLoadError("apply the remote squad battle command", error);
    });
}

export function applyRemoteCoopBattleCommandDeferred(sourceSlot: SessionPlayerSlot, payload: string): void {
  void loadBattleScreenModule()
    .then(({ applyRemoteCoopBattleCommand }) => {
      applyRemoteCoopBattleCommand(sourceSlot, payload);
    })
    .catch((error) => {
      logBattleScreenLoadError("apply the remote coop battle command", error);
    });
}
