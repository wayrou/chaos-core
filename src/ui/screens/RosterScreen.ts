// ============================================================================
// ROSTER SCREEN - Unit list with stats and equipment overview
// Headline 11b: Unit customization, roster, stats, and current decks
// ============================================================================

import { getGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderUnitDetailScreen } from "./UnitDetailScreen";
import {
  UnitLoadout,
  calculateEquipmentStats,
  getAllStarterEquipment,
  getAllModules,
  buildDeckFromLoadout,
  UnitClass,
} from "../../core/equipment";

function formatClassName(cls: UnitClass): string {
  const names: Record<UnitClass, string> = {
    squire: "Squire",
    sentry: "Sentry",
    paladin: "Paladin",
    watchGuard: "Watch Guard",
    ranger: "Ranger",
    hunter: "Hunter",
    bowmaster: "Bowmaster",
    trapper: "Trapper",
    magician: "Magician",
    cleric: "Cleric",
    wizard: "Wizard",
    chaosmancer: "Chaosmancer",
    thief: "Thief",
    scout: "Scout",
    shadow: "Shadow",
    trickster: "Trickster",
    academic: "Academic",
    freelancer: "Freelancer",
  };
  return names[cls] || cls;
}

function formatStatDiff(diff: number): string {
  if (diff > 0) return `<span class="stat-bonus">+${diff}</span>`;
  if (diff < 0) return `<span class="stat-penalty">${diff}</span>`;
  return "";
}

export function renderRosterScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const units = state.unitsById;
  const unitIds = Object.keys(units);
  const partyUnitIds = state.partyUnitIds || [];

  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const modulesById = (state as any).modulesById || getAllModules();

  const unitCardsHtml = unitIds
    .map((unitId) => {
      const unit = units[unitId];
      if (!unit) return "";

      const isInParty = partyUnitIds.includes(unitId);
      const loadout: UnitLoadout = (unit as any).loadout || {
        weapon: null,
        helmet: null,
        chestpiece: null,
        accessory1: null,
        accessory2: null,
      };

      const weaponId = loadout.weapon;
      const weapon = weaponId ? equipmentById[weaponId] : null;
      const weaponName = weapon ? weapon.name : "None";

      const equipStats = calculateEquipmentStats(loadout, equipmentById, modulesById);
      const unitClass: UnitClass = (unit as any).unitClass || "squire";
      const deck = buildDeckFromLoadout(unitClass, loadout, equipmentById, modulesById);
      const deckSize = deck.length;

      const baseStats = unit.stats || { maxHp: 20, atk: 5, def: 3, agi: 4, acc: 80 };
      const totalAtk = baseStats.atk + equipStats.atk;
      const totalDef = baseStats.def + equipStats.def;
      const totalAgi = baseStats.agi + equipStats.agi;
      const totalAcc = baseStats.acc + equipStats.acc;
      const totalHp = baseStats.maxHp + equipStats.hp;

      return `
        <div class="roster-unit-card ${isInParty ? "roster-unit-card--in-party" : ""}" data-unit-id="${unitId}">
          <div class="roster-unit-header">
            <div class="roster-unit-name">${unit.name}</div>
            <div class="roster-unit-class">${formatClassName(unitClass)}</div>
          </div>
          <div class="roster-unit-body">
            <div class="roster-unit-stats">
              <div class="roster-stat">
                <span class="roster-stat-label">HP</span>
                <span class="roster-stat-value">${totalHp}</span>
                ${formatStatDiff(equipStats.hp)}
              </div>
              <div class="roster-stat">
                <span class="roster-stat-label">ATK</span>
                <span class="roster-stat-value">${totalAtk}</span>
                ${formatStatDiff(equipStats.atk)}
              </div>
              <div class="roster-stat">
                <span class="roster-stat-label">DEF</span>
                <span class="roster-stat-value">${totalDef}</span>
                ${formatStatDiff(equipStats.def)}
              </div>
              <div class="roster-stat">
                <span class="roster-stat-label">AGI</span>
                <span class="roster-stat-value">${totalAgi}</span>
                ${formatStatDiff(equipStats.agi)}
              </div>
              <div class="roster-stat">
                <span class="roster-stat-label">ACC</span>
                <span class="roster-stat-value">${totalAcc}</span>
                ${formatStatDiff(equipStats.acc)}
              </div>
            </div>
            <div class="roster-unit-equip">
              <div class="roster-equip-row">
                <span class="roster-equip-label">WEAPON</span>
                <span class="roster-equip-value">${weaponName}</span>
              </div>
              <div class="roster-equip-row">
                <span class="roster-equip-label">DECK</span>
                <span class="roster-equip-value">${deckSize} cards</span>
              </div>
            </div>
          </div>
          <div class="roster-unit-footer">
            ${isInParty ? '<span class="roster-party-badge">IN PARTY</span>' : ""}
            <button class="roster-detail-btn" data-unit-id="${unitId}">MANAGE</button>
          </div>
        </div>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="roster-root">
      <div class="roster-card">
        <div class="roster-header">
          <div class="roster-header-left">
            <div class="roster-title">UNIT ROSTER</div>
            <div class="roster-subtitle">Manage units, equipment, and decks</div>
          </div>
          <div class="roster-header-right">
            <div class="roster-count">${unitIds.length} UNITS / ${partyUnitIds.length} IN PARTY</div>
            <button class="roster-back-btn">BACK TO BASE CAMP</button>
          </div>
        </div>
        <div class="roster-body">
          <div class="roster-grid">
            ${unitCardsHtml}
          </div>
        </div>
        <div class="roster-footer">
          <div class="roster-legend">
            <span class="roster-legend-item">
              <span class="roster-legend-dot roster-legend-dot--party"></span>
              In Party
            </span>
            <span class="roster-legend-item">
              <span class="roster-legend-dot roster-legend-dot--reserve"></span>
              Reserve
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector(".roster-back-btn")?.addEventListener("click", () => {
    renderBaseCampScreen();
  });

  root.querySelectorAll(".roster-detail-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const unitId = (e.target as HTMLElement).getAttribute("data-unit-id");
      if (unitId) {
        renderUnitDetailScreen(unitId);
      }
    });
  });

  root.querySelectorAll(".roster-unit-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("roster-detail-btn")) return;
      const unitId = (card as HTMLElement).getAttribute("data-unit-id");
      if (unitId) {
        renderUnitDetailScreen(unitId);
      }
    });
  });
}