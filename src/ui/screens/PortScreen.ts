// ============================================================================
// PORT SCREEN - TRADE MANIFEST SYSTEM
// ============================================================================

import { getGameState, updateGameState, addResources } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import {
  PortManifest,
  TradeOffer,
  BulkShipmentOffer,
  ResourceType,
} from "../../core/portTrades";
import {
  generatePortManifest,
} from "../../core/portManifestGenerator";
import { loadCampaignProgress } from "../../core/campaign";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let manifestUpdatedStampVisible = false;
let npcWindowInterval: number | null = null;
let activeNpcWindows: Array<{ id: string; name: string; text: string; timestamp: number }> = [];
let npcWindowIdCounter = 0;

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export function renderPortScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  // Stop any existing NPC window system
  stopNpcWindowSystem();
  
  // Reset stamp visibility
  manifestUpdatedStampVisible = false;
  const app = document.getElementById("app");
  if (!app) return;

  const state = getGameState();
  const campaignProgress = loadCampaignProgress();
  
  // Ensure visit index exists
  const visitIndex = state.baseCampVisitIndex ?? 0;
  
  // Check if we need to generate/refresh manifest
  let manifest = state.portManifest;
  const shouldRefresh = !manifest || manifest.generatedAtVisitIndex !== visitIndex;
  
  if (shouldRefresh) {
    // Generate new manifest
    manifest = generatePortManifest(visitIndex, campaignProgress, state.resources);
    
    // Save manifest to state
    updateGameState(s => ({
      ...s,
      portManifest: manifest,
      portTradesRemaining: 2, // Reset trades remaining on new visit
    }));
    
    // Show manifest updated stamp
    showManifestUpdatedStamp();
    
    // Print terminal feed message
    printTerminalFeed("supply manifests update as caravans come and go");
  } else {
    manifest = state.portManifest!;
  }
  
  const tradesRemaining = state.portTradesRemaining ?? 2;
  const res = state.resources;
  
  const backButtonText = returnTo === "field" ? "FIELD MODE" : "BASE CAMP";
  
  app.innerHTML = `
    <div class="port-root">
      <!-- Header -->
      <div class="port-header">
        <div class="port-header-left">
          <h1 class="port-title">PORT</h1>
          <div class="port-subtitle">SUPPLY MANIFEST TERMINAL</div>
        </div>
        <div class="port-header-right">
          <button class="port-back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>
      
      <!-- Main Content: Two Column Layout -->
      <div class="port-content">
        <!-- Left Column: Main Window -->
        <div class="port-main-window">
          <!-- Manifest Updated Stamp -->
          <div class="port-stamp-container" id="manifestStampContainer">
            <div class="port-stamp ${manifestUpdatedStampVisible ? 'port-stamp--visible' : ''}" id="manifestStamp">
              MANIFEST UPDATED
            </div>
          </div>
          
          <!-- Trades Remaining Indicator -->
          <div class="port-trades-remaining">
            <span class="trades-label">Trades remaining this visit:</span>
            <span class="trades-value">${tradesRemaining}</span>
          </div>
          
          <!-- Normal Trade Contracts -->
          <div class="port-section">
            <h2 class="port-section-title">NORMAL TRADE CONTRACTS</h2>
            <div class="port-offers-list" id="normalOffersList">
              ${renderNormalOffers(manifest.normalOffers, res, tradesRemaining)}
            </div>
          </div>
          
          <!-- Divider -->
          <div class="port-divider"></div>
          
          <!-- Bulk Shipment -->
          <div class="port-section">
            <h2 class="port-section-title">BULK SHIPMENT</h2>
            <div class="port-bulk-shipment" id="bulkShipmentContainer">
              ${renderBulkShipment(manifest.bulkShipmentOffer, res)}
            </div>
          </div>
          
          <!-- Resources Footer -->
          <div class="port-footer">
            <div class="resource-display">
              <div class="resource-item">
                <span class="resource-label">METAL</span>
                <span class="resource-value">${res.metalScrap}</span>
              </div>
              <div class="resource-item">
                <span class="resource-label">WOOD</span>
                <span class="resource-value">${res.wood}</span>
              </div>
              <div class="resource-item">
                <span class="resource-label">SHARDS</span>
                <span class="resource-value">${res.chaosShards}</span>
              </div>
              <div class="resource-item">
                <span class="resource-label">STEAM</span>
                <span class="resource-value">${res.steamComponents}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Right Column: NPC Flavor Text -->
        <div class="port-npc-panel">
          ${renderNpcFlavorText()}
        </div>
      </div>
    </div>
  `;
  
  attachPortListeners(returnTo, manifest);
  
  // Start the NPC window system
  startNpcWindowSystem();
}

