import { getGameState, updateGameState } from "../../state/gameStore";
import { autoEquipUnit, renderUnitDetailScreen } from "./Unitdetailscreen";
import { renderLoadoutScreen } from "./LoadoutScreen";
import { renderOperationMapScreen } from "./OperationMapScreen";
import { getPWRBand, getPWRBandColor } from "../../core/pwr";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import {
  UnitLoadout,
  calculateEquipmentStats,
  getAllStarterEquipment,
  getAllModules,
  buildDeckFromLoadout,
  UnitClass,
  canEquipWeapon,
} from "../../core/equipment";
import { getUnitManagementStandIconPath } from "../../core/portraits";
import { getBusyDispatchUnitIds } from "../../core/dispatchSystem";
import { getStatBank, STAT_SHORT_LABEL } from "../../core/statTokens";
import { clearControllerContext, updateFocusableElements } from "../../core/controllerSupport";
import { createEmptyResourceWallet } from "../../core/resources";
import type { TheaterDeploymentPreset, TheaterSquadPreset } from "../../core/types";
import {
  clampSquadName,
  formatDefaultSquadName,
  normalizeTheaterDeploymentPreset,
  normalizeSquadColorKey,
  normalizeSquadIcon,
  THEATER_SQUAD_COLOR_CHOICES,
  THEATER_SQUAD_ICON_CHOICES,
  THEATER_SQUAD_UNIT_LIMIT,
} from "../../core/theaterDeploymentPreset";

let rosterOperationEscHandler: ((e: KeyboardEvent) => void) | null = null;
let selectedDeploymentSquadId: string | null = null;

function returnToActiveOperationScreen(): void {
  const activeOperation = getGameState().operation;
  if (activeOperation?.theater) {
    import("./TheaterCommandScreen").then(({ renderTheaterCommandScreen }) => renderTheaterCommandScreen());
    return;
  }
  renderOperationMapScreen();
}

function unregisterRosterOperationReturnHotkey(): void {
  if (!rosterOperationEscHandler) return;
  window.removeEventListener("keydown", rosterOperationEscHandler);
  rosterOperationEscHandler = null;
}

