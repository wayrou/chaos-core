import { getGameState, updateGameState } from "../../state/gameStore";
import {
  abandonActiveEchoRun,
  applyEchoDraftChoice,
  clearActiveEchoRun,
  getActiveEchoRun,
  getEchoModifierDef,
  getEchoResultsSummary,
  launchActiveEchoEncounterBattle,
  selectEchoMapNode,
  rerollActiveEchoChoices,
  startEchoRunSession,
} from "../../core/echoRuns";
import { getAllStarterEquipment } from "../../core/equipment";
import { enableAutosave, triggerAutosave } from "../../core/saveSystem";
import type { EchoRewardChoice, EchoRunNode, EchoUnitDraftOption } from "../../core/types";
import { showConfirmDialog } from "../components/confirmDialog";

const echoDraftPreviewByStage = new Map<string, string>();

function getEchoPreviewStageKey(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  return `${run.id}:${run.stage}:${run.encounterNumber}`;
}

function getSelectedEchoPreviewChoice(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): EchoRewardChoice | null {
  const unitChoices = run.draftChoices.filter((choice) => choice.unitOption);
  if (unitChoices.length === 0) {
    return null;
  }

  const stageKey = getEchoPreviewStageKey(run);
  const savedId = echoDraftPreviewByStage.get(stageKey);
  const matched = savedId ? unitChoices.find((choice) => choice.id === savedId) ?? null : null;
  if (matched) {
    return matched;
  }

  const fallback = unitChoices[0] ?? null;
  if (fallback) {
    echoDraftPreviewByStage.set(stageKey, fallback.id);
  }
  return fallback;
}

function setSelectedEchoPreviewChoice(run: NonNullable<ReturnType<typeof getActiveEchoRun>>, choiceId: string): void {
  echoDraftPreviewByStage.set(getEchoPreviewStageKey(run), choiceId);
}

function formatEchoEquipmentLabel(equipmentId: string | null, slotLabel: string): string {
  if (!equipmentId) {
    return `${slotLabel}: None`;
  }
  const equipment = getAllStarterEquipment()[equipmentId];
  return `${slotLabel}: ${equipment?.name ?? equipmentId}`;
}

function renderEchoUnitDraftPreview(unit: EchoUnitDraftOption): string {
  const affinityLines = Object.entries(unit.affinities ?? {})
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .map(([key, value]) => `
      <div class="echo-run-draft-preview__affinity-row">
        <span>${key.toUpperCase()}</span>
        <strong>${Math.round(Number(value) * 100)}%</strong>
      </div>
    `)
    .join("");

  const loadoutLines = [
    formatEchoEquipmentLabel(unit.loadout.primaryWeapon, "Primary"),
    formatEchoEquipmentLabel(unit.loadout.secondaryWeapon, "Secondary"),
    formatEchoEquipmentLabel(unit.loadout.helmet, "Helmet"),
    formatEchoEquipmentLabel(unit.loadout.chestpiece, "Chest"),
    formatEchoEquipmentLabel(unit.loadout.accessory1, "Accessory I"),
    formatEchoEquipmentLabel(unit.loadout.accessory2, "Accessory II"),
  ];

  return `
    <aside class="echo-run-draft-preview" aria-label="Draft unit preview">
      <div class="echo-run-draft-preview__kicker">FULL UNIT READOUT</div>
      <h3 class="echo-run-draft-preview__title">${unit.name}</h3>
      <div class="echo-run-draft-preview__meta">${unit.baseClass.toUpperCase()} // PWR ${unit.pwr} // ${unit.pwrBand.toUpperCase()} BAND</div>
      <div class="echo-run-tag-row">
        ${unit.affinityLean.map((entry) => `<span class="echo-run-tag">${entry.toUpperCase()}</span>`).join("")}
      </div>
      <div class="echo-run-draft-preview__trait">${unit.traitLabel ?? "Adaptive draft frame"}</div>

      <div class="echo-run-draft-preview__section">
        <div class="echo-run-draft-preview__section-title">Stats</div>
        <div class="echo-run-draft-preview__stats">
          <div class="echo-run-draft-preview__stat"><span>HP</span><strong>${unit.stats.maxHp}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>ATK</span><strong>${unit.stats.atk}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>DEF</span><strong>${unit.stats.def}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>AGI</span><strong>${unit.stats.agi}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>ACC</span><strong>${unit.stats.acc}</strong></div>
          <div class="echo-run-draft-preview__stat"><span>PWR</span><strong>${unit.pwr}</strong></div>
        </div>
      </div>

      <div class="echo-run-draft-preview__section">
        <div class="echo-run-draft-preview__section-title">Gear</div>
        <div class="echo-run-draft-preview__loadout">
          ${loadoutLines.map((line) => `<div class="echo-run-draft-preview__loadout-row">${line}</div>`).join("")}
        </div>
      </div>

      <div class="echo-run-draft-preview__section">
        <div class="echo-run-draft-preview__section-title">Affinities</div>
        <div class="echo-run-draft-preview__affinities">
          ${affinityLines}
        </div>
      </div>
    </aside>
  `;
}