// ----------------------------------------------------------------------------
// RENDER HELPERS
// ----------------------------------------------------------------------------

function renderNormalOffers(
  offers: TradeOffer[],
  playerResources: GameState["resources"],
  tradesRemaining: number
): string {
  if (offers.length === 0) {
    return '<div class="port-empty">No trade contracts available.</div>';
  }
  
  return offers.map(offer => {
    const canAfford = (playerResources[offer.input.resource] ?? 0) >= offer.input.amount;
    const canTrade = !offer.fulfilled && tradesRemaining > 0 && canAfford;
    const isFulfilled = offer.fulfilled;
    
    return `
      <div class="port-offer ${isFulfilled ? 'port-offer--fulfilled' : ''}" data-offer-id="${offer.id}">
        <div class="port-offer-header">
          <h3 class="port-offer-name">${offer.name}</h3>
          ${isFulfilled ? '<span class="port-offer-status">FULFILLED</span>' : ''}
        </div>
        <p class="port-offer-description">${offer.description}</p>
        <div class="port-offer-trade">
          <div class="port-trade-input">
            <span class="port-resource-name">${formatResourceName(offer.input.resource)}</span>
            <span class="port-resource-amount">${offer.input.amount}</span>
          </div>
          <div class="port-trade-arrow">→</div>
          <div class="port-trade-output">
            <span class="port-resource-name">${formatResourceName(offer.output.resource)}</span>
            <span class="port-resource-amount">${offer.output.amount}</span>
          </div>
        </div>
        ${!isFulfilled ? `
          <button class="port-trade-btn ${canTrade ? '' : 'port-trade-btn--disabled'}" 
                  data-offer-id="${offer.id}"
                  ${!canTrade ? 'disabled' : ''}>
            ${tradesRemaining === 0 ? 'NO TRADES REMAINING' : !canAfford ? 'INSUFFICIENT RESOURCES' : 'EXECUTE TRADE'}
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderBulkShipment(
  offer: BulkShipmentOffer,
  playerResources: GameState["resources"]
): string {
  const playerAmount = playerResources[offer.targetResource] ?? 0;
  const canShip = playerAmount > 0 && !offer.fulfilled;
  const isFulfilled = offer.fulfilled;
  
  // Determine payout (90% basic, 10% interesting)
  const payout = offer.interestingPayout.length > 0 
    ? offer.interestingPayout 
    : offer.basicPayout;
  
  const isInteresting = offer.interestingPayout.length > 0;
  
  return `
    <div class="port-bulk-offer ${isFulfilled ? 'port-bulk-offer--fulfilled' : ''}">
      <div class="port-bulk-header">
        <h3 class="port-bulk-name">${offer.name}</h3>
        ${isInteresting ? '<span class="port-bulk-bonus">PREMIUM PAYOUT</span>' : ''}
        ${isFulfilled ? '<span class="port-bulk-status">FULFILLED</span>' : ''}
      </div>
      <p class="port-bulk-description">${offer.description}</p>
      <div class="port-bulk-details">
        <div class="port-bulk-input">
          <span class="port-resource-name">${formatResourceName(offer.targetResource)}</span>
          <span class="port-resource-amount">ALL (${playerAmount} available)</span>
        </div>
        <div class="port-trade-arrow">→</div>
        <div class="port-bulk-output">
          ${payout.map(p => `
            <div class="port-bulk-payout-item">
              <span class="port-resource-name">${formatResourceName(p.resource)}</span>
              <span class="port-resource-amount">${p.amount}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ${!isFulfilled ? `
        <button class="port-bulk-btn ${canShip ? '' : 'port-bulk-btn--disabled'}" 
                data-bulk-id="${offer.id}"
                ${!canShip ? 'disabled' : ''}>
          ${canShip ? 'EXECUTE BULK SHIPMENT' : 'NO RESOURCES AVAILABLE'}
        </button>
      ` : ''}
    </div>
  `;
}

function formatResourceName(resource: ResourceType): string {
  const names: Record<ResourceType, string> = {
    metalScrap: "METAL SCRAP",
    wood: "WOOD",
    chaosShards: "CHAOS SHARDS",
    steamComponents: "STEAM COMPONENTS",
  };
  return names[resource] || resource.toUpperCase();
}

// ----------------------------------------------------------------------------
// NPC WINDOW SYSTEM
// ----------------------------------------------------------------------------

// NPC dialogue data - conversations between NPCs
const NPC_DIALOGUES: Array<{ name: string; text: string }> = [
  { name: "DOCK MASTER", text: "The caravans come and go, but the manifest never lies. Every scrap, every shard, every component—it's all accounted for." },
  { name: "CARAVAN MERCHANT", text: "Been running these routes for twenty years. Seen empires rise and fall, but the trade routes? They never change." },
  { name: "WAREHOUSE KEEPER", text: "Storage is tight these days. Everyone wants to hoard, but hoarding doesn't feed the operation." },
  { name: "PORT SCRIBE", text: "Every transaction gets logged. Every shipment gets verified. The manifest is the law here." },
  { name: "TRADE COORDINATOR", text: "The bulk shipments are where the real money is. Think big, commander." },
  { name: "CARGO HANDLER", text: "Another shipment coming in. Metal scrap, mostly. The usual." },
  { name: "HARBORMASTER", text: "Keep the docks clear. We've got three more caravans scheduled before sundown." },
  { name: "SCRAP DEALER", text: "Prices are good today. If you've got metal, now's the time to move it." },
  { name: "STEAM ENGINEER", text: "Those components need proper handling. One wrong move and you've got a pressure leak." },
  { name: "QUARTERMASTER", text: "Resources are resources. Trade what you've got, take what you need." },
  { name: "DOCK WORKER", text: "Heavy load today. Wood shipments are stacking up faster than we can move them." },
  { name: "TRADER", text: "Shards for steam, steam for metal. It's all connected. You just need to know the right people." },
  { name: "MANIFEST CLERK", text: "Double-checking the numbers. Can't afford mistakes in this business." },
  { name: "CARAVAN LEADER", text: "Routes are getting dangerous. More chaos out there than usual." },
  { name: "WAREHOUSE FOREMAN", text: "Inventory's running low. We need more shipments if we're going to keep up with demand." },
];

function renderNpcFlavorText(): string {
  return `
    <div class="port-npc-panel-content">
      <h2 class="port-npc-panel-title">PORT ACTIVITY</h2>
      <div class="port-npc-windows-container" id="portNpcWindowsContainer">
        ${activeNpcWindows.map(window => `
          <div class="port-npc-window port-npc-window--visible" data-window-id="${window.id}">
            <div class="port-npc-name">${window.name}</div>
            <div class="port-npc-text">${window.text}</div>
          </div>
        `).join('')}
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
  npcWindowIdCounter = 0;
  
  // Add initial windows (2-3 to start)
  const initialCount = 2 + Math.floor(Math.random() * 2); // 2-3 windows
  for (let i = 0; i < initialCount; i++) {
    addNpcWindow();
  }
  
  // Update the DOM
  updateNpcWindowsDOM();
  
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
        return age < maxAge;
      });
    }
    
    // If we have too many windows, remove the oldest
    if (activeNpcWindows.length > 4) {
      activeNpcWindows.shift();
    }
    
    updateNpcWindowsDOM();
  }, 2000); // Check every 2 seconds
}

