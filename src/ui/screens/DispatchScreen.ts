import "../../styles.css";
import { getGameState, updateGameState } from "../../state/gameStore";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import {
  claimDispatchReport,
  DispatchMissionType,
  estimateDispatchSuccessChance,
  getDispatchEligibleUnits,
  getDispatchMissionBoard,
  getDispatchState,
  launchDispatchExpedition,
} from "../../core/dispatchSystem";
import { getPWRBand, getPWRBandColor } from "../../core/pwr";
import { STAT_LONG_LABEL, STAT_SHORT_LABEL } from "../../core/statTokens";

let selectedMissionId: DispatchMissionType = "scouting_run";
let selectedUnitIds = new Set<string>();
let returnDestination: BaseCampReturnTo = "basecamp";
let dispatchNotice = "";

const AFFINITY_LABELS: Record<string, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  support: "Support",
  mobility: "Mobility",
  survival: "Survival",
};

const MISSION_PREVIEW: Record<DispatchMissionType, string[]> = {
  scouting_run: [
    "Scouting reports for the next operation",
    `Small ${STAT_SHORT_LABEL} infusion`,
    "Minor salvage and route notes",
  ],
  salvage_expedition: [
    "Scrap, timber, and steam components",
    "Chance to recover intact gear",
    "Steady class XP for reserve units",
  ],
  arcane_survey: [
    "Chaos Shards and rare readings",
    "Chance to unlock Codex fragments",
    "High class XP for magic-focused teams",
  ],
  escort_detail: [
    "Strong WAD payout and mission credit",
    "Chance to surface a recruit lead",
    `Best ${STAT_SHORT_LABEL} among the starting missions`,
  ],
};

function formatClassLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAffinityLabel(value: string): string {
  return AFFINITY_LABELS[value] || formatClassLabel(value);
}

function renderMissionCards(): string {
  return getDispatchMissionBoard()
    .map((mission) => `
      <button class="dispatch-mission-card ${selectedMissionId === mission.id ? "dispatch-mission-card--active" : ""}" data-mission-id="${mission.id}">
        <div class="dispatch-mission-card__header">
          <div>
            <div class="dispatch-mission-card__title">${mission.name}</div>
            <div class="dispatch-mission-card__subtitle">Recommended PWR ${mission.recommendedPwr} • ${mission.durationTicks} ticks</div>
          </div>
          <div class="dispatch-mission-card__chance">BASE ${mission.baseSuccessRate}%</div>
        </div>
        <div class="dispatch-mission-card__summary">${mission.summary}</div>
        <div class="dispatch-mission-card__tags">
          ${mission.favoredAffinities.map((affinity) => `<span class="dispatch-tag">AFF: ${formatAffinityLabel(affinity)}</span>`).join("")}
          ${mission.favoredClasses.map((className) => `<span class="dispatch-tag dispatch-tag--class">${formatClassLabel(className)}</span>`).join("")}
        </div>
      </button>
    `)
    .join("");
}

