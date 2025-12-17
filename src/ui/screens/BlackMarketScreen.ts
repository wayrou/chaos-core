// ============================================================================
// CHAOS CORE - BLACK MARKET SCREEN
// Purchase field mods for the next run
// ============================================================================

import { getGameState, updateGameState, spendWad } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { getAllFieldModDefs, getFieldModDef } from "../../core/fieldModDefinitions";
import { FieldModInstance } from "../../core/fieldMods";
import { loadCampaignProgress, saveCampaignProgress } from "../../core/campaign";

// ----------------------------------------------------------------------------
// NPC CONVERSATION SYSTEM STATE
// ----------------------------------------------------------------------------

let npcWindowInterval: number | null = null;
let activeNpcWindows: Array<{ id: string; name: string; text: string; timestamp: number; conversationId?: string }> = [];
let npcWindowIdCounter = 0;
let activeConversations: Map<string, Array<{ name: string; text: string }>> = new Map();

// NPC dialogue data - conversations in the black market
const NPC_DIALOGUES: Array<{ name: string; text: string }> = [
  { name: "SHADY DEALER", text: "Got some hot mods fresh off the line. Military-grade, but... unofficially." },
  { name: "UNDERGROUND TECH", text: "These field mods aren't in any official catalog. You didn't see them here." },
  { name: "SMUGGLER", text: "Brought these in through the back channels. Command doesn't know they exist." },
  { name: "MOD BROKER", text: "Premium modifications, commander. Expensive, but they'll give you an edge." },
  { name: "ILLEGAL VENDOR", text: "Everything here is off the books. No questions asked, no records kept." },
  { name: "BLACK MARKET OPERATOR", text: "The best mods never make it to the official supply chain. You're looking at them." },
  { name: "SHADOW MERCHANT", text: "These modifications are... experimental. Use at your own risk." },
  { name: "UNDERGROUND DEALER", text: "Got connections in the supply depots. Sometimes things fall off the truck." },
  { name: "ILLICIT TRADER", text: "Field mods that'll make your units unstoppable. For the right price." },
  { name: "BLACK MARKET VENDOR", text: "Command would shut this place down if they knew. Lucky for you, they don't." },
  { name: "SHADY OPERATOR", text: "These mods are one-of-a-kind. Once they're gone, they're gone." },
  { name: "UNDERGROUND BROKER", text: "Premium illegal modifications. The kind that win wars." },
  { name: "SMUGGLER CAPTAIN", text: "Brought these through enemy lines. Cost me three good operators." },
  { name: "BLACK MARKET MASTER", text: "Everything here is contraband. But it works. That's what matters." },
  { name: "ILLEGAL TECH DEALER", text: "These mods bypass all safety regulations. They're dangerous. They're effective." },
];

// Aeriss response templates based on dialogue context
const AERISS_RESPONSES: Record<string, string[]> = {
  default: [
    "Interesting. Tell me more.",
    "I'll keep that in mind.",
    "Noted.",
    "Understood.",
    "I see.",
  ],
  shady: [
    "I don't need to know where they came from.",
    "As long as they work, I don't care about the paperwork.",
    "Off the books works for me.",
    "No questions asked. Perfect.",
  ],
  expensive: [
    "Quality comes at a price.",
    "If it gives us an edge, it's worth it.",
    "I'll find the WAD somehow.",
    "Expensive, but necessary.",
  ],
  illegal: [
    "Command doesn't need to know everything.",
    "Sometimes you have to bend the rules.",
    "I'll take what I can get.",
    "The war doesn't care about regulations.",
  ],
  experimental: [
    "Risky, but we need every advantage.",
    "I'll take the risk.",
    "Experimental is fine if it works.",
    "We're already in dangerous territory.",
  ],
};

// ----------------------------------------------------------------------------
// MAIN RENDER
// ----------------------------------------------------------------------------

