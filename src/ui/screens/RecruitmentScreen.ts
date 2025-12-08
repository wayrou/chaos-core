// ============================================================================
// RECRUITMENT SCREEN - Headline 14az
// ============================================================================
// UI for viewing and hiring recruitment candidates from Taverns/Contract Boards
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { RecruitmentCandidate, GUILD_ROSTER_LIMITS } from "../../core/types";
import { generateCandidates, hireCandidate, getRosterSize } from "../../core/recruitment";
import { getPWRBand, getPWRBandColor } from "../../core/pwr";

// ============================================================================
// RENDER
// ============================================================================

export function renderRecruitmentScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const candidates = state.recruitmentCandidates || [];
  const rosterSize = getRosterSize(state);
  const wad = state.wad || 0;

  // If no candidates, generate a new pool
  if (candidates.length === 0) {
    const hub = {
      id: "base_camp_tavern",
      name: "Base Camp Tavern",
      type: "base_camp" as const,
      candidatePoolSize: 4,
    };
    
    const newCandidates = generateCandidates(hub, rosterSize);
    
    // Only update and re-render if we actually got candidates
    if (newCandidates.length > 0) {
      updateGameState((s) => ({
        ...s,
        recruitmentCandidates: newCandidates,
      }));
      
      // Re-render with new candidates (use requestAnimationFrame to avoid infinite loops)
      requestAnimationFrame(() => {
        renderRecruitmentScreen(returnTo);
      });
      return;
    } else {
      // If no candidates could be generated (roster full), show message
      console.warn("[RECRUITMENT] Could not generate candidates - roster may be full");
    }
  }

  const candidatesHtml = candidates.map((candidate) => renderCandidateCard(candidate, wad)).join("");

  root.innerHTML = `
    <div class="recruitment-root">
      <div class="recruitment-card">
        <div class="recruitment-header">
          <div class="recruitment-header-left">
            <div class="recruitment-title">TAVERN - RECRUITMENT HUB</div>
            <div class="recruitment-subtitle">Review available candidates and hire new units</div>
          </div>
          <div class="recruitment-header-right">
            <div class="recruitment-stats">
              <div class="recruitment-stat-item">
                <span class="recruitment-stat-label">ROSTER:</span>
                <span class="recruitment-stat-value">${rosterSize} / ${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS}</span>
              </div>
              <div class="recruitment-stat-item">
                <span class="recruitment-stat-label">WAD:</span>
                <span class="recruitment-stat-value">${wad}</span>
              </div>
            </div>
            <button class="recruitment-back-btn" data-return-to="${returnTo}">BACK</button>
          </div>
        </div>
        
        <div class="recruitment-body">
          ${rosterSize >= GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS ? `
            <div class="recruitment-warning">
              ⚠️ ROSTER IS FULL (${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS}/${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS})
              <br/>Dismiss units from the roster before recruiting new ones.
            </div>
          ` : ""}
          
          <div class="recruitment-candidates-grid">
            ${candidatesHtml}
          </div>
        </div>
        
        <div class="recruitment-footer">
          <div class="recruitment-legend">
            <span class="recruitment-legend-item">
              <span class="recruitment-legend-dot" style="background: ${getPWRBandColor(50)}"></span>
              Rookie (0-50 PWR)
            </span>
            <span class="recruitment-legend-item">
              <span class="recruitment-legend-dot" style="background: ${getPWRBandColor(75)}"></span>
              Standard (51-100 PWR)
            </span>
            <span class="recruitment-legend-item">
              <span class="recruitment-legend-dot" style="background: ${getPWRBandColor(125)}"></span>
              Veteran (101-150 PWR)
            </span>
            <span class="recruitment-legend-item">
              <span class="recruitment-legend-dot" style="background: ${getPWRBandColor(175)}"></span>
              Elite (151-200 PWR)
            </span>
            <span class="recruitment-legend-item">
              <span class="recruitment-legend-dot" style="background: ${getPWRBandColor(250)}"></span>
              Paragon (201+ PWR)
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  attachEventListeners(returnTo);
}

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
 * Attach event listeners
 */
function attachEventListeners(returnTo: "basecamp" | "field"): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Back button
  root.querySelector(".recruitment-back-btn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      // Return to field mode
      import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("base_camp");
      });
    } else {
      // Return to base camp screen
      import("./BaseCampScreen").then(({ renderBaseCampScreen }) => {
        renderBaseCampScreen();
      });
    }
  });

  // Hire buttons
  root.querySelectorAll(".candidate-hire-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const candidateId = (e.currentTarget as HTMLElement).getAttribute("data-candidate-id");
      if (!candidateId) return;

      handleHireCandidate(candidateId, returnTo);
    });
  });

  // Candidate detail clicks (for future expansion)
  root.querySelectorAll(".candidate-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      // Only trigger if not clicking a button
      if ((e.target as HTMLElement).closest("button")) return;
      
      const candidateId = (card as HTMLElement).getAttribute("data-candidate-id");
      if (candidateId) {
        // TODO: Show detailed candidate view
        console.log("Show candidate detail:", candidateId);
      }
    });
  });
}

/**
 * Handle hiring a candidate
 */
function handleHireCandidate(candidateId: string, returnTo: "basecamp" | "field"): void {
  const state = getGameState();
  const candidates = state.recruitmentCandidates || [];

  updateGameState((s) => {
    const result = hireCandidate(candidateId, candidates, s);
    
    if (!result.success) {
      // Show error notification
      showNotification(result.error || "Failed to hire candidate", "error");
      return s;
    }

    // Success notification
    showNotification("Candidate hired successfully!", "success");
    return s;
  });

  // Re-render to show updated roster and remaining candidates
  setTimeout(() => renderRecruitmentScreen(returnTo), 100);
}

/**
 * Show a notification (simple implementation)
 */
function showNotification(message: string, type: "success" | "error" | "info" = "info"): void {
  // Simple alert for now - can be replaced with a proper toast system
  if (type === "error") {
    alert(`ERROR: ${message}`);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Could use a toast library here
  }
}