function registerRosterOperationReturnHotkey(): void {
  unregisterRosterOperationReturnHotkey();
  rosterOperationEscHandler = (e: KeyboardEvent) => {
    if (!document.querySelector(".roster-root")) return unregisterRosterOperationReturnHotkey();
    if ((e.key?.toLowerCase() ?? "") !== "escape" && e.key !== "Escape" && e.keyCode !== 27) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    unregisterRosterOperationReturnHotkey();
    returnToActiveOperationScreen();
  };
  window.addEventListener("keydown", rosterOperationEscHandler);
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (value: string) => escapeHtml(value).replace(/"/g, "&quot;");

function formatClassName(cls: UnitClass): string {
  const names: Record<UnitClass, string> = {
    squire: "Squire", sentry: "Sentry", paladin: "Paladin", watchGuard: "Watch Guard",
    ranger: "Ranger", hunter: "Hunter", bowmaster: "Bowmaster", trapper: "Trapper",
    magician: "Magician", cleric: "Cleric", wizard: "Wizard", chaosmancer: "Chaosmancer",
    thief: "Thief", scout: "Scout", shadow: "Shadow", trickster: "Trickster",
    academic: "Academic", freelancer: "Freelancer",
  };
  return names[cls] || cls;
}

const formatStatDiff = (diff: number) => diff > 0 ? `<span class="stat-bonus">+${diff}</span>` : diff < 0 ? `<span class="stat-penalty">${diff}</span>` : "";

function nextPresetSquadId(squads: TheaterSquadPreset[]): string {
  let index = 1;
  const used = new Set(squads.map((squad) => squad.squadId));
  while (used.has(`tp_${index}`)) index += 1;
  return `tp_${index}`;
}

function selectedSquad(squads: TheaterSquadPreset[]): TheaterSquadPreset | null {
  const current = selectedDeploymentSquadId ? squads.find((squad) => squad.squadId === selectedDeploymentSquadId) ?? null : null;
  if (current) return current;
  selectedDeploymentSquadId = squads[0]?.squadId ?? null;
  return squads[0] ?? null;
}

function mutatePreset(update: (preset: TheaterDeploymentPreset) => TheaterDeploymentPreset): void {
  updateGameState((prev) => ({
    ...prev,
    theaterDeploymentPreset: normalizeTheaterDeploymentPreset(update(prev.theaterDeploymentPreset ?? { squads: [] }), prev.partyUnitIds ?? []),
  }));
}

export function renderRosterScreen(returnTo: BaseCampReturnTo | "loadout" | "operation" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;
  document.body.setAttribute("data-screen", "roster");
  clearControllerContext();

  const state = getGameState();
  const units = state.unitsById;
  const unitIds = Object.keys(units);
  const partyUnitIds = state.partyUnitIds ?? [];
  const busyDispatchUnitIds = getBusyDispatchUnitIds(state);
  const statBank = getStatBank(state);
  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const modulesById = (state as any).modulesById || getAllModules();
  const preset = normalizeTheaterDeploymentPreset(state.theaterDeploymentPreset, state.partyUnitIds ?? []);
  const presetMembership = new Map<string, TheaterSquadPreset>();
  preset.squads.forEach((squad) => squad.unitIds.forEach((unitId) => { if (!presetMembership.has(unitId)) presetMembership.set(unitId, squad); }));
  const focusedSquad = selectedSquad(preset.squads);
  const isLiveTheaterOperation = returnTo === "operation" && Boolean(state.operation?.theater);
  const partyUnits = unitIds.filter((id) => partyUnitIds.includes(id));
  const reserveUnits = unitIds.filter((id) => !partyUnitIds.includes(id));
  const portraitPath = getUnitManagementStandIconPath();

  const renderUnitCard = (unitId: string, isInParty: boolean) => {
    const unit = units[unitId];
    if (!unit) return "";
    const loadout: UnitLoadout = (unit as any).loadout || { primaryWeapon: null, secondaryWeapon: null, helmet: null, chestpiece: null, accessory1: null, accessory2: null };
    const equipStats = calculateEquipmentStats(loadout, equipmentById, modulesById);
    const unitClass: UnitClass = (unit as any).unitClass || "squire";
    const deckSize = buildDeckFromLoadout(unitClass, loadout, equipmentById, modulesById).length;
    const baseStats = (unit as any).stats || { maxHp: 20, atk: 5, def: 3, agi: 4, acc: 80 };
    const assignedSquad = presetMembership.get(unitId) ?? null;
    const isDispatched = busyDispatchUnitIds.has(unitId);
    const assignedToFocused = Boolean(focusedSquad && assignedSquad?.squadId === focusedSquad.squadId);
    const focusFull = Boolean(focusedSquad && !assignedToFocused && focusedSquad.unitIds.length >= THEATER_SQUAD_UNIT_LIMIT);
    const primaryWeapon = loadout.primaryWeapon ? equipmentById[loadout.primaryWeapon] : null;
    const secondaryWeapon = loadout.secondaryWeapon ? equipmentById[loadout.secondaryWeapon] : null;
    const weaponName = primaryWeapon && secondaryWeapon ? `${primaryWeapon.name} & ${secondaryWeapon.name}` : primaryWeapon?.name ?? secondaryWeapon?.name ?? "None";
    const pwr = (unit as any).pwr || 0;
    return `
      <div class="roster-unit-card ${isInParty ? "roster-unit-card--in-party" : ""}" data-unit-id="${unitId}">
        <div class="roster-unit-header">
          <div class="roster-unit-portrait"><img src="${portraitPath}" alt="${escapeAttr(unit.name)}" class="roster-unit-portrait-img" onerror="this.src='/assets/portraits/units/core/Unit_Stand_Test.png';" /></div>
          <div class="roster-unit-header-text">
            <div class="roster-unit-name">${escapeHtml(unit.name)}</div>
            <div class="roster-unit-class">${escapeHtml(formatClassName(unitClass))}</div>
            <div class="roster-unit-pwr" style="color:${getPWRBandColor(pwr)}"><span class="roster-pwr-label">PWR:</span><span class="roster-pwr-value">${pwr}</span><span class="roster-pwr-band">(${escapeHtml(getPWRBand(pwr))})</span></div>
          </div>
        </div>
        <div class="roster-unit-body">
          <div class="roster-unit-stats">
            <div class="roster-stat"><span class="roster-stat-label">HP</span><span class="roster-stat-value">${baseStats.maxHp + equipStats.hp}</span>${formatStatDiff(equipStats.hp)}</div>
            <div class="roster-stat"><span class="roster-stat-label">ATK</span><span class="roster-stat-value">${baseStats.atk + equipStats.atk}</span>${formatStatDiff(equipStats.atk)}</div>
            <div class="roster-stat"><span class="roster-stat-label">DEF</span><span class="roster-stat-value">${baseStats.def + equipStats.def}</span>${formatStatDiff(equipStats.def)}</div>
            <div class="roster-stat"><span class="roster-stat-label">AGI</span><span class="roster-stat-value">${baseStats.agi + equipStats.agi}</span>${formatStatDiff(equipStats.agi)}</div>
            <div class="roster-stat"><span class="roster-stat-label">ACC</span><span class="roster-stat-value">${baseStats.acc + equipStats.acc}</span>${formatStatDiff(equipStats.acc)}</div>
          </div>
          <div class="roster-unit-equip">
            <div class="roster-equip-row"><span class="roster-equip-label">WEAPON</span><span class="roster-equip-value">${escapeHtml(weaponName)}</span></div>
            <div class="roster-equip-row"><span class="roster-equip-label">DECK</span><span class="roster-equip-value">${deckSize} cards</span></div>
          </div>
        </div>
        <div class="roster-unit-footer">
          <div class="roster-unit-badges">
            ${isInParty ? '<span class="roster-party-badge">IN PARTY</span>' : ""}
            ${isDispatched ? '<span class="roster-party-badge roster-party-badge--dispatch">ON DISPATCH</span>' : ""}
            <span class="roster-party-badge roster-party-badge--deployment">${assignedSquad ? `${escapeHtml(assignedSquad.icon)} ${escapeHtml(assignedSquad.displayName)}` : "UNASSIGNED"}</span>
          </div>
          <div class="roster-unit-actions">
            <button class="roster-toggle-party-btn ${isInParty ? "roster-toggle-party-btn--remove" : "roster-toggle-party-btn--add"}" data-unit-id="${unitId}" data-action="${isInParty ? "remove" : "add"}" type="button" ${isDispatched ? "disabled" : ""}>${isDispatched ? "ON DISPATCH" : isInParty ? "− REMOVE" : "+ ADD TO PARTY"}</button>
            ${isLiveTheaterOperation ? "" : `<button class="roster-deployment-btn ${assignedToFocused ? "roster-deployment-btn--remove" : ""}" type="button" data-roster-deploy="${assignedToFocused ? "remove" : "assign"}" data-unit-id="${unitId}" ${!focusedSquad || focusFull ? "disabled" : ""}>${!focusedSquad ? "SELECT A SQUAD" : assignedToFocused ? "REMOVE FROM SQUAD" : assignedSquad ? `MOVE TO ${escapeHtml(focusedSquad.displayName.toUpperCase())}` : `ASSIGN TO ${escapeHtml(focusedSquad.displayName.toUpperCase())}`}</button>`}
            <button class="roster-detail-btn" data-unit-id="${unitId}" type="button">MANAGE</button>
          </div>
        </div>
      </div>
    `;
  };

  root.innerHTML = `
    <div class="roster-root town-screen ard-noise">
      <div class="roster-card town-screen__panel">
        <div class="roster-header town-screen__header">
          <div class="roster-header-left town-screen__titleblock"><h1 class="roster-title">UNIT ROSTER</h1><div class="roster-subtitle">S/COM_OS // UNIT_MANAGEMENT</div></div>
          <div class="roster-header-right town-screen__header-right">
            <div class="roster-count roster-count--stat"><span class="roster-count-label">${STAT_SHORT_LABEL}</span><span class="roster-count-value">${statBank}</span></div>
            <div class="roster-count"><span class="roster-count-label">UNITS</span><span class="roster-count-value">${unitIds.length} / ${partyUnitIds.length} IN PARTY</span></div>
            <button class="roster-back-btn town-screen__back-btn" data-return-to="${returnTo}" type="button"><span class="btn-icon">â†</span><span class="btn-text">${returnTo === "operation" ? "OPERATION MAP" : returnTo === "field" ? "FIELD MODE" : returnTo === "loadout" ? "LOADOUT" : getBaseCampReturnLabel(returnTo as BaseCampReturnTo)}</span></button>
          </div>
        </div>
        <div class="roster-body">
          <div class="roster-deployment-panel roster-section">
            <div class="roster-section-header">
              <div class="roster-section-header-top">
                <div><div class="roster-section-title">THEATER DEPLOYMENT</div><div class="roster-section-subtitle">Persistent launch squads for theater operations</div></div>
                ${isLiveTheaterOperation ? `<span class="roster-deployment-status">LIVE THEATER OPERATION</span>` : `<button class="roster-auto-equip-btn" id="rosterAddDeploymentSquadBtn" type="button">+ NEW SQUAD</button>`}
              </div>
              <div class="roster-deployment-copy">${isLiveTheaterOperation ? "Saved presets are read-only while a theater operation is active. Use Theater Command for live squad changes." : `Select a squad, then assign units below. ${THEATER_SQUAD_UNIT_LIMIT} units max per squad.`}</div>
            </div>
            <div class="roster-deployment-layout">
              <div class="roster-deployment-ledger">
                ${preset.squads.length > 0 ? preset.squads.map((squad) => `<button class="roster-deployment-squad-card ${squad.squadId === focusedSquad?.squadId ? "roster-deployment-squad-card--selected" : ""}" type="button" data-roster-deployment-select="${squad.squadId}"><div class="roster-deployment-squad-card__header"><span class="roster-deployment-squad-card__icon">${squad.icon}</span><span class="roster-deployment-squad-card__name">${escapeHtml(squad.displayName)}</span></div><div class="roster-deployment-squad-card__meta">${squad.unitIds.length} / ${THEATER_SQUAD_UNIT_LIMIT} UNITS</div></button>`).join("") : `<div class="roster-section-empty">No theater deployment squads yet.</div>`}
              </div>
              <div class="roster-deployment-detail">
                ${focusedSquad ? `
                  <div class="roster-deployment-detail__header">
                    <div class="roster-deployment-detail__identity">
                      ${isLiveTheaterOperation ? `<span class="roster-deployment-detail__icon">${focusedSquad.icon}</span>` : `<button class="roster-deployment-detail__icon" id="rosterCycleDeploymentIconBtn" type="button">${focusedSquad.icon}</button>`}
                      <div class="roster-deployment-detail__copy">
                        ${isLiveTheaterOperation ? `<div class="roster-deployment-detail__name">${escapeHtml(focusedSquad.displayName)}</div>` : `<input class="roster-deployment-detail__name-input" id="rosterDeploymentNameInput" type="text" maxlength="24" value="${escapeAttr(focusedSquad.displayName)}" />`}
                        <div class="roster-deployment-detail__meta">${focusedSquad.unitIds.length} / ${THEATER_SQUAD_UNIT_LIMIT} UNITS READY</div>
                      </div>
                    </div>
                    <div class="roster-deployment-detail__actions">
                      ${isLiveTheaterOperation ? `<span class="roster-deployment-detail__color">${escapeHtml(focusedSquad.colorKey.toUpperCase())}</span>` : `<button class="roster-deployment-detail__color" id="rosterCycleDeploymentColorBtn" type="button">${escapeHtml(focusedSquad.colorKey.toUpperCase())}</button><button class="roster-debug-btn roster-debug-btn--danger" id="rosterDeleteDeploymentSquadBtn" type="button">DELETE</button>`}
                    </div>
                  </div>
                  <div class="roster-deployment-detail__members">
                    ${focusedSquad.unitIds.length > 0 ? focusedSquad.unitIds.map((unitId) => `<div class="roster-deployment-member"><div><div class="roster-deployment-member__name">${escapeHtml(units[unitId]?.name ?? unitId)}</div><div class="roster-deployment-member__meta">${escapeHtml(formatClassName((units[unitId]?.unitClass ?? "freelancer") as UnitClass))}${busyDispatchUnitIds.has(unitId) ? " // ON DISPATCH" : ""}</div></div>${isLiveTheaterOperation ? "" : `<button class="roster-chip-btn" type="button" data-roster-deployment-remove="${unitId}">REMOVE</button>`}</div>`).join("") : `<div class="roster-section-empty">No members assigned. Select this squad, then assign units below.</div>`}
                  </div>
                ` : `<div class="roster-section-empty">Select a deployment squad to edit it.</div>`}
              </div>
            </div>
          </div>
          <div class="roster-sections">
            <div class="roster-section roster-section--party">
              <div class="roster-section-header"><div class="roster-section-header-top"><div><div class="roster-section-title">PARTY (${partyUnitIds.length})</div><div class="roster-section-subtitle">Flat party roster used outside theater preset launches</div></div>${partyUnitIds.length > 0 ? `<button class="roster-auto-equip-btn" id="autoEquipPartyBtn" type="button">âš¡ AUTO-EQUIP ALL</button>` : ""}</div></div>
              <div class="roster-section-grid roster-section-grid--party">${partyUnits.map((unitId) => renderUnitCard(unitId, true)).join("") || '<div class="roster-section-empty">Click "ADD TO PARTY" on reserve units to add them here</div>'}</div>
            </div>
            <div class="roster-section roster-section--reserve">
              <div class="roster-section-header"><div class="roster-section-title">RESERVE (${reserveUnits.length})</div><div class="roster-section-subtitle">Units not currently in the flat party roster</div></div>
              <div class="roster-section-grid roster-section-grid--reserve">${reserveUnits.map((unitId) => renderUnitCard(unitId, false)).join("") || '<div class="roster-section-empty">No reserve units</div>'}</div>
            </div>
          </div>
        </div>
        <div class="roster-footer">
          <div class="roster-legend"><span class="roster-legend-item"><span class="roster-legend-dot roster-legend-dot--party"></span>In Party</span><span class="roster-legend-item"><span class="roster-legend-dot roster-legend-dot--reserve"></span>Reserve</span></div>
          <div class="roster-debug"><button class="roster-debug-btn" id="debugEquipBtn" type="button">ðŸ”§ DEBUG: Give All Equipment</button></div>
        </div>
      </div>
    </div>
  `;

  if (returnTo === "operation") registerRosterOperationReturnHotkey(); else unregisterRosterOperationReturnHotkey();
  if (returnTo !== "loadout" && returnTo !== "operation") registerBaseCampReturnHotkey("roster-screen", returnTo, { allowFieldEKey: true, activeSelector: ".roster-root" }); else unregisterBaseCampReturnHotkey("roster-screen");

  root.onclick = (event) => {
    const target = event.target as HTMLElement;
    const unitId = target.closest<HTMLElement>("[data-unit-id]")?.getAttribute("data-unit-id");
    const actionBtn = target.closest<HTMLElement>(".roster-toggle-party-btn");
    if (actionBtn && unitId) { actionBtn.getAttribute("data-action") === "add" ? updateGameState((prev) => ({ ...prev, partyUnitIds: [...new Set([...(prev.partyUnitIds ?? []), unitId])] })) : updateGameState((prev) => ({ ...prev, partyUnitIds: (prev.partyUnitIds ?? []).filter((id) => id !== unitId) })); return renderRosterScreen(returnTo); }
    const manageBtn = target.closest<HTMLElement>(".roster-detail-btn");
    if (manageBtn && unitId) { unregisterBaseCampReturnHotkey("roster-screen"); unregisterRosterOperationReturnHotkey(); return renderUnitDetailScreen(unitId, returnTo); }
    if (target.closest(".roster-back-btn")) { unregisterBaseCampReturnHotkey("roster-screen"); unregisterRosterOperationReturnHotkey(); return returnTo === "loadout" ? renderLoadoutScreen() : returnTo === "operation" ? returnToActiveOperationScreen() : returnFromBaseCampScreen(returnTo as BaseCampReturnTo); }
    if (target.closest("#autoEquipPartyBtn")) {
      const equipmentPool = (state as any).equipmentPool || Object.keys(equipmentById);
      for (const id of state.partyUnitIds ?? []) { const unit = state.unitsById[id]; if (unit) autoEquipUnit(id, ((unit as any).unitClass || "squire") as UnitClass, equipmentById, equipmentPool, false); }
      return renderRosterScreen(returnTo);
    }
    if (target.closest("#rosterAddDeploymentSquadBtn") && !isLiveTheaterOperation) {
      const squadId = nextPresetSquadId(preset.squads); selectedDeploymentSquadId = squadId;
      mutatePreset((current) => ({ squads: [...current.squads, { squadId, displayName: formatDefaultSquadName(current.squads.length), icon: normalizeSquadIcon(undefined, current.squads.length), colorKey: normalizeSquadColorKey(undefined, current.squads.length), unitIds: [] }] }));
      return renderRosterScreen(returnTo);
    }
    const selectBtn = target.closest<HTMLElement>("[data-roster-deployment-select]");
    if (selectBtn) { selectedDeploymentSquadId = selectBtn.getAttribute("data-roster-deployment-select"); return renderRosterScreen(returnTo); }
    if (!isLiveTheaterOperation && target.closest("#rosterCycleDeploymentIconBtn") && focusedSquad) {
      mutatePreset((current) => ({ squads: current.squads.map((squad, index) => squad.squadId === focusedSquad.squadId ? { ...squad, icon: THEATER_SQUAD_ICON_CHOICES[(THEATER_SQUAD_ICON_CHOICES.indexOf(squad.icon as any) + 1 + THEATER_SQUAD_ICON_CHOICES.length) % THEATER_SQUAD_ICON_CHOICES.length] ?? normalizeSquadIcon(undefined, index) } : squad) }));
      return renderRosterScreen(returnTo);
    }
    if (!isLiveTheaterOperation && target.closest("#rosterCycleDeploymentColorBtn") && focusedSquad) {
      mutatePreset((current) => ({ squads: current.squads.map((squad, index) => squad.squadId === focusedSquad.squadId ? { ...squad, colorKey: THEATER_SQUAD_COLOR_CHOICES[(THEATER_SQUAD_COLOR_CHOICES.indexOf(squad.colorKey as any) + 1 + THEATER_SQUAD_COLOR_CHOICES.length) % THEATER_SQUAD_COLOR_CHOICES.length] ?? normalizeSquadColorKey(undefined, index) } : squad) }));
      return renderRosterScreen(returnTo);
    }
    if (!isLiveTheaterOperation && target.closest("#rosterDeleteDeploymentSquadBtn") && focusedSquad) {
      mutatePreset((current) => ({ squads: current.squads.filter((squad) => squad.squadId !== focusedSquad.squadId) })); selectedDeploymentSquadId = null;
      return renderRosterScreen(returnTo);
    }
    const removeMemberBtn = target.closest<HTMLElement>("[data-roster-deployment-remove]");
    if (!isLiveTheaterOperation && removeMemberBtn) {
      const removeId = removeMemberBtn.getAttribute("data-roster-deployment-remove"); if (!removeId) return;
      mutatePreset((current) => ({ squads: current.squads.map((squad) => ({ ...squad, unitIds: squad.unitIds.filter((id) => id !== removeId) })) }));
      return renderRosterScreen(returnTo);
    }
    const deployBtn = target.closest<HTMLElement>(".roster-deployment-btn");
    if (!isLiveTheaterOperation && deployBtn && focusedSquad && unitId) {
      if (deployBtn.getAttribute("data-roster-deploy") === "remove") mutatePreset((current) => ({ squads: current.squads.map((squad) => ({ ...squad, unitIds: squad.unitIds.filter((id) => id !== unitId) })) }));
      else if (focusedSquad.unitIds.length >= THEATER_SQUAD_UNIT_LIMIT) alert(`Deployment squads cap at ${THEATER_SQUAD_UNIT_LIMIT} units.`);
      else mutatePreset((current) => ({ squads: current.squads.map((squad) => squad.squadId === focusedSquad.squadId ? { ...squad, unitIds: [...squad.unitIds.filter((id) => id !== unitId), unitId] } : { ...squad, unitIds: squad.unitIds.filter((id) => id !== unitId) }) }));
      return renderRosterScreen(returnTo);
    }
    if (target.closest("#debugEquipBtn")) {
      if (!confirm("Give all starter equipment to all units for testing?")) return;
      updateGameState((prev) => {
        const allEquipment = getAllStarterEquipment(); const nextUnitsById = { ...prev.unitsById };
        Object.keys(nextUnitsById).forEach((id) => {
          const unit = nextUnitsById[id]; const unitClass: UnitClass = (unit as any).unitClass || "squire"; const nextLoadout: UnitLoadout = (unit as any).loadout || { primaryWeapon: null, secondaryWeapon: null, helmet: null, chestpiece: null, accessory1: null, accessory2: null };
          const compatibleWeapon = Object.values(allEquipment).filter((eq) => eq.slot === "weapon").find((weapon) => canEquipWeapon(unitClass, (weapon as any).weaponType)); if (compatibleWeapon) nextLoadout.primaryWeapon = compatibleWeapon.id;
          const helmet = Object.values(allEquipment).find((eq) => eq.slot === "helmet"); if (helmet) nextLoadout.helmet = helmet.id;
          const chestpiece = Object.values(allEquipment).find((eq) => eq.slot === "chestpiece"); if (chestpiece) nextLoadout.chestpiece = chestpiece.id;
          const accessories = Object.values(allEquipment).filter((eq) => eq.slot === "accessory"); if (accessories[0]) nextLoadout.accessory1 = accessories[0].id; if (accessories[1]) nextLoadout.accessory2 = accessories[1].id;
          nextUnitsById[id] = { ...unit, loadout: nextLoadout };
        });
        return {
          ...prev,
          wad: 9999,
          resources: createEmptyResourceWallet({
            metalScrap: 99,
            wood: 99,
            chaosShards: 99,
            steamComponents: 99,
            alloy: 99,
            drawcord: 99,
            fittings: 99,
            resin: 99,
            chargeCells: 99,
          }),
          equipmentById: { ...(prev.equipmentById || {}), ...allEquipment },
          unitsById: nextUnitsById,
        };
      });
      return renderRosterScreen(returnTo);
    }
    const card = target.closest<HTMLElement>(".roster-unit-card");
    if (card && !target.closest("button") && !target.closest("input")) {
      const cardUnitId = card.getAttribute("data-unit-id");
      if (!cardUnitId) return;
      unregisterBaseCampReturnHotkey("roster-screen");
      unregisterRosterOperationReturnHotkey();
      return renderUnitDetailScreen(cardUnitId, returnTo);
    }
  };

  root.onchange = (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.id === "rosterDeploymentNameInput" && focusedSquad && !isLiveTheaterOperation) {
      mutatePreset((current) => ({ squads: current.squads.map((squad, index) => squad.squadId === focusedSquad.squadId ? { ...squad, displayName: clampSquadName(target.value, formatDefaultSquadName(index)) } : squad) }));
      renderRosterScreen(returnTo);
    }
  };

  root.onkeydown = (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.id === "rosterDeploymentNameInput" && event.key === "Enter") {
      event.preventDefault();
      target.blur();
    }
  };

  updateFocusableElements();
}
