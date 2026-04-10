// ============================================================================
// TAVERN DIALOGUE SCREEN
// Shows flavor dialogue when entering a tavern/safe zone node
// Includes continuous NPC conversation system like the port
// ============================================================================

import { getActiveRun } from "../../core/campaignManager";
import { getGameState, updateGameState } from "../../state/gameStore";
import { RecruitmentCandidate, GUILD_ROSTER_LIMITS } from "../../core/types";
import {
  BaseCampReturnTo,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import {
  generateCandidates,
  hireCandidate,
  getRosterSize,
} from "../../core/recruitment";
import { getPWRBand, getPWRBandColor } from "../../core/pwr";
import {
  getQueuedTavernMealBuff,
  queueTavernMeal,
  TavernMealBuff,
  TAVERN_MEAL_DEFINITIONS,
} from "../../core/tavernMeals";
import { getLocalSessionPlayerSlot, getSessionResourcePool } from "../../core/session";
import { showSystemPing } from "../components/systemPing";
import { markOperationRoomVisited, renderActiveOperationSurface } from "./activeOperationFlow";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

export type TavernReturnTo = "operation" | BaseCampReturnTo | "field-node";

interface TavernScreenOptions {
  fullHubServices?: boolean;
  onClose?: () => void;
}

let npcWindowInterval: number | null = null;
let activeNpcWindows: Array<{ id: string; name: string; text: string; timestamp: number; conversationId?: string }> = [];
let npcWindowIdCounter = 0;
let activeConversations: Map<string, Array<{ name: string; text: string }>> = new Map();
let currentTavernScreenContext: {
  roomId: string;
  roomLabel?: string;
  returnTo: TavernReturnTo;
  options: TavernScreenOptions;
} | null = null;


// ----------------------------------------------------------------------------
// DATA
// ----------------------------------------------------------------------------

/**
 * Get flavor dialogue based on context (operation/floor or base camp)
 */
function getTavernDialogue(
  floorIndex: number | null,
  isBaseCamp: boolean,
): string[] {
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
    return [
      baseCampDialogues[Math.floor(Math.random() * baseCampDialogues.length)],
    ];
  }

  // Operation/floor dialogues
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
    ...(floorIndex !== null && floorDialogues[floorIndex]
      ? floorDialogues[floorIndex]
      : []),
    ...baseDialogues,
  ];

  // Return a random selection (or could be deterministic based on seed)
  const selected =
    allDialogues[Math.floor(Math.random() * allDialogues.length)];

  return [selected];
}

// NPC dialogue data - tavern flavor chatter
const NPC_DIALOGUES: Array<{ name: string; text: string }> = [
  { name: "BARTENDER", text: "Keep the glasses full and the talk quiet. Command has ears everywhere." },
  { name: "SQUAD LEADER", text: "Third squad didn't make it back from the ridge. Chaos surges are no joke." },
  { name: "RUMOR MONGER", text: "Heard there's a cache of military-grade mods buried in the sector 7 wastes." },
  { name: "RECRUITER", text: "Lots of new faces today. Half of them won't survive the first week." },
  { name: "INJURED OPERATOR", text: "That last run... I've never seen the enemy hit that hard. We barely got out." },
  { name: "WEAPON TECH", text: "If your gear is acting up, it's the interference. Don't blame the maintenance." },
  { name: "DRUNKEN SOLDIER", text: "The Ardycia empire... they used to say it would last forever. Nothing lasts forever." },
  { name: "TAVERN REGULAR", text: "Seen many like you come and go. Best advice? Don't get attached to anyone." },
  { name: "INTEL CLERK", text: "The manifests are showing increased activity near the old port. Keep your eyes open." },
  { name: "OFF-DUTY SENTRY", text: "Safe zones are getting harder to maintain. The static is bleeding through." },
];

// Aeriss response templates
const AERISS_RESPONSES: Record<string, string[]> = {
  default: [
    "Interesting data point.",
    "I'll factor that into my simulations.",
    "Acknowledged.",
    "The environment is increasingly unstable.",
    "A standard observation for this sector.",
  ],
  danger: [
    "Threat levels are consistent with our projections.",
    "Casualties are the primary metric of this conflict.",
    "We must optimize our survival probability.",
    "The chaos is not just data; it is a physical force.",
  ],
  intel: [
    "That aligns with the current manifest.",
    "Additional verification is required for that rumor.",
    "Supply lines are indeed the critical failure point.",
    "The historical Ardycian archives are incomplete on that matter.",
  ],
};

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

