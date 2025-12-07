// ============================================================================
// CLASS CHANGE SCREEN - Headline 14
// FFT-style class selection with unlock tree visualization
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderUnitDetailScreen } from "./UnitDetailScreen";
import { GameState, UnitId } from "../../core/types";
import {
  ClassId,
  ClassDefinition,
  UnitClassProgress,
  getClassDefinition,
  isClassUnlocked,
  getUnlockableClasses,
  getClassesByTier,
  getUnlockRequirementsText,
  changeUnitClass,
  createDefaultClassProgress,
} from "../../core/classes";

export function renderClassChangeScreen(unitId: UnitId): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const unit = state.unitsById[unitId];

  if (!unit) {
    root.innerHTML = `<div class="error">Unit not found</div>`;
    return;
  }

  // Get or create class progress
  const classProgress = (state as any).unitClassProgress?.[unitId] ||
    createDefaultClassProgress(unitId);

  const currentClassDef = getClassDefinition(classProgress.currentClass);

  root.innerHTML = `
    <div class="class-change-root">
      <div class="class-change-card">
        <div class="class-change-header">
          <div>
            <div class="class-change-title">${unit.name} - CLASS MANAGEMENT</div>
            <div class="class-change-subtitle">
              Current: ${currentClassDef.name} (Tier ${currentClassDef.tier})
            </div>
          </div>
          <button class="class-change-back-btn">← BACK TO UNIT</button>
        </div>

        <div class="class-change-body">
          <div class="class-change-info">
            <div class="class-info-section">
              <div class="class-info-label">Battles Won:</div>
              <div class="class-info-value">${classProgress.battlesWon}</div>
            </div>
            <div class="class-info-section">
              <div class="class-info-label">Classes Unlocked:</div>
              <div class="class-info-value">${classProgress.unlockedClasses.length} / ${Object.keys(CLASS_DEFINITIONS).length}</div>
            </div>
          </div>

          ${renderClassTiers(classProgress)}
        </div>
      </div>
    </div>
  `;

  // Event listeners
  attachEventListeners(unitId, classProgress);
}

function renderClassTiers(progress: UnitClassProgress): string {
  const tiers = [0, 1, 2, 3] as const;

  return `
    <div class="class-tiers">
      ${tiers.map(tier => renderTier(tier, progress)).join('')}
    </div>
  `;
}

function renderTier(tier: 0 | 1 | 2 | 3, progress: UnitClassProgress): string {
  const classes = getClassesByTier(tier);
  const tierNames = ["TIER 0 - STARTER", "TIER 1 - CORE UNLOCKS", "TIER 2 - JOB BRANCHES", "TIER 3 - ELITE HYBRIDS"];

  return `
    <div class="class-tier">
      <div class="class-tier-title">${tierNames[tier]}</div>
      <div class="class-tier-grid">
        ${classes.map(classId => renderClassCard(classId, progress)).join('')}
      </div>
    </div>
  `;
}