function renderEligibleUnits(): string {
  const state = getGameState();
  const eligibleUnits = getDispatchEligibleUnits(state);
  if (eligibleUnits.length === 0) {
    return `
      <div class="dispatch-empty-state">
        No reserve units are available. Units in the active party or already on Dispatch cannot be assigned here.
      </div>
    `;
  }

  return eligibleUnits
    .map((unit) => {
      const pwr = unit.pwr || 0;
      const pwrBand = getPWRBand(pwr);
      const pwrColor = getPWRBandColor(pwr);
      const isSelected = selectedUnitIds.has(unit.id);
      const affinities = unit.affinities || {
        mobility: 0,
        survival: 0,
        magic: 0,
      };
      return `
        <button class="dispatch-unit-option ${isSelected ? "dispatch-unit-option--selected" : ""}" data-unit-id="${unit.id}">
          <div class="dispatch-unit-option__topline">
            <div>
              <div class="dispatch-unit-option__name">${unit.name}</div>
              <div class="dispatch-unit-option__class">${formatClassLabel((unit.unitClass as string) || "squire")}</div>
            </div>
            <div class="dispatch-unit-option__pwr" style="color: ${pwrColor}">
              ${pwr} • ${pwrBand}
            </div>
          </div>
          <div class="dispatch-unit-option__affinities">
            <span>MOB ${affinities.mobility || 0}</span>
            <span>SUR ${affinities.survival || 0}</span>
            <span>MAG ${(affinities as any).magic || 0}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderActiveExpeditions(): string {
  const dispatch = getDispatchState(getGameState());
  if (dispatch.activeExpeditions.length === 0) {
    return `<div class="dispatch-empty-state">No teams are currently out on assignment.</div>`;
  }

  return dispatch.activeExpeditions
    .map((expedition) => {
      const remaining = Math.max(0, expedition.completesAtTick - dispatch.dispatchTick);
      return `
        <div class="dispatch-activity-card">
          <div class="dispatch-activity-card__header">
            <div>
              <div class="dispatch-activity-card__title">${expedition.missionName}</div>
              <div class="dispatch-activity-card__subtitle">${expedition.assignedUnitNames.join(", ")}</div>
            </div>
            <span class="dispatch-pill">${remaining} ticks left</span>
          </div>
          <div class="dispatch-activity-card__body">
            ${expedition.summary}
          </div>
          <div class="dispatch-activity-card__meta">
            <span>Success Snapshot ${expedition.successChance}%</span>
            <span>Avg PWR ${expedition.averagePwr}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderReports(): string {
  const dispatch = getDispatchState(getGameState());
  if (dispatch.completedReports.length === 0) {
    return `<div class="dispatch-empty-state">No completed reports are waiting for debrief.</div>`;
  }

  return dispatch.completedReports
    .map((report) => {
      const rewards = report.outcome.rewards;
      const rewardBits = [
        rewards.wad > 0 ? `${rewards.wad} WAD` : "",
        rewards.squadXp > 0 ? `${rewards.squadXp} ${STAT_SHORT_LABEL}` : "",
        rewards.resources.metalScrap > 0 ? `${rewards.resources.metalScrap} Metal` : "",
        rewards.resources.wood > 0 ? `${rewards.resources.wood} Wood` : "",
        rewards.resources.chaosShards > 0 ? `${rewards.resources.chaosShards} Shards` : "",
        rewards.resources.steamComponents > 0 ? `${rewards.resources.steamComponents} Steam` : "",
        rewards.intelDossiers > 0 ? `${rewards.intelDossiers} Scouting Report` : "",
        rewards.gearDropId ? `Gear Recovery` : "",
        rewards.codexEntryId ? `Codex Fragment` : "",
        rewards.recruitCandidate ? `Recruit Lead` : "",
      ].filter(Boolean);

      return `
        <div class="dispatch-report-card ${report.outcome.success ? "dispatch-report-card--success" : "dispatch-report-card--failure"}">
          <div class="dispatch-report-card__header">
            <div>
              <div class="dispatch-report-card__title">${report.missionName}</div>
              <div class="dispatch-report-card__subtitle">${report.assignedUnitNames.join(", ")}</div>
            </div>
            <span class="dispatch-pill ${report.outcome.success ? "dispatch-pill--success" : "dispatch-pill--failure"}">
              ${report.outcome.success ? "SUCCESS" : "PARTIAL"}
            </span>
          </div>
          <div class="dispatch-report-card__body">${report.outcome.summary}</div>
          <div class="dispatch-report-card__rewards">
            ${rewardBits.map((bit) => `<span class="dispatch-tag">${bit}</span>`).join("") || '<span class="dispatch-tag">Experience only</span>'}
            <span class="dispatch-tag dispatch-tag--class">${report.outcome.rewards.classXpPerUnit} Class XP / unit</span>
          </div>
          <button class="dispatch-claim-btn" data-report-id="${report.id}">CLAIM REPORT</button>
        </div>
      `;
    })
    .join("");
}

function buildClaimNotice(reportId: string): string {
  const report = getDispatchState(getGameState()).completedReports.find((entry) => entry.id === reportId);
  if (!report) return "Dispatch report claimed.";

  const rewards = report.outcome.rewards;
  const materialTotal =
    rewards.resources.metalScrap
    + rewards.resources.wood
    + rewards.resources.chaosShards
    + rewards.resources.steamComponents;
  const notes = [
    rewards.wad > 0 ? `+${rewards.wad} WAD` : "",
    rewards.squadXp > 0 ? `+${rewards.squadXp} ${STAT_SHORT_LABEL} banked` : "",
    materialTotal > 0 ? "Recovered materials transferred to stores" : "",
    rewards.intelDossiers > 0 ? `+${rewards.intelDossiers} scouting report` : "",
    rewards.gearDropId ? "Recovered field gear added to stores" : "",
    rewards.codexEntryId ? "Codex fragment archived" : "",
    rewards.recruitCandidate ? "A new recruit lead is waiting in the Tavern" : "",
  ].filter(Boolean);

  return notes.length > 0 ? notes.join(" • ") : "Report logged. Reserve units gained class experience.";
}

export function renderDispatchScreen(returnTo: BaseCampReturnTo = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  returnDestination = returnTo;

  const state = getGameState();
  const dispatch = getDispatchState(state);
  const missions = getDispatchMissionBoard();
  if (!missions.some((mission) => mission.id === selectedMissionId)) {
    selectedMissionId = missions[0]?.id || "scouting_run";
  }

  const eligibleIds = new Set(getDispatchEligibleUnits(state).map((unit) => unit.id));
  selectedUnitIds = new Set(Array.from(selectedUnitIds).filter((unitId) => eligibleIds.has(unitId)));

  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) || missions[0];
  const selectedCount = selectedUnitIds.size;
  const projectedChance = selectedCount > 0
    ? estimateDispatchSuccessChance(state, selectedMission.id, Array.from(selectedUnitIds))
    : selectedMission.baseSuccessRate;
  const projectedBand = getPWRBand(selectedMission.recommendedPwr);
  const projectedColor = getPWRBandColor(selectedMission.recommendedPwr);
  const slotsFilled = `${dispatch.activeExpeditions.length} / ${dispatch.missionSlots}`;

  root.innerHTML = `
    <div class="dispatch-root town-screen ard-noise">
      <div class="dispatch-panel town-screen__panel">
        <div class="dispatch-header town-screen__header">
          <div class="dispatch-header-left town-screen__titleblock">
            <h1 class="dispatch-title">DISPATCH</h1>
            <div class="dispatch-subtitle">S/COM_OS // OFF-SCREEN_EXPEDITIONS</div>
          </div>
          <div class="dispatch-header-right town-screen__header-right">
            <div class="dispatch-metrics">
              <div class="dispatch-metric">
                <span class="dispatch-metric__label">ACTIVE SLOTS</span>
                <span class="dispatch-metric__value">${slotsFilled}</span>
              </div>
              <div class="dispatch-metric">
                <span class="dispatch-metric__label">SCOUTING REPORTS</span>
                <span class="dispatch-metric__value">${dispatch.intelDossiers}</span>
              </div>
              <div class="dispatch-metric">
                <span class="dispatch-metric__label">${STAT_SHORT_LABEL}</span>
                <span class="dispatch-metric__value">${dispatch.squadXpBank}</span>
              </div>
            </div>
            <button class="dispatch-back-btn town-screen__back-btn" id="dispatchBackBtn">
              <span class="btn-icon">←</span>
              <span class="btn-text">${getBaseCampReturnLabel(returnDestination)}</span>
            </button>
          </div>
        </div>

        <div class="dispatch-hero town-screen__hero">
          <div class="dispatch-hero__copy">
            <div class="dispatch-hero__eyebrow">COMMAND OVERVIEW</div>
            <div class="dispatch-hero__text">Dispatch missions advance when rooms are cleared, floors are reached or operations are completed.</div>
          </div>
          <div class="dispatch-hero__status">
            <div class="dispatch-hero__status-label">SELECTED MISSION</div>
            <div class="dispatch-hero__status-value">${selectedMission.name}</div>
            <div class="dispatch-hero__status-meta" style="color: ${projectedColor}">Recommended ${selectedMission.recommendedPwr} • ${projectedBand}</div>
          </div>
        </div>

        ${dispatchNotice ? `<div class="dispatch-notice town-screen__resource-strip">${dispatchNotice}</div>` : ""}

        <div class="dispatch-grid">
          <section class="dispatch-column town-screen__content-panel">
            <div class="dispatch-section-header">
              <div>
                <div class="dispatch-section-title">Mission Board</div>
              </div>
            </div>
            <div class="dispatch-mission-list">
              ${renderMissionCards()}
            </div>
          </section>

          <section class="dispatch-column town-screen__content-panel">
            <div class="dispatch-section-header">
              <div>
                <div class="dispatch-section-title">Assignment Desk</div>
              </div>
              <span class="dispatch-pill">${selectedCount} selected</span>
            </div>
            <div class="dispatch-assignment-card">
              <div class="dispatch-assignment-card__title">${selectedMission.name}</div>
              <div class="dispatch-assignment-card__summary">${selectedMission.summary}</div>
              <div class="dispatch-assignment-card__preview">
                ${MISSION_PREVIEW[selectedMission.id].map((line) => `<span class="dispatch-tag">${line}</span>`).join("")}
              </div>
              <div class="dispatch-assignment-card__summary">${STAT_LONG_LABEL} is shared across the whole squad.</div>
              <div class="dispatch-assignment-card__meta">
                <span>Projected Success ${projectedChance}%</span>
                <span>${selectedMission.durationTicks} ticks</span>
              </div>
              <button class="dispatch-launch-btn" id="dispatchLaunchBtn" ${selectedCount === 0 || dispatch.activeExpeditions.length >= dispatch.missionSlots ? "disabled" : ""}>
                ${dispatch.activeExpeditions.length >= dispatch.missionSlots ? "ALL SLOTS OCCUPIED" : "LAUNCH EXPEDITION"}
              </button>
            </div>
            <div class="dispatch-unit-list">
              ${renderEligibleUnits()}
            </div>
          </section>

          <section class="dispatch-column town-screen__content-panel">
            <div class="dispatch-section-header">
              <div>
                <div class="dispatch-section-title">Active Routes</div>
              </div>
            </div>
            <div class="dispatch-activity-list">
              ${renderActiveExpeditions()}
            </div>

            <div class="dispatch-section-header dispatch-section-header--reports">
              <div>
                <div class="dispatch-section-title">Debrief Queue</div>
              </div>
            </div>
            <div class="dispatch-report-list">
              ${renderReports()}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  attachListeners();
}

function attachListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.querySelectorAll<HTMLElement>("[data-mission-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMissionId = button.dataset.missionId as DispatchMissionType;
      selectedUnitIds.clear();
      renderDispatchScreen(returnDestination);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-unit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const unitId = button.dataset.unitId;
      if (!unitId) return;
      if (selectedUnitIds.has(unitId)) {
        selectedUnitIds.delete(unitId);
      } else {
        selectedUnitIds.add(unitId);
      }
      renderDispatchScreen(returnDestination);
    });
  });

  root.querySelector("#dispatchLaunchBtn")?.addEventListener("click", () => {
    try {
      updateGameState((state) => launchDispatchExpedition(state, selectedMissionId, Array.from(selectedUnitIds)));
      dispatchNotice = "Dispatch order confirmed. Reserve team routed beyond the perimeter.";
      selectedUnitIds.clear();
      renderDispatchScreen(returnDestination);
    } catch (error) {
      dispatchNotice = error instanceof Error ? error.message : "Dispatch failed to initialize.";
      renderDispatchScreen(returnDestination);
    }
  });

  root.querySelectorAll<HTMLElement>("[data-report-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const reportId = button.dataset.reportId;
      if (!reportId) return;
      dispatchNotice = buildClaimNotice(reportId);
      updateGameState((state) => claimDispatchReport(state, reportId));
      renderDispatchScreen(returnDestination);
    });
  });

  root.querySelector("#dispatchBackBtn")?.addEventListener("click", () => {
    unregisterBaseCampReturnHotkey("dispatch-screen");
    returnFromBaseCampScreen(returnDestination);
  });

  registerBaseCampReturnHotkey("dispatch-screen", returnDestination, {
    activeSelector: ".dispatch-root",
    allowFieldEKey: true,
  });
}
