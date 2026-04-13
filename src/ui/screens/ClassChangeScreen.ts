// ============================================================================
// CLASS MANAGEMENT SCREEN
// Shared S.T.A.T. spending + class switching + per-class ability grids
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderUnitDetailScreen } from "./Unitdetailscreen";
import { GameState, Unit, UnitId } from "../../core/types";
import {
  ClassGridNode,
  ClassId,
  UnitClassProgress,
  canUnlockClassGridNode,
  changeUnitClass,
  createDefaultClassProgress,
  getAvailableClasses,
  getClassAbilityGrid,
  getClassDefinition,
  getClassRankLetter,
  getClassesByTier,
  getDisplayedClassRank,
  getUnlockRequirementsText,
  isClassUnlocked,
  purchaseClassGridNode,
  syncClassRanksWithGrid,
  unlockEligibleClasses,
} from "../../core/classes";
import { calculatePWR } from "../../core/pwr";
import { getAllStarterEquipment } from "../../core/equipment";
import { getStatBank, spendStatTokens, STAT_SHORT_LABEL } from "../../core/statTokens";

type ClassChangeReturnTo = "basecamp" | "field" | "esc" | "loadout" | "operation";

let classChangeEscHandler: ((e: KeyboardEvent) => void) | null = null;

function unregisterClassChangeReturnHotkey(): void {
  if (!classChangeEscHandler) return;
  window.removeEventListener("keydown", classChangeEscHandler);
  classChangeEscHandler = null;
}

function registerClassChangeReturnHotkey(unitId: UnitId, returnTo: ClassChangeReturnTo): void {
  unregisterClassChangeReturnHotkey();

  classChangeEscHandler = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase() ?? "";
    const isEscape = key === "escape" || e.key === "Escape" || e.keyCode === 27;
    if (!isEscape || !document.querySelector(".class-change-root")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    unregisterClassChangeReturnHotkey();
    renderUnitDetailScreen(unitId, returnTo);
  };

  window.addEventListener("keydown", classChangeEscHandler);
}