export function renderBlackMarketScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  // Stop any existing NPC window system
  stopNpcWindowSystem();
  
  // Populate initial NPC windows before rendering
  activeNpcWindows = [];
  activeConversations.clear();
  npcWindowIdCounter = 0;
  const initialCount = 2 + Math.floor(Math.random() * 2); // 2-3 windows
  for (let i = 0; i < initialCount; i++) {
    addNpcWindow();
  }
  
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const campaignProgress = loadCampaignProgress();
  const activeRun = campaignProgress.activeRun;
  
  // Get current inventory (from active run or game state)
  const currentInventory = activeRun?.runFieldModInventory || state.runFieldModInventory || [];
  
  // Get all available field mod definitions
  const allMods = getAllFieldModDefs();
  
  // Filter to only mods that have a cost (black market items)
  const availableMods = allMods.filter(mod => mod.cost !== undefined && mod.cost > 0);
  
  // Sort by rarity (common, uncommon, rare)
  const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2 };
  availableMods.sort((a, b) => {
    const rarityDiff = (rarityOrder[a.rarity] || 0) - (rarityOrder[b.rarity] || 0);
    if (rarityDiff !== 0) return rarityDiff;
    return a.name.localeCompare(b.name);
  });

  const wad = state.wad;

  root.innerHTML = `
    <div class="blackmarket-root">
      <div class="blackmarket-header">
        <div class="blackmarket-header-left">
          <div class="blackmarket-title">BLACK MARKET</div>
          <div class="blackmarket-subtitle">ILLEGAL FIELD MODIFICATIONS // NEXT RUN ONLY</div>
        </div>
        <div class="blackmarket-header-right">
          <div class="blackmarket-wad">
            <span class="blackmarket-wad-label">WAD:</span>
            <span class="blackmarket-wad-amount">${wad}</span>
          </div>
          <button class="blackmarket-back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${returnTo === "field" ? "FIELD MODE" : "BASE CAMP"}</span>
          </button>
        </div>
      </div>

      <div class="blackmarket-body">
        <!-- Two Column Layout -->
        <div class="blackmarket-content-wrapper">
          <!-- Left Column: Main Content -->
          <div class="blackmarket-main-panel">
            <div class="blackmarket-info">
              <div class="blackmarket-info-text">
                Field mods purchased here will be available for your next operation run.
                Equip them to unit hardpoints in the loadout screen before starting a run.
              </div>
            </div>

            <div class="blackmarket-inventory">
              <div class="blackmarket-inventory-title">YOUR INVENTORY (${currentInventory.length})</div>
              <div class="blackmarket-inventory-list">
                ${currentInventory.length > 0
                  ? currentInventory.map(modInstance => {
                      const modDef = getFieldModDef(modInstance.defId);
                      if (!modDef) return "";
                      return `
                        <div class="blackmarket-inventory-item">
                          <div class="blackmarket-inventory-item-name">${modDef.name}</div>
                          <div class="blackmarket-inventory-item-rarity blackmarket-inventory-item-rarity--${modDef.rarity}">
                            ${modDef.rarity.toUpperCase()}
                          </div>
                          ${modInstance.stacks > 1 ? `<div class="blackmarket-inventory-item-stacks">x${modInstance.stacks}</div>` : ""}
                        </div>
                      `;
                    }).join("")
                  : '<div class="blackmarket-inventory-empty">No field mods in inventory.</div>'
                }
              </div>
            </div>

            <div class="blackmarket-catalog">
              <div class="blackmarket-catalog-title">AVAILABLE MODS</div>
              <div class="blackmarket-catalog-list">
                ${availableMods.map(mod => {
                  const canAfford = wad >= (mod.cost || 0);
                  return `
                    <div class="blackmarket-item ${!canAfford ? "blackmarket-item--unaffordable" : ""}" data-mod-id="${mod.id}">
                      <div class="blackmarket-item-header">
                        <div class="blackmarket-item-name">${mod.name}</div>
                        <div class="blackmarket-item-rarity blackmarket-item-rarity--${mod.rarity}">
                          ${mod.rarity.toUpperCase()}
                        </div>
                      </div>
                      <div class="blackmarket-item-description">${mod.description}</div>
                      <div class="blackmarket-item-footer">
                        <div class="blackmarket-item-scope">${mod.scope === "squad" ? "SQUAD" : "UNIT"} SCOPE</div>
                        <div class="blackmarket-item-price ${!canAfford ? "blackmarket-item-price--unaffordable" : ""}">
                          ${mod.cost || 0} WAD
                        </div>
                      </div>
                      <button class="blackmarket-item-buy-btn ${!canAfford ? "blackmarket-item-buy-btn--disabled" : ""}" 
                              data-mod-id="${mod.id}" 
                              ${!canAfford ? "disabled" : ""}>
                        ${canAfford ? "PURCHASE" : "INSUFFICIENT FUNDS"}
                      </button>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          </div>

          <!-- Right Column: NPC Conversation -->
          <div class="blackmarket-npc-panel">
            ${renderNpcFlavorText()}
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  attachBlackMarketListeners(root, returnTo);
  
  // Start the NPC window system
  startNpcWindowSystem();
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachBlackMarketListeners(root: HTMLElement, returnTo: "basecamp" | "field"): void {
  // Back button
  root.querySelector("#backBtn")?.addEventListener("click", () => {
    // Stop NPC window system when leaving
    stopNpcWindowSystem();
    
    if (returnTo === "field") {
      renderFieldScreen("base_camp");
    } else {
      renderBaseCampScreen();
    }
  });

  // Purchase buttons
  root.querySelectorAll(".blackmarket-item-buy-btn:not(.blackmarket-item-buy-btn--disabled)").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modId = (btn as HTMLElement).getAttribute("data-mod-id");
      if (modId) {
        purchaseFieldMod(modId);
      }
    });
  });

  // Clickable NPC dialogue windows - attach after DOM is ready
  setTimeout(() => {
    attachNpcWindowClickHandlers();
  }, 100);
}