function renderClassCard(classId: ClassId, progress: UnitClassProgress): string {
  const classDef = getClassDefinition(classId);
  const isUnlocked = isClassUnlocked(classId, progress);
  const isCurrent = progress.currentClass === classId;
  const classRank = progress.classRanks[classId] || 0;
  const requirements = getUnlockRequirementsText(classId);

  // Determine if this class should be revealed
  const currentTier = classDef.tier;
  const highestUnlockedTier = Math.max(...progress.unlockedClasses.map(cId => getClassDefinition(cId).tier));
  const isNextTier = currentTier === highestUnlockedTier + 1;
  const shouldReveal = isUnlocked || isNextTier || currentTier === 0; // Always show Tier 0

  // For locked classes beyond next tier, show mystery placeholder
  if (!shouldReveal) {
    return `
      <div class="class-card class-card--locked class-card--mystery">
        <div class="class-card-header">
          <div class="class-card-name">???</div>
          <div class="class-card-locked-badge">🔒 UNDISCOVERED</div>
        </div>
        <div class="class-card-description class-mystery-text">
          A powerful class awaits discovery...
        </div>
        <div class="class-card-hint">
          Unlock more Tier ${currentTier - 1} classes to reveal
        </div>
      </div>
    `;
  }

  return `
    <div class="class-card ${!isUnlocked ? 'class-card--locked' : ''} ${isCurrent ? 'class-card--current' : ''}"
         data-class-id="${classId}">
      <div class="class-card-header">
        <div class="class-card-name">${classDef.name}</div>
        ${isCurrent ? '<div class="class-card-current-badge">● EQUIPPED</div>' : ''}
        ${!isUnlocked ? '<div class="class-card-locked-badge">🔒 LOCKED</div>' : ''}
      </div>

      <div class="class-card-description">
        ${classDef.description}
      </div>

      <div class="class-card-stats">
        <div class="class-stat-row">
          <span class="class-stat-label">HP:</span>
          <span class="class-stat-value">${classDef.baseStats.maxHp}</span>
        </div>
        <div class="class-stat-row">
          <span class="class-stat-label">ATK:</span>
          <span class="class-stat-value">${classDef.baseStats.atk}</span>
        </div>
        <div class="class-stat-row">
          <span class="class-stat-label">DEF:</span>
          <span class="class-stat-value">${classDef.baseStats.def}</span>
        </div>
        <div class="class-stat-row">
          <span class="class-stat-label">AGI:</span>
          <span class="class-stat-value">${classDef.baseStats.agi}</span>
        </div>
        <div class="class-stat-row">
          <span class="class-stat-label">ACC:</span>
          <span class="class-stat-value">${classDef.baseStats.acc}</span>
        </div>
      </div>

      <div class="class-card-weapons">
        <div class="class-weapons-label">Weapons:</div>
        <div class="class-weapons-list">
          ${classDef.weaponTypes.map(w => `<span class="class-weapon-tag">${w}</span>`).join('')}
        </div>
      </div>

      ${classDef.innateAbility ? `
        <div class="class-card-ability">
          <div class="class-ability-label">Innate:</div>
          <div class="class-ability-text">${classDef.innateAbility}</div>
        </div>
      ` : ''}

      ${!isUnlocked ? `
        <div class="class-card-requirements">
          <div class="class-req-label">Requires:</div>
          ${requirements.map(req => `<div class="class-req-item">• ${req}</div>`).join('')}
        </div>
      ` : ''}

      ${isUnlocked && classRank > 0 ? `
        <div class="class-card-level">Rank ${classRank}</div>
      ` : ''}

      ${isUnlocked && !isCurrent ? `
        <button class="class-change-btn" data-class-id="${classId}">
          CHANGE TO ${classDef.name.toUpperCase()}
        </button>
      ` : ''}
    </div>
  `;
}

function attachEventListeners(unitId: UnitId, progress: UnitClassProgress): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Back button
  root.querySelector(".class-change-back-btn")?.addEventListener("click", () => {
    renderUnitDetailScreen(unitId);
  });

  // Change class buttons
  root.querySelectorAll(".class-change-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const classId = (e.target as HTMLElement).getAttribute("data-class-id") as ClassId;
      if (classId) {
        changeClass(unitId, classId);
      }
    });
  });
}

function changeClass(unitId: UnitId, newClassId: ClassId): void {
  const newClassDef = getClassDefinition(newClassId);

  // Confirm change
  if (!confirm(`Change class to ${newClassDef.name}?\n\nThis will update base stats and weapon restrictions.`)) {
    return;
  }

  updateGameState(prev => {
    // Initialize class progress if needed
    if (!(prev as any).unitClassProgress) {
      (prev as any).unitClassProgress = {};
    }

    const classProgress = (prev as any).unitClassProgress[unitId] ||
      createDefaultClassProgress(unitId);

    // Change class
    const updatedProgress = changeUnitClass(classProgress, newClassId);

    // Update unit stats based on new class
    const unit = prev.unitsById[unitId];
    const updatedUnit = {
      ...unit,
      maxHp: newClassDef.baseStats.maxHp,
      hp: Math.min(unit.hp, newClassDef.baseStats.maxHp), // Cap current HP to new max
      unitClass: newClassId,
    };

    // Also update base stats (stored separately for equipment calculations)
    if ((unit as any).baseStats) {
      (updatedUnit as any).baseStats = {
        ...newClassDef.baseStats,
      };
    }

    return {
      ...prev,
      unitClassProgress: {
        ...(prev as any).unitClassProgress,
        [unitId]: updatedProgress,
      },
      unitsById: {
        ...prev.unitsById,
        [unitId]: updatedUnit,
      },
    } as GameState;
  });

  // Re-render to show new class
  renderClassChangeScreen(unitId);
}

// Re-export for backwards compatibility
const CLASS_DEFINITIONS = {
  squire: getClassDefinition("squire"),
  chemist: getClassDefinition("chemist"),
  knight: getClassDefinition("knight"),
  // ... etc
};