function normalizeClassToken(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveUnitClassId(unit: Unit, progress: UnitClassProgress): ClassId {
  const desired = normalizeClassToken(progress.currentClass || (unit.unitClass as string) || "squire");
  const match = getAvailableClasses().find((classId) => normalizeClassToken(classId) === desired);
  return match || "squire";
}

function getNormalizedProgress(state: GameState, unitId: UnitId): UnitClassProgress {
  const unit = state.unitsById[unitId];
  const existing = state.unitClassProgress?.[unitId] || createDefaultClassProgress(unitId);
  const currentClass = resolveUnitClassId(unit, existing);
  const unlockedClasses = existing.unlockedClasses.includes(currentClass)
    ? existing.unlockedClasses
    : [...existing.unlockedClasses, currentClass];

  return unlockEligibleClasses(syncClassRanksWithGrid({
    ...existing,
    currentClass,
    unlockedClasses,
    classRanks: {
      ...existing.classRanks,
      [currentClass]: existing.classRanks[currentClass] || 1,
    },
    gridUnlocks: existing.gridUnlocks || {},
  }));
}

function formatClassCount(progress: UnitClassProgress): string {
  return `${progress.unlockedClasses.length}`;
}

function renderSummaryPanel(unit: Unit, progress: UnitClassProgress, statBank: number): string {
  const currentClassDef = getClassDefinition(progress.currentClass);
  const currentRank = getDisplayedClassRank(progress, progress.currentClass);

  return `
    <section class="class-manage-summary">
      <div class="class-manage-summary-card">
        <span class="class-manage-summary-label">Current Class</span>
        <span class="class-manage-summary-value">${currentClassDef.name}</span>
      </div>
      <div class="class-manage-summary-card">
        <span class="class-manage-summary-label">Class Rank</span>
        <span class="class-manage-summary-value">RANK ${getClassRankLetter(currentRank)}</span>
      </div>
      <div class="class-manage-summary-card">
        <span class="class-manage-summary-label">${STAT_SHORT_LABEL}</span>
        <span class="class-manage-summary-value">${statBank}</span>
      </div>
      <div class="class-manage-summary-card">
        <span class="class-manage-summary-label">Unlocked Classes</span>
        <span class="class-manage-summary-value">${formatClassCount(progress)}</span>
      </div>
      <div class="class-manage-summary-card">
        <span class="class-manage-summary-label">Unit PWR</span>
        <span class="class-manage-summary-value">${unit.pwr || 0}</span>
      </div>
    </section>
  `;
}

function renderGridNode(node: ClassGridNode, progress: UnitClassProgress, statBank: number, classId: ClassId): string {
  const unlocked = progress.gridUnlocks?.[classId]?.includes(node.id) ?? false;
  const validation = canUnlockClassGridNode(progress, classId, node.id);
  const available = !unlocked && validation.ok;
  const affordable = statBank >= node.cost;
  const statusText = unlocked
    ? "UNLOCKED"
    : !available
      ? "LOCKED"
      : affordable
        ? `BUY ${node.cost}`
        : "INSUFFICIENT";
  const disabled = unlocked || !available || !affordable;
  const statusClass = unlocked
    ? "class-grid-node--unlocked"
    : available && affordable
      ? "class-grid-node--available"
      : "class-grid-node--locked";

  return `
    <button
      class="class-grid-node ${statusClass}"
      type="button"
      data-grid-node-id="${node.id}"
      ${disabled ? "disabled" : ""}
      style="grid-column:${node.col}; grid-row:${node.row};"
      title="${unlocked ? "Already unlocked" : validation.reason || node.description}"
    >
      <span class="class-grid-node__cost">${node.cost} ${STAT_SHORT_LABEL}</span>
      <span class="class-grid-node__name">${node.name}</span>
      <span class="class-grid-node__desc">${node.description}</span>
      <span class="class-grid-node__benefit">${node.benefit || "Training node"}</span>
      <span class="class-grid-node__status">${statusText}</span>
    </button>
  `;
}

function renderCurrentClassGrid(unit: Unit, progress: UnitClassProgress, statBank: number): string {
  const classDef = getClassDefinition(progress.currentClass);
  const gridNodes = getClassAbilityGrid(progress.currentClass);
  const unlockedCount = progress.gridUnlocks?.[progress.currentClass]?.length || 0;
  const rank = getDisplayedClassRank(progress, progress.currentClass);

  return `
    <section class="class-grid-panel">
      <div class="class-grid-panel__header">
        <div>
          <div class="class-grid-panel__eyebrow">CURRENT TRAINING GRID</div>
          <div class="class-grid-panel__title">${classDef.name}</div>
        </div>
        <div class="class-grid-panel__rank">RANK ${getClassRankLetter(rank)} • ${unlockedCount}/${gridNodes.length} nodes</div>
      </div>
      <div class="class-grid-panel__intro">
        <div class="class-grid-panel__description">${classDef.description}</div>
        <div class="class-grid-panel__details">
          <span>Weapons: ${classDef.weaponTypes.join(" / ").toUpperCase()}</span>
          ${classDef.innateAbility ? `<span>Innate: ${classDef.innateAbility}</span>` : ""}
          <span>${unit.name} spends from the shared ${STAT_SHORT_LABEL} bank.</span>
        </div>
      </div>
      <div class="class-grid-board">
        ${gridNodes.map((node) => renderGridNode(node, progress, statBank, progress.currentClass)).join("")}
      </div>
    </section>
  `;
}

function renderClassCard(classId: ClassId, progress: UnitClassProgress): string {
  const classDef = getClassDefinition(classId);
  const unlocked = isClassUnlocked(classId, progress);
  const current = progress.currentClass === classId;
  const classRank = getDisplayedClassRank(progress, classId);
  const requirements = getUnlockRequirementsText(classId);
  const highestUnlockedTier = progress.unlockedClasses.reduce((maxTier, unlockedClassId) => {
    return Math.max(maxTier, getClassDefinition(unlockedClassId).tier);
  }, 0);
  const isFutureTier = classDef.tier > highestUnlockedTier;

  if (isFutureTier && !current) {
    return `
      <article class="class-manage-card class-manage-card--locked class-manage-card--mystery">
        <div class="class-manage-card__header">
          <div>
            <div class="class-manage-card__title">???</div>
            <div class="class-manage-card__meta">Tier ${classDef.tier} • Hidden</div>
          </div>
          <div class="class-manage-card__badges">
            <span class="class-manage-card__badge">SEALED</span>
          </div>
        </div>
        <div class="class-manage-card__body">
          <div class="class-manage-card__description">
            Further class data is obscured until your squad pushes deeper into this branch.
          </div>
          <div class="class-manage-card__weapons">Weapons: ???</div>
          <div class="class-manage-card__requirements">
            <span>Reach a higher class tier to reveal this job.</span>
          </div>
        </div>
      </article>
    `;
  }

  return `
    <article class="class-manage-card ${current ? "class-manage-card--current" : ""} ${!unlocked ? "class-manage-card--locked" : ""}">
      <div class="class-manage-card__header">
        <div>
          <div class="class-manage-card__title">${classDef.name}</div>
          <div class="class-manage-card__meta">Tier ${classDef.tier} • Rank ${getClassRankLetter(classRank)}</div>
        </div>
        <div class="class-manage-card__badges">
          ${current ? `<span class="class-manage-card__badge class-manage-card__badge--current">ACTIVE</span>` : ""}
          ${!unlocked ? `<span class="class-manage-card__badge">LOCKED</span>` : ""}
        </div>
      </div>
      <div class="class-manage-card__body">
        <div class="class-manage-card__description">${classDef.description}</div>
        <div class="class-manage-card__weapons">Weapons: ${classDef.weaponTypes.join(" / ").toUpperCase()}</div>
        ${classDef.innateAbility ? `<div class="class-manage-card__innate">${classDef.innateAbility}</div>` : ""}
        ${!unlocked && requirements.length > 0 ? `
          <div class="class-manage-card__requirements">
            ${requirements.map((requirement) => `<span>${requirement}</span>`).join("")}
          </div>
        ` : ""}
      </div>
      ${unlocked && !current ? `
        <button class="class-manage-card__action" type="button" data-class-id="${classId}">
          SET ACTIVE
        </button>
      ` : ""}
    </article>
  `;
}

function renderClassDirectory(progress: UnitClassProgress): string {
  const tiers = [0, 1, 2, 3] as const;
  const tierNames = ["Starter", "Core Unlocks", "Job Branches", "Elite Hybrids"];

  return `
    <section class="class-directory-panel">
      <div class="class-grid-panel__header">
        <div>
          <div class="class-grid-panel__eyebrow">CLASS DIRECTORY</div>
          <div class="class-grid-panel__title">Switch Active Class</div>
        </div>
      </div>
      ${tiers.map((tier) => `
        <div class="class-directory-tier">
          <div class="class-directory-tier__title">${tierNames[tier]}</div>
          <div class="class-directory-tier__grid">
            ${getClassesByTier(tier).map((classId) => renderClassCard(classId, progress)).join("")}
          </div>
        </div>
      `).join("")}
    </section>
  `;
}

function renderClassManagementBody(unit: Unit, progress: UnitClassProgress, statBank: number): string {
  const currentClassDef = getClassDefinition(progress.currentClass);

  return `
    <div class="class-change-body class-manage-body">
      ${renderSummaryPanel(unit, progress, statBank)}
      <div class="class-manage-layout">
        ${renderCurrentClassGrid(unit, progress, statBank)}
        ${renderClassDirectory(progress)}
      </div>
      <div class="class-manage-footer-note">
        ${currentClassDef.name} nodes raise class mastery and PWR. Promotions open automatically when their rank gates are met.
      </div>
    </div>
  `;
}

function buildUpdatedUnit(state: GameState, unitId: UnitId, nextProgress: UnitClassProgress, nextClassId: ClassId = nextProgress.currentClass): Unit {
  const unit = state.unitsById[unitId];
  const nextClassDef = getClassDefinition(nextClassId);
  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const nextStats = {
    ...((unit as any).stats || {}),
    maxHp: nextClassDef.baseStats.maxHp,
    atk: nextClassDef.baseStats.atk,
    def: nextClassDef.baseStats.def,
    agi: nextClassDef.baseStats.agi,
    acc: nextClassDef.baseStats.acc,
  };
  const baseUnit = {
    ...unit,
    unitClass: nextClassId,
    stats: nextStats,
    maxHp: nextClassDef.baseStats.maxHp,
    hp: Math.min(unit.hp, nextClassDef.baseStats.maxHp),
    agi: nextClassDef.baseStats.agi,
  };

  return {
    ...baseUnit,
    pwr: calculatePWR({
      unit: baseUnit,
      unitClassProgress: nextProgress,
      equipmentById,
    }),
  } as Unit;
}

function setActiveClass(unitId: UnitId, classId: ClassId, returnTo: ClassChangeReturnTo): void {
  updateGameState((prev) => {
    const progress = getNormalizedProgress(prev, unitId);
    if (!isClassUnlocked(classId, progress)) {
      return prev;
    }

    const nextProgress = unlockEligibleClasses(changeUnitClass(progress, classId));
    const updatedUnit = buildUpdatedUnit(prev, unitId, nextProgress, classId);

    return {
      ...prev,
      unitClassProgress: {
        ...(prev.unitClassProgress || {}),
        [unitId]: nextProgress,
      },
      unitsById: {
        ...prev.unitsById,
        [unitId]: updatedUnit,
      },
    } as GameState;
  });

  renderClassChangeScreen(unitId, returnTo);
}

function unlockGridNode(unitId: UnitId, nodeId: string, returnTo: ClassChangeReturnTo): void {
  updateGameState((prev) => {
    const progress = getNormalizedProgress(prev, unitId);
    const currentClass = progress.currentClass;
    const validation = canUnlockClassGridNode(progress, currentClass, nodeId);
    if (!validation.ok || !validation.node) {
      return prev;
    }

    const statBank = getStatBank(prev);
    if (statBank < validation.node.cost) {
      return prev;
    }

    const nextProgress = unlockEligibleClasses(purchaseClassGridNode(progress, currentClass, nodeId));
    const updatedUnit = buildUpdatedUnit(prev, unitId, nextProgress);
    const nextState = spendStatTokens({
      ...prev,
      unitClassProgress: {
        ...(prev.unitClassProgress || {}),
        [unitId]: nextProgress,
      },
      unitsById: {
        ...prev.unitsById,
        [unitId]: updatedUnit,
      },
    } as GameState, validation.node.cost);

    return nextState;
  });

  renderClassChangeScreen(unitId, returnTo);
}

function attachEventListeners(unitId: UnitId, progress: UnitClassProgress, returnTo: ClassChangeReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  registerClassChangeReturnHotkey(unitId, returnTo);

  root.querySelector(".class-change-back-btn")?.addEventListener("click", () => {
    unregisterClassChangeReturnHotkey();
    renderUnitDetailScreen(unitId, returnTo);
  });

  root.querySelectorAll<HTMLElement>("[data-class-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const classId = button.getAttribute("data-class-id") as ClassId | null;
      if (!classId || classId === progress.currentClass) return;
      setActiveClass(unitId, classId, returnTo);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-grid-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const nodeId = button.getAttribute("data-grid-node-id");
      if (!nodeId) return;
      unlockGridNode(unitId, nodeId, returnTo);
    });
  });
}

export function renderClassChangeScreen(unitId: UnitId, returnTo: ClassChangeReturnTo = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const unit = state.unitsById[unitId];
  if (!unit) {
    root.innerHTML = `<div class="error">Unit not found</div>`;
    return;
  }

  const progress = getNormalizedProgress(state, unitId);
  const statBank = getStatBank(state);
  const currentClassDef = getClassDefinition(progress.currentClass);

  root.innerHTML = `
    <div class="class-change-root ard-noise">
      <div class="class-change-card">
        <div class="class-change-header">
          <div class="class-change-header-left">
            <h1 class="class-change-title">${unit.name} - CLASS MANAGEMENT</h1>
            <div class="class-change-subtitle">
              S/COM_OS // CLASS_SYSTEM • Current: ${currentClassDef.name} • Shared ${STAT_SHORT_LABEL} bank
            </div>
          </div>
          <div class="class-change-header-right">
            <button class="class-change-back-btn">
              <span class="btn-icon">←</span>
              <span class="btn-text">BACK TO UNIT</span>
            </button>
          </div>
        </div>
        ${renderClassManagementBody(unit, progress, statBank)}
      </div>
    </div>
  `;

  attachEventListeners(unitId, progress, returnTo);
}
