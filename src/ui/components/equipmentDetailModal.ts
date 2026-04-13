import { getGameState } from "../../state/gameStore";
import {
  getAllEquipmentCards,
  getAllStarterEquipment,
  type Equipment,
  type EquipmentStats,
  type WeaponEquipment,
} from "../../core/equipment";
import { getDefaultGearSlots, type GearSlotData } from "../../core/gearWorkbench";
import { getFieldModDef } from "../../core/fieldModDefinitions";
import type { GeneratedGear } from "../../core/endlessGear/types";
import { getChassisById } from "../../data/gearChassis";
import { getDoctrineById } from "../../data/gearDoctrines";

const EQUIPMENT_DETAIL_MODAL_ID = "gearDetailModalRoot";

type GeneratedEquipment = Equipment & Partial<GeneratedGear>;

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatStatWithSign(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatSlotLabel(slot: Equipment["slot"]): string {
  switch (slot) {
    case "weapon":
      return "Weapon";
    case "helmet":
      return "Helmet";
    case "chestpiece":
      return "Chestpiece";
    case "accessory":
      return "Accessory";
    default:
      return slot;
  }
}

function formatWeaponTypeLabel(type: WeaponEquipment["weaponType"]): string {
  return type.replace(/_/g, " ").toUpperCase();
}

function isGeneratedEquipment(equipment: Equipment): equipment is GeneratedGear {
  return Boolean((equipment as GeneratedEquipment).provenance);
}

function renderStatMetric(label: string, value: number): string {
  return `
    <div class="gear-detail-stat">
      <span class="gear-detail-stat__label">${label}</span>
      <strong class="gear-detail-stat__value">${formatStatWithSign(value)}</strong>
    </div>
  `;
}

function renderChip(label: string, value: string | number): string {
  return `
    <div class="gear-detail-chip">
      <span class="gear-detail-chip__label">${escapeHtml(label)}</span>
      <strong class="gear-detail-chip__value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderDataRow(label: string, value: string | number): string {
  return `
    <div class="gear-detail-row">
      <span class="gear-detail-row__label">${escapeHtml(label)}</span>
      <strong class="gear-detail-row__value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderCardList(cardIds: string[], title: string, emptyLabel: string): string {
  const cardsById = getAllEquipmentCards();
  if (cardIds.length === 0) {
    return `
      <div class="gear-detail-card-group">
        <div class="gear-detail-section-title">${escapeHtml(title)}</div>
        <div class="gear-detail-empty">${escapeHtml(emptyLabel)}</div>
      </div>
    `;
  }

  return `
    <div class="gear-detail-card-group">
      <div class="gear-detail-section-title">${escapeHtml(title)}</div>
      <div class="gear-detail-list">
        ${cardIds.map((cardId) => {
          const card = cardsById[cardId];
          const metaParts: string[] = [];
          if (typeof card?.strainCost === "number") {
            metaParts.push(`${card.strainCost} STR`);
          }
          if (card?.range) {
            metaParts.push(card.range);
          }
          if (typeof card?.damage === "number") {
            metaParts.push(`${card.damage} DMG`);
          }
          return `
            <article class="gear-detail-list-item">
              <div class="gear-detail-list-item__title">${escapeHtml(card?.name ?? cardId)}</div>
              <div class="gear-detail-list-item__copy">${escapeHtml(card?.description ?? "Card data unavailable.")}</div>
              ${metaParts.length > 0 ? `<div class="gear-detail-list-item__meta">${escapeHtml(metaParts.join(" // "))}</div>` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFieldModList(fieldModIds: string[]): string {
  if (fieldModIds.length === 0) {
    return "";
  }

  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-panel__kicker">Procedural Effects</div>
      <h3 class="gear-detail-panel__title">Field Mods</h3>
      <div class="gear-detail-list">
        ${fieldModIds.map((fieldModId) => {
          const fieldMod = getFieldModDef(fieldModId);
          return `
            <article class="gear-detail-list-item">
              <div class="gear-detail-list-item__title">${escapeHtml(fieldMod?.name ?? fieldModId)}</div>
              <div class="gear-detail-list-item__copy">${escapeHtml(fieldMod?.description ?? "Field mod data unavailable.")}</div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderWeaponSystems(weapon: WeaponEquipment): string {
  const clutchList = Array.isArray(weapon.clutches) ? weapon.clutches : [];
  const hasSystems =
    Boolean(weapon.heatCapacity) ||
    Boolean(weapon.ammoMax) ||
    clutchList.length > 0 ||
    Boolean(weapon.clutchToggle) ||
    Boolean(weapon.doubleClutch);

  if (!hasSystems) {
    return "";
  }

  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-panel__kicker">Operational Systems</div>
      <h3 class="gear-detail-panel__title">Weapon Runtime</h3>
      <div class="gear-detail-row-grid">
        ${weapon.heatCapacity ? renderDataRow("Heat Cap", weapon.heatCapacity) : ""}
        ${typeof weapon.passiveHeatDecay === "number" ? renderDataRow("Heat Decay", `${weapon.passiveHeatDecay}/turn`) : ""}
        ${weapon.ammoMax ? renderDataRow("Ammo Cap", weapon.ammoMax) : ""}
        ${typeof weapon.quickReloadStrain === "number" ? renderDataRow("Quick Reload", `${weapon.quickReloadStrain} STR`) : ""}
        ${typeof weapon.fullReloadStrain === "number" ? renderDataRow("Full Reload", `${weapon.fullReloadStrain} STR`) : ""}
      </div>
      ${clutchList.length > 0 ? `
        <div class="gear-detail-list">
          ${clutchList.map((clutch) => `
            <article class="gear-detail-list-item">
              <div class="gear-detail-list-item__title">${escapeHtml(clutch.label)}</div>
              <div class="gear-detail-list-item__copy">${escapeHtml(clutch.description)}</div>
            </article>
          `).join("")}
        </div>
      ` : ""}
      ${weapon.heatZones && weapon.heatZones.length > 0 ? `
        <div class="gear-detail-subsection">
          <div class="gear-detail-section-title">Heat Zones</div>
          <div class="gear-detail-list">
            ${weapon.heatZones.map((zone) => `
              <article class="gear-detail-list-item">
                <div class="gear-detail-list-item__title">${escapeHtml(`${zone.name} // ${zone.min}-${zone.max}`)}</div>
                <div class="gear-detail-list-item__copy">${escapeHtml(zone.effect ?? "No penalties while operating in this zone.")}</div>
              </article>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </section>
  `;
}

function renderProvenancePanel(equipment: Equipment): string {
  const generated = isGeneratedEquipment(equipment) ? equipment : null;
  const chassis = equipment.chassisId ? getChassisById(equipment.chassisId) : null;
  const doctrine = equipment.doctrineId ? getDoctrineById(equipment.doctrineId) : null;
  const rows: string[] = [];

  if (chassis?.name) {
    rows.push(renderDataRow("Chassis", chassis.name));
  }
  if (doctrine?.name) {
    rows.push(renderDataRow("Doctrine", doctrine.name));
  }
  if (typeof equipment.stability === "number") {
    rows.push(renderDataRow("Stability", `${equipment.stability}%`));
  }
  if (typeof equipment.builderVersion === "number") {
    rows.push(renderDataRow("Build Rev", equipment.builderVersion));
  }
  if (generated?.provenance?.kind) {
    rows.push(renderDataRow("Origin", generated.provenance.kind === "endless_loot" ? "Recovered Drop" : "Workshop Proc"));
  }
  if (generated?.provenance?.seed) {
    rows.push(renderDataRow("Seed", generated.provenance.seed));
  }

  if (rows.length === 0) {
    return "";
  }

  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-panel__kicker">Build Signature</div>
      <h3 class="gear-detail-panel__title">Workshop Record</h3>
      <div class="gear-detail-row-grid">
        ${rows.join("")}
      </div>
    </section>
  `;
}

function getEquipmentDescription(equipment: Equipment): string {
  if (equipment.description && equipment.description.trim().length > 0) {
    return equipment.description;
  }

  const chassis = equipment.chassisId ? getChassisById(equipment.chassisId) : null;
  const doctrine = equipment.doctrineId ? getDoctrineById(equipment.doctrineId) : null;
  if (chassis && doctrine) {
    return `${doctrine.name} doctrine laid over the ${chassis.name} frame for field deployment.`;
  }

  return "Recovered equipment package ready for deployment.";
}

function renderIdentityPanel(equipment: Equipment, gearSlots: GearSlotData): string {
  const generated = isGeneratedEquipment(equipment) ? equipment : null;
  const totalLockedCards = gearSlots.lockedCards.length;
  const totalSlottedCards = gearSlots.slottedCards.length;
  const totalFieldMods = generated && Array.isArray(generated.fieldMods) ? generated.fieldMods.length : 0;
  const subtype = equipment.slot === "weapon"
    ? formatWeaponTypeLabel(equipment.weaponType)
    : formatSlotLabel(equipment.slot).toUpperCase();

  return `
    <section class="gear-detail-panel gear-detail-panel--hero">
      <h2 class="gear-detail-panel__title gear-detail-panel__title--hero" id="gearDetailModalTitle">${escapeHtml(equipment.name)}</h2>
      <div class="gear-detail-panel__subtitle">
        ${escapeHtml(formatSlotLabel(equipment.slot).toUpperCase())} // ${escapeHtml(subtype)}
        ${equipment.slot === "weapon" && equipment.isMechanical ? " // MECHANICAL" : ""}
      </div>
      <p class="gear-detail-panel__copy">${escapeHtml(getEquipmentDescription(equipment))}</p>
      <div class="gear-detail-chip-row">
        ${renderChip("Locked Cards", totalLockedCards)}
        ${renderChip("Slotted Cards", totalSlottedCards)}
        ${renderChip("Open Slots", gearSlots.freeSlots)}
        ${typeof equipment.stability === "number" ? renderChip("Stability", `${equipment.stability}%`) : ""}
        ${totalFieldMods > 0 ? renderChip("Field Mods", totalFieldMods) : ""}
      </div>
    </section>
  `;
}

function renderStatsPanel(stats: EquipmentStats): string {
  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-panel__kicker">Combat Profile</div>
      <h3 class="gear-detail-panel__title">Stat Array</h3>
      <div class="gear-detail-stat-grid">
        ${renderStatMetric("ATK", stats.atk)}
        ${renderStatMetric("DEF", stats.def)}
        ${renderStatMetric("AGI", stats.agi)}
        ${renderStatMetric("ACC", stats.acc)}
        ${renderStatMetric("HP", stats.hp)}
      </div>
    </section>
  `;
}

function renderInventoryPanel(equipment: Equipment): string {
  const inventory = equipment.inventory;
  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-panel__kicker">Carry Burden</div>
      <h3 class="gear-detail-panel__title">Inventory Profile</h3>
      <div class="gear-detail-row-grid">
        ${renderDataRow("Mass", `${inventory?.massKg ?? 0} kg`)}
        ${renderDataRow("Bulk", `${inventory?.bulkBu ?? 0} bu`)}
        ${renderDataRow("Power", `${inventory?.powerW ?? 0} w`)}
      </div>
    </section>
  `;
}

function renderCardsPanel(gearSlots: GearSlotData): string {
  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-panel__kicker">Deck Integration</div>
      <h3 class="gear-detail-panel__title">Card Payload</h3>
      ${renderCardList(gearSlots.lockedCards, "Granted / Locked", "No locked cards are wired into this frame.")}
      ${renderCardList(gearSlots.slottedCards, "Slotted Cards", "No extra cards have been slotted into this gear.")}
    </section>
  `;
}

function renderEquipmentDetailModal(equipment: Equipment, gearSlots: GearSlotData): string {
  const generated = isGeneratedEquipment(equipment) ? equipment : null;
  const fieldModIds = generated && Array.isArray(generated.fieldMods) ? generated.fieldMods : [];

  return `
    <div class="gear-detail-modal" role="dialog" aria-modal="true" aria-labelledby="gearDetailModalTitle">
      <div class="gear-detail-modal__header">
        <div>
          <div class="gear-detail-modal__eyebrow">Workshop // Gear Detail</div>
          <div class="gear-detail-modal__caption">Inspect frame breakdown, cards, systems, and proc metadata.</div>
        </div>
        <button class="gear-detail-modal__close" type="button" data-gear-detail-action="close" aria-label="Close gear detail">
          X
        </button>
      </div>
      <div class="gear-detail-modal__body">
        ${renderIdentityPanel(equipment, gearSlots)}
        <div class="gear-detail-grid">
          ${renderStatsPanel(equipment.stats)}
          ${renderInventoryPanel(equipment)}
        </div>
        <div class="gear-detail-grid">
          ${renderCardsPanel(gearSlots)}
          ${renderProvenancePanel(equipment)}
        </div>
        ${equipment.slot === "weapon" ? renderWeaponSystems(equipment) : ""}
        ${renderFieldModList(fieldModIds)}
      </div>
    </div>
  `;
}

function closeEquipmentDetailModalInternal(): void {
  const existing = document.getElementById(EQUIPMENT_DETAIL_MODAL_ID);
  if (existing) {
    existing.remove();
  }
  window.removeEventListener("keydown", handleEquipmentDetailEscape, true);
}

function handleEquipmentDetailEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    closeEquipmentDetailModalInternal();
  }
}

export function closeEquipmentDetailModal(): void {
  closeEquipmentDetailModalInternal();
}

export function showEquipmentDetailModal(equipment: Equipment, gearSlots?: GearSlotData): void {
  closeEquipmentDetailModalInternal();

  const overlay = document.createElement("div");
  overlay.id = EQUIPMENT_DETAIL_MODAL_ID;
  overlay.className = "gear-detail-modal-backdrop";
  overlay.innerHTML = renderEquipmentDetailModal(
    equipment,
    gearSlots ?? getDefaultGearSlots(equipment.id, equipment),
  );

  overlay.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target === overlay || target.closest("[data-gear-detail-action='close']")) {
      closeEquipmentDetailModalInternal();
    }
  });

  document.body.appendChild(overlay);
  window.addEventListener("keydown", handleEquipmentDetailEscape, true);
  overlay.querySelector<HTMLButtonElement>("[data-gear-detail-action='close']")?.focus();
}

export function showEquipmentDetailModalById(equipmentId: string): void {
  const state = getGameState();
  const equipmentById = {
    ...getAllStarterEquipment(),
    ...(state.equipmentById ?? {}),
  };
  const equipment = equipmentById[equipmentId];

  if (!equipment) {
    return;
  }

  showEquipmentDetailModal(equipment, state.gearSlots?.[equipmentId]);
}