function addNpcWindow(): void {
  const dialogue = NPC_DIALOGUES[Math.floor(Math.random() * NPC_DIALOGUES.length)];
  const windowId = `npc-window-${npcWindowIdCounter++}`;
  
  activeNpcWindows.push({
    id: windowId,
    name: dialogue.name,
    text: dialogue.text,
    timestamp: Date.now(),
  });
}

function updateNpcWindowsDOM(): void {
  const container = document.getElementById("portNpcWindowsContainer");
  if (!container) return;
  
  // Get current window IDs in DOM
  const currentWindowIds = Array.from(container.querySelectorAll('.port-npc-window')).map(
    el => el.getAttribute('data-window-id')
  );
  
  // Get active window IDs
  const activeWindowIds = activeNpcWindows.map(w => w.id);
  
  // Remove windows that are no longer active
  currentWindowIds.forEach(windowId => {
    if (!activeWindowIds.includes(windowId)) {
      const windowEl = container.querySelector(`[data-window-id="${windowId}"]`);
      if (windowEl) {
        windowEl.classList.add('port-npc-window--removing');
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
      windowEl.className = 'port-npc-window';
      windowEl.setAttribute('data-window-id', window.id);
      windowEl.innerHTML = `
        <div class="port-npc-name">${window.name}</div>
        <div class="port-npc-text">${window.text}</div>
      `;
      
      // Add with animation
      windowEl.classList.add('port-npc-window--appearing');
      container.appendChild(windowEl);
      
      // Trigger animation
      requestAnimationFrame(() => {
        windowEl.classList.remove('port-npc-window--appearing');
        windowEl.classList.add('port-npc-window--visible');
      });
    }
  });
}

function stopNpcWindowSystem(): void {
  if (npcWindowInterval !== null) {
    clearInterval(npcWindowInterval);
    npcWindowInterval = null;
  }
  activeNpcWindows = [];
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachPortListeners(
  returnTo: "basecamp" | "field",
  manifest: PortManifest
): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  // Back button
  app.querySelector("#backBtn")?.addEventListener("click", () => {
    // Stop NPC window system when leaving
    stopNpcWindowSystem();
    
    if (returnTo === "field") {
      renderFieldScreen("base_camp");
    } else {
      renderBaseCampScreen();
    }
  });
  
  // Normal trade buttons
  app.querySelectorAll(".port-trade-btn:not(.port-trade-btn--disabled)").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const offerId = (e.currentTarget as HTMLElement).getAttribute("data-offer-id");
      if (offerId) {
        executeNormalTrade(offerId, manifest);
      }
    });
  });
  
  // Bulk shipment button
  app.querySelector(".port-bulk-btn:not(.port-bulk-btn--disabled)")?.addEventListener("click", () => {
    executeBulkShipment(manifest.bulkShipmentOffer);
  });
}