function syncEchoScreenState(): void {
  updateGameState((prev) => ({
    ...prev,
    phase: "echo",
    currentBattle: null,
  }));
}

function launchEchoBattleFromScreen(): boolean {
  const battle = launchActiveEchoEncounterBattle();
  if (!battle) {
    return false;
  }

  updateGameState((prev) => ({
    ...prev,
    phase: "battle",
    currentBattle: battle,
  }));
  void triggerAutosave(getGameState());

  import("./BattleScreen").then(({ renderBattleScreen }) => {
    renderBattleScreen();
  });
  return true;
}

function leaveEchoRunsToMainMenu(): void {
  clearActiveEchoRun();
  enableAutosave(() => getGameState());
  updateGameState((prev) => ({
    ...prev,
    phase: "shell",
    currentBattle: null,
  }));
  import("./MainMenuScreen").then(({ renderMainMenu }) => {
    renderMainMenu();
  });
}

function renderUnitSummaryCard(unitId: string, run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  const unit = run.unitsById[unitId];
  if (!unit) {
    return "";
  }

  const affinityPairs = Object.entries(unit.affinities ?? {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 2)
    .map(([key]) => key.toUpperCase());
  const classLabel = String((unit as any).classId ?? unit.unitClass ?? "unit").toUpperCase();

  return `
    <div class="echo-run-summary-card">
      <div class="echo-run-summary-card__title">${unit.name}</div>
      <div class="echo-run-summary-card__meta">${classLabel} | PWR ${unit.pwr ?? "?"} | HP ${unit.hp}/${unit.maxHp}</div>
      <div class="echo-run-tag-row">
        ${affinityPairs.map((tag) => `<span class="echo-run-tag">${tag}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderFieldSummary(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  if (run.fields.length === 0) {
    return `<div class="echo-run-empty">No Echo Fields drafted yet.</div>`;
  }

  return run.fields.map((field) => `
    <div class="echo-run-summary-card echo-run-summary-card--field">
      <div class="echo-run-summary-card__title">${field.name}</div>
      <div class="echo-run-summary-card__meta">LV ${field.level}/${field.maxLevel} | RADIUS ${field.radius}</div>
      <div class="echo-run-summary-card__copy">${field.effectLabel} | ${field.description}</div>
    </div>
  `).join("");
}

function renderModifierSummary(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  if (run.tacticalModifiers.length === 0) {
    return `<div class="echo-run-empty">No tactical modifiers drafted yet.</div>`;
  }

  return run.tacticalModifiers.map((modifier) => {
    const def = getEchoModifierDef(modifier.defId);
    return `
      <div class="echo-run-summary-card echo-run-summary-card--modifier">
        <div class="echo-run-summary-card__title">${def?.name ?? modifier.defId}</div>
        <div class="echo-run-summary-card__meta">${(def?.trigger ?? "proc").replace(/_/g, " ").toUpperCase()}</div>
        <div class="echo-run-summary-card__copy">${def?.description ?? "Run-scoped tactical modifier."}</div>
      </div>
    `;
  }).join("");
}

function renderChoiceCard(
  choice: NonNullable<ReturnType<typeof getActiveEchoRun>>["draftChoices"][number],
  options: { isPreviewed: boolean },
): string {
  const unit = choice.unitOption;
  const field = choice.fieldDefinition;
  const modifierDef = getEchoModifierDef(choice.modifierDefId);
  const recovery = choice.recoveryOption;
  const training = choice.trainingOption;

  let detailBlock = `
    <div class="echo-run-choice-card__detail">
      <div class="echo-run-choice-card__line">${(modifierDef?.trigger ?? "proc").replace(/_/g, " ").toUpperCase()}</div>
      <div class="echo-run-choice-card__line">${modifierDef?.description ?? choice.description}</div>
    </div>
  `;

  if (unit) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">${unit.baseClass.toUpperCase()} | ${unit.pwrBand.toUpperCase()} BAND</div>
        <div class="echo-run-choice-card__line">Lean: ${unit.affinityLean.map((entry) => entry.toUpperCase()).join(" / ")}</div>
        <div class="echo-run-choice-card__line">${unit.traitLabel ?? "Adaptive draft frame"}</div>
      </div>
    `;
  } else if (field) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">LEVEL ${field.level} | RADIUS ${field.radius}</div>
        <div class="echo-run-choice-card__line">${field.effectLabel}</div>
        <div class="echo-run-choice-card__line">${field.description}</div>
      </div>
    `;
  } else if (recovery) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">${recovery.name.toUpperCase()}</div>
        <div class="echo-run-choice-card__line">${recovery.description}</div>
        ${recovery.rerollsGranted ? `<div class="echo-run-choice-card__line">+${recovery.rerollsGranted} REROLL</div>` : ""}
      </div>
    `;
  } else if (training) {
    detailBlock = `
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">${training.name.toUpperCase()}</div>
        <div class="echo-run-choice-card__line">${training.description}</div>
        <div class="echo-run-choice-card__line">TEAM-WIDE +${training.amount} ${training.stat.toUpperCase()}</div>
      </div>
    `;
  }

  return `
    <article class="echo-run-choice-card echo-run-choice-card--${choice.lane}${options.isPreviewed ? " echo-run-choice-card--previewed" : ""}">
      <div class="echo-run-choice-card__lane">${choice.lane.replace(/_/g, " ").toUpperCase()}</div>
      <div class="echo-run-choice-card__title">${choice.title}</div>
      <div class="echo-run-choice-card__subtitle">${choice.subtitle}</div>
      <div class="echo-run-choice-card__copy">${choice.description}</div>
      ${detailBlock}
      ${unit ? `<button class="echo-run-choice-card__inspect" type="button" data-echo-preview-id="${choice.id}">UNIT INFO</button>` : ""}
      <button class="echo-run-choice-card__button" type="button" data-echo-choice-id="${choice.id}">SELECT</button>
    </article>
  `;
}

function renderMapNodeCard(
  node: EchoRunNode,
  run: NonNullable<ReturnType<typeof getActiveEchoRun>>,
): string {
  const isAvailable = run.availableNodeIds.includes(node.id);
  const isCompleted = run.completedNodeIds.includes(node.id);
  const isCurrent = run.currentNodeId === node.id || run.pendingNodeId === node.id;
  const stateLabel = isCompleted
    ? "CLEARED"
    : isAvailable
      ? "AVAILABLE"
      : node.stratum === run.currentStratum
        ? "LOCKED"
        : "FUTURE";

  return `
    <article class="echo-run-map-node echo-run-map-node--${node.nodeType}${isAvailable ? " echo-run-map-node--available" : ""}${isCompleted ? " echo-run-map-node--completed" : ""}${isCurrent ? " echo-run-map-node--current" : ""}">
      <div class="echo-run-map-node__state">${stateLabel}</div>
      <div class="echo-run-map-node__title">${node.title}</div>
      <div class="echo-run-map-node__subtitle">${node.subtitle}</div>
      <div class="echo-run-map-node__meta">Tier ${node.dangerTier} // ${node.rewardBias}</div>
      <div class="echo-run-map-node__copy">${node.description}</div>
      <button class="echo-run-choice-card__button" type="button" data-echo-node-id="${node.id}" ${isAvailable ? "" : "disabled"}>
        ${node.nodeType === "support" ? "ACCESS NODE" : "ENGAGE NODE"}
      </button>
    </article>
  `;
}

function renderMapStage(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  const currentStratumNodes = Object.values(run.nodesById)
    .filter((node) => node.stratum === run.currentStratum)
    .sort((left, right) => left.layer - right.layer || left.branchIndex - right.branchIndex);

  const grouped = new Map<number, EchoRunNode[]>();
  currentStratumNodes.forEach((node) => {
    const bucket = grouped.get(node.layer) ?? [];
    bucket.push(node);
    grouped.set(node.layer, bucket);
  });

  const layersHtml = Array.from(grouped.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([layer, nodes]) => `
      <section class="echo-run-map-layer">
        <div class="echo-run-map-layer__label">LAYER ${layer.toString().padStart(2, "0")}</div>
        <div class="echo-run-map-layer__nodes">
          ${nodes.map((node) => renderMapNodeCard(node, run)).join("")}
        </div>
      </section>
    `)
    .join("");

  return `
    <section class="echo-run-choice-stage echo-run-choice-stage--map">
      <div class="echo-run-choice-stage__header">
        <div class="echo-run-choice-stage__title">Stratum ${run.currentStratum} Route Map</div>
        <div class="echo-run-choice-stage__actions">
          <button class="echo-run-secondary-btn" type="button" id="echoRunAbandonBtn">ABANDON RUN</button>
        </div>
      </div>
      <div class="echo-run-map-stage__summary">
        <div class="echo-run-meta-chip"><span>Boss Chains</span><strong>${run.bossChainsCleared}</strong></div>
        <div class="echo-run-meta-chip"><span>Milestones</span><strong>${run.milestonesReached}</strong></div>
        <div class="echo-run-meta-chip"><span>Reachable Nodes</span><strong>${run.availableNodeIds.length}</strong></div>
      </div>
      <div class="echo-run-map-stage">
        ${layersHtml}
      </div>
    </section>
  `;
}

function renderEchoResults(run: NonNullable<ReturnType<typeof getActiveEchoRun>>): string {
  const summary = getEchoResultsSummary();
  const lastSummary = run.lastEncounterSummary;

  return `
    <section class="echo-run-results">
      <div class="echo-run-results__hero">
        <div class="echo-run-results__kicker">S/COM_OS // ECHO SUMMARY</div>
        <h1 class="echo-run-results__title">RUN COMPLETE</h1>
        <p class="echo-run-results__copy">The simulation has ended. Draft state is ready to be discarded or restarted from zero.</p>
      </div>
      <div class="echo-run-results__grid">
        <div class="echo-run-results__item"><span>Total Score</span><strong>${summary?.totalScore ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Encounters Cleared</span><strong>${summary?.encountersCleared ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Units Drafted</span><strong>${summary?.unitsDrafted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Units Lost</span><strong>${summary?.unitsLost ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Fields Drafted</span><strong>${summary?.fieldsDrafted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Field Upgrades</span><strong>${summary?.fieldsUpgraded ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Modifiers Drafted</span><strong>${summary?.tacticalModifiersDrafted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Challenges Completed</span><strong>${summary?.challengesCompleted ?? 0}</strong></div>
        <div class="echo-run-results__item"><span>Milestones</span><strong>${run.milestonesReached}</strong></div>
        <div class="echo-run-results__item"><span>Boss Chains</span><strong>${run.bossChainsCleared}</strong></div>
      </div>
      ${lastSummary ? `
        <div class="echo-run-results__last">
          <div class="echo-run-results__last-title">FINAL ENCOUNTER</div>
          <div class="echo-run-results__last-copy">
            Encounter ${lastSummary.encounterNumber} | ${lastSummary.encounterType.toUpperCase()} |
            ${lastSummary.challengeCompleted ? "Challenge complete" : lastSummary.challengeFailed ? "Challenge missed" : "No challenge"}
          </div>
        </div>
      ` : ""}
      <div class="echo-run-results__actions">
        <button class="echo-run-primary-btn" type="button" id="echoRunRestartBtn">START NEW ECHO RUN</button>
        <button class="echo-run-secondary-btn" type="button" id="echoRunReturnMenuBtn">RETURN TO MAIN MENU</button>
      </div>
    </section>
  `;
}

export function renderEchoRunScreen(): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const run = getActiveEchoRun();
  if (!run) {
    leaveEchoRunsToMainMenu();
    return;
  }

  syncEchoScreenState();

  const stageTitle = run.stage === "initial_units"
    ? "Initial Unit Draft"
    : run.stage === "initial_field"
      ? "Initial Echo Field"
      : run.stage === "map"
        ? `Stratum ${run.currentStratum} Route Map`
        : run.stage === "milestone"
          ? `Milestone ${run.currentStratum}`
      : run.stage === "reward"
        ? "Reward Draft"
        : "Results";

  const stageCopy = run.stage === "initial_units"
    ? "Choose three temporary operators to build your starting draft squad."
    : run.stage === "initial_field"
      ? "Choose an initial Echo Field"
      : run.stage === "map"
        ? "Select one reachable node. Support nodes resolve immediately, while encounter nodes launch a battle."
        : run.stage === "milestone"
          ? "Choose one milestone package, then continue into the next endless stratum."
      : run.stage === "reward"
        ? "Pick exactly one reward lane and keep the run moving."
      : "The simulation is over. Nothing here carries into story progression.";

  const selectedPreviewChoice = getSelectedEchoPreviewChoice(run);
  const shouldShowDraftStage = run.stage === "initial_units" || run.stage === "initial_field" || run.stage === "reward" || run.stage === "milestone";
  const mainContent = run.stage === "results"
    ? renderEchoResults(run)
    : run.stage === "map"
      ? renderMapStage(run)
      : `
        <section class="echo-run-choice-stage">
          <div class="echo-run-choice-stage__header">
            <div class="echo-run-choice-stage__title">${stageTitle}</div>
            <div class="echo-run-choice-stage__actions">
              ${run.stage === "reward" ? `
                <button class="echo-run-secondary-btn" type="button" id="echoRunRerollBtn" ${run.rerolls <= 0 ? "disabled" : ""}>REROLL (${run.rerolls})</button>
              ` : ""}
              <button class="echo-run-secondary-btn" type="button" id="echoRunAbandonBtn">ABANDON RUN</button>
            </div>
          </div>
          <div class="echo-run-choice-stage__body${selectedPreviewChoice?.unitOption ? " echo-run-choice-stage__body--with-preview" : ""}">
            <div class="echo-run-choice-grid">
              ${run.draftChoices.map((choice) => renderChoiceCard(choice, {
                isPreviewed: selectedPreviewChoice?.id === choice.id,
              })).join("")}
            </div>
            ${selectedPreviewChoice?.unitOption ? renderEchoUnitDraftPreview(selectedPreviewChoice.unitOption) : ""}
          </div>
        </section>
      `;

  app.innerHTML = `
    <div class="echo-run-root">
      <div class="echo-run-shell">
        <header class="echo-run-header">
          <div>
            <div class="echo-run-header__kicker">S/COM_OS // ECHO RUNS</div>
            <h1 class="echo-run-header__title">${stageTitle}</h1>
            <p class="echo-run-header__copy">${stageCopy}</p>
          </div>
          <div class="echo-run-header__meta">
            <div class="echo-run-meta-chip"><span>Encounter</span><strong>${run.encounterNumber}</strong></div>
            <div class="echo-run-meta-chip"><span>Rerolls</span><strong>${run.rerolls}</strong></div>
            <div class="echo-run-meta-chip"><span>Score</span><strong>${run.totalScore}</strong></div>
          </div>
        </header>

        <div class="echo-run-body">
          <aside class="echo-run-sidebar">
            <section class="echo-run-panel">
              <div class="echo-run-panel__title">Draft Squad</div>
              ${run.squadUnitIds.length > 0 ? run.squadUnitIds.map((unitId) => renderUnitSummaryCard(unitId, run)).join("") : `<div class="echo-run-empty">No drafted units yet.</div>`}
            </section>
            <section class="echo-run-panel">
              <div class="echo-run-panel__title">Echo Fields</div>
              ${renderFieldSummary(run)}
            </section>
            <section class="echo-run-panel">
              <div class="echo-run-panel__title">Tactical Modifiers</div>
              ${renderModifierSummary(run)}
            </section>
            ${run.lastEncounterSummary ? `
              <section class="echo-run-panel echo-run-panel--summary">
                <div class="echo-run-panel__title">Last Encounter</div>
                <div class="echo-run-summary-stat"><span>Type</span><strong>${run.lastEncounterSummary.encounterType.toUpperCase()}</strong></div>
                <div class="echo-run-summary-stat"><span>Score</span><strong>+${run.lastEncounterSummary.scoreGained}</strong></div>
                <div class="echo-run-summary-stat"><span>Rerolls</span><strong>+${run.lastEncounterSummary.rerollsEarned}</strong></div>
                <div class="echo-run-summary-stat"><span>Field Triggers</span><strong>${run.lastEncounterSummary.fieldTriggerCount}</strong></div>
              </section>
            ` : ""}
          </aside>

          <main class="echo-run-main">
            ${mainContent}
          </main>
        </div>
      </div>
    </div>
  `;

  if (shouldShowDraftStage) {
    document.querySelectorAll<HTMLElement>("[data-echo-choice-id]").forEach((button) => {
      button.onclick = () => {
        const choiceId = button.getAttribute("data-echo-choice-id");
        if (!choiceId) {
          return;
        }
        applyEchoDraftChoice(choiceId);
        renderEchoRunScreen();
      };
    });

    document.querySelectorAll<HTMLElement>("[data-echo-preview-id]").forEach((button) => {
      button.onclick = () => {
        const choiceId = button.getAttribute("data-echo-preview-id");
        if (!choiceId) {
          return;
        }
        setSelectedEchoPreviewChoice(run, choiceId);
        renderEchoRunScreen();
      };
    });
  }

  document.querySelectorAll<HTMLElement>("[data-echo-node-id]").forEach((button) => {
    button.onclick = () => {
      const nodeId = button.getAttribute("data-echo-node-id");
      if (!nodeId) {
        return;
      }
      const result = selectEchoMapNode(nodeId);
      if (result === "battle") {
        launchEchoBattleFromScreen();
        return;
      }
      renderEchoRunScreen();
    };
  });

  const rerollBtn = document.getElementById("echoRunRerollBtn");
  if (rerollBtn) {
    rerollBtn.onclick = () => {
      rerollActiveEchoChoices();
      renderEchoRunScreen();
    };
  }

  const abandonBtn = document.getElementById("echoRunAbandonBtn");
  if (abandonBtn) {
    abandonBtn.onclick = async () => {
      if (!(await showConfirmDialog({
        title: "ABANDON ECHO RUN",
        message: "Abandon this Echo Run and move straight to the results summary?",
        confirmLabel: "ABANDON",
        variant: "danger",
        restoreFocusSelector: "#echoRunAbandonBtn",
      }))) {
        return;
      }
      abandonActiveEchoRun();
      renderEchoRunScreen();
    };
  }

  const restartBtn = document.getElementById("echoRunRestartBtn");
  if (restartBtn) {
    restartBtn.onclick = () => {
      startEchoRunSession();
      renderEchoRunScreen();
    };
  }

  const returnMenuBtn = document.getElementById("echoRunReturnMenuBtn");
  if (returnMenuBtn) {
    returnMenuBtn.onclick = () => {
      leaveEchoRunsToMainMenu();
    };
  }
}

export default renderEchoRunScreen;
