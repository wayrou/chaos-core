// ============================================================================
// UNIT DETAIL SCREEN - Individual unit equipment and deck management
// Headline 11b & 11c: Equipment slots, deck building from equipment
// Updated: Added CUSTOMIZE button for Gear Workbench (11da)
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderRosterScreen } from "./RosterScreen";
import { renderGearWorkbenchScreen } from "./GearWorkbenchScreen";
import { saveGame, loadGame } from "../../core/saveSystem";
import { getSettings, updateSettings } from "../../core/settings";
import { initControllerSupport } from "../../core/controllerSupport";

import {
  Equipment,
  WeaponEquipment,
  UnitLoadout,
  EquipSlot,
  UnitClass,
  calculateEquipmentStats,
  getAllStarterEquipment,
  getAllModules,
  getAllEquipmentCards,
  buildDeckFromLoadout,
  canEquipWeapon,
  EquipmentCard,
} from "../../core/equipment";
import { getUnitPortraitPath } from "../../core/portraits";
import { getPWRBand, getPWRBandColor, calculatePWR } from "../../core/pwr";

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

function formatSlotName(slot: EquipSlot): string {
  const names: Record<EquipSlot, string> = {
    weapon: "Weapon",
    helmet: "Helmet",
    chestpiece: "Chestpiece",
    accessory1: "Accessory 1",
    accessory2: "Accessory 2",
  };
  return names[slot] || slot;
}

function formatStatWithSign(val: number): string {
  if (val > 0) return `+${val}`;
  if (val < 0) return `${val}`;
  return "0";
}

