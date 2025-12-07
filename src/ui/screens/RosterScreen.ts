// ============================================================================
// ROSTER SCREEN - Unit list with stats and equipment overview
// Headline 11b: Unit customization, roster, stats, and current decks
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderUnitDetailScreen } from "./UnitDetailScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { getPWRBand, getPWRBandColor } from "../../core/pwr";

import {
  UnitLoadout,
  calculateEquipmentStats,
  getAllStarterEquipment,
  getAllModules,
  buildDeckFromLoadout,
  UnitClass,
  CLASS_WEAPON_RESTRICTIONS,
} from "../../core/equipment";
import { getUnitPortraitPath } from "../../core/portraits";

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

export function renderRosterScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
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
      const portraitPath = getUnitPortraitPath(unitId);
      
      // PWR display
      const pwr = (unit as any).pwr || 0;
      const pwrBand = getPWRBand(pwr);
      const pwrColor = getPWRBandColor(pwr);

      return `
        <div class="roster-unit-card ${isInParty ? "roster-unit-card--in-party" : ""}" data-unit-id="${unitId}">
          <div class="roster-unit-header">
            <div class="roster-unit-portrait">
              <img src="${portraitPath}" alt="${unit.name}" class="roster-unit-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
            </div>
            <div class="roster-unit-header-text">
              <div class="roster-unit-name">${unit.name}</div>
              <div class="roster-unit-class">${formatClassName(unitClass)}</div>
              <div class="roster-unit-pwr" style="color: ${pwrColor}">
                <span class="roster-pwr-label">PWR:</span>
                <span class="roster-pwr-value">${pwr}</span>
                <span class="roster-pwr-band">(${pwrBand})</span>
              </div>
            </div>
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
            <button class="roster-detail-btn" data-unit-id="${unitId}" type="button">MANAGE</button>
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
            <button class="roster-back-btn" data-return-to="${returnTo}">${returnTo === "field" ? "BACK TO FIELD MODE" : "BACK TO BASE CAMP"}</button>
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
          <div class="roster-debug">
            <button class="roster-debug-btn" id="debugEquipBtn">🔧 DEBUG: Give All Equipment</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachRosterListeners(root, returnTo);
}

function attachRosterListeners(root: HTMLElement, returnTo: "basecamp" | "field"): void {
  // Use setTimeout to ensure DOM is fully rendered
  setTimeout(() => {
    // Back button
    const backBtn = root.querySelector(".roster-back-btn");
    if (backBtn) {
      (backBtn as HTMLElement).onclick = () => {
        const btn = backBtn as HTMLElement;
        const returnDestination = btn?.getAttribute("data-return-to") || returnTo;
        console.log(`[ROSTER] Back button clicked, returning to: ${returnDestination}`);
        if (returnDestination === "field") {
          renderFieldScreen("base_camp");
        } else {
          renderBaseCampScreen();
        }
      };
    } else {
      console.warn("[ROSTER] Back button not found");
    }

    // Manage buttons - use both onclick and addEventListener for maximum compatibility
    const manageButtons = root.querySelectorAll(".roster-detail-btn");
    console.log(`[ROSTER] Found ${manageButtons.length} manage buttons`);
    
    if (manageButtons.length === 0) {
      console.error("[ROSTER] No manage buttons found in DOM!");
    }
    
    manageButtons.forEach((btn, index) => {
      const button = btn as HTMLElement;
      const unitId = button.getAttribute("data-unit-id");
      
      if (!unitId) {
        console.warn(`[ROSTER] Button ${index} has no data-unit-id attribute`);
      }
      
      // Clear any existing handlers
      button.onclick = null;
      
      // Use onclick as primary handler (more reliable)
      button.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log(`[ROSTER] Manage button ${index} clicked (onclick), unitId: ${unitId}`);
        if (unitId) {
          try {
            renderUnitDetailScreen(unitId);
          } catch (error) {
            console.error("[ROSTER] Error opening unit detail screen:", error);
            alert(`Error opening unit detail: ${error}`);
          }
        } else {
          console.error(`[ROSTER] Button ${index} has no unit-id!`);
          alert("Error: Unit ID not found on button");
        }
      };
      
      // Also add event listener as backup
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log(`[ROSTER] Manage button ${index} clicked (addEventListener), unitId: ${unitId}`);
        if (unitId) {
          try {
            renderUnitDetailScreen(unitId);
          } catch (error) {
            console.error("[ROSTER] Error opening unit detail screen:", error);
          }
        }
      }, { once: false, passive: false });
      
      // Ensure button is clickable
      button.style.pointerEvents = "auto";
      button.style.cursor = "pointer";
      button.style.zIndex = "10";
    });

    // Unit cards - click anywhere on card to open detail
    const unitCards = root.querySelectorAll(".roster-unit-card");
    console.log(`[ROSTER] Found ${unitCards.length} unit cards`);
    
    unitCards.forEach((card, index) => {
      const cardEl = card as HTMLElement;
      const unitId = cardEl.getAttribute("data-unit-id");
      
      // Use onclick for reliability
      cardEl.onclick = (e) => {
        const target = e.target as HTMLElement;
        // Don't open if clicking on the button
        if (target.closest(".roster-detail-btn")) {
          return;
        }
        console.log(`[ROSTER] Unit card ${index} clicked, unitId: ${unitId}`);
        if (unitId) {
          try {
            renderUnitDetailScreen(unitId);
          } catch (error) {
            console.error("[ROSTER] Error opening unit detail screen:", error);
          }
        }
      };
      
      // Also add event listener
      card.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".roster-detail-btn")) {
          return;
        }
        const unitId = cardEl.getAttribute("data-unit-id");
        if (unitId) {
          try {
            renderUnitDetailScreen(unitId);
          } catch (error) {
            console.error("[ROSTER] Error opening unit detail screen:", error);
          }
        }
      });
    });
  }, 0);

  // Debug button to give all equipment to all units
  root.querySelector("#debugEquipBtn")?.addEventListener("click", () => {
    if (confirm("Give all starter equipment to all units for testing?")) {
      updateGameState(draft => {
        // Give resources
        draft.wad = 9999;
        if (!draft.resources) {
          draft.resources = { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };
        }
        draft.resources.metalScrap = 99;
        draft.resources.wood = 99;
        draft.resources.chaosShards = 99;
        draft.resources.steamComponents = 99;

        // Get all starter equipment
        const allEquipment = getAllStarterEquipment();

        // Add all equipment to equipmentById
        if (!draft.equipmentById) draft.equipmentById = {};
        Object.assign(draft.equipmentById, allEquipment);

        // Equip all units with compatible gear
        Object.keys(draft.unitsById).forEach(unitId => {
          const unit = draft.unitsById[unitId];
          const unitClass: UnitClass = (unit as any).unitClass || "squire";

          if (!unit.loadout) {
            (unit as any).loadout = {
              weapon: null,
              helmet: null,
              chestpiece: null,
              accessory1: null,
              accessory2: null,
            };
          }

          // Find a compatible weapon for this class
          const weapons = Object.values(allEquipment).filter(eq => eq.slot === "weapon");
          const compatibleWeapon = weapons.find(w => {
            const weaponType = (w as any).weaponType;
            const allowed = CLASS_WEAPON_RESTRICTIONS[unitClass];
            return allowed?.includes(weaponType);
          });

          if (compatibleWeapon) {
            (unit as any).loadout.weapon = compatibleWeapon.id;
          }

          // Equip first helmet
          const helmet = Object.values(allEquipment).find(eq => eq.slot === "helmet");
          if (helmet) {
            (unit as any).loadout.helmet = helmet.id;
          }

          // Equip first chestpiece
          const chestpiece = Object.values(allEquipment).find(eq => eq.slot === "chestpiece");
          if (chestpiece) {
            (unit as any).loadout.chestpiece = chestpiece.id;
          }

          // Equip first two accessories
          const accessories = Object.values(allEquipment).filter(eq => eq.slot === "accessory");
          if (accessories.length > 0) {
            (unit as any).loadout.accessory1 = accessories[0].id;
          }
          if (accessories.length > 1) {
            (unit as any).loadout.accessory2 = accessories[1].id;
          }
        });
      });

      // Re-render to show updated equipment
      renderRosterScreen();
    }
  });
}