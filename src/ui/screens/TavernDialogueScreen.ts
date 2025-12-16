// ============================================================================
// TAVERN DIALOGUE SCREEN
// Shows flavor dialogue when entering a tavern/safe zone node
// ============================================================================

import { renderOperationMapScreen } from "./OperationMapScreen";
import { getActiveRun } from "../../core/campaignManager";
import { OPERATION_DEFINITIONS } from "../../core/campaign";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderRecruitmentScreen } from "./RecruitmentScreen";

/**
 * Get flavor dialogue based on context (operation/floor or base camp)
 */
function getTavernDialogue(floorIndex: number | null, operationId: string | null, isBaseCamp: boolean): string[] {
  // Base camp specific dialogues
  if (isBaseCamp) {
    const baseCampDialogues: string[] = [
      "The tavern is a welcome sight after operations. The familiar smell of stale air and recycled atmosphere. Home, such as it is.",
      "You find a quiet corner in the tavern. Around you, other operators share stories, compare notes, plan their next moves. The war never stops, but here, for a moment, you can pretend it does.",
      "The tavern serves as more than just a rest stop. It's where intel is shared, where alliances are formed, where you remember why you're fighting.",
      "A drink, a moment of rest, a chance to decompress. The tavern is one of the few places in base camp where the tension eases, if only slightly.",
      "You sit at a table, watching the comings and goings. New faces, old faces, faces you'll never see again. The tavern is a crossroads of the war effort.",
      "The walls are covered in mission briefings, wanted posters, and faded photos of completed operations. This place has seen a lot. You've seen a lot.",
      "The bartender nods as you approach. No words needed. You've been here before. You'll be here again. The cycle continues.",
    ];
    return [baseCampDialogues[Math.floor(Math.random() * baseCampDialogues.length)]];
  }
  
  // Operation/floor dialogues
  const opDef = operationId ? OPERATION_DEFINITIONS[operationId as keyof typeof OPERATION_DEFINITIONS] : null;
  const opName = opDef?.name || "OPERATION";
  
  // Base dialogues that can appear on any floor
  const baseDialogues: string[] = [
    "The air is still here, a brief respite from the chaos outside. You take a moment to catch your breath.",
    "This place feels safe, for now. The walls are thick, the doors are locked. You can almost forget what's waiting beyond.",
    "A moment of quiet. You check your gear, your ammo, your resolve. It won't last, but it's enough.",
    "The silence is unnerving. In the distance, you can hear the echo of conflict. But here, for now, you're safe.",
    "Your squad takes positions, eyes scanning. Old habits die hard. Even in safety, you stay ready.",
  ];
  
  // Floor-specific dialogues
  const floorDialogues: Record<number, string[]> = {
    0: [
      "The Forward Outpost. Your first step into the unknown. The briefing was clear: secure the entrance, clear the garrison. Simple words for a complex reality.",
      "This is it. The point of no return. Beyond this door, everything changes. You take one last look at the map, commit it to memory.",
      "The outpost is quiet, almost too quiet. Your instincts tell you something's wrong, but orders are orders. You press forward.",
    ],
    1: [
      "Deeper now. The first floor is behind you, but the real challenge lies ahead. You've seen what they can do. You're ready.",
      "The second floor. The enemy knows you're here now. No more surprises. This is where it gets real.",
      "You've made it this far. That means something. But it also means they know you're coming. The element of surprise is gone.",
    ],
    2: [
      "The final floor. Everything has led to this. You can feel the weight of it, the pressure. But you're not alone. Your squad is with you.",
      "This is where it ends. One way or another. You check your gear one last time, make sure everything is ready. It has to be.",
      "The air is different here. Thicker, heavier. You can sense the presence of something powerful ahead. This is it.",
    ],
  };
  
  // Combine base and floor-specific dialogues
  const allDialogues = [
    ...(floorIndex !== null && floorDialogues[floorIndex] ? floorDialogues[floorIndex] : []),
    ...baseDialogues,
  ];
  
  // Return a random selection (or could be deterministic based on seed)
  const selected = allDialogues[Math.floor(Math.random() * allDialogues.length)];
  
  return [selected];
}