export function renderUnitDetailScreen(unitId: string): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const unit = state.unitsById[unitId];
  if (!unit) {
    renderRosterScreen();
    return;
  }

  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const modulesById = (state as any).modulesById || getAllModules();
  const cardsById = getAllEquipmentCards();

  const unitClass: UnitClass = (unit as any).unitClass || "squire";
  const loadout: UnitLoadout = (unit as any).loadout || {
    weapon: null,
    helmet: null,
    chestpiece: null,
    accessory1: null,
    accessory2: null,
  };

  const baseStats = unit.stats || { maxHp: 20, atk: 5, def: 3, agi: 4, acc: 80 };
  const equipStats = calculateEquipmentStats(loadout, equipmentById, modulesById);
  const deck = buildDeckFromLoadout(unitClass, loadout, equipmentById, modulesById);

  const totalAtk = baseStats.atk + equipStats.atk;
  const totalDef = baseStats.def + equipStats.def;
  const totalAgi = baseStats.agi + equipStats.agi;
  const totalAcc = baseStats.acc + equipStats.acc;
  const totalHp = baseStats.maxHp + equipStats.hp;

  const equipmentPool = (state as any).equipmentPool || Object.keys(equipmentById);

  const slots: EquipSlot[] = ["weapon", "helmet", "chestpiece", "accessory1", "accessory2"];

  const equipSlotsHtml = slots
    .map((slot) => {
      const equipId = loadout[slot];
      const equip = equipId ? equipmentById[equipId] : null;

      let equipName = "Empty";
      let equipStatsStr = "";
      let cardsGranted = "";

      if (equip) {
        equipName = equip.name;
        const s = equip.stats;
        const statParts: string[] = [];
        if (s.atk !== 0) statParts.push(`ATK ${formatStatWithSign(s.atk)}`);
        if (s.def !== 0) statParts.push(`DEF ${formatStatWithSign(s.def)}`);
        if (s.agi !== 0) statParts.push(`AGI ${formatStatWithSign(s.agi)}`);
        if (s.acc !== 0) statParts.push(`ACC ${formatStatWithSign(s.acc)}`);
        if (s.hp !== 0) statParts.push(`HP ${formatStatWithSign(s.hp)}`);
        equipStatsStr = statParts.join(" / ");
        cardsGranted = `${equip.cardsGranted.length} cards`;
      }

      return `
        <div class="equip-slot" data-slot="${slot}">
          <div class="equip-slot-header">
            <span class="equip-slot-label">${formatSlotName(slot)}</span>
            <div class="equip-slot-actions">
              ${equipId ? `<button class="equip-unequip-btn" data-slot="${slot}">UNEQUIP</button>` : ""}
            </div>
          </div>
          <div class="equip-slot-body ${equip ? "" : "equip-slot-body--empty"}">
            <div class="equip-slot-name">${equipName}</div>
            ${equipStatsStr ? `<div class="equip-slot-stats">${equipStatsStr}</div>` : ""}
            ${cardsGranted ? `<div class="equip-slot-cards">${cardsGranted}</div>` : ""}
          </div>
          <div class="equip-slot-buttons">
            <button class="equip-change-btn" data-slot="${slot}">
              ${equip ? "CHANGE" : "EQUIP"}
            </button>
            ${equipId && slot === "weapon" ? `
              <button class="equip-view-weapon-btn"
                      data-weapon-id="${equipId}"
                      title="View weapon details and diagrams">
                📊 VIEW
              </button>
            ` : ""}
            ${equipId ? `
              <button class="equip-customize-btn"
                      data-slot="${slot}"
                      data-unit-id="${unitId}"
                      data-equipment-id="${equipId}"
                      title="Customize card slots for this gear">
                🔧 CUSTOMIZE
              </button>
            ` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  const cardCounts: Record<string, number> = {};
  for (const cardId of deck) {
    cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
  }

  const deckCardsHtml = Object.entries(cardCounts)
    .map(([cardId, count]) => {
      const card = cardsById[cardId];
      if (!card) return "";

      const typeClass = `deck-card--${card.type}`;
      return `
        <div class="deck-card ${typeClass}">
          <div class="deck-card-header">
            <span class="deck-card-name">${card.name}</span>
            <span class="deck-card-cost">${card.strainCost}</span>
          </div>
          <div class="deck-card-type">${card.type.toUpperCase()}</div>
          <div class="deck-card-desc">${card.description}</div>
          ${count > 1 ? `<div class="deck-card-count">x${count}</div>` : ""}
        </div>
      `;
    })
    .join("");

  const portraitPath = getUnitPortraitPath(unitId);

  // Calculate PWR for the unit
  const pwr = (unit as any).pwr ?? calculatePWR({
    unit,
    equipmentById,
    modulesById,
  });
  const pwrBand = getPWRBand(pwr);
  const pwrColor = getPWRBandColor(pwr);

  root.innerHTML = `
    <div class="unitdetail-root">
      <div class="unitdetail-card">
        <div class="unitdetail-header">
          <div class="unitdetail-header-left">
            <div class="unitdetail-portrait">
              <img src="${portraitPath}" alt="${unit.name}" class="unitdetail-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
            </div>
            <div class="unitdetail-header-text">
              <div class="unitdetail-name">${unit.name}</div>
              <div class="unitdetail-class">${formatClassName(unitClass)}</div>
              <div class="unitdetail-pwr" style="color: ${pwrColor}">
                <span class="unitdetail-pwr-label">PWR:</span>
                <span class="unitdetail-pwr-value">${pwr}</span>
                <span class="unitdetail-pwr-band">(${pwrBand})</span>
              </div>
            </div>
          </div>
          <div class="unitdetail-header-right">
            <button class="unitdetail-class-btn" id="changeClassBtn">
              🎭 CHANGE CLASS
            </button>
            <button class="unitdetail-back-btn">BACK TO ROSTER</button>
          </div>
        </div>

        <div class="unitdetail-body">
          <div class="unitdetail-left">
            <div class="unitdetail-section">
              <div class="unitdetail-section-title">STATS</div>
              <div class="unitdetail-stats-grid">
                <div class="unitdetail-stat">
                  <span class="unitdetail-stat-label">HP</span>
                  <span class="unitdetail-stat-base">${baseStats.maxHp}</span>
                  <span class="unitdetail-stat-equip ${equipStats.hp >= 0 ? "stat-bonus" : "stat-penalty"}">${formatStatWithSign(equipStats.hp)}</span>
                  <span class="unitdetail-stat-total">= ${totalHp}</span>
                </div>
                <div class="unitdetail-stat">
                  <span class="unitdetail-stat-label">ATK</span>
                  <span class="unitdetail-stat-base">${baseStats.atk}</span>
                  <span class="unitdetail-stat-equip ${equipStats.atk >= 0 ? "stat-bonus" : "stat-penalty"}">${formatStatWithSign(equipStats.atk)}</span>
                  <span class="unitdetail-stat-total">= ${totalAtk}</span>
                </div>
                <div class="unitdetail-stat">
                  <span class="unitdetail-stat-label">DEF</span>
                  <span class="unitdetail-stat-base">${baseStats.def}</span>
                  <span class="unitdetail-stat-equip ${equipStats.def >= 0 ? "stat-bonus" : "stat-penalty"}">${formatStatWithSign(equipStats.def)}</span>
                  <span class="unitdetail-stat-total">= ${totalDef}</span>
                </div>
                <div class="unitdetail-stat">
                  <span class="unitdetail-stat-label">AGI</span>
                  <span class="unitdetail-stat-base">${baseStats.agi}</span>
                  <span class="unitdetail-stat-equip ${equipStats.agi >= 0 ? "stat-bonus" : "stat-penalty"}">${formatStatWithSign(equipStats.agi)}</span>
                  <span class="unitdetail-stat-total">= ${totalAgi}</span>
                </div>
                <div class="unitdetail-stat">
                  <span class="unitdetail-stat-label">ACC</span>
                  <span class="unitdetail-stat-base">${baseStats.acc}</span>
                  <span class="unitdetail-stat-equip ${equipStats.acc >= 0 ? "stat-bonus" : "stat-penalty"}">${formatStatWithSign(equipStats.acc)}</span>
                  <span class="unitdetail-stat-total">= ${totalAcc}</span>
                </div>
              </div>
            </div>

            <div class="unitdetail-section">
              <div class="unitdetail-section-title">EQUIPMENT (5 SLOTS)</div>
              <div class="equip-slots-grid">
                ${equipSlotsHtml}
              </div>
            </div>
          </div>

          <div class="unitdetail-right">
            <div class="unitdetail-section">
              <div class="unitdetail-section-title">COMPILED DECK (${deck.length} CARDS)</div>
              <div class="deck-grid">
                ${deckCardsHtml || '<div class="deck-empty">No cards in deck. Equip gear to add cards.</div>'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="equip-modal" id="equipModal" style="display: none;">
        <div class="equip-modal-content">
          <div class="equip-modal-header">
            <span class="equip-modal-title">SELECT EQUIPMENT</span>
            <button class="equip-modal-close">&times;</button>
          </div>
          <div class="equip-modal-body" id="equipModalBody">
          </div>
        </div>
      </div>

      <div class="weapon-detail-modal" id="weaponDetailModal" style="display: none;">
        <div class="weapon-detail-modal-content">
          <div class="weapon-detail-modal-header">
            <span class="weapon-detail-modal-title">WEAPON DETAILS</span>
            <button class="weapon-detail-modal-close">&times;</button>
          </div>
          <div class="weapon-detail-modal-body" id="weaponDetailModalBody">
          </div>
        </div>
      </div>
    </div>
  `;

  // --- EVENT LISTENERS ---

  // Back to roster
  root.querySelector(".unitdetail-back-btn")?.addEventListener("click", () => {
    renderRosterScreen();
  });

  // Change Class button
  root.querySelector("#changeClassBtn")?.addEventListener("click", () => {
    // Import dynamically to avoid circular dependencies
    import("./ClassChangeScreen").then(({ renderClassChangeScreen }) => {
      renderClassChangeScreen(unitId);
    });
  });

  // Change/Equip buttons
  root.querySelectorAll(".equip-change-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const slot = (e.target as HTMLElement).getAttribute("data-slot") as EquipSlot;
      if (slot) {
        openEquipModal(unitId, slot, unitClass, loadout, equipmentById, equipmentPool);
      }
    });
  });

  // Unequip buttons
  root.querySelectorAll(".equip-unequip-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slot = (e.target as HTMLElement).getAttribute("data-slot") as EquipSlot;
      if (slot) {
        unequipItem(unitId, slot);
      }
    });
  });

  // VIEW WEAPON buttons - Opens weapon detail modal
  root.querySelectorAll(".equip-view-weapon-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const weaponId = el.getAttribute("data-weapon-id");
      if (weaponId) {
        openWeaponDetailModal(weaponId);
      }
    });
  });

  // CUSTOMIZE buttons - Opens Gear Workbench with correct return destination
  root.querySelectorAll(".equip-customize-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const targetUnitId = el.getAttribute("data-unit-id");
      const equipmentId = el.getAttribute("data-equipment-id");
      if (targetUnitId && equipmentId) {
        // Pass "unitdetail" as the return destination so back button returns here
        renderGearWorkbenchScreen(targetUnitId, equipmentId, "unitdetail");
      }
    });
  });

  // Modal close button
  root.querySelector(".equip-modal-close")?.addEventListener("click", () => {
    closeEquipModal();
  });

  // Modal backdrop click
  root.querySelector(".equip-modal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("equip-modal")) {
      closeEquipModal();
    }
  });

  // Weapon detail modal close button
  root.querySelector(".weapon-detail-modal-close")?.addEventListener("click", () => {
    closeWeaponDetailModal();
  });

  // Weapon detail modal backdrop click
  root.querySelector(".weapon-detail-modal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("weapon-detail-modal")) {
      closeWeaponDetailModal();
    }
  });
}

function openEquipModal(
  unitId: string,
  slot: EquipSlot,
  unitClass: UnitClass,
  currentLoadout: UnitLoadout,
  equipmentById: Record<string, Equipment>,
  equipmentPool: string[]
): void {
  const modal = document.getElementById("equipModal");
  const modalBody = document.getElementById("equipModalBody");
  if (!modal || !modalBody) return;

  const currentEquippedIds = [
    currentLoadout.weapon,
    currentLoadout.helmet,
    currentLoadout.chestpiece,
    currentLoadout.accessory1,
    currentLoadout.accessory2,
  ].filter(Boolean) as string[];

  const availableEquipment = equipmentPool
    .map((id) => equipmentById[id])
    .filter((eq): eq is Equipment => {
      if (!eq) return false;
      if (currentEquippedIds.includes(eq.id) && eq.id !== currentLoadout[slot]) return false;

      if (slot === "weapon") {
        if (eq.slot !== "weapon") return false;
        const wep = eq as WeaponEquipment;
        return canEquipWeapon(unitClass, wep.weaponType);
      } else if (slot === "helmet") {
        return eq.slot === "helmet";
      } else if (slot === "chestpiece") {
        return eq.slot === "chestpiece";
      } else if (slot === "accessory1" || slot === "accessory2") {
        return eq.slot === "accessory";
      }
      return false;
    });

  if (availableEquipment.length === 0) {
    modalBody.innerHTML = `
      <div class="equip-modal-empty">
        No available equipment for this slot.
      </div>
    `;
  } else {
    const equipListHtml = availableEquipment
      .map((eq) => {
        const s = eq.stats;
        const statParts: string[] = [];
        if (s.atk !== 0) statParts.push(`ATK ${formatStatWithSign(s.atk)}`);
        if (s.def !== 0) statParts.push(`DEF ${formatStatWithSign(s.def)}`);
        if (s.agi !== 0) statParts.push(`AGI ${formatStatWithSign(s.agi)}`);
        if (s.acc !== 0) statParts.push(`ACC ${formatStatWithSign(s.acc)}`);
        if (s.hp !== 0) statParts.push(`HP ${formatStatWithSign(s.hp)}`);
        const statsStr = statParts.join(" / ") || "No stat bonuses";

        const isCurrent = eq.id === currentLoadout[slot];

        return `
          <div class="equip-option ${isCurrent ? "equip-option--current" : ""}" data-equip-id="${eq.id}">
            <div class="equip-option-name">${eq.name}</div>
			
            <div class="equip-option-stats">${statsStr}</div>
            <div class="equip-option-cards">${eq.cardsGranted.length} cards granted</div>
            ${isCurrent ? '<div class="equip-option-badge">EQUIPPED</div>' : ""}
          </div>
        `;
      })
      .join("");

    modalBody.innerHTML = `
      <div class="equip-modal-slot-label">Selecting for: ${formatSlotName(slot)}</div>
      <div class="equip-options-list">
        ${equipListHtml}
      </div>
    `;

    modalBody.querySelectorAll(".equip-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const equipId = (opt as HTMLElement).getAttribute("data-equip-id");
        if (equipId) {
          equipItem(unitId, slot, equipId);
          closeEquipModal();
        }
      });
    });
  }

  modal.style.display = "flex";
}

function closeEquipModal(): void {
  const modal = document.getElementById("equipModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function openWeaponDetailModal(weaponId: string): void {
  const state = getGameState();
  const equipmentById = (state as any).equipmentById || {};
  const weapon = equipmentById[weaponId] as WeaponEquipment;

  if (!weapon) return;

  const modal = document.getElementById("weaponDetailModal");
  const body = document.getElementById("weaponDetailModalBody");

  if (!modal || !body) return;

  // Render weapon details
  let html = `
    <div class="weapon-detail-content">
      <div class="weapon-detail-header-section">
        <div class="weapon-detail-name">${weapon.name}</div>
        <div class="weapon-detail-type">${weapon.weaponType.toUpperCase()} ${weapon.isMechanical ? "• MECHANICAL" : ""}</div>
      </div>

      <div class="weapon-detail-stats">
        <div class="weapon-detail-stat-row">
          <span class="weapon-detail-stat-label">ATK:</span>
          <span class="weapon-detail-stat-value">${weapon.stats.atk >= 0 ? '+' : ''}${weapon.stats.atk}</span>
        </div>
        <div class="weapon-detail-stat-row">
          <span class="weapon-detail-stat-label">DEF:</span>
          <span class="weapon-detail-stat-value">${weapon.stats.def >= 0 ? '+' : ''}${weapon.stats.def}</span>
        </div>
        <div class="weapon-detail-stat-row">
          <span class="weapon-detail-stat-label">AGI:</span>
          <span class="weapon-detail-stat-value">${weapon.stats.agi >= 0 ? '+' : ''}${weapon.stats.agi}</span>
        </div>
        <div class="weapon-detail-stat-row">
          <span class="weapon-detail-stat-label">ACC:</span>
          <span class="weapon-detail-stat-value">${weapon.stats.acc >= 0 ? '+' : ''}${weapon.stats.acc}</span>
        </div>
        ${weapon.stats.hp !== 0 ? `
          <div class="weapon-detail-stat-row">
            <span class="weapon-detail-stat-label">HP:</span>
            <span class="weapon-detail-stat-value">${weapon.stats.hp >= 0 ? '+' : ''}${weapon.stats.hp}</span>
          </div>
        ` : ''}
      </div>

      <div class="weapon-detail-section">
        <div class="weapon-detail-section-title">CARDS GRANTED (${weapon.cardsGranted.length})</div>
        <div class="weapon-detail-cards">
          ${weapon.cardsGranted.map(cardId => `<div class="weapon-detail-card-name">• ${cardId}</div>`).join('')}
        </div>
      </div>

      ${weapon.clutchToggle ? `
        <div class="weapon-detail-section">
          <div class="weapon-detail-section-title">CLUTCH TOGGLE</div>
          <div class="weapon-detail-clutch">${weapon.clutchToggle}</div>
        </div>
      ` : ''}

      ${weapon.isMechanical && weapon.heatCapacity ? `
        <div class="weapon-detail-section">
          <div class="weapon-detail-section-title">HEAT SYSTEM</div>
          <div class="weapon-detail-heat-info">
            <div class="weapon-detail-heat-row">
              <span>Heat Capacity:</span>
              <span>${weapon.heatCapacity}</span>
            </div>
            ${weapon.passiveHeatDecay ? `
              <div class="weapon-detail-heat-row">
                <span>Passive Decay:</span>
                <span>${weapon.passiveHeatDecay}/turn</span>
              </div>
            ` : ''}
          </div>
          ${weapon.heatZones && weapon.heatZones.length > 0 ? `
            <div class="weapon-detail-heat-zones">
              <div class="weapon-detail-section-subtitle">HEAT ZONES</div>
              ${weapon.heatZones.map(zone => `
                <div class="weapon-detail-heat-zone">
                  <div class="weapon-detail-heat-zone-header">
                    <span class="weapon-detail-heat-zone-range">${zone.min}-${zone.max}</span>
                    <span class="weapon-detail-heat-zone-name">${zone.name}</span>
                  </div>
                  ${zone.effect ? `
                    <div class="weapon-detail-heat-zone-effect">${zone.effect}</div>
                  ` : `
                    <div class="weapon-detail-heat-zone-effect weapon-detail-heat-zone-effect--ok">No penalties</div>
                  `}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${weapon.ammoMax ? `
        <div class="weapon-detail-section">
          <div class="weapon-detail-section-title">AMMO SYSTEM</div>
          <div class="weapon-detail-ammo-info">
            <div class="weapon-detail-heat-row">
              <span>Max Ammo:</span>
              <span>${weapon.ammoMax}</span>
            </div>
            ${weapon.quickReloadStrain !== undefined ? `
              <div class="weapon-detail-heat-row">
                <span>Quick Reload Strain:</span>
                <span>${weapon.quickReloadStrain}</span>
              </div>
            ` : ''}
            ${weapon.fullReloadStrain !== undefined ? `
              <div class="weapon-detail-heat-row">
                <span>Full Reload Strain:</span>
                <span>${weapon.fullReloadStrain}</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <div class="weapon-detail-section">
        <div class="weapon-detail-section-title">MODULE SLOTS</div>
        <div class="weapon-detail-modules">${weapon.moduleSlots} available slots</div>
      </div>
    </div>
  `;

  body.innerHTML = html;
  modal.style.display = "flex";
}

function closeWeaponDetailModal(): void {
  const modal = document.getElementById("weaponDetailModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function equipItem(unitId: string, slot: EquipSlot, equipId: string): void {
  updateGameState((prev) => {
    const unit = prev.unitsById[unitId];
    if (!unit) return prev;

    const currentLoadout: UnitLoadout = (unit as any).loadout || {
      weapon: null,
      helmet: null,
      chestpiece: null,
      accessory1: null,
      accessory2: null,
    };

    const newLoadout: UnitLoadout = {
      ...currentLoadout,
      [slot]: equipId,
    };

    const updatedUnit = {
      ...unit,
      loadout: newLoadout,
    };

    return {
      ...prev,
      unitsById: {
        ...prev.unitsById,
        [unitId]: updatedUnit,
      },
    };
  });

  renderUnitDetailScreen(unitId);
}

function unequipItem(unitId: string, slot: EquipSlot): void {
  updateGameState((prev) => {
    const unit = prev.unitsById[unitId];
    if (!unit) return prev;

    const currentLoadout: UnitLoadout = (unit as any).loadout || {
      weapon: null,
      helmet: null,
      chestpiece: null,
      accessory1: null,
      accessory2: null,
    };

    const newLoadout: UnitLoadout = {
      ...currentLoadout,
      [slot]: null,
    };

    const updatedUnit = {
      ...unit,
      loadout: newLoadout,
    };

    return {
      ...prev,
      unitsById: {
        ...prev.unitsById,
        [unitId]: updatedUnit,
      },
    };
  });

  renderUnitDetailScreen(unitId);
}