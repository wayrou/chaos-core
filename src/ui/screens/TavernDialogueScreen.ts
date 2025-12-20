// ============================================================================
// TAVERN DIALOGUE SCREEN
// Shows flavor dialogue when entering a tavern/safe zone node
// Includes continuous NPC conversation system like the port
// ============================================================================

import { renderOperationMapScreen } from "./OperationMapScreen";
import { getActiveRun } from "../../core/campaignManager";
import { OPERATION_DEFINITIONS } from "../../core/campaign";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderRecruitmentScreen } from "./RecruitmentScreen";
import { getGameState, updateGameState } from "../../state/gameStore";
import { RecruitmentCandidate, GUILD_ROSTER_LIMITS } from "../../core/types";
import { generateCandidates, hireCandidate, getRosterSize } from "../../core/recruitment";
import { getPWRBand, getPWRBandColor } from "../../core/pwr";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let npcWindowInterval: number | null = null;
let activeNpcWindows: Array<{ id: string; name: string; text: string; timestamp: number }> = [];
let npcWindowIdCounter = 0;

// ----------------------------------------------------------------------------
// NPC DIALOGUE DATA
// ----------------------------------------------------------------------------

// Aeriss response templates based on dialogue context
const AERISS_RESPONSES: Record<string, string[]> = {
  default: [
    "Interesting. Tell me more.",
    "I'll keep that in mind.",
    "Noted.",
    "Understood.",
    "I see.",
  ],
  war: [
    "The war doesn't stop for anyone.",
    "We'll keep fighting.",
    "Every operation matters.",
    "We've lost too many good operators.",
  ],
  strategy: [
    "Tactics matter as much as firepower.",
    "I'll consider that advice.",
    "Survival is the priority.",
    "We adapt or we die.",
  ],
  recruitment: [
    "Good operators are hard to find.",
    "I'll review the candidates.",
    "We need more units.",
    "The roster needs fresh blood.",
  ],
  intel: [
    "Information is as valuable as firepower.",
    "I'll investigate that.",
    "Good to know.",
    "Every piece of intel helps.",
  ],
  supply: [
    "Resources are always tight.",
    "We'll make do with what we have.",
    "Supply lines are critical.",
    "I'll check our inventory.",
  ],
};

// NPC dialogue data - conversations between NPCs in the tavern
const NPC_DIALOGUES: Array<{ name: string; text: string }> = [
  { name: "BARTENDER", text: "Another long day, commander? The usual, or something stronger?" },
  { name: "VETERAN OPERATOR", text: "Been in this war longer than I care to remember. Seen too many good operators not come back." },
  { name: "INTEL BROKER", text: "Heard rumors about a new operation zone. Dangerous, but the rewards could be worth it." },
  { name: "MERCENARY", text: "Looking for work. Got a squad, got gear, just need a contract. You hiring?" },
  { name: "TACTICIAN", text: "The key to survival isn't just firepower. It's knowing when to fight and when to run." },
  { name: "SCOUT", text: "Scouted the perimeter earlier. Enemy activity's picking up. Something big's coming." },
  { name: "MEDIC", text: "Treating wounds, patching up operators. The med bay's full, but we're managing." },
  { name: "SUPPLY OFFICER", text: "Resources are running low. We need more metal scrap if we're going to keep the operation running." },
  { name: "COMMS OPERATOR", text: "Intercepted some enemy chatter. They're planning something. We should be ready." },
  { name: "WEAPONS SMITH", text: "Got some new gear in. Custom modifications, better than standard issue. Interested?" },
  { name: "SQUAD LEADER", text: "Lost two good operators last mission. War's getting worse, not better." },
  { name: "RECRUITER", text: "Always looking for new talent. Good operators are hard to find, harder to keep." },
  { name: "STRATEGIST", text: "The enemy's adapting. We need to change tactics, or we'll keep losing ground." },
  { name: "FIELD ENGINEER", text: "Working on some new field mods. Experimental stuff, but it could give us an edge." },
  { name: "COMMANDER", text: "Every operation matters. Every decision counts. The war won't win itself." },
  { name: "RUMOR MONGER", text: "Heard about a hidden cache in the old sector. Worth checking out, if you're brave enough." },
  { name: "WAR CORRESPONDENT", text: "Documenting the war, one operation at a time. History needs to remember what happened here." },
  { name: "QUARTERMASTER", text: "Managing supplies, tracking inventory. It's not glamorous, but someone's got to do it." },
];

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

// ----------------------------------------------------------------------------
// NPC WINDOW SYSTEM
// ----------------------------------------------------------------------------

function renderNpcFlavorText(): string {
  return `
    <div class="tavern-npc-panel-content">
      <h2 class="tavern-npc-panel-title">TAVERN CHATTER</h2>
      <div class="tavern-npc-windows-container" id="tavernNpcWindowsContainer">
        ${activeNpcWindows.map(window => {
          const conversation = activeConversations.get(window.conversationId || "");
          const hasConversation = conversation && conversation.length > 0;
          return `
            <div class="tavern-npc-window tavern-npc-window--visible ${hasConversation ? "tavern-npc-window--has-conversation" : ""}" 
                 data-window-id="${window.id}" 
                 data-conversation-id="${window.conversationId || ""}">
              <div class="tavern-npc-name">${window.name}</div>
              <div class="tavern-npc-text">${window.text}</div>
              ${hasConversation ? conversation!.map((msg) => `
                <div class="tavern-npc-conversation-message ${msg.name === "AERISS" ? "tavern-npc-conversation-message--aeriss" : ""}">
                  <div class="tavern-npc-conversation-name">${msg.name}</div>
                  <div class="tavern-npc-conversation-text">${msg.text}</div>
                </div>
              `).join("") : ""}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function startNpcWindowSystem(): void {
  // Clear any existing interval
  if (npcWindowInterval !== null) {
    clearInterval(npcWindowInterval);
  }
  
  // Clear existing windows
  activeNpcWindows = [];
  activeConversations.clear();
  npcWindowIdCounter = 0;
  
  // Clear the container completely to remove any leftover elements
  const container = document.getElementById("tavernNpcWindowsContainer");
  if (container) {
    container.innerHTML = '';
  }
  
  // Add initial windows (2-3 to start)
  const initialCount = 2 + Math.floor(Math.random() * 2); // 2-3 windows
  for (let i = 0; i < initialCount; i++) {
    addNpcWindow();
  }
  
  // Update the DOM
  updateNpcWindowsDOM();
  
  // Start the cycle: add new windows and remove old ones
  npcWindowInterval = window.setInterval(() => {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    // Remove old windows (keep at least 1)
    if (activeNpcWindows.length > 1) {
      activeNpcWindows = activeNpcWindows.filter(window => {
        const age = now - window.timestamp;
        if (age >= maxAge) {
          // Clean up conversation when window is removed
          if (window.conversationId) {
            activeConversations.delete(window.conversationId);
          }
          return false;
        }
        return true;
      });
    }
    
    // Limit to maximum 3 windows to prevent overflow
    const maxWindows = 3;
    if (activeNpcWindows.length > maxWindows) {
      // Remove oldest windows
      while (activeNpcWindows.length > maxWindows) {
        const removed = activeNpcWindows.shift();
        if (removed?.conversationId) {
          activeConversations.delete(removed.conversationId);
        }
      }
    }
    
    // Random chance to add a new window (60% chance, but only if under max)
    if (Math.random() < 0.6 && activeNpcWindows.length < maxWindows) {
      addNpcWindow();
    }
    
    updateNpcWindowsDOM();
  }, 2000); // Check every 2 seconds
}

function addNpcWindow(): void {
  const dialogue = NPC_DIALOGUES[Math.floor(Math.random() * NPC_DIALOGUES.length)];
  const windowId = `tavern-npc-window-${npcWindowIdCounter++}`;
  
  activeNpcWindows.push({
    id: windowId,
    name: dialogue.name,
    text: dialogue.text,
    timestamp: Date.now(),
  });
}

function updateNpcWindowsDOM(): void {
  const container = document.getElementById("tavernNpcWindowsContainer");
  if (!container) return;
  
  // Get current window IDs in DOM
  const currentWindowIds = Array.from(container.querySelectorAll('.tavern-npc-window')).map(
    el => el.getAttribute('data-window-id')
  );
  
  // Get active window IDs
  const activeWindowIds = activeNpcWindows.map(w => w.id);
  
  // Remove windows that are no longer active
  currentWindowIds.forEach(windowId => {
    if (!activeWindowIds.includes(windowId)) {
      const windowEl = container.querySelector(`[data-window-id="${windowId}"]`);
      if (windowEl) {
        windowEl.classList.add('tavern-npc-window--removing');
        setTimeout(() => {
          windowEl.remove();
        }, 300); // Match animation duration
      }
    }
  });
  
  // Add new windows
  activeNpcWindows.forEach(window => {
    if (!currentWindowIds.includes(window.id)) {
      const windowEl = document.createElement('div');
      windowEl.className = 'tavern-npc-window';
      windowEl.setAttribute('data-window-id', window.id);
      windowEl.innerHTML = `
        <div class="tavern-npc-name">${window.name}</div>
        <div class="tavern-npc-text">${window.text}</div>
      `;
      
      // Add with animation
      windowEl.classList.add('tavern-npc-window--appearing');
      container.appendChild(windowEl);
      
      // Trigger animation
      requestAnimationFrame(() => {
        windowEl.classList.remove('tavern-npc-window--appearing');
        windowEl.classList.add('tavern-npc-window--visible');
      });
    }
  });
}

function stopNpcWindowSystem(): void {
  if (npcWindowInterval !== null) {
    clearInterval(npcWindowInterval);
    npcWindowInterval = null;
  }
  
  // Remove click handler
  const container = document.getElementById("tavernNpcWindowsContainer");
  if (container && containerClickHandler) {
    container.removeEventListener('click', containerClickHandler);
    containerClickHandler = null;
  }
  
  activeNpcWindows = [];
  activeConversations.clear();
}

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

/**
 * Render a single candidate card
 */
function renderCandidateCard(candidate: RecruitmentCandidate, playerWad: number): string {
  const pwrBand = getPWRBand(candidate.pwr);
  const pwrColor = getPWRBandColor(candidate.pwr);
  const canAfford = playerWad >= candidate.contractCost;
  const traitsHtml = candidate.traits?.map((t) => `<span class="candidate-trait">${t}</span>`).join("") || "";

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
              .map(([type, value]) => `<span class="candidate-affinity-item">${type}: ${value}</span>`)
              .join("") || "<span class='candidate-affinity-item'>None</span>"}
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
  // Stop any existing NPC window system
  stopNpcWindowSystem();
  
  const root = document.getElementById("app");
  if (!root) return;
  
  const activeRun = getActiveRun();
  const isBaseCamp = returnTo === "basecamp" || returnTo === "field";
  const floorIndex = isBaseCamp ? null : (activeRun?.floorIndex ?? 0);
  const operationId = isBaseCamp ? null : (activeRun?.operationId ?? "op_iron_gate");
  
  const displayLabel = roomLabel || (isBaseCamp ? "Base Camp Tavern" : "Safe Zone");
  
  // Get recruitment candidates
  const state = getGameState();
  let candidates = state.recruitmentCandidates || [];
  const rosterSize = getRosterSize(state);
  const wad = state.wad || 0;
  
  // If no candidates and this is base camp, generate a new pool
  if (candidates.length === 0 && isBaseCamp) {
    const hub = {
      id: "base_camp_tavern",
      name: "Base Camp Tavern",
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
  
  const candidatesHtml = isBaseCamp ? candidates.map((candidate) => renderCandidateCard(candidate, wad)).join("") : "";
  
  root.innerHTML = `
    <div class="tavern-root ard-noise">
      <div class="tavern-content-wrapper">
        <div class="tavern-main-panel">
          <div class="tavern-card">
            <div class="tavern-header">
              <div class="tavern-header-left">
                <h1 class="tavern-title">TAVERN</h1>
                <div class="tavern-subtitle">SCROLLINK OS // RECRUITMENT_HUB</div>
              </div>
              <div class="tavern-header-right">
                ${isBaseCamp ? `
                  <div class="tavern-stats">
                    <div class="tavern-stat-item">
                      <span class="tavern-stat-label">ROSTER</span>
                      <span class="tavern-stat-value">${rosterSize} / ${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS}</span>
                    </div>
                    <div class="tavern-stat-item">
                      <span class="tavern-stat-label">WAD</span>
                      <span class="tavern-stat-value">${wad.toLocaleString()}</span>
                    </div>
                  </div>
                ` : ""}
                <button class="tavern-back-btn" id="tavernBackBtn" data-return-to="${returnTo}">
                  <span class="btn-icon">←</span>
                  <span class="btn-text">${returnTo === "field" ? "FIELD MODE" : returnTo === "operation" ? "OPERATION MAP" : "BASE CAMP"}</span>
                </button>
              </div>
            </div>
            
            <div class="tavern-body">
              ${isBaseCamp ? `
                ${rosterSize >= GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS ? `
                  <div class="tavern-warning">
                    ⚠️ ROSTER IS FULL (${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS}/${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS})
                    <br/>Dismiss units from the roster before recruiting new ones.
                  </div>
                ` : ""}
                
                <div class="tavern-candidates-grid">
                  ${candidatesHtml}
                </div>
              ` : `
                <div class="tavern-safe-zone-message">
                  <div class="tavern-safe-zone-icon">🏠</div>
                  <div class="tavern-safe-zone-text">
                    <p>You have reached a safe zone. Take a moment to rest and prepare for the next challenge.</p>
                  </div>
                </div>
              `}
            </div>
            
            ${isBaseCamp ? `
              <div class="tavern-footer">
                <div class="tavern-legend">
                  <span class="tavern-legend-item">
                    <span class="tavern-legend-dot" style="background: ${getPWRBandColor(50)}"></span>
                    Rookie (0-50 PWR)
                  </span>
                  <span class="tavern-legend-item">
                    <span class="tavern-legend-dot" style="background: ${getPWRBandColor(75)}"></span>
                    Standard (51-100 PWR)
                  </span>
                  <span class="tavern-legend-item">
                    <span class="tavern-legend-dot" style="background: ${getPWRBandColor(125)}"></span>
                    Veteran (101-150 PWR)
                  </span>
                  <span class="tavern-legend-item">
                    <span class="tavern-legend-dot" style="background: ${getPWRBandColor(175)}"></span>
                    Elite (151-200 PWR)
                  </span>
                  <span class="tavern-legend-item">
                    <span class="tavern-legend-dot" style="background: ${getPWRBandColor(250)}"></span>
                    Paragon (201+ PWR)
                  </span>
                </div>
              </div>
            ` : `
              <div class="tavern-footer">
                <button class="tavern-continue-btn" id="tavernContinueBtn">CONTINUE</button>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Attach event listeners
  attachTavernListeners(roomId, returnTo);
  
  // Attach click handlers for hiring candidates (base camp only)
  if (isBaseCamp) {
    setTimeout(() => {
      attachCandidateHireHandlers(returnTo);
    }, 100);
  }
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachCandidateHireHandlers(returnTo: "operation" | "field" | "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Hire buttons
  root.querySelectorAll(".candidate-hire-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const candidateId = (e.currentTarget as HTMLElement).getAttribute("data-candidate-id");
      if (!candidateId) return;

      handleHireCandidate(candidateId, returnTo);
    });
  });
}

function handleHireCandidate(candidateId: string, returnTo: "operation" | "field" | "basecamp"): void {
  const state = getGameState();
  const candidates = state.recruitmentCandidates || [];

  updateGameState((s) => {
    const result = hireCandidate(candidateId, candidates, s);
    
    if (!result.success) {
      console.warn("[TAVERN] Failed to hire candidate:", result.error);
      return s;
    }

    console.log("[TAVERN] Candidate hired successfully!");
    return s;
  });

  // Re-render to show updated roster and remaining candidates
  setTimeout(() => renderTavernDialogueScreen("base_camp_tavern", undefined, returnTo), 100);
}

function attachTavernListeners(
  roomId: string,
  returnTo: "operation" | "field" | "basecamp"
): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  const backBtn = root.querySelector("#tavernBackBtn");
  const continueBtn = root.querySelector("#tavernContinueBtn");
  
  const closeDialogue = () => {
    // Cleanup NPC window system when leaving
    stopNpcWindowSystem();
    
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
      import("./AllNodesMenuScreen").then(({ renderAllNodesMenuScreen }) => {
        renderAllNodesMenuScreen();
      });
    }
  };
  
  backBtn?.addEventListener("click", closeDialogue);
  continueBtn?.addEventListener("click", closeDialogue);
  
  // ESC and E key handlers to exit (always works for ESC, E key only for field mode)
  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase() ?? "";
    
    // Handle ESC key - always works regardless of returnTo
    if (key === "escape" || e.key === "Escape" || e.keyCode === 27) {
      e.preventDefault();
      closeDialogue();
      document.removeEventListener("keydown", handleKeyDown);
      return;
    }
    
    // Handle E key (only if returnTo is "field" and not typing in input)
    if (returnTo === "field" && key === "e") {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
        e.preventDefault();
        closeDialogue();
        document.removeEventListener("keydown", handleKeyDown);
      }
    }
  };
  document.addEventListener("keydown", handleKeyDown);
}
