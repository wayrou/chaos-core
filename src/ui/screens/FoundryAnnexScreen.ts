import { getGameState, updateGameState } from "../../state/gameStore";
import {
  FOUNDRY_MODULE_DEFINITIONS,
  FOUNDRY_PARTITION_DEFINITIONS,
  getFoundryUnlockState,
  getOrderedFoundryModuleTypes,
  getOrderedFoundryPartitionTypes,
  unlockFoundryModuleTypeInState,
  unlockFoundryPartitionTypeInState,
} from "../../core/foundrySystem";
import { AutomationModuleType, PartitionType } from "../../core/types";
import { showSystemPing } from "../components/systemPing";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";

function attachFoundryAnnexListeners(returnTo: BaseCampReturnTo): void {
  const backBtn = document.getElementById("foundryAnnexBackBtn");
  backBtn?.addEventListener("click", () => {
    unregisterBaseCampReturnHotkey("foundry-annex-screen");
    returnFromBaseCampScreen(returnTo);
  });

  document.querySelectorAll<HTMLElement>("[data-foundry-unlock-module]").forEach((button) => {
    button.addEventListener("click", () => {
      const moduleType = button.getAttribute("data-foundry-unlock-module") as AutomationModuleType | null;
      if (!moduleType) {
        return;
      }
      const outcome = unlockFoundryModuleTypeInState(getGameState(), moduleType);
      updateGameState(() => outcome.state);
      showSystemPing({
        type: outcome.success ? "info" : "error",
        title: outcome.success ? "Module Unlocked" : "Unlock Failed",
        message: outcome.message,
        channel: "foundry",
      });
      renderFoundryAnnexScreen(returnTo);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-foundry-unlock-partition]").forEach((button) => {
    button.addEventListener("click", () => {
      const partitionType = button.getAttribute("data-foundry-unlock-partition") as PartitionType | null;
      if (!partitionType) {
        return;
      }
      const outcome = unlockFoundryPartitionTypeInState(getGameState(), partitionType);
      updateGameState(() => outcome.state);
      showSystemPing({
        type: outcome.success ? "info" : "error",
        title: outcome.success ? "Partition Unlocked" : "Unlock Failed",
        message: outcome.message,
        channel: "foundry",
      });
      renderFoundryAnnexScreen(returnTo);
    });
  });

  registerBaseCampReturnHotkey("foundry-annex-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".foundry-annex-screen",
  });
}

function renderResourceStatus(): string {
  const state = getGameState();
  return `
    <div class="schema-screen__resource-list foundry-annex-screen__resource-list">
      <div class="schema-screen__resource-item">
        <span class="schema-screen__resource-label">Metal Scrap</span>
        <span class="schema-screen__resource-value">${state.resources.metalScrap}</span>
      </div>
      <div class="schema-screen__resource-item">
        <span class="schema-screen__resource-label">Wood</span>
        <span class="schema-screen__resource-value">${state.resources.wood}</span>
      </div>
      <div class="schema-screen__resource-item">
        <span class="schema-screen__resource-label">Chaos Shards</span>
        <span class="schema-screen__resource-value">${state.resources.chaosShards}</span>
      </div>
      <div class="schema-screen__resource-item">
        <span class="schema-screen__resource-label">Steam Components</span>
        <span class="schema-screen__resource-value">${state.resources.steamComponents}</span>
      </div>
    </div>
  `;
}

function formatFoundryCost(cost: Partial<ReturnType<typeof getGameState>["resources"]>): string {
  const parts = [
    cost.metalScrap ? `${cost.metalScrap} Metal` : null,
    cost.wood ? `${cost.wood} Wood` : null,
    cost.chaosShards ? `${cost.chaosShards} Shards` : null,
    cost.steamComponents ? `${cost.steamComponents} Steam` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" // ") : "0";
}

