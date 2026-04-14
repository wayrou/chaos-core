// ============================================================================
// UNIT DETAIL SCREEN - Individual unit equipment and deck management
// Headline 11b & 11c: Equipment slots, deck building from equipment
// Updated: Added CUSTOMIZE button for Workshop (11da)
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderRosterScreen } from "./RosterScreen";
import { renderGearWorkbenchScreen } from "./GearWorkbenchScreen";

import {
  Equipment,
  WeaponEquipment,
  UnitLoadout,
  UnitClass,
  calculateEquipmentStats,
  getAllStarterEquipment,
  getAllEquipmentCards,
  buildDeckFromLoadout,
  canEquipWeapon,
  EquipmentCard,
} from "../../core/equipment";
import { getUnitManagementStandIconPath } from "../../core/portraits";
import { getPWRBand, getPWRBandColor, calculatePWR } from "../../core/pwr";
import { loadCampaignProgress, saveCampaignProgress } from "../../core/campaign";
import { HardpointState, FieldModInstance } from "../../core/fieldMods";
import { getFieldModDef } from "../../core/fieldModDefinitions";
import {
  clampUnitNotes,
  clampUnitName,
  normalizeUnitAppearance,
  UNIT_APPEARANCE_HAIR_OPTIONS,
  UNIT_APPEARANCE_HEAD_OPTIONS,
  UNIT_NAME_MAX_LENGTH,
  UNIT_NOTES_MAX_LENGTH,
  type UnitAppearance,
  type UnitAppearanceHairId,
  type UnitAppearanceHeadId,
} from "../../core/unitAppearance";
import {
  drawNextUnitSampleHand,
  ensureUnitSampleHandState,
  playUnitSampleHandCard,
  resetUnitSampleHandState,
  SAMPLE_DRAW_HAND_SIZE,
  SAMPLE_HAND_TURN_STRAIN_RELIEF,
  type UnitSampleHandState,
} from "../../core/unitSampleHand";
import { showEquipmentDetailModalById } from "../components/equipmentDetailModal";

type UnitDetailReturnTo = "basecamp" | "field" | "esc" | "loadout" | "operation";
type LoadoutSlot = keyof UnitLoadout;