// ----------------------------------------------------------------------------
// TRADE EXECUTION
// ----------------------------------------------------------------------------

function executeNormalTrade(offerId: string, manifest: PortManifest): void {
  const state = getGameState();
  const offer = manifest.normalOffers.find(o => o.id === offerId);
  
  if (!offer || offer.fulfilled) {
    return;
  }
  
  const playerResources = state.resources;
  const playerAmount = playerResources[offer.input.resource] ?? 0;
  
  if (playerAmount < offer.input.amount) {
    return; // Can't afford
  }
  
  const tradesRemaining = state.portTradesRemaining ?? 2;
  if (tradesRemaining <= 0) {
    return; // No trades remaining
  }
  
  // Execute trade
  updateGameState(s => {
    const newResources = { ...s.resources };
    newResources[offer.input.resource] = (newResources[offer.input.resource] ?? 0) - offer.input.amount;
    newResources[offer.output.resource] = (newResources[offer.output.resource] ?? 0) + offer.output.amount;
    
    // Mark offer as fulfilled
    const updatedManifest = { ...s.portManifest! };
    const offerIndex = updatedManifest.normalOffers.findIndex(o => o.id === offerId);
    if (offerIndex >= 0) {
      updatedManifest.normalOffers[offerIndex] = { ...updatedManifest.normalOffers[offerIndex], fulfilled: true };
    }
    
    return {
      ...s,
      resources: newResources,
      portManifest: updatedManifest,
      portTradesRemaining: tradesRemaining - 1,
    };
  });
  
  // Log to terminal feed
  printTerminalFeed(
    `TRADE EXECUTED: ${offer.input.amount} ${formatResourceName(offer.input.resource)} → ${offer.output.amount} ${formatResourceName(offer.output.resource)}`
  );
  
  // Re-render screen
  renderPortScreen();
}

function executeBulkShipment(offer: BulkShipmentOffer): void {
  const state = getGameState();
  const playerAmount = state.resources[offer.targetResource] ?? 0;
  
  // Check if already fulfilled
  if (offer.fulfilled) {
    return;
  }
  
  // Check if player has resources
  if (playerAmount <= 0) {
    return;
  }
  
  // Determine payout
  const payout = offer.interestingPayout.length > 0 
    ? offer.interestingPayout 
    : offer.basicPayout;
  
  // Execute shipment
  updateGameState(s => {
    const newResources = { ...s.resources };
    
    // Consume ALL of target resource
    newResources[offer.targetResource] = 0;
    
    // Add payout
    for (const payoutItem of payout) {
      newResources[payoutItem.resource] = (newResources[payoutItem.resource] ?? 0) + payoutItem.amount;
    }
    
    // Mark bulk shipment as fulfilled
    const updatedManifest = { ...s.portManifest! };
    updatedManifest.bulkShipmentOffer = {
      ...updatedManifest.bulkShipmentOffer,
      fulfilled: true,
    };
    
    return {
      ...s,
      resources: newResources,
      portManifest: updatedManifest,
    };
  });
  
  // Log to terminal feed
  const payoutText = payout.map(p => `${p.amount} ${formatResourceName(p.resource)}`).join(", ");
  printTerminalFeed(
    `BULK SHIPMENT: ${playerAmount} ${formatResourceName(offer.targetResource)} → ${payoutText}`
  );
  
  // Re-render screen
  const returnTo = (document.getElementById("backBtn")?.getAttribute("data-return-to") as "basecamp" | "field") || "basecamp";
  renderPortScreen(returnTo);
}