/**
 * Render a single candidate card
 */
function renderCandidateCard(
  candidate: RecruitmentCandidate,
  playerWad: number,
): string {
  const pwrBand = getPWRBand(candidate.pwr);
  const pwrColor = getPWRBandColor(candidate.pwr);
  const canAfford = playerWad >= candidate.contractCost;
  const traitsHtml =
    candidate.traits
      ?.map((t) => `<span class="candidate-trait">${t}</span>`)
      .join("") || "";

  return `
    <div class="candidate-card" data-candidate-id="${candidate.id}">
      <div class="candidate-header">
        <div class="candidate-name">${candidate.name}</div>
        <div class="candidate-pwr" style="color: ${pwrColor}">
          <span class="candidate-pwr-label">PWR</span>
          <span class="candidate-pwr-value">${candidate.pwr}</span>
          <span class="candidate-pwr-band">${pwrBand}</span>
        </div>
      </div>
      
      <div class="candidate-body">
        <div class="candidate-class">
          <span class="candidate-class-label">CLASS:</span>
          <span class="candidate-class-value">${candidate.currentClass.toUpperCase()}</span>
        </div>
        
        <div class="candidate-stats">
          <div class="candidate-stat">
            <span class="candidate-stat-label">HP</span>
            <span class="candidate-stat-value">${candidate.stats.maxHp}</span>
          </div>
          <div class="candidate-stat">
            <span class="candidate-stat-label">ATK</span>
            <span class="candidate-stat-value">${candidate.stats.atk}</span>
          </div>
          <div class="candidate-stat">
            <span class="candidate-stat-label">DEF</span>
            <span class="candidate-stat-value">${candidate.stats.def}</span>
          </div>
          <div class="candidate-stat">
            <span class="candidate-stat-label">AGI</span>
            <span class="candidate-stat-value">${candidate.stats.agi}</span>
          </div>
        </div>
        
        ${traitsHtml ? `<div class="candidate-traits">${traitsHtml}</div>` : ""}
        
        <div class="candidate-affinities">
          <div class="candidate-affinity-label">AFFINITIES:</div>
          <div class="candidate-affinity-list">
            ${Object.entries(candidate.affinities)
      .filter(([_, value]) => value > 0)
      .map(
        ([type, value]) =>
          `<span class="candidate-affinity-item">${type}: ${value}</span>`,
      )
      .join("") || "<span class='candidate-affinity-item'>None</span>"
    }
          </div>
        </div>
      </div>
      
      <div class="candidate-footer">
        <div class="candidate-cost">
          <span class="candidate-cost-label">COST:</span>
          <span class="candidate-cost-value ${canAfford ? "" : "insufficient"}">${candidate.contractCost} WAD</span>
        </div>
        <button 
          class="candidate-hire-btn ${canAfford ? "" : "disabled"}" 
          data-candidate-id="${candidate.id}"
          ${!canAfford ? "disabled" : ""}
        >
          ${canAfford ? "HIRE" : "INSUFFICIENT WAD"}
        </button>
      </div>
    </div>
  `;
}

