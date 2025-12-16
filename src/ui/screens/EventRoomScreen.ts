// ============================================================================
// EVENT ROOM SCREEN - Headline 13
// Presents choices with consequences (HP sacrifice, WAD trades, buffs, etc.)
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderOperationMapScreen, markRoomVisited } from "./OperationMapScreen";
import { getEventTemplate, EventRoom, EventChoice } from "../../core/procedural";
import { GameState } from "../../core/types";

export function renderEventRoomScreen(eventTemplateId: string): void {
  const app = document.getElementById("app");
  if (!app) return;

  const eventTemplate = getEventTemplate(eventTemplateId);
  if (!eventTemplate) {
    console.error("[EVENT] Event template not found:", eventTemplateId);
    app.innerHTML = `<div class="error">Event not found: ${eventTemplateId}</div>`;
    return;
  }

  const state = getGameState();

  app.innerHTML = `
    <div class="event-room-root">
      <div class="event-room-card">
        <div class="event-room-header">
          <div class="event-room-title">${eventTemplate.title}</div>
          <div class="event-room-subtitle">SLK://EVENT_NODE</div>
        </div>

        <div class="event-room-body">
          <div class="event-room-description">
            ${eventTemplate.description}
          </div>

          <div class="event-room-flavor">
            "${eventTemplate.flavorText}"
          </div>

          <div class="event-room-choices">
            <div class="event-room-choices-title">CHOOSE YOUR ACTION:</div>
            ${eventTemplate.choices.map((choice, index) => renderChoice(choice, state, index)).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach choice handlers
  eventTemplate.choices.forEach((choice, index) => {
    const btn = app.querySelector(`#choice-${index}`);
    btn?.addEventListener("click", () => {
      handleChoice(choice, eventTemplate);
    });
  });
}

function renderChoice(choice: EventChoice, state: GameState, index: number): string {
  const canAfford = checkCanAffordChoice(choice, state);

  return `
    <button class="event-choice-btn ${!canAfford ? 'event-choice-btn--disabled' : ''}"
            id="choice-${index}"
            ${!canAfford ? 'disabled' : ''}>
      <div class="event-choice-label">${choice.label}</div>
      <div class="event-choice-description">${choice.description}</div>
      ${!canAfford ? '<div class="event-choice-warning">⚠ Cannot afford</div>' : ''}
    </button>
  `;
}

function checkCanAffordChoice(choice: EventChoice, state: GameState): boolean {
  const outcome = choice.outcome;

  if (outcome.wadCost && state.wad < outcome.wadCost) {
    return false;
  }

  // HP cost check - make sure at least one unit would survive
  if (outcome.hpCost) {
    const hpCost = outcome.hpCost; // Capture for type safety
    const partyUnits = state.partyUnitIds.map(id => state.unitsById[id]);
    const wouldAllDie = partyUnits.every(u => u.hp <= hpCost);
    if (wouldAllDie) {
      return false;
    }
  }

  return true;
}

function handleChoice(choice: EventChoice, _event: EventRoom): void {
  const outcome = choice.outcome;

  updateGameState(prev => {
    const updated = { ...prev };

    // Apply HP cost
    if (outcome.hpCost) {
      const hpCost = outcome.hpCost; // Capture for type safety
      prev.partyUnitIds.forEach(unitId => {
        const unit = updated.unitsById[unitId];
        if (unit) {
          updated.unitsById[unitId] = {
            ...unit,
            hp: Math.max(1, unit.hp - hpCost),
          };
        }
      });
    }

    // Apply WAD cost/gain
    if (outcome.wadCost) {
      updated.wad = prev.wad - outcome.wadCost;
    }
    if (outcome.wadGain) {
      updated.wad = prev.wad + outcome.wadGain;
    }

    // Apply resources
    if (outcome.resourceGain) {
      updated.resources = {
        metalScrap: prev.resources.metalScrap + (outcome.resourceGain.metalScrap || 0),
        wood: prev.resources.wood + (outcome.resourceGain.wood || 0),
        chaosShards: prev.resources.chaosShards + (outcome.resourceGain.chaosShards || 0),
        steamComponents: prev.resources.steamComponents + (outcome.resourceGain.steamComponents || 0),
      };
    }

    // Apply equipment gain
    if (outcome.equipmentGain === "random") {
      // TODO: Roll random equipment and add to inventory/equipmentById
      console.log("[EVENT] Would grant random equipment");
    } else if (outcome.equipmentGain) {
      // Specific equipment ID
      console.log("[EVENT] Would grant equipment:", outcome.equipmentGain);
    }

    // Apply buffs
    if (outcome.buff) {
      // TODO: Add buff system to units
      console.log("[EVENT] Would apply buff:", outcome.buff);
    }

    return updated as GameState;
  });

  // Mark the room as visited in both game state and campaign system
  const state = getGameState();
  if (state.operation?.currentRoomId) {
    markRoomVisited(state.operation.currentRoomId);
  }

  // Show result message then return to map
  showEventResult(choice, () => {
    renderOperationMapScreen();
  });
}

function showEventResult(choice: EventChoice, onContinue: () => void): void {
  const app = document.getElementById("app");
  if (!app) return;

  const resultMessage = generateResultMessage(choice);

  app.innerHTML = `
    <div class="event-result-overlay">
      <div class="event-result-card">
        <div class="event-result-title">OUTCOME</div>
        <div class="event-result-message">${resultMessage}</div>
        <button class="event-result-continue" id="continueBtn">CONTINUE</button>
      </div>
    </div>
  `;

  document.getElementById("continueBtn")?.addEventListener("click", onContinue);
}

function generateResultMessage(choice: EventChoice): string {
  const outcome = choice.outcome;
  const messages: string[] = [];

  if (outcome.hpCost) {
    messages.push(`All units lost ${outcome.hpCost} HP.`);
  }

  if (outcome.wadCost) {
    messages.push(`Spent ${outcome.wadCost} WAD.`);
  }

  if (outcome.wadGain) {
    messages.push(`Gained ${outcome.wadGain} WAD.`);
  }

  if (outcome.equipmentGain) {
    messages.push(`Acquired new equipment!`);
  }

  if (outcome.resourceGain) {
    const r = outcome.resourceGain;
    const parts: string[] = [];
    if (r.metalScrap) parts.push(`${r.metalScrap} Metal`);
    if (r.wood) parts.push(`${r.wood} Wood`);
    if (r.chaosShards) parts.push(`${r.chaosShards} Chaos Shards`);
    if (r.steamComponents) parts.push(`${r.steamComponents} Steam Components`);

    if (parts.length > 0) {
      messages.push(`Gained resources: ${parts.join(', ')}`);
    }
  }

  if (outcome.buff) {
    messages.push(`All units gained +${outcome.buff.amount} ${outcome.buff.stat.toUpperCase()} for ${outcome.buff.duration} battles.`);
  }

  if (messages.length === 0) {
    messages.push("You move on without incident.");
  }

  return messages.join("<br>");
}