// ----------------------------------------------------------------------------
// PURCHASE LOGIC
// ----------------------------------------------------------------------------

function purchaseFieldMod(modId: string): void {
  const modDef = getFieldModDef(modId);
  if (!modDef || !modDef.cost) {
    console.error(`[BLACK MARKET] Invalid mod or no cost: ${modId}`);
    return;
  }

  const state = getGameState();
  if (state.wad < modDef.cost) {
    console.warn(`[BLACK MARKET] Insufficient funds: ${state.wad} < ${modDef.cost}`);
    return;
  }

  // Spend WAD
  if (!spendWad(modDef.cost)) {
    console.error(`[BLACK MARKET] Failed to spend WAD`);
    return;
  }

  // Create field mod instance
  const instanceId = `mod_${modId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const modInstance: FieldModInstance = {
    defId: modId,
    instanceId,
    stacks: 1,
  };

  // Add to inventory (prefer active run, otherwise game state)
  const campaignProgress = loadCampaignProgress();
  const activeRun = campaignProgress.activeRun;

  if (activeRun) {
    // Add to active run inventory
    const currentInventory = activeRun.runFieldModInventory || [];
    const updatedInventory = [...currentInventory, modInstance];
    
    saveCampaignProgress({
      ...campaignProgress,
      activeRun: {
        ...activeRun,
        runFieldModInventory: updatedInventory,
      },
    });
  } else {
    // Add to game state inventory (for next run)
    updateGameState(s => ({
      ...s,
      runFieldModInventory: [...(s.runFieldModInventory || []), modInstance],
    }));
  }

  console.log(`[BLACK MARKET] Purchased field mod: ${modDef.name} for ${modDef.cost} WAD`);

  // Re-render to update UI
  renderBlackMarketScreen("field");
}

// ----------------------------------------------------------------------------
// NPC WINDOW SYSTEM
// ----------------------------------------------------------------------------

function renderNpcFlavorText(): string {
  return `
    <div class="blackmarket-npc-panel-content">
      <h2 class="blackmarket-npc-panel-title">BLACK MARKET CHATTER</h2>
      <div class="blackmarket-npc-windows-container" id="blackmarketNpcWindowsContainer">
        ${activeNpcWindows.map(window => {
          const conversation = activeConversations.get(window.conversationId || "");
          const hasConversation = conversation && conversation.length > 0;
          return `
            <div class="blackmarket-npc-window blackmarket-npc-window--visible ${hasConversation ? "blackmarket-npc-window--has-conversation" : ""}" 
                 data-window-id="${window.id}" 
                 data-conversation-id="${window.conversationId || ""}">
              <div class="blackmarket-npc-name">${window.name}</div>
              <div class="blackmarket-npc-text">${window.text}</div>
              ${hasConversation ? conversation!.map((msg, idx) => `
                <div class="blackmarket-npc-conversation-message ${msg.name === "AERISS" ? "blackmarket-npc-conversation-message--aeriss" : ""}">
                  <div class="blackmarket-npc-conversation-name">${msg.name}</div>
                  <div class="blackmarket-npc-conversation-text">${msg.text}</div>
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
  
  // Don't clear windows here - they're already populated before render
  // Just ensure we have windows
  if (activeNpcWindows.length === 0) {
    const initialCount = 2 + Math.floor(Math.random() * 2); // 2-3 windows
    for (let i = 0; i < initialCount; i++) {
      addNpcWindow();
    }
  }
  
  // Update the DOM immediately
  updateNpcWindowsDOM();
  
  // Also update after a short delay to ensure DOM is ready
  setTimeout(() => {
    updateNpcWindowsDOM();
  }, 100);
  
  // Start the cycle: add new windows and remove old ones
  npcWindowInterval = window.setInterval(() => {
    // Random chance to add a new window (60% chance)
    if (Math.random() < 0.6 && activeNpcWindows.length < 5) {
      addNpcWindow();
    }
    
    // Remove old windows (random, but keep at least 1)
    if (activeNpcWindows.length > 1) {
      const now = Date.now();
      // Remove windows older than 8-12 seconds
      const maxAge = 8000 + Math.random() * 4000;
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
    
    // If we have too many windows, remove the oldest
    if (activeNpcWindows.length > 4) {
      const removed = activeNpcWindows.shift();
      if (removed?.conversationId) {
        activeConversations.delete(removed.conversationId);
      }
    }
    
    updateNpcWindowsDOM();
  }, 2000); // Check every 2 seconds
}

function addNpcWindow(): void {
  const dialogue = NPC_DIALOGUES[Math.floor(Math.random() * NPC_DIALOGUES.length)];
  const windowId = `blackmarket-npc-window-${npcWindowIdCounter++}`;
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
  const container = document.getElementById("blackmarketNpcWindowsContainer");
  if (!container) {
    // Container doesn't exist yet, try again after a short delay
    setTimeout(() => updateNpcWindowsDOM(), 50);
    return;
  }
  
  // Get current window IDs in DOM
  const currentWindowIds = Array.from(container.querySelectorAll('.blackmarket-npc-window')).map(
    el => el.getAttribute('data-window-id')
  ).filter((id): id is string => id !== null);
  
  // Get active window IDs
  const activeWindowIds = activeNpcWindows.map(w => w.id);
  
  // Remove windows that are no longer active
  currentWindowIds.forEach(windowId => {
    if (!activeWindowIds.includes(windowId)) {
      const windowEl = container.querySelector(`[data-window-id="${windowId}"]`);
      if (windowEl) {
        windowEl.classList.add('blackmarket-npc-window--removing');
        setTimeout(() => {
          windowEl.remove();
        }, 300); // Match animation duration
      }
    }
  });
  
  // Add new windows and update existing ones
  activeNpcWindows.forEach(window => {
    let windowEl = container.querySelector(`[data-window-id="${window.id}"]`) as HTMLElement;
    const conversation = activeConversations.get(window.conversationId || "");
    const hasConversation = conversation && conversation.length > 0;
    
    const isNewWindow = !windowEl;
    
    if (isNewWindow) {
      // Create new window
      windowEl = document.createElement('div');
      windowEl.className = 'blackmarket-npc-window';
      windowEl.setAttribute('data-window-id', window.id);
      windowEl.setAttribute('data-conversation-id', window.conversationId || "");
      
      // Add with animation
      windowEl.classList.add('blackmarket-npc-window--appearing');
      container.appendChild(windowEl);
    }
    
    // Update window content
    windowEl.innerHTML = `
      <div class="blackmarket-npc-name">${window.name}</div>
      <div class="blackmarket-npc-text">${window.text}</div>
      ${hasConversation ? conversation!.map((msg) => `
        <div class="blackmarket-npc-conversation-message ${msg.name === "AERISS" ? "blackmarket-npc-conversation-message--aeriss" : ""}">
          <div class="blackmarket-npc-conversation-name">${msg.name}</div>
          <div class="blackmarket-npc-conversation-text">${msg.text}</div>
        </div>
      `).join("") : ""}
    `;
    
    // Handle visibility for new windows
    if (isNewWindow) {
      // Trigger animation after content is set
      requestAnimationFrame(() => {
        windowEl.classList.remove('blackmarket-npc-window--appearing');
        windowEl.classList.add('blackmarket-npc-window--visible');
      });
    } else {
      // For existing windows, ensure they're visible (not stuck in appearing state)
      if (windowEl.classList.contains('blackmarket-npc-window--appearing')) {
        windowEl.classList.remove('blackmarket-npc-window--appearing');
      }
      if (!windowEl.classList.contains('blackmarket-npc-window--visible')) {
        windowEl.classList.add('blackmarket-npc-window--visible');
      }
    }
    
    if (hasConversation) {
      windowEl.classList.add('blackmarket-npc-window--has-conversation');
    } else {
      windowEl.classList.remove('blackmarket-npc-window--has-conversation');
    }
  });
  
  // Re-attach click handlers after DOM update
  attachNpcWindowClickHandlers();
}

function attachNpcWindowClickHandlers(): void {
  const container = document.getElementById("blackmarketNpcWindowsContainer");
  if (!container) return;
  
  // Remove old handlers and attach new ones
  container.querySelectorAll('.blackmarket-npc-window').forEach(windowEl => {
    // Remove existing click handler
    const newWindowEl = windowEl.cloneNode(true) as HTMLElement;
    windowEl.parentNode?.replaceChild(newWindowEl, windowEl);
    
    // Attach click handler to the main window (not conversation messages)
    newWindowEl.addEventListener('click', (e) => {
      // Don't trigger if clicking on a conversation message
      if ((e.target as HTMLElement).closest('.blackmarket-npc-conversation-message')) {
        return;
      }
      
      const windowId = newWindowEl.getAttribute('data-window-id');
      const conversationId = newWindowEl.getAttribute('data-conversation-id');
      
      if (windowId && conversationId) {
        handleNpcWindowClick(windowId, conversationId);
      }
    });
  });
}

function handleNpcWindowClick(windowId: string, conversationId: string): void {
  const window = activeNpcWindows.find(w => w.id === windowId);
  if (!window) return;
  
  // Get or create conversation
  let conversation = activeConversations.get(conversationId) || [];
  
  // Determine response type based on dialogue content
  let responseType = "default";
  const text = window.text.toLowerCase();
  if (text.includes("shady") || text.includes("off the books") || text.includes("unofficially")) {
    responseType = "shady";
  } else if (text.includes("expensive") || text.includes("premium") || text.includes("cost")) {
    responseType = "expensive";
  } else if (text.includes("illegal") || text.includes("contraband") || text.includes("command")) {
    responseType = "illegal";
  } else if (text.includes("experimental") || text.includes("risk") || text.includes("dangerous")) {
    responseType = "experimental";
  }
  
  // Get random Aeriss response
  const responses = AERISS_RESPONSES[responseType] || AERISS_RESPONSES.default;
  const aerissResponse = responses[Math.floor(Math.random() * responses.length)];
  
  // Add Aeriss response to conversation
  conversation.push({
    name: "AERISS",
    text: aerissResponse,
  });
  
  // Store conversation
  activeConversations.set(conversationId, conversation);
  
  // Update the window to show conversation
  window.conversationId = conversationId;
  
  // Update DOM
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