function renderMealCard(meal: TavernMealBuff, playerWad: number, queuedMeal: TavernMealBuff | null): string {
  const canAfford = playerWad >= meal.cost;
  const alreadyQueued = queuedMeal?.id === meal.id;
  const mealLocked = Boolean(queuedMeal);
  const disabled = mealLocked || !canAfford;
  const buttonText = alreadyQueued
    ? "QUEUED"
    : mealLocked
      ? "MEAL ALREADY QUEUED"
      : canAfford
        ? "ORDER MEAL"
        : "INSUFFICIENT WAD";

  return `
    <div class="tavern-meal-card ${alreadyQueued ? "tavern-meal-card--queued" : ""}">
      <div class="tavern-meal-card-header">
        <span class="tavern-meal-icon">${meal.icon}</span>
        <div class="tavern-meal-meta">
          <div class="tavern-meal-name">${meal.name}</div>
          <div class="tavern-meal-cost">${meal.cost} WAD</div>
        </div>
      </div>
      <div class="tavern-meal-description">${meal.description}</div>
      <button
        class="tavern-meal-btn"
        type="button"
        data-meal-id="${meal.id}"
        ${disabled ? "disabled" : ""}
      >
        ${buttonText}
      </button>
    </div>
  `;
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
  returnTo: TavernReturnTo = "basecamp",
  options: TavernScreenOptions = {},
): void {
  // Stop any existing NPC window system

  const root = document.getElementById("app");
  if (!root) return;

  currentTavernScreenContext = {
    roomId,
    roomLabel,
    returnTo,
    options,
  };

  const activeRun = getActiveRun();
  const hasFullHubServices = options.fullHubServices ?? (returnTo !== "operation");
  const floorIndex = hasFullHubServices ? null : (activeRun?.floorIndex ?? 0);
  const [flavorText] = getTavernDialogue(floorIndex, hasFullHubServices);
  const displayTitle = (roomLabel || "Tavern").toUpperCase();

  // Get recruitment candidates
  const state = getGameState();
  let candidates = state.recruitmentCandidates || [];
  const rosterSize = getRosterSize(state);
  const wallet = getSessionResourcePool(state, getLocalSessionPlayerSlot(state));
  const wad = wallet.wad || 0;
  const queuedMeal = hasFullHubServices ? getQueuedTavernMealBuff(state) : null;

  // Initialize NPC windows
  activeNpcWindows = [];
  activeConversations.clear();
  npcWindowIdCounter = 0;
  const initialCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < initialCount; i++) {
    addNpcWindow();
  }

  // If no candidates and this is base camp, generate a new pool
  if (candidates.length === 0 && hasFullHubServices) {
    const hub = {
      id: roomId,
      name: roomLabel || "Tavern",
      type: "base_camp" as const,
      candidatePoolSize: 4,
    };

    const newCandidates = generateCandidates(hub, rosterSize);

    if (newCandidates.length > 0) {
      updateGameState((s) => ({
        ...s,
        recruitmentCandidates: newCandidates,
      }));
      candidates = newCandidates;
    }
  }

  const candidatesHtml = hasFullHubServices
    ? candidates
      .map((candidate) => renderCandidateCard(candidate, wad))
      .join("")
    : "";
  const mealCardsHtml = hasFullHubServices
    ? TAVERN_MEAL_DEFINITIONS.map((meal) => renderMealCard(meal, wad, queuedMeal)).join("")
    : "";

  root.innerHTML = `
    <div class="tavern-root">
      <div class="tavern-header">
        <div class="tavern-title-group">
          <h1 class="tavern-title">${displayTitle}</h1>
          <div class="tavern-subtitle">S/COM_OS // RECRUITMENT_HUB</div>
        </div>
        <div class="tavern-controls">
          ${hasFullHubServices
      ? `
            <div class="tavern-stats">
              <span class="stat-badge">ROSTER: ${rosterSize}/${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS}</span>
              <span class="stat-badge">WAD: ${wad.toLocaleString()}</span>
            </div>
          `
      : ""
    }
          <button class="tavern-back-btn" id="tavernBackBtn" data-return-to="${returnTo}">
            ← EXIT
          </button>
        </div>
      </div>

      <div class="tavern-body">
        <div class="tavern-content-wrapper">
          <!-- Left Column: Recruitment / Main Window -->
          <div class="tavern-main-panel">
            <div class="tavern-info-box">
               <div class="tavern-flavor-text">
                "${flavorText}"
              </div>
              ${!hasFullHubServices
      ? `
                <div class="tavern-safe-zone">
                  <div class="safe-zone-title">SAFE ZONE ACTIVE</div>
                  <div class="safe-zone-desc">Units relax and recover minor fatigue. No threats detected in immediate vicinity.</div>
                </div>
              `
      : ""
    }
            </div>

            ${hasFullHubServices
      ? `
              <div class="tavern-meal-section">
                <div class="tavern-section-header">
                  <div class="tavern-section-title">MESS HALL</div>
                  <div class="tavern-meal-status">
                    ${queuedMeal
          ? `NEXT DEPLOYMENT BUFF: ${queuedMeal.name.toUpperCase()}`
          : "QUEUE ONE SMALL BUFF FOR YOUR NEXT DEPLOYMENT"}
                  </div>
                </div>
                <div class="tavern-meal-grid">
                  ${mealCardsHtml}
                </div>
                <div class="tavern-meal-note">
                  ${queuedMeal
          ? `${queuedMeal.name} is queued for your next deployment. Party meals also settle Shaken on active squads.`
          : "A good meal won't stack. Order one when you're ready to deploy, and it will also clear Shaken from the current party and deployment squads."}
                </div>
              </div>
            `
      : ""
    }

            <div class="tavern-recruitment-section">
              ${hasFullHubServices
      ? `
                <div class="tavern-section-header">
                  <div class="tavern-section-title">RECRUITMENT POOL</div>
                  ${rosterSize >= GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS
        ? `
                    <div class="tavern-warning">
                      ⚠️ ROSTER FULL. DISMISS UNITS TO RECRUIT.
                    </div>
                  `
        : ""
      }
                </div>
                <div class="tavern-candidates-grid">
                  ${candidatesHtml}
                </div>
                <div class="tavern-footer">
                  RECRUITMENT POOL REFRESHES DAILY
                </div>
              `
      : `
                <div class="tavern-empty-state">
                  <div class="empty-icon">☕</div>
                  <div class="empty-text">Take a break, Operator.</div>
                  <button class="candidate-hire-btn" id="tavernContinueBtn">CONTINUE OPERATION</button>
                </div>
              `
    }
            </div>
          </div>

          <!-- Right Column: NPC Chatter System -->
          <div class="tavern-npc-panel">
            ${renderNpcFlavorText()}
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachTavernListeners(roomId, returnTo, options);

  // Start the NPC window system
  startNpcWindowSystem();

  // Attach click handlers for hiring candidates (base camp only)
  if (hasFullHubServices) {
    setTimeout(() => {
      attachCandidateHireHandlers();
      attachTavernMealHandlers();
    }, 100);
  }
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function rerenderCurrentTavernScreen(): void {
  if (!currentTavernScreenContext) return;
  renderTavernDialogueScreen(
    currentTavernScreenContext.roomId,
    currentTavernScreenContext.roomLabel,
    currentTavernScreenContext.returnTo,
    currentTavernScreenContext.options,
  );
}

function attachCandidateHireHandlers(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Hire buttons
  root.querySelectorAll(".candidate-hire-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const candidateId = (e.currentTarget as HTMLElement).getAttribute(
        "data-candidate-id",
      );
      if (!candidateId) return;

      handleHireCandidate(candidateId);
    });
  });
}

function handleHireCandidate(candidateId: string): void {
  const state = getGameState();
  const candidates = state.recruitmentCandidates || [];

  updateGameState((s) => {
    const result = hireCandidate(candidateId, candidates, s);

    if (!result.success || !result.state) {
      console.warn("[TAVERN] Failed to hire candidate:", result.error);
      return s;
    }

    console.log("[TAVERN] Candidate hired successfully!");
    return result.state;
  });

  // Re-render to show updated roster and remaining candidates
  setTimeout(rerenderCurrentTavernScreen, 100);
}

function attachTavernMealHandlers(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.querySelectorAll<HTMLElement>(".tavern-meal-btn[data-meal-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mealId = btn.dataset.mealId;
      if (!mealId) return;
      handlePurchaseTavernMeal(mealId);
    });
  });
}

function handlePurchaseTavernMeal(mealId: string): void {
  const state = getGameState();
  const result = queueTavernMeal(state, mealId);

  if ("error" in result) {
    showSystemPing({
      title: "MESS HALL ERROR",
      message: result.error,
      type: "error",
      channel: "tavern-meals",
    });
    return;
  }

  updateGameState(() => result.next);
  const recoveredUnitNames = result.recoveredShakenUnitIds
    .map((unitId) => state.unitsById[unitId]?.name)
    .filter((name): name is string => Boolean(name));
  showSystemPing({
    title: "MEAL QUEUED",
    message: result.meal.name,
    detail: recoveredUnitNames.length > 0
      ? `${result.meal.description} Shaken cleared: ${recoveredUnitNames.join(", ")}.`
      : result.meal.description,
    type: "success",
    channel: "tavern-meals",
  });
  rerenderCurrentTavernScreen();
}

function attachTavernListeners(
  roomId: string,
  returnTo: TavernReturnTo,
  options: TavernScreenOptions,
): void {
  const root = document.getElementById("app");
  if (!root) return;

  const backBtn = root.querySelector("#tavernBackBtn");
  const continueBtn = root.querySelector("#tavernContinueBtn");

  const closeDialogue = () => {
    // Cleanup NPC window system when leaving
    stopNpcWindowSystem();
    currentTavernScreenContext = null;

    if (returnTo === "operation") {
      markOperationRoomVisited(roomId);
      renderActiveOperationSurface();
    } else if (returnTo === "field-node") {
      options.onClose?.();
    } else {
      unregisterBaseCampReturnHotkey("tavern-screen");
      returnFromBaseCampScreen(returnTo);
    }
  };

  backBtn?.addEventListener("click", closeDialogue);
  continueBtn?.addEventListener("click", closeDialogue);

  if (returnTo === "operation" || returnTo === "field-node") {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase() ?? "";
      if (key !== "escape" && e.key !== "Escape" && e.keyCode !== 27) {
        return;
      }

      e.preventDefault();
      closeDialogue();
      document.removeEventListener("keydown", handleKeyDown);
    };
    document.addEventListener("keydown", handleKeyDown);
    return;
  }

  registerBaseCampReturnHotkey("tavern-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".tavern-root",
    onReturn: stopNpcWindowSystem,
  });
}

// ----------------------------------------------------------------------------
// NPC CHATTER SYSTEM
// ----------------------------------------------------------------------------

function renderNpcFlavorText(): string {
  return `
    <div class="tavern-npc-panel-content">
      <h2 class="tavern-npc-panel-title">TAVERN ACTIVITY</h2>
      <div class="tavern-npc-windows-container" id="tavernNpcWindowsContainer">
        ${activeNpcWindows
      .map((window) => {
        const conversation = activeConversations.get(
          window.conversationId || "",
        );
        const hasConversation = conversation && conversation.length > 0;
        return `
            <div class="tavern-npc-window tavern-npc-window--visible ${hasConversation ? "tavern-npc-window--has-conversation" : ""
          }" 
                 data-window-id="${window.id}" 
                 data-conversation-id="${window.conversationId || ""}">
              <div class="tavern-npc-name">${window.name}</div>
              <div class="tavern-npc-text">${window.text}</div>
              ${hasConversation
            ? conversation!
              .map(
                (msg) => `
                <div class="tavern-npc-conversation-message ${msg.name === "AERISS"
                    ? "tavern-npc-conversation-message--aeriss"
                    : ""
                  }">
                  <div class="tavern-npc-conversation-name">${msg.name}</div>
                  <div class="tavern-npc-conversation-text">${msg.text}</div>
                </div>
              `,
              )
              .join("")
            : ""
          }
            </div>
          `;
      })
      .join("")}
      </div>
    </div>
  `;
}

function startNpcWindowSystem(): void {
  // Clear any existing interval
  if (npcWindowInterval !== null) {
    clearInterval(npcWindowInterval);
  }

  // Update the DOM immediately
  updateNpcWindowsDOM();

  // Start the cycle: add new windows and remove old ones
  npcWindowInterval = window.setInterval(() => {
    // Random chance to add a new window (60% chance)
    if (Math.random() < 0.6 && activeNpcWindows.length < 3) {
      addNpcWindow();
    }

    // Remove old windows (random, but keep at least 1)
    if (activeNpcWindows.length > 1) {
      const now = Date.now();
      const maxAge = 8000 + Math.random() * 4000;
      activeNpcWindows = activeNpcWindows.filter((window) => {
        const age = now - window.timestamp;
        if (age >= maxAge) {
          if (window.conversationId) {
            activeConversations.delete(window.conversationId);
          }
          return false;
        }
        return true;
      });
    }

    // If we have too many windows, remove the oldest
    if (activeNpcWindows.length > 3) {
      const removed = activeNpcWindows.shift();
      if (removed?.conversationId) {
        activeConversations.delete(removed.conversationId);
      }
    }

    updateNpcWindowsDOM();
  }, 2000);
}

function addNpcWindow(): void {
  const dialogue =
    NPC_DIALOGUES[Math.floor(Math.random() * NPC_DIALOGUES.length)];
  const windowId = `tavern-npc-window-${npcWindowIdCounter++}`;
  const conversationId = `conv-${windowId}`;

  activeNpcWindows.push({
    id: windowId,
    name: dialogue.name,
    text: dialogue.text,
    timestamp: Date.now(),
    conversationId,
  });
}

function updateNpcWindowsDOM(): void {
  const container = document.getElementById("tavernNpcWindowsContainer");
  if (!container) return;

  // Get current window IDs in DOM
  const currentWindowIds = Array.from(
    container.querySelectorAll(".tavern-npc-window"),
  )
    .map((el) => el.getAttribute("data-window-id"))
    .filter((id): id is string => id !== null);

  // Get active window IDs
  const activeWindowIds = activeNpcWindows.map((w) => w.id);

  // Remove windows that are no longer active
  currentWindowIds.forEach((windowId) => {
    if (!activeWindowIds.includes(windowId)) {
      const windowEl = container.querySelector(`[data-window-id="${windowId}"]`);
      if (windowEl) {
        windowEl.classList.add("tavern-npc-window--removing");
        setTimeout(() => {
          windowEl.remove();
        }, 300);
      }
    }
  });

  // Add new windows and update existing ones
  activeNpcWindows.forEach((window) => {
    let windowEl = container.querySelector(
      `[data-window-id="${window.id}"]`,
    ) as HTMLElement;
    const conversation = activeConversations.get(window.conversationId || "");
    const hasConversation = conversation && conversation.length > 0;

    const isNewWindow = !windowEl;

    if (isNewWindow) {
      windowEl = document.createElement("div");
      windowEl.className = "tavern-npc-window";
      windowEl.setAttribute("data-window-id", window.id);
      windowEl.setAttribute("data-conversation-id", window.conversationId || "");
      windowEl.classList.add("tavern-npc-window--appearing");
      container.appendChild(windowEl);
    }

    windowEl.innerHTML = `
      <div class="tavern-npc-name">${window.name}</div>
      <div class="tavern-npc-text">${window.text}</div>
      ${hasConversation
        ? conversation!
          .map(
            (msg) => `
        <div class="tavern-npc-conversation-message ${msg.name === "AERISS" ? "tavern-npc-conversation-message--aeriss" : ""
              }">
          <div class="tavern-npc-conversation-name">${msg.name}</div>
          <div class="tavern-npc-conversation-text">${msg.text}</div>
        </div>
      `,
          )
          .join("")
        : ""
      }
    `;

    if (isNewWindow) {
      requestAnimationFrame(() => {
        windowEl.classList.remove("tavern-npc-window--appearing");
        windowEl.classList.add("tavern-npc-window--visible");
      });
    } else {
      if (windowEl.classList.contains("tavern-npc-window--appearing")) {
        windowEl.classList.remove("tavern-npc-window--appearing");
      }
      if (!windowEl.classList.contains("tavern-npc-window--visible")) {
        windowEl.classList.add("tavern-npc-window--visible");
      }
    }

    if (hasConversation) {
      windowEl.classList.add("tavern-npc-window--has-conversation");
    } else {
      windowEl.classList.remove("tavern-npc-window--has-conversation");
    }
  });

  attachNpcWindowClickHandlers();
}

function attachNpcWindowClickHandlers(): void {
  const container = document.getElementById("tavernNpcWindowsContainer");
  if (!container) return;

  if (container.dataset.clickBound === "true") {
    return;
  }

  container.dataset.clickBound = "true";
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".tavern-npc-conversation-message")) {
      return;
    }

    const windowEl = target.closest(".tavern-npc-window") as HTMLElement | null;
    if (!windowEl) {
      return;
    }

    const windowId = windowEl.getAttribute("data-window-id");
    const conversationId = windowEl.getAttribute("data-conversation-id");

    if (windowId && conversationId) {
      handleNpcWindowClick(windowId, conversationId);
    }
  });
}

function handleNpcWindowClick(windowId: string, conversationId: string): void {
  const window = activeNpcWindows.find((w) => w.id === windowId);
  if (!window) return;

  let conversation = activeConversations.get(conversationId) || [];

  let responseType = "default";
  const text = window.text.toLowerCase();
  if (
    text.includes("danger") ||
    text.includes("survive") ||
    text.includes("killed") ||
    text.includes("chaos")
  ) {
    responseType = "danger";
  } else if (
    text.includes("intel") ||
    text.includes("rumor") ||
    text.includes("manifest") ||
    text.includes("sector")
  ) {
    responseType = "intel";
  }

  const responses = AERISS_RESPONSES[responseType] || AERISS_RESPONSES.default;
  const aerissResponse = responses[Math.floor(Math.random() * responses.length)];

  conversation.push({
    name: "AERISS",
    text: aerissResponse,
  });

  activeConversations.set(conversationId, conversation);
  window.conversationId = conversationId;
  updateNpcWindowsDOM();
}

function stopNpcWindowSystem(): void {
  if (npcWindowInterval !== null) {
    clearInterval(npcWindowInterval);
    npcWindowInterval = null;
  }
  activeNpcWindows = [];
  activeConversations.clear();
}
