// ============================================================================
// DEFENSE DECISION SCREEN
// Shown when a Key Room is under attack
// ============================================================================

import {
  delayKeyRoomDefense,
  abandonKeyRoom,
  getDefenseBattleTurns,
} from "../../core/keyRoomSystem";
import { renderOperationMapScreen } from "./OperationMapScreen";
import { getActiveRun, prepareDefenseBattle } from "../../core/campaignManager";
import { createDefenseBattle } from "../../core/defenseBattleGenerator";
import { syncCampaignToGameState } from "../../core/campaignSync";
import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBattleScreen } from "./BattleScreen";

/**
 * Render defense decision screen
 */
export function renderDefenseDecisionScreen(keyRoomId: string, nodeId: string): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  const activeRun = getActiveRun();
  if (!activeRun) {
    console.error("[DEFENSE] No active run");
    renderOperationMapScreen();
    return;
  }
  
  const floorIndex = activeRun.floorIndex;
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
  const keyRoom = floorKeyRooms.find(kr => kr.roomNodeId === keyRoomId);
  
  if (!keyRoom) {
    console.error("[DEFENSE] Key room not found:", keyRoomId);
    renderOperationMapScreen();
    return;
  }
  
  const facilityName = keyRoom.facility.replace(/_/g, " ").toUpperCase();
  const defenseTurns = getDefenseBattleTurns();
  
  root.innerHTML = `
    <div class="defense-decision-root">
      <div class="defense-decision-card">
        <div class="defense-decision-header">
          <h1 class="defense-decision-title">KEY ROOM UNDER ATTACK</h1>
          <p class="defense-decision-subtitle">
            Your ${facilityName} at ${nodeId} is under enemy attack!
          </p>
        </div>
        
        <div class="defense-decision-info">
          <div class="defense-info-section">
            <div class="defense-info-label">Facility:</div>
            <div class="defense-info-value">${facilityName}</div>
          </div>
          <div class="defense-info-section">
            <div class="defense-info-label">Stored Resources:</div>
            <div class="defense-info-value">
              ${Object.entries(keyRoom.storedResources).length > 0
                ? Object.entries(keyRoom.storedResources)
                    .map(([type, amount]) => `${type}: ${amount}`)
                    .join(", ")
                : "None"}
            </div>
          </div>
        </div>
        
        <div class="defense-decision-options">
          <div class="defense-option" data-action="defend">
            <div class="defense-option-header">
              <h2 class="defense-option-title">DEFEND</h2>
            </div>
            <div class="defense-option-description">
              Fight to protect the facility. Survive ${defenseTurns} turns to successfully defend.
            </div>
            <div class="defense-option-consequence">
              <strong>On Victory:</strong> Facility remains captured, attack cleared, delay removed.
            </div>
            <div class="defense-option-consequence">
              <strong>On Defeat:</strong> You can retry the defense battle.
            </div>
            <button class="defense-option-select" data-action="defend">
              DEFEND FACILITY
            </button>
          </div>
          
          <div class="defense-option" data-action="delay">
            <div class="defense-option-header">
              <h2 class="defense-option-title">DELAY</h2>
            </div>
            <div class="defense-option-description">
              Postpone the defense. The facility remains captured but is weakened.
            </div>
            <div class="defense-option-consequence">
              <strong>Effect:</strong> Facility output reduced to 50%, attack chance may increase.
            </div>
            <button class="defense-option-select" data-action="delay">
              DELAY DEFENSE
            </button>
          </div>
          
          <div class="defense-option defense-option--danger" data-action="abandon">
            <div class="defense-option-header">
              <h2 class="defense-option-title">ABANDON</h2>
            </div>
            <div class="defense-option-description">
              Give up the facility. You lose the facility and all stored resources.
            </div>
            <div class="defense-option-consequence">
              <strong>Effect:</strong> Facility lost, stored resources lost, room no longer captured.
            </div>
            <button class="defense-option-select defense-option-select--danger" data-action="abandon">
              ABANDON FACILITY
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Attach event listeners
  root.querySelectorAll(".defense-option-select, .defense-option").forEach(element => {
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = (e.currentTarget as HTMLElement).getAttribute("data-action");
      if (action) {
        handleDefenseDecision(keyRoomId, action);
      }
    });
  });
}

/**
 * Handle defense decision
 */
function handleDefenseDecision(keyRoomId: string, action: string): void {
  switch (action) {
    case "defend":
      startDefenseBattle(keyRoomId);
      break;

    case "delay":
      delayKeyRoomDefense(keyRoomId);
      renderOperationMapScreen();
      break;

    case "abandon":
      if (confirm("Are you sure you want to abandon this facility? You will lose the facility and all stored resources.")) {
        abandonKeyRoom(keyRoomId);
        renderOperationMapScreen();
      }
      break;

    default:
      console.warn("[DEFENSE] Unknown action:", action);
      renderOperationMapScreen();
  }
}

/**
 * Start a defense battle for a key room
 */
function startDefenseBattle(keyRoomId: string): void {
  try {
    // Prepare the defense battle in campaign state
    prepareDefenseBattle(keyRoomId);
    syncCampaignToGameState();

    // Get the pending defense battle info
    const activeRun = getActiveRun();
    if (!activeRun?.pendingDefenseBattle) {
      console.error("[DEFENSE] Failed to prepare defense battle");
      renderOperationMapScreen();
      return;
    }

    const { turnsToSurvive, encounterSeed } = activeRun.pendingDefenseBattle;

    // Create the defense battle
    const gameState = getGameState();
    const battle = createDefenseBattle(
      gameState,
      keyRoomId,
      turnsToSurvive,
      encounterSeed
    );

    if (!battle) {
      console.error("[DEFENSE] Failed to create defense battle");
      renderOperationMapScreen();
      return;
    }

    // Set flags for battle screen
    (window as any).__isDefenseBattle = true;
    (window as any).__defenseKeyRoomId = keyRoomId;
    (window as any).__isCampaignRun = true;

    // Store battle in state
    updateGameState(prev => ({
      ...prev,
      currentBattle: { ...battle, turnIndex: 0 } as any,
      phase: "battle",
    }));

    // Render battle screen
    renderBattleScreen();
  } catch (error) {
    console.error("[DEFENSE] Error starting defense battle:", error);
    renderOperationMapScreen();
  }
}