let currentUnitDetailReturnTo: UnitDetailReturnTo = "basecamp";
let unitDetailEscHandler: ((e: KeyboardEvent) => void) | null = null;
let unitDetailSampleDrawState: UnitSampleHandState | null = null;

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (value: string) => escapeHtml(value).replace(/"/g, "&quot;");

function returnToActiveOperationRoster(): void {
  renderRosterScreen("operation");
}

function unregisterUnitDetailReturnHotkey(): void {
  if (!unitDetailEscHandler) return;
  window.removeEventListener("keydown", unitDetailEscHandler);
  unitDetailEscHandler = null;
}

function registerUnitDetailReturnHotkey(_unitId: string, returnTo: UnitDetailReturnTo): void {
  unregisterUnitDetailReturnHotkey();

  unitDetailEscHandler = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase() ?? "";
    const isEscape = key === "escape" || e.key === "Escape" || e.keyCode === 27;
    if (!isEscape || !document.querySelector(".unitdetail-root")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    unregisterUnitDetailReturnHotkey();

    if (returnTo === "operation") {
      returnToActiveOperationRoster();
      return;
    }

    renderRosterScreen(returnTo === "loadout" ? "loadout" : returnTo);
  };

  window.addEventListener("keydown", unitDetailEscHandler);
}

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

function formatSlotName(slot: LoadoutSlot): string {
  const names: Record<LoadoutSlot, string> = {
    primaryWeapon: "Primary Weapon",
    secondaryWeapon: "Secondary Weapon",
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

function getDeckCardGlyph(type: EquipmentCard["type"]): string {
  switch (type) {
    case "class":
      return "^";
    case "equipment":
      return "#";
    case "gambit":
      return "!";
    case "core":
    default:
      return "*";
  }
}

function resetUnitDetailSampleDrawState(unitId: string, deck: string[]): UnitSampleHandState | null {
  unitDetailSampleDrawState = resetUnitSampleHandState(unitId, deck);
  return unitDetailSampleDrawState;
}

function ensureUnitDetailSampleDrawState(unitId: string, deck: string[]): UnitSampleHandState | null {
  unitDetailSampleDrawState = ensureUnitSampleHandState(unitDetailSampleDrawState, unitId, deck);
  return unitDetailSampleDrawState;
}

function drawNextUnitDetailSampleHand(unitId: string, deck: string[]): UnitSampleHandState | null {
  unitDetailSampleDrawState = drawNextUnitSampleHand(unitDetailSampleDrawState, unitId, deck);
  return unitDetailSampleDrawState;
}

function getUnitDetailSampleCardStrainDelta(card: EquipmentCard): number {
  if (card.id === "core_wait") {
    return -2;
  }
  return Number(card.strainCost ?? 0);
}

function playUnitDetailSampleCard(unitId: string, deck: string[], handIndex: number, card: EquipmentCard): UnitSampleHandState | null {
  ensureUnitDetailSampleDrawState(unitId, deck);
  unitDetailSampleDrawState = playUnitSampleHandCard(
    unitDetailSampleDrawState,
    handIndex,
    getUnitDetailSampleCardStrainDelta(card),
  );
  return unitDetailSampleDrawState;
}

function renderDeckCard(
  card: EquipmentCard,
  options: {
    footerStats?: string[];
    extraClasses?: string[];
    attrs?: string;
  } = {},
): string {
  const typeClass = `deck-card--${card.type}`;
  const footerBits = (options.footerStats ?? [])
    .filter(Boolean)
    .map((value) => `<span class="deck-card-stat">${value}</span>`)
    .join("");
  const classes = ["deck-card", typeClass, ...(options.extraClasses ?? [])]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="${classes}" ${options.attrs ?? ""}>
      <div class="deck-card-cost">${card.strainCost}</div>
      <div class="deck-card-type">${card.type.toUpperCase()}</div>
      <div class="deck-card-art">
        <span class="deck-card-glyph">${getDeckCardGlyph(card.type)}</span>
      </div>
      <div class="deck-card-name-banner">
        <span class="deck-card-name">${card.name}</span>
      </div>
      <div class="deck-card-desc">${card.description}</div>
      <div class="deck-card-footer">
        ${footerBits || `<span class="deck-card-stat">DECK</span>`}
      </div>
    </div>
  `;
}

function renderIdentitySection(
  unit: { name: string; notes?: string },
  unitClass: UnitClass,
  appearance: UnitAppearance,
): string {
  const portraitPath = getUnitManagementStandIconPath(unitClass, appearance);
  const headOptionsHtml = UNIT_APPEARANCE_HEAD_OPTIONS.map((option) => `
    <button
      class="unitdetail-appearance-option ${appearance.head === option.id ? "unitdetail-appearance-option--selected" : ""}"
      type="button"
      data-appearance-head="${option.id}"
      aria-pressed="${appearance.head === option.id ? "true" : "false"}"
    >
      ${escapeHtml(option.label)}
    </button>
  `).join("");
  const hairOptionsHtml = UNIT_APPEARANCE_HAIR_OPTIONS.map((option) => `
    <button
      class="unitdetail-appearance-option ${appearance.hair === option.id ? "unitdetail-appearance-option--selected" : ""}"
      type="button"
      data-appearance-hair="${option.id}"
      aria-pressed="${appearance.hair === option.id ? "true" : "false"}"
    >
      ${escapeHtml(option.label)}
    </button>
  `).join("");

  return `
    <div class="unitdetail-section">
      <div class="unitdetail-section-title">IDENTITY</div>
      <div class="unitdetail-identity-card">
        <div class="unitdetail-identity-preview">
          <div class="unitdetail-identity-sprite">
            <img
              src="${portraitPath}"
              alt="${escapeAttr(unit.name)}"
              class="unitdetail-identity-sprite-img"
              onerror="this.src='/assets/portraits/units/core/Unit_Stand_Test.png';"
            />
          </div>
          <div class="unitdetail-identity-copy">
            <div class="unitdetail-identity-overline">FIELD IDENTITY</div>
            <div class="unitdetail-identity-current-name">${escapeHtml(unit.name)}</div>
            <div class="unitdetail-identity-note">
              Placeholder head and hair slots currently swap temporary stand sheets.
            </div>
          </div>
        </div>

        <label class="unitdetail-identity-field">
          <span class="unitdetail-identity-label">CALLSIGN</span>
          <div class="unitdetail-identity-name-row">
            <input
              id="unitdetailNameInput"
              class="unitdetail-identity-name-input"
              type="text"
              maxlength="${UNIT_NAME_MAX_LENGTH}"
              value="${escapeAttr(unit.name)}"
              spellcheck="false"
            />
            <button id="unitdetailNameSaveBtn" class="unitdetail-identity-name-btn" type="button">
              SAVE NAME
            </button>
          </div>
        </label>

        <div class="unitdetail-appearance-groups">
          <div class="unitdetail-appearance-group">
            <div class="unitdetail-identity-label">HEAD</div>
            <div class="unitdetail-appearance-option-row">
              ${headOptionsHtml}
            </div>
          </div>
          <div class="unitdetail-appearance-group">
            <div class="unitdetail-identity-label">HAIR</div>
            <div class="unitdetail-appearance-option-row">
              ${hairOptionsHtml}
            </div>
          </div>
        </div>

        <label class="unitdetail-identity-field unitdetail-identity-field--notes">
          <span class="unitdetail-identity-label">OPERATOR NOTES</span>
          <textarea
            id="unitdetailNotesInput"
            class="unitdetail-identity-notes-input"
            maxlength="${UNIT_NOTES_MAX_LENGTH}"
            placeholder="Add reminders, role notes, quirks, or loadout plans for this operator."
            spellcheck="false"
          >${escapeHtml(unit.notes ?? "")}</textarea>
          <div class="unitdetail-identity-notes-row">
            <div class="unitdetail-identity-note unitdetail-identity-note--subtle">
              Saved per unit from this management screen.
            </div>
            <button id="unitdetailNotesSaveBtn" class="unitdetail-identity-name-btn" type="button">
              SAVE NOTES
            </button>
          </div>
        </label>
      </div>
    </div>
  `;
}

export function renderUnitDetailScreen(unitId: string, returnTo: UnitDetailReturnTo = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;
  currentUnitDetailReturnTo = returnTo;

  const state = getGameState();
  const unit = state.unitsById[unitId];
  if (!unit) {
    if (returnTo === "operation") {
      returnToActiveOperationRoster();
    } else {
      renderRosterScreen(returnTo === "loadout" ? "loadout" : returnTo);
    }
    return;
  }

  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const gearSlotsById = state.gearSlots ?? {};
  const cardsById = getAllEquipmentCards();

  const unitClass: UnitClass = (unit as any).unitClass || "squire";
  const unitAppearance = normalizeUnitAppearance(unit.appearance, unitClass);
  const loadout: UnitLoadout = (unit as any).loadout || {
    primaryWeapon: null,
    secondaryWeapon: null,
    helmet: null,
    chestpiece: null,
    accessory1: null,
    accessory2: null,
  };

  const baseStats = (unit as any).stats || { maxHp: 20, atk: 5, def: 3, agi: 4, acc: 80 };
  const equipStats = calculateEquipmentStats(loadout, equipmentById);
  const deck = buildDeckFromLoadout(unitClass, loadout, equipmentById, gearSlotsById);

  const totalAtk = baseStats.atk + equipStats.atk;
  const totalDef = baseStats.def + equipStats.def;
  const totalAgi = baseStats.agi + equipStats.agi;
  const totalAcc = baseStats.acc + equipStats.acc;
  const totalHp = baseStats.maxHp + equipStats.hp;

  const equipmentPool = (state as any).equipmentPool || Object.keys(equipmentById);

  const slots: LoadoutSlot[] = ["primaryWeapon", "secondaryWeapon", "helmet", "chestpiece", "accessory1", "accessory2"];

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
        const customizedGear = equipId ? gearSlotsById[equipId] : undefined;
        const slotCardCount = customizedGear
          ? (equip.cardsGranted.length > 0
            ? customizedGear.slottedCards.length
            : customizedGear.lockedCards.length + customizedGear.slottedCards.length)
          : 0;
        cardsGranted = `${equip.cardsGranted.length + slotCardCount} cards`;
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
            ${equipId ? `
              <button class="equip-view-gear-btn"
                      data-equipment-id="${equipId}"
                      title="Inspect this gear package">
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

  const sampleDrawState = ensureUnitDetailSampleDrawState(unitId, deck);
  const uniqueCardCount = new Set(deck).size;
  const sampleStrain = sampleDrawState?.strain ?? 0;

  const deckCardsHtml = deck
    .map((cardId) => {
      const card = cardsById[cardId];
      if (!card) return "";

      return renderDeckCard(card, {
        footerStats: card.range ? [card.range, "DECK"] : ["DECK"],
        extraClasses: ["deck-card--compiled"],
      });
    })
    .join("");

  const sampleHandHtml = (sampleDrawState?.hand ?? [])
    .map((cardId, handIndex) => {
      const card = cardsById[cardId];
      if (!card) return "";

      const sampleStrainDelta = getUnitDetailSampleCardStrainDelta(card);
      const playPreviewLabel = sampleStrainDelta >= 0
        ? `PLAY +${sampleStrainDelta} STR`
        : `PLAY ${sampleStrainDelta} STR`;

      return renderDeckCard(card, {
        footerStats: card.range ? [card.range, playPreviewLabel] : [playPreviewLabel],
        extraClasses: ["deck-card--sample", "deck-card--sample-playable"],
        attrs: `data-sample-hand-index="${handIndex}" title="Play ${card.name} in the sample hand"`,
      });
    })
    .join("");

  const portraitPath = getUnitManagementStandIconPath(unitClass, unitAppearance);

  // Calculate PWR for the unit
  const pwr = (unit as any).pwr ?? calculatePWR({
    unit,
    equipmentById,
  });
  const pwrBand = getPWRBand(pwr);
  const pwrColor = getPWRBandColor(pwr);

  root.innerHTML = `
    <div class="unitdetail-root">
      <div class="unitdetail-card">
        <div class="unitdetail-header">
          <div class="unitdetail-header-left">
            <div class="unitdetail-portrait">
              <img src="${portraitPath}" alt="${unit.name}" class="unitdetail-portrait-img" onerror="this.src='/assets/portraits/units/core/Unit_Stand_Test.png';" />
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
              MANAGE CLASS
            </button>
            <button class="unitdetail-back-btn">BACK TO ROSTER</button>
          </div>
        </div>

        <div class="unitdetail-body">
          <div class="unitdetail-stats-section">
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
          </div>

          <div class="unitdetail-section unitdetail-section--deck">
            <div class="unitdetail-deck-toolbar">
              <div class="unitdetail-deck-heading">
                <div class="unitdetail-section-title">COMPILED DECK (${deck.length} CARDS)</div>
                <div class="unitdetail-deck-summary">
                  <span class="unitdetail-deck-chip">UNIQUE ${uniqueCardCount}</span>
                  <span class="unitdetail-deck-chip">DRAW PILE ${sampleDrawState?.drawPile.length ?? deck.length}</span>
                  <span class="unitdetail-deck-chip">HAND ${sampleDrawState?.hand.length ?? 0}</span>
                  <span class="unitdetail-deck-chip">DISCARD ${sampleDrawState?.discardPile.length ?? 0}</span>
                </div>
              </div>
              <div class="unitdetail-deck-actions">
                <div class="unitdetail-deck-actions-copy">
                  Draw ${SAMPLE_DRAW_HAND_SIZE} cards, click sample cards to test strain pressure, and cool ${SAMPLE_HAND_TURN_STRAIN_RELIEF} strain on each new hand.
                </div>
                <div class="unitdetail-deck-action-row">
                  <button class="unitdetail-sample-draw-btn" id="unitdetailSampleDrawBtn" ${deck.length === 0 ? "disabled" : ""}>
                    ${sampleDrawState?.drawCount ? "DRAW NEXT HAND" : "SAMPLE DRAW"}
                  </button>
                  <button class="unitdetail-sample-reset-btn" id="unitdetailSampleResetBtn" ${deck.length === 0 ? "disabled" : ""}>
                    RESET SAMPLE
                  </button>
                </div>
              </div>
            </div>

            <div class="unitdetail-sample-panel">
              <div class="unitdetail-sample-header">
                <div class="unitdetail-sample-heading">
                  <div class="unitdetail-sample-title">
                    SAMPLE HAND ${sampleDrawState?.drawCount ? `#${sampleDrawState.drawCount}` : "READY"}
                  </div>
                  <div class="unitdetail-sample-copy">
                    ${sampleDrawState?.drawCount
                      ? `Click a card to test its strain impact. DRAW NEXT HAND discards the rest and cools ${SAMPLE_HAND_TURN_STRAIN_RELIEF} strain.`
                      : "Press SAMPLE DRAW to preview how this loadout opens before deployment."}
                  </div>
                </div>
                <div class="unitdetail-sample-strain">
                  <span class="unitdetail-sample-strain__label">TEST STRAIN</span>
                  <span class="unitdetail-sample-strain__value">${sampleStrain}</span>
                  <span class="unitdetail-sample-strain__meta">NEXT DRAW -${SAMPLE_HAND_TURN_STRAIN_RELIEF}</span>
                </div>
              </div>
              <div class="deck-grid deck-grid--sample">
                ${sampleHandHtml || `<div class="unitdetail-sample-empty">${sampleDrawState?.drawCount ? "Sample hand exhausted. Draw next hand to keep testing the deck flow." : "No sample hand yet. Draw to see five live cards from the compiled deck."}</div>`}
              </div>
            </div>

            <div class="unitdetail-deck-grid-heading">FULL DECK GRID</div>
            <div class="deck-grid deck-grid--compiled">
              ${deckCardsHtml || '<div class="deck-empty">No cards in deck. Equip gear to add cards.</div>'}
            </div>
          </div>

          <div class="unitdetail-columns unitdetail-columns--management">
            <div class="unitdetail-column">
              <div class="unitdetail-section">
                <div class="unitdetail-section-title">EQUIPMENT (6 SLOTS)</div>
                <div class="auto-equip-section">
                  <button class="auto-equip-btn" id="autoEquipBtn">AUTO EQUIP</button>
                </div>
                <div class="equip-slots-grid">
                  ${equipSlotsHtml}
                </div>
              </div>
            </div>

            <div class="unitdetail-column">
              ${renderIdentitySection(unit, unitClass, unitAppearance)}
              ${renderHardpointsSection(unitId)}
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
    </div>
  `;

  // --- EVENT LISTENERS ---
  registerUnitDetailReturnHotkey(unitId, returnTo);

  // Back to roster
  root.querySelector(".unitdetail-back-btn")?.addEventListener("click", () => {
    unregisterUnitDetailReturnHotkey();
    renderRosterScreen(returnTo === "loadout" ? "loadout" : returnTo);
  });

  // Change Class button
  root.querySelector("#changeClassBtn")?.addEventListener("click", () => {
    unregisterUnitDetailReturnHotkey();
    // Import dynamically to avoid circular dependencies
    import("./ClassChangeScreen").then(({ renderClassChangeScreen }) => {
      renderClassChangeScreen(unitId, returnTo);
    });
  });

  const persistUnitName = () => {
    const nameInput = root.querySelector<HTMLInputElement>("#unitdetailNameInput");
    if (!nameInput) {
      return;
    }
    updateUnitIdentity(unitId, {
      name: clampUnitName(nameInput.value, unit.name),
    });
  };

  const persistUnitNotes = () => {
    const notesInput = root.querySelector<HTMLTextAreaElement>("#unitdetailNotesInput");
    if (!notesInput) {
      return;
    }
    updateUnitIdentity(unitId, {
      notes: clampUnitNotes(notesInput.value),
    });
  };

  root.querySelector("#unitdetailNameSaveBtn")?.addEventListener("click", persistUnitName);
  root.querySelector<HTMLInputElement>("#unitdetailNameInput")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    persistUnitName();
  });

  root.querySelector("#unitdetailNotesSaveBtn")?.addEventListener("click", persistUnitNotes);
  root.querySelector<HTMLTextAreaElement>("#unitdetailNotesInput")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    persistUnitNotes();
  });

  root.querySelectorAll<HTMLElement>("[data-appearance-head]").forEach((button) => {
    button.addEventListener("click", () => {
      const headId = button.getAttribute("data-appearance-head") as UnitAppearanceHeadId | null;
      if (!headId || headId === unitAppearance.head) {
        return;
      }
      updateUnitIdentity(unitId, {
        appearance: {
          ...unitAppearance,
          head: headId,
        },
      });
    });
  });

  root.querySelectorAll<HTMLElement>("[data-appearance-hair]").forEach((button) => {
    button.addEventListener("click", () => {
      const hairId = button.getAttribute("data-appearance-hair") as UnitAppearanceHairId | null;
      if (!hairId || hairId === unitAppearance.hair) {
        return;
      }
      updateUnitIdentity(unitId, {
        appearance: {
          ...unitAppearance,
          hair: hairId,
        },
      });
    });
  });

  // Change/Equip buttons
  root.querySelectorAll(".equip-change-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const slot = (e.target as HTMLElement).getAttribute("data-slot") as LoadoutSlot;
      if (slot) {
        openEquipModal(unitId, slot, unitClass, loadout, equipmentById, equipmentPool);
      }
    });
  });

  // Unequip buttons
  root.querySelectorAll(".equip-unequip-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slot = (e.target as HTMLElement).getAttribute("data-slot") as LoadoutSlot;
      if (slot) {
        unequipItem(unitId, slot);
      }
    });
  });

  // DETAIL buttons - Opens gear detail modal
  root.querySelectorAll(".equip-view-gear-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const equipmentId = el.getAttribute("data-equipment-id");
      if (equipmentId) {
        showEquipmentDetailModalById(equipmentId);
      }
    });
  });

  // CUSTOMIZE buttons - Opens Workshop with correct return destination
  root.querySelectorAll(".equip-customize-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const targetUnitId = el.getAttribute("data-unit-id");
      const equipmentId = el.getAttribute("data-equipment-id");
      if (targetUnitId && equipmentId) {
        unregisterUnitDetailReturnHotkey();
        // Pass "unitdetail" as the return destination so back button returns here
        renderGearWorkbenchScreen(targetUnitId, equipmentId, returnTo === "operation" ? "unitdetail-operation" : "unitdetail");
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

  // Auto-equip button (15d)
  const autoEquipBtn = root.querySelector("#autoEquipBtn");
  if (autoEquipBtn) {
    autoEquipBtn.addEventListener("click", () => {
      autoEquipUnit(unitId, unitClass, equipmentById, equipmentPool);
    });
  }

  const sampleDrawBtn = root.querySelector("#unitdetailSampleDrawBtn");
  if (sampleDrawBtn) {
    sampleDrawBtn.addEventListener("click", () => {
      drawNextUnitDetailSampleHand(unitId, deck);
      renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
    });
  }

  const sampleResetBtn = root.querySelector("#unitdetailSampleResetBtn");
  if (sampleResetBtn) {
    sampleResetBtn.addEventListener("click", () => {
      resetUnitDetailSampleDrawState(unitId, deck);
      renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
    });
  }

  root.querySelectorAll(".deck-card--sample[data-sample-hand-index]").forEach((cardEl) => {
    cardEl.addEventListener("click", () => {
      const handIndex = Number((cardEl as HTMLElement).getAttribute("data-sample-hand-index") ?? "-1");
      if (handIndex < 0 || !sampleDrawState?.hand[handIndex]) {
        return;
      }
      const card = cardsById[sampleDrawState.hand[handIndex]];
      if (!card) {
        return;
      }
      playUnitDetailSampleCard(unitId, deck, handIndex, card);
      renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
    });
  });

  // Hardpoint slot buttons
  root.querySelectorAll(".hardpoint-slot-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const hardpointIndex = parseInt((e.currentTarget as HTMLElement).getAttribute("data-hardpoint-index") || "0");
      openHardpointModal(unitId, hardpointIndex);
    });
  });

  // Hardpoint mod items (click to slot)
  root.querySelectorAll(".hardpoint-mod-item:not(.hardpoint-mod-item--slotted)").forEach((item) => {
    item.addEventListener("click", (e) => {
      const modInstanceId = (e.currentTarget as HTMLElement).getAttribute("data-mod-instance-id");
      if (modInstanceId) {
        // Open modal to select which hardpoint to slot into
        openHardpointSelectModal(unitId, modInstanceId);
      }
    });
  });
}

function openEquipModal(
  unitId: string,
  slot: LoadoutSlot,
  unitClass: UnitClass,
  currentLoadout: UnitLoadout,
  equipmentById: Record<string, Equipment>,
  equipmentPool: string[]
): void {
  const modal = document.getElementById("equipModal");
  const modalBody = document.getElementById("equipModalBody");
  if (!modal || !modalBody) return;

  const state = getGameState();
  const isInOperation = state.phase === "operation" && state.operation !== null;

  const currentEquippedIds = [
    currentLoadout.primaryWeapon,
    currentLoadout.secondaryWeapon,
    currentLoadout.helmet,
    currentLoadout.chestpiece,
    currentLoadout.accessory1,
    currentLoadout.accessory2,
  ].filter(Boolean) as string[];

  // In town/base camp, use the player's owned equipment inventory/pool.
  // During an operation, restrict swaps to what is physically in the forward locker
  // plus whatever is already equipped on the unit.
  let filteredPool = Array.from(new Set([
    ...(state.equipmentPool || equipmentPool || []),
    ...currentEquippedIds,
  ]));

  if (isInOperation) {
    const forwardLocker = state.inventory?.forwardLocker || [];
    const forwardLockerEquipmentIds = forwardLocker
      .filter(item => item.kind === "equipment")
      .map(item => item.id);

    filteredPool = filteredPool.filter(id =>
      forwardLockerEquipmentIds.includes(id) || currentEquippedIds.includes(id)
    );
  }

  const availableEquipment = filteredPool
    .map((id) => equipmentById[id])
    .filter((eq): eq is Equipment => {
      if (!eq) return false;
      if (currentEquippedIds.includes(eq.id) && eq.id !== currentLoadout[slot]) return false;

      if (slot === "primaryWeapon" || slot === "secondaryWeapon") {
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
    const emptyMessage = isInOperation
      ? "No equipment available in forward locker for this slot."
      : "No available equipment for this slot.";
    modalBody.innerHTML = `
      <div class="equip-modal-empty">
        ${emptyMessage}
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

function equipItem(unitId: string, slot: LoadoutSlot, equipId: string): void {
  updateGameState((prev) => {
    const unit = prev.unitsById[unitId];
    if (!unit) return prev;

    const currentLoadout: UnitLoadout = (unit as any).loadout || {
      primaryWeapon: null,
      secondaryWeapon: null,
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

  renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
}

function updateUnitIdentity(
  unitId: string,
  updates: Partial<{
    name: string;
    notes: string;
    appearance: UnitAppearance;
  }>,
): void {
  updateGameState((prev) => {
    const unit = prev.unitsById[unitId];
    if (!unit) {
      return prev;
    }

    const nextName = updates.name ?? unit.name;
    const nextNotes = updates.notes ?? unit.notes ?? "";
    const nextAppearance = updates.appearance ?? normalizeUnitAppearance(unit.appearance, unit.unitClass);
    const unitChanged = unit.name !== nextName
      || (unit.notes ?? "") !== nextNotes
      || unit.appearance?.head !== nextAppearance.head
      || unit.appearance?.hair !== nextAppearance.hair;

    let battleChanged = false;
    const nextCurrentBattle = prev.currentBattle
      ? {
          ...prev.currentBattle,
          units: Object.fromEntries(
            Object.entries(prev.currentBattle.units).map(([battleUnitId, battleUnit]) => {
              if (battleUnit.baseUnitId !== unitId && battleUnit.id !== unitId) {
                return [battleUnitId, battleUnit];
              }

              battleChanged = true;
              return [
                battleUnitId,
                {
                  ...battleUnit,
                  name: nextName,
                  appearance: nextAppearance,
                },
              ];
            }),
          ) as typeof prev.currentBattle.units,
        }
      : prev.currentBattle;

    if (!unitChanged && !battleChanged) {
      return prev;
    }

    return {
      ...prev,
      unitsById: unitChanged
        ? {
            ...prev.unitsById,
            [unitId]: {
              ...unit,
              name: nextName,
              notes: nextNotes,
              appearance: nextAppearance,
            },
          }
        : prev.unitsById,
      currentBattle: nextCurrentBattle,
    };
  });

  renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
}

/**
 * Auto-equip best gear for a unit (15d)
 * Scores gear by: ATK*3 + DEF*2 + AGI*1 + ACC*1
 */
export function autoEquipUnit(
  unitId: string,
  unitClass: UnitClass,
  equipmentById: Record<string, Equipment>,
  equipmentPool: string[],
  rerender: boolean = true,
): void {
  const state = getGameState();
  const unit = state.unitsById[unitId];
  if (!unit) return;

  // Score function for equipment
  const scoreGear = (equip: Equipment): number => {
    const s = equip.stats;
    return (s.atk || 0) * 3 + (s.def || 0) * 2 + (s.agi || 0) * 1 + (s.acc || 0) * 1;
  };

  // Get available equipment
  const availableEquipment = equipmentPool
    .map((id) => equipmentById[id])
    .filter((eq): eq is Equipment => Boolean(eq));

  // Wait: The autoEquip logic is only picking the "best weapon", we want to pick the top 2 here actually
  // Find top 2 best weapons
  const bestWeapons = availableEquipment
    .filter((eq) => eq.slot === "weapon")
    .filter((eq) => canEquipWeapon(unitClass, (eq as WeaponEquipment).weaponType))
    .sort((a, b) => scoreGear(b) - scoreGear(a))
    .slice(0, 2);

  const bestWeapon = bestWeapons[0];
  const secondaryWeapon = bestWeapons[1];

  // Find best helmet
  const bestHelmet = availableEquipment
    .filter(eq => eq.slot === "helmet")
    .sort((a, b) => scoreGear(b) - scoreGear(a))[0];

  // Find best chestpiece
  const bestChestpiece = availableEquipment
    .filter(eq => eq.slot === "chestpiece")
    .sort((a, b) => scoreGear(b) - scoreGear(a))[0];

  // Find best accessories (top 2)
  const bestAccessories = availableEquipment
    .filter(eq => eq.slot === "accessory")
    .sort((a, b) => scoreGear(b) - scoreGear(a))
    .slice(0, 2);

  // Build new loadout
  const newLoadout: UnitLoadout = {
    primaryWeapon: bestWeapon?.id || null,
    secondaryWeapon: secondaryWeapon?.id || null,
    helmet: bestHelmet?.id || null,
    chestpiece: bestChestpiece?.id || null,
    accessory1: bestAccessories[0]?.id || null,
    accessory2: bestAccessories[1]?.id || null,
  };

  // Update state
  updateGameState((prev) => {
    const updatedUnit = {
      ...prev.unitsById[unitId],
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

  if (rerender) {
    renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
  }
}

function unequipItem(unitId: string, slot: LoadoutSlot): void {
  updateGameState((prev) => {
    const unit = prev.unitsById[unitId];
    if (!unit) return prev;

    const currentLoadout: UnitLoadout = (unit as any).loadout || {
      primaryWeapon: null,
      secondaryWeapon: null,
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

  renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
}

// ----------------------------------------------------------------------------
// HARDPOINTS SECTION
// ----------------------------------------------------------------------------

function getStoredUnitHardpoints(unitId: string): HardpointState {
  const state = getGameState();
  const activeRun = loadCampaignProgress().activeRun;
  return activeRun?.unitHardpoints?.[unitId] || state.unitHardpoints?.[unitId] || [null, null];
}

function getStoredFieldModInventory(): FieldModInstance[] {
  const state = getGameState();
  const activeRun = loadCampaignProgress().activeRun;
  return activeRun?.runFieldModInventory || state.runFieldModInventory || [];
}

function saveHardpointState(
  unitId: string,
  unitHardpoints: HardpointState,
  fieldModInventory: FieldModInstance[],
): void {
  const progress = loadCampaignProgress();
  if (progress.activeRun) {
    saveCampaignProgress({
      ...progress,
      activeRun: {
        ...progress.activeRun,
        unitHardpoints: {
          ...(progress.activeRun.unitHardpoints || {}),
          [unitId]: unitHardpoints,
        },
        runFieldModInventory: fieldModInventory,
      },
    });
    return;
  }

  updateGameState((prev) => ({
    ...prev,
    unitHardpoints: {
      ...(prev.unitHardpoints || {}),
      [unitId]: unitHardpoints,
    },
    runFieldModInventory: fieldModInventory,
  }));
}

function renderHardpointsSection(unitId: string): string {
  const campaignProgress = loadCampaignProgress();
  const activeRun = campaignProgress.activeRun;

  // Get hardpoint state for this unit (2 slots per unit)
  const unitHardpoints: HardpointState = getStoredUnitHardpoints(unitId);
  const runInventory = getStoredFieldModInventory();

  const hardpointSlotsHtml = unitHardpoints.map((modInstance, index) => {
    const slotNumber = index + 1;
    let modDef = null;
    let modName = "Empty";
    let modDescription = "";
    let modRarity = "";

    if (modInstance) {
      modDef = getFieldModDef(modInstance.defId);
      if (modDef) {
        modName = modDef.name;
        modDescription = modDef.description;
        modRarity = modDef.rarity;
      }
    }

    return `
      <div class="hardpoint-slot" data-hardpoint-index="${index}">
        <div class="hardpoint-slot-header">
          <span class="hardpoint-slot-label">HARDPOINT ${slotNumber}</span>
          ${modRarity ? `<span class="hardpoint-rarity hardpoint-rarity--${modRarity}">${modRarity.toUpperCase()}</span>` : ""}
        </div>
        <div class="hardpoint-slot-body ${modInstance ? "" : "hardpoint-slot-body--empty"}">
          <div class="hardpoint-slot-name">${modName}</div>
          ${modDescription ? `<div class="hardpoint-slot-description">${modDescription}</div>` : ""}
          ${modInstance && modInstance.stacks > 1 ? `<div class="hardpoint-slot-stacks">x${modInstance.stacks}</div>` : ""}
        </div>
        <div class="hardpoint-slot-buttons">
          <button class="hardpoint-slot-btn" data-hardpoint-index="${index}">
            ${modInstance ? "REMOVE" : "SLOT MOD"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  const inventoryLabel = activeRun ? "AVAILABLE FIELD MODS" : "FIELD MOD LOCKER";

  // Available mods in locker inventory
  const availableModsHtml = runInventory.length > 0
    ? runInventory.map(modInstance => {
      const modDef = getFieldModDef(modInstance.defId);
      if (!modDef) return "";

      // Check if this mod is already slotted
      const isSlotted = unitHardpoints.some(hp => hp?.instanceId === modInstance.instanceId);

      return `
          <div class="hardpoint-mod-item ${isSlotted ? "hardpoint-mod-item--slotted" : ""}" data-mod-instance-id="${modInstance.instanceId}">
            <div class="hardpoint-mod-name">${modDef.name}</div>
            <div class="hardpoint-mod-rarity hardpoint-mod-rarity--${modDef.rarity}">${modDef.rarity.toUpperCase()}</div>
            <div class="hardpoint-mod-description">${modDef.description}</div>
            ${modInstance.stacks > 1 ? `<div class="hardpoint-mod-stacks">x${modInstance.stacks}</div>` : ""}
            ${isSlotted ? '<div class="hardpoint-mod-badge">SLOTTED</div>' : ""}
          </div>
        `;
    }).join("")
    : '<div class="hardpoints-empty-inventory">No field mods currently available.</div>';

  return `
    <div class="unitdetail-section">
      <div class="unitdetail-section-title">HARDPOINTS (2 SLOTS)</div>
      <div class="hardpoints-slots-grid">
        ${hardpointSlotsHtml}
      </div>
      <div class="hardpoints-inventory">
        <div class="hardpoints-inventory-title">${inventoryLabel}</div>
        <div class="hardpoints-inventory-list">
          ${availableModsHtml}
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// HARDPOINT INTERACTIONS
// ----------------------------------------------------------------------------

function openHardpointModal(unitId: string, hardpointIndex: number): void {
  const unitHardpoints: HardpointState = getStoredUnitHardpoints(unitId);
  const runInventory = getStoredFieldModInventory();
  const currentMod = unitHardpoints[hardpointIndex];

  // If there's a mod, remove it
  if (currentMod) {
    const newHardpoints: HardpointState = [...unitHardpoints];
    newHardpoints[hardpointIndex] = null;

    // Return mod to inventory
    const newInventory = [...runInventory, currentMod];

    saveHardpointState(unitId, newHardpoints, newInventory);

    renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
    return;
  }

  // If empty, show selection modal
  openHardpointSelectModal(unitId, null, hardpointIndex);
}

function openHardpointSelectModal(unitId: string, modInstanceId: string | null, targetHardpointIndex?: number): void {
  const unitHardpoints: HardpointState = getStoredUnitHardpoints(unitId);
  const runInventory = getStoredFieldModInventory();

  // If modInstanceId provided, find available hardpoints
  // If targetHardpointIndex provided, use that
  if (modInstanceId) {
    const modInstance = runInventory.find(m => m.instanceId === modInstanceId);
    if (!modInstance) return;

    // Find first empty hardpoint, or use target if provided
    let slotIndex = targetHardpointIndex;
    if (slotIndex === undefined) {
      slotIndex = unitHardpoints.findIndex(hp => hp === null);
    }

    if (slotIndex === -1 || slotIndex >= 2) {
      // No empty slot
      alert("No available hardpoint slots!");
      return;
    }

    // Slot the mod
    const newHardpoints: HardpointState = [...unitHardpoints];
    newHardpoints[slotIndex] = modInstance;

    // Remove from inventory
    const newInventory = runInventory.filter(m => m.instanceId !== modInstanceId);

    saveHardpointState(unitId, newHardpoints, newInventory);

    renderUnitDetailScreen(unitId, currentUnitDetailReturnTo);
  }
}