/**
 * Render tavern dialogue screen
 * @param roomId - Room/node ID (for operation maps) or "base_camp_tavern" for base camp
 * @param roomLabel - Display label for the tavern
 * @param returnTo - Where to return after closing: "operation" | "field" | "basecamp"
 */
export function renderTavernDialogueScreen(
  roomId: string = "base_camp_tavern",
  roomLabel?: string,
  returnTo: "operation" | "field" | "basecamp" = "basecamp"
): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  const activeRun = getActiveRun();
  const isBaseCamp = returnTo === "basecamp" || returnTo === "field";
  const floorIndex = isBaseCamp ? null : (activeRun?.floorIndex ?? 0);
  const operationId = isBaseCamp ? null : (activeRun?.operationId ?? "op_iron_gate");
  
  const dialogues = getTavernDialogue(floorIndex, operationId, isBaseCamp);
  const displayLabel = roomLabel || (isBaseCamp ? "Base Camp Tavern" : "Safe Zone");
  
  root.innerHTML = `
    <div class="tavern-dialogue-root">
      <div class="tavern-dialogue-overlay"></div>
      <div class="tavern-dialogue-window">
        <div class="tavern-dialogue-header">
          <div class="tavern-dialogue-title">${displayLabel}</div>
          <button class="tavern-dialogue-close" id="tavernCloseBtn">✕</button>
        </div>
        
        <div class="tavern-dialogue-content">
          <div class="tavern-dialogue-icon">🏠</div>
          <div class="tavern-dialogue-text-container">
            ${dialogues.map((dialogue, index) => `
              <div class="tavern-dialogue-text ${index === 0 ? 'tavern-dialogue-text--active' : ''}" data-dialogue-index="${index}">
                ${dialogue}
              </div>
            `).join("")}
          </div>
        </div>
        
        <div class="tavern-dialogue-footer">
          ${isBaseCamp ? `
            <div class="tavern-dialogue-footer-actions">
              <button class="tavern-dialogue-action" id="tavernRecruitmentBtn">RECRUITMENT</button>
              <button class="tavern-dialogue-continue" id="tavernContinueBtn">CLOSE</button>
            </div>
          ` : `
            <button class="tavern-dialogue-continue" id="tavernContinueBtn">CONTINUE</button>
          `}
        </div>
      </div>
    </div>
  `;
  
  // Attach event listeners
  const closeBtn = root.querySelector("#tavernCloseBtn");
  const continueBtn = root.querySelector("#tavernContinueBtn");
  const recruitmentBtn = root.querySelector("#tavernRecruitmentBtn");
  
  const closeDialogue = () => {
    if (returnTo === "operation") {
      // Mark room as visited and return to operation map
      import("./OperationMapScreen").then(({ markRoomVisited, renderOperationMapScreen }) => {
        markRoomVisited(roomId);
        renderOperationMapScreen();
      });
    } else if (returnTo === "field") {
      // Return to field mode
      renderFieldScreen("base_camp");
    } else {
      // Return to base camp screen
      import("./BaseCampScreen").then(({ renderBaseCampScreen }) => {
        renderBaseCampScreen("basecamp");
      });
    }
  };
  
  closeBtn?.addEventListener("click", closeDialogue);
  continueBtn?.addEventListener("click", closeDialogue);
  
  // Recruitment button (base camp only)
  if (recruitmentBtn) {
    recruitmentBtn.addEventListener("click", () => {
      if (returnTo === "field") {
        renderRecruitmentScreen("field");
      } else {
        renderRecruitmentScreen("basecamp");
      }
    });
  }
  
  // Close on Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeDialogue();
      document.removeEventListener("keydown", handleKeyDown);
    }
  };
  document.addEventListener("keydown", handleKeyDown);
}