// ----------------------------------------------------------------------------
// UI HELPERS
// ----------------------------------------------------------------------------

function showManifestUpdatedStamp(): void {
  manifestUpdatedStampVisible = true;
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    const stamp = document.getElementById("manifestStamp");
    if (stamp) {
      stamp.classList.add("port-stamp--visible");
    }
    setTimeout(() => {
      manifestUpdatedStampVisible = false;
      if (stamp) {
        stamp.classList.remove("port-stamp--visible");
      }
    }, 3000); // Fade after 3 seconds
  });
}

function printTerminalFeed(message: string): void {
  // Find terminal feed element (could be in base camp or field mode)
  const terminalFeed = document.querySelector(".basecamp-terminal-body") || 
                       document.querySelector(".field-terminal-feed");
  
  if (terminalFeed) {
    const line = document.createElement("div");
    line.className = "terminal-line";
    line.textContent = `SLK> PORT :: ${message}`;
    terminalFeed.appendChild(line);
    terminalFeed.scrollTop = terminalFeed.scrollHeight;
  }
  
  // Also log to console
  console.log(`[PORT] ${message}`);
}

// Import GameState for type reference
import { GameState } from "../../core/types";

// ----------------------------------------------------------------------------
// DEBUG HELPERS
// ----------------------------------------------------------------------------

/**
 * Debug: Force refresh manifest (DEV only)
 * Call from console: window.debugRefreshPortManifest()
 */
export function debugRefreshPortManifest(): void {
  const state = getGameState();
  const campaignProgress = loadCampaignProgress();
  
  // Increment visit index to force refresh
  updateGameState(s => ({
    ...s,
    baseCampVisitIndex: (s.baseCampVisitIndex ?? 0) + 1,
  }));
  
  const newState = getGameState();
  const newVisitIndex = newState.baseCampVisitIndex ?? 0;
  
  // Generate new manifest
  const manifest = generatePortManifest(newVisitIndex, campaignProgress, newState.resources);
  
  updateGameState(s => ({
    ...s,
    portManifest: manifest,
    portTradesRemaining: 2,
  }));
  
  console.log("[PORT DEBUG] Manifest refreshed:");
  console.log(`  Visit Index: ${newVisitIndex}`);
  console.log(`  Normal Offers: ${manifest.normalOffers.length}`);
  console.log(`  Bulk Shipment Target: ${manifest.bulkShipmentOffer.targetResource}`);
  
  // Re-render if Port screen is open
  if (document.querySelector(".port-root")) {
    renderPortScreen();
  }
}

/**
 * Debug: Print current manifest info (DEV only)
 * Call from console: window.debugPrintPortManifest()
 */
export function debugPrintPortManifest(): void {
  const state = getGameState();
  const manifest = state.portManifest;
  
  if (!manifest) {
    console.log("[PORT DEBUG] No manifest generated yet");
    return;
  }
  
  console.log("[PORT DEBUG] Current Manifest:");
  console.log(`  Visit Index: ${state.baseCampVisitIndex ?? 0}`);
  console.log(`  Generated At Visit: ${manifest.generatedAtVisitIndex}`);
  console.log(`  Generated At Time: ${new Date(manifest.generatedAtTime).toLocaleString()}`);
  console.log(`  Trades Remaining: ${state.portTradesRemaining ?? 2}`);
  console.log(`  Normal Offers: ${manifest.normalOffers.length}`);
  manifest.normalOffers.forEach((offer, i) => {
    console.log(`    ${i + 1}. ${offer.name} - ${offer.fulfilled ? 'FULFILLED' : 'AVAILABLE'}`);
  });
  console.log(`  Bulk Shipment: ${manifest.bulkShipmentOffer.targetResource}`);
}

// Expose to window for console access (DEV only)
if (typeof window !== 'undefined') {
  (window as any).debugRefreshPortManifest = debugRefreshPortManifest;
  (window as any).debugPrintPortManifest = debugPrintPortManifest;
}