function renderUnlockedModules(): string {
  const state = getGameState();
  const foundry = getFoundryUnlockState(state);
  if (foundry.unlockedModuleTypes.length === 0) {
    return `
      <article class="schema-screen__auth-card schema-screen__auth-card--locked">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">MODULES</div>
            <h3 class="schema-screen__auth-card-title">No module authorizations unlocked yet</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--starter">LOCKED</div>
        </div>
        <p class="schema-screen__auth-card-copy">Authorize theater automation hardware here, then install modules directly onto secured rooms and annexes during operations.</p>
      </article>
    `;
  }

  return foundry.unlockedModuleTypes.map((moduleType) => {
    const definition = FOUNDRY_MODULE_DEFINITIONS[moduleType];
    return `
      <article class="schema-screen__auth-card schema-screen__auth-card--unlocked">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">${definition.category.toUpperCase()}</div>
            <h3 class="schema-screen__auth-card-title">${definition.displayName}</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--online">AUTHORIZED</div>
        </div>
        <p class="schema-screen__auth-card-copy">${definition.description}</p>
        <div class="schema-screen__auth-card-meta">
          <span>Install cost in theater: ${formatFoundryCost(definition.buildCost)}</span>
          <span>${definition.remoteTargetMinBw ? `Remote target floor: ${definition.remoteTargetMinBw} BW` : "Local install or adjacent routing ready"}</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderAvailableModuleUnlocks(): string {
  const state = getGameState();
  const foundry = getFoundryUnlockState(state);
  const availableModules = getOrderedFoundryModuleTypes()
    .filter((moduleType) => !foundry.unlockedModuleTypes.includes(moduleType))
    .filter((moduleType) => !FOUNDRY_MODULE_DEFINITIONS[moduleType].placeholder);

  if (availableModules.length === 0) {
    return `
      <article class="schema-screen__auth-card schema-screen__auth-card--unlocked">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">AUTHORIZATION</div>
            <h3 class="schema-screen__auth-card-title">All live module types unlocked</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--online">CLEAR</div>
        </div>
        <p class="schema-screen__auth-card-copy">The current theater automation slice is fully authorized. Install modules from the theater command screen.</p>
      </article>
    `;
  }

  return availableModules.map((moduleType) => {
    const definition = FOUNDRY_MODULE_DEFINITIONS[moduleType];
    return `
      <article class="schema-screen__auth-card schema-screen__auth-card--starter">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">${definition.category.toUpperCase()}</div>
            <h3 class="schema-screen__auth-card-title">${definition.displayName}</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--starter">AVAILABLE</div>
        </div>
        <p class="schema-screen__auth-card-copy">${definition.description}</p>
        <div class="schema-screen__auth-card-meta">
          <span>Unlock cost: ${formatFoundryCost(definition.buildCost)}</span>
          <span>${definition.remoteTargetMinBw ? `Remote routing ready at ${definition.remoteTargetMinBw} BW` : "Core local automation component"}</span>
        </div>
        <div class="schema-screen__auth-card-footer">
          <button class="schema-screen__unlock-btn foundry-annex-screen__unlock-btn" type="button" data-foundry-unlock-module="${moduleType}">
            <span>Unlock ${definition.displayName}</span>
            <small>Authorize this module type for all future theater installs.</small>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderPartitionUnlocks(): string {
  const state = getGameState();
  const foundry = getFoundryUnlockState(state);
  return getOrderedFoundryPartitionTypes().map((partitionType) => {
    const definition = FOUNDRY_PARTITION_DEFINITIONS[partitionType];
    const unlocked = foundry.unlockedPartitionTypes.includes(partitionType);
    return `
      <article class="schema-screen__auth-card ${unlocked ? "schema-screen__auth-card--unlocked" : "schema-screen__auth-card--starter"}">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">PARTITION</div>
            <h3 class="schema-screen__auth-card-title">${definition.displayName}</h3>
          </div>
          <div class="schema-screen__auth-card-state ${unlocked ? "schema-screen__auth-card-state--online" : "schema-screen__auth-card-state--starter"}">
            ${unlocked ? "AUTHORIZED" : "AVAILABLE"}
          </div>
        </div>
        <p class="schema-screen__auth-card-copy">Install on any traversable theater connection, then open, close, or automate it through Door Controller chains.</p>
        <div class="schema-screen__auth-card-meta">
          <span>Unlock cost: ${formatFoundryCost(definition.buildCost)}</span>
          <span>${definition.powerRequirement ? `Motor requirement: ${definition.powerRequirement}W` : "Passive partition"}</span>
        </div>
        ${unlocked ? "" : `
          <div class="schema-screen__auth-card-footer">
            <button class="schema-screen__unlock-btn foundry-annex-screen__unlock-btn" type="button" data-foundry-unlock-partition="${partitionType}">
              <span>Unlock ${definition.displayName}</span>
              <small>Authorize this partition type for theater construction.</small>
            </button>
          </div>
        `}
      </article>
    `;
  }).join("");
}

function renderPrototypeCatalog(): string {
  const prototypeModules = getOrderedFoundryModuleTypes()
    .filter((moduleType) => FOUNDRY_MODULE_DEFINITIONS[moduleType].placeholder);

  return prototypeModules.map((moduleType) => {
    const definition = FOUNDRY_MODULE_DEFINITIONS[moduleType];
    return `
      <article class="schema-screen__auth-card schema-screen__auth-card--locked">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">${definition.category.toUpperCase()}</div>
            <h3 class="schema-screen__auth-card-title">${definition.displayName}</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--starter">PLANNED</div>
        </div>
        <p class="schema-screen__auth-card-copy">${definition.description}</p>
        <div class="schema-screen__auth-card-meta">
          <span>Prototype cost target: ${formatFoundryCost(definition.buildCost)}</span>
          <span>Visible for roadmap clarity only in this slice</span>
        </div>
      </article>
    `;
  }).join("");
}

export function renderFoundryAnnexScreen(returnTo: BaseCampReturnTo = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) return;

  console.log("[FOUNDRY] screen mounted");
  const backButtonText = getBaseCampReturnLabel(returnTo);
  const foundry = getFoundryUnlockState(getGameState());

  app.innerHTML = `
    <div class="town-screen schema-screen foundry-annex-screen">
      <div class="town-screen__panel schema-screen__panel">
        <header class="town-screen__header">
          <div class="town-screen__titleblock">
            <span class="schema-screen__eyebrow">HAVEN // INDUSTRIAL EXPANSION WING</span>
            <h1 class="town-screen__title">FOUNDRY // ANNEX FABRICATION & MODULE LOGIC</h1>
            <p class="town-screen__subtitle">
              Unlock automation module types and partition authorizations here, then build annexes and install hardware directly from the theater command screen.
            </p>
          </div>
          <div class="town-screen__header-right">
            <button class="town-screen__back-btn" id="foundryAnnexBackBtn" type="button">
              <span class="btn-icon" aria-hidden="true">&larr;</span>
              <span class="btn-text">${backButtonText}</span>
            </button>
          </div>
        </header>

        <div class="schema-screen__layout">
          <aside class="schema-screen__sidebar">
            <article class="schema-screen__card schema-screen__materials-window">
              <div class="schema-screen__card-kicker">FOUNDRY STATUS</div>
              <h2 class="schema-screen__card-title">Automation Authorizations</h2>
              ${renderResourceStatus()}
              <div class="schema-screen__resource-list foundry-annex-screen__resource-list foundry-annex-screen__resource-list--status">
                <div class="schema-screen__resource-item">
                  <span class="schema-screen__resource-label">Unlocked Modules</span>
                  <span class="schema-screen__resource-value">${foundry.unlockedModuleTypes.length}</span>
                </div>
                <div class="schema-screen__resource-item">
                  <span class="schema-screen__resource-label">Unlocked Partitions</span>
                  <span class="schema-screen__resource-value">${foundry.unlockedPartitionTypes.length}</span>
                </div>
                <div class="schema-screen__resource-item">
                  <span class="schema-screen__resource-label">Annex Status</span>
                  <span class="schema-screen__resource-value">Built In Theater</span>
                </div>
              </div>
            </article>
          </aside>

          <div class="schema-screen__content">
            <section class="town-screen__content-panel schema-screen__section">
              <div class="schema-screen__section-header">
                <h2 class="schema-screen__section-title">Unlocked Module Types</h2>
                <div class="schema-screen__section-count">${foundry.unlockedModuleTypes.length}</div>
              </div>
              <div class="schema-screen__auth-grid">
                ${renderUnlockedModules()}
              </div>
            </section>

            <section class="town-screen__content-panel schema-screen__section">
              <div class="schema-screen__section-header">
                <h2 class="schema-screen__section-title">Available Unlocks</h2>
                <div class="schema-screen__section-count">Live Slice</div>
              </div>
              <div class="schema-screen__auth-grid">
                ${renderAvailableModuleUnlocks()}
              </div>
            </section>

            <section class="town-screen__content-panel schema-screen__section">
              <div class="schema-screen__section-header">
                <h2 class="schema-screen__section-title">Partition Unlocks</h2>
                <div class="schema-screen__section-count">${foundry.unlockedPartitionTypes.length}/${getOrderedFoundryPartitionTypes().length}</div>
              </div>
              <div class="schema-screen__auth-grid">
                ${renderPartitionUnlocks()}
              </div>
            </section>

            <section class="town-screen__content-panel schema-screen__section">
              <div class="schema-screen__section-header">
                <h2 class="schema-screen__section-title">Prototype Catalog</h2>
                <div class="schema-screen__section-count">Planned</div>
              </div>
              <div class="schema-screen__auth-grid">
                ${renderPrototypeCatalog()}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  `;

  attachFoundryAnnexListeners(returnTo);
}
