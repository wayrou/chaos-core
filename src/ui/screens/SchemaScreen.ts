// ============================================================================
// CHAOS CORE - S.C.H.E.M.A. SCREEN
// Strategic C.O.R.E. Housing, Engineering, and Modular Authorization
// ============================================================================

import {
  formatResourceWalletInline,
  formatRoomTagLabel,
  getOrderedSchemaCoreTypes,
  getOrderedSchemaFieldAssetTypes,
  getOrderedSchemaFortificationTypes,
  getSchemaUnlockState,
  isFieldAssetUnlocked,
  SCHEMA_FIELD_ASSET_DEFINITIONS,
  SCHEMA_CORE_DEFINITIONS,
  SCHEMA_FORTIFICATION_DEFINITIONS,
  unlockSchemaCoreTypeInState,
  unlockSchemaFieldAssetInState,
  unlockSchemaFortificationInState,
} from "../../core/schemaSystem";
import { CoreType, FieldAssetType, FortificationType } from "../../core/types";
import { getSchemaCoreUnlockFloorOrdinal, isSchemaCoreTierAvailable } from "../../core/campaign";
import { getGameState, updateGameState } from "../../state/gameStore";
import { showSystemPing } from "../components/systemPing";
import {
  formatResourceLabel,
  getResourceEntries,
  RESOURCE_KEYS,
} from "../../core/resources";
import {
  canSessionAffordCost,
  getLocalSessionPlayerSlot,
  getSessionResourcePool,
} from "../../core/session";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { clearControllerContext, updateFocusableElements } from "../../core/controllerSupport";

let cleanupSchemaMaterialsWindowListeners: (() => void) | null = null;
type SchemaTabId = "core" | "fortification" | "field-assets";
let activeSchemaTab: SchemaTabId = "core";

function getResolvedSchemaTab(tab: string | null | undefined): SchemaTabId {
  return tab === "fortification" || tab === "field-assets" || tab === "core" ? tab : "core";
}

function orderItemsUnlockedFirst<T>(items: T[], isUnlocked: (item: T) => boolean): T[] {
  return items
    .map((item, index) => ({ item, index, unlocked: isUnlocked(item) }))
    .sort((left, right) => {
      if (left.unlocked !== right.unlocked) {
        return Number(right.unlocked) - Number(left.unlocked);
      }
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function getSchemaScrollPosition(): number {
  const panel = document.querySelector<HTMLElement>(".schema-screen__panel");
  const screen = document.querySelector<HTMLElement>(".schema-screen");
  return panel?.scrollTop ?? screen?.scrollTop ?? document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
}

function restoreSchemaScrollPosition(scrollTop: number): void {
  window.requestAnimationFrame(() => {
    const panel = document.querySelector<HTMLElement>(".schema-screen__panel");
    const screen = document.querySelector<HTMLElement>(".schema-screen");
    if (panel) {
      panel.scrollTop = scrollTop;
    }
    if (screen) {
      screen.scrollTop = scrollTop;
    }
    document.scrollingElement?.scrollTo({ top: scrollTop });
    window.scrollTo(0, scrollTop);
  });
}

function cleanupSchemaMaterialsWindow(): void {
  if (cleanupSchemaMaterialsWindowListeners) {
    cleanupSchemaMaterialsWindowListeners();
    cleanupSchemaMaterialsWindowListeners = null;
  }
}

function attachSchemaMaterialsWindow(): void {
  cleanupSchemaMaterialsWindow();

  const syncMaterialsWindow = () => {
    const sidebar = document.querySelector<HTMLElement>(".schema-screen__sidebar");
    const materialsWindow = document.querySelector<HTMLElement>(".schema-screen__materials-window");
    const header = document.querySelector<HTMLElement>(".schema-screen .town-screen__header");
    if (!sidebar || !materialsWindow) {
      return;
    }

    if (window.innerWidth <= 920) {
      materialsWindow.style.removeProperty("--schema-materials-left");
      materialsWindow.style.removeProperty("--schema-materials-top");
      materialsWindow.style.removeProperty("--schema-materials-width");
      materialsWindow.style.removeProperty("--schema-materials-max-height");
      materialsWindow.dataset.floating = "false";
      return;
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const top = Math.max(20, Math.round(headerBottom + 10));
    const maxHeight = Math.max(220, window.innerHeight - top - 20);

    materialsWindow.dataset.floating = "true";
    materialsWindow.style.setProperty("--schema-materials-left", `${Math.round(sidebarRect.left)}px`);
    materialsWindow.style.setProperty("--schema-materials-top", `${top}px`);
    materialsWindow.style.setProperty("--schema-materials-width", `${Math.round(sidebarRect.width)}px`);
    materialsWindow.style.setProperty("--schema-materials-max-height", `${Math.round(maxHeight)}px`);
  };

  const handleResize = () => syncMaterialsWindow();
  window.addEventListener("resize", handleResize);
  window.requestAnimationFrame(syncMaterialsWindow);

  cleanupSchemaMaterialsWindowListeners = () => {
    window.removeEventListener("resize", handleResize);
  };
}

function formatNetworkOutputLine(
  label: string,
  amount: number | undefined,
  mode: "fixed" | "add_input" | undefined,
  unit: string,
): string | null {
  if (!amount || amount <= 0) {
    return null;
  }

  return mode === "add_input"
    ? `${label}: +${amount}${unit} over input`
    : `${label}: ${amount}${unit} fixed`;
}

function formatResourceCostWallet(
  cost: Partial<ReturnType<typeof getGameState>["resources"]> | undefined,
): string {
  const parts = getResourceEntries(cost).map((entry) => `${entry.amount} ${entry.label}`);

  return parts.length > 0 ? parts.join(" // ") : "No material cost";
}

function formatUnlockCostLine(
  wadCost: number | undefined,
  resourceCost: Partial<ReturnType<typeof getGameState>["resources"]> | undefined,
): string {
  const parts = [
    wadCost ? `${wadCost} Wad` : null,
    formatResourceCostWallet(resourceCost) !== "No material cost" ? formatResourceCostWallet(resourceCost) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" // ") : "No unlock cost";
}

function canAffordUnlock(
  state: ReturnType<typeof getGameState>,
  wadCost: number | undefined,
  resourceCost: Partial<ReturnType<typeof getGameState>["resources"]> | undefined,
): boolean {
  return canSessionAffordCost(state, {
    wad: wadCost ?? 0,
    resources: resourceCost,
  });
}

function renderCoreAuthorizationCards(): string {
  const state = getGameState();
  const schema = getSchemaUnlockState(state);
  const orderedCoreTypes = orderItemsUnlockedFirst(
    getOrderedSchemaCoreTypes(),
    (coreType) => schema.unlockedCoreTypes.includes(coreType),
  );

  return orderedCoreTypes.map((coreType) => {
    const definition = SCHEMA_CORE_DEFINITIONS[coreType];
    const unlocked = schema.unlockedCoreTypes.includes(coreType);
    const isStarter = definition.unlockSource === "starter";
    const unlockFloorOrdinal = getSchemaCoreUnlockFloorOrdinal(coreType);
    const tierAvailable = isStarter || isSchemaCoreTierAvailable(coreType);
    const unlockCost = formatUnlockCostLine(
      definition.unlockWadCost,
      definition.unlockCost,
    );
    const buildIncome = formatResourceWalletInline(definition.incomePerTick ?? {});
    const networkOutputs = [
      formatNetworkOutputLine("Power Output", definition.powerOutputWatts, definition.powerOutputMode, "W"),
      formatNetworkOutputLine("Comms Output", definition.commsOutputBw, definition.commsOutputMode, " BW"),
      formatNetworkOutputLine("Supply Output", definition.supplyOutputCrates, definition.supplyOutputMode, " crates"),
    ].filter((entry): entry is string => Boolean(entry));
    const canAfford = canAffordUnlock(state, definition.unlockWadCost, definition.unlockCost);
    const preferredTags = (definition.preferredRoomTags ?? []).map((tag) => formatRoomTagLabel(tag)).join(" // ");

    return `
      <article class="schema-screen__auth-card ${unlocked ? "schema-screen__auth-card--unlocked" : "schema-screen__auth-card--locked"}">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">${definition.category.toUpperCase()}</div>
            <h3 class="schema-screen__auth-card-title">${definition.displayName}</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--${unlocked ? "online" : isStarter ? "starter" : "locked"}">
            ${unlocked ? "AUTHORIZED" : isStarter ? "STARTER" : tierAvailable ? "LOCKED" : `FLOOR ${String(unlockFloorOrdinal).padStart(2, "0")}`}
          </div>
        </div>
        <p class="schema-screen__auth-card-copy">${definition.description}</p>
        <div class="schema-screen__auth-card-meta">
          <span>Build Cost: ${formatResourceCostWallet(definition.buildCost)}</span>
          <span>Wad Upkeep: ${definition.wadUpkeepPerTick}/tick</span>
          <span>${buildIncome === "No resource output" ? "No passive income" : `Income: ${buildIncome}`}</span>
          ${networkOutputs.map((line) => `<span>${line}</span>`).join("")}
          <span>${preferredTags ? `Preferred Tags: ${preferredTags}` : "No room affinity preference"}</span>
          ${definition.placeholder ? `<span>Placeholder runtime effect</span>` : ""}
        </div>
        ${unlocked || isStarter
          ? `<div class="schema-screen__auth-card-footer">Available now in theater Build C.O.R.E. menus.</div>`
          : !tierAvailable
            ? `
              <div class="schema-screen__auth-card-footer">
                Unlock Tier: Reach Floor ${String(unlockFloorOrdinal).padStart(2, "0")} through live progression or atlas floor transit.
              </div>
              <button class="schema-screen__unlock-btn" type="button" disabled>
                Await Floor ${String(unlockFloorOrdinal).padStart(2, "0")}
              </button>
            `
          : `
            <div class="schema-screen__auth-card-footer">
              Unlock Cost: ${unlockCost}
            </div>
            <button class="schema-screen__unlock-btn" type="button" data-schema-unlock-core="${coreType}" ${canAfford ? "" : "disabled"}>
              Authorize ${definition.displayName}
            </button>
          `}
      </article>
    `;
  }).join("");
}

function renderFortificationAuthorizationCards(): string {
  const state = getGameState();
  const schema = getSchemaUnlockState(state);
  const orderedFortificationTypes = orderItemsUnlockedFirst(
    getOrderedSchemaFortificationTypes(),
    (fortificationType) => schema.unlockedFortificationPips.includes(fortificationType),
  );

  return orderedFortificationTypes.map((fortificationType) => {
    const definition = SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
    const unlocked = schema.unlockedFortificationPips.includes(fortificationType);
    const isStarter = definition.unlockSource === "starter";
    const unlockCost = formatUnlockCostLine(
      definition.unlockWadCost,
      definition.unlockCost,
    );
    const canAfford = canAffordUnlock(state, definition.unlockWadCost, definition.unlockCost);
    const preferredTags = (definition.preferredRoomTags ?? []).map((tag) => formatRoomTagLabel(tag)).join(" // ");

    return `
      <article class="schema-screen__auth-card ${unlocked ? "schema-screen__auth-card--unlocked" : "schema-screen__auth-card--locked"}">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">FORTIFICATION</div>
            <h3 class="schema-screen__auth-card-title">${definition.displayName}</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--${unlocked ? "online" : isStarter ? "starter" : "locked"}">
            ${unlocked ? "AUTHORIZED" : isStarter ? "STARTER" : "LOCKED"}
          </div>
        </div>
        <p class="schema-screen__auth-card-copy">${definition.description}</p>
        <div class="schema-screen__auth-card-meta">
          <span>Build Cost: ${formatResourceCostWallet(definition.buildCost)}</span>
          <span>${preferredTags ? `Preferred Tags: ${preferredTags}` : "No room affinity preference"}</span>
          ${definition.placeholder ? `<span>Placeholder runtime effect</span>` : ""}
        </div>
        ${unlocked || isStarter
          ? `<div class="schema-screen__auth-card-footer">Available now in theater Fortifications menus.</div>`
          : `
            <div class="schema-screen__auth-card-footer">
              Unlock Cost: ${unlockCost}
            </div>
            <button class="schema-screen__unlock-btn" type="button" data-schema-unlock-fortification="${fortificationType}" ${canAfford ? "" : "disabled"}>
              Authorize ${definition.displayName}
            </button>
          `}
      </article>
    `;
  }).join("");
}

function renderFieldAssetAuthorizationCards(): string {
  const state = getGameState();
  const schema = getSchemaUnlockState(state);
  const orderedFieldAssetTypes = orderItemsUnlockedFirst(
    getOrderedSchemaFieldAssetTypes(),
    (fieldAssetType) => schema.unlockedFieldAssetTypes.includes(fieldAssetType),
  );

  return orderedFieldAssetTypes.map((fieldAssetType) => {
    const definition = SCHEMA_FIELD_ASSET_DEFINITIONS[fieldAssetType];
    if (!definition) {
      return "";
    }

    const unlocked = isFieldAssetUnlocked(state, fieldAssetType);
    const unlockCost = formatUnlockCostLine(
      definition.unlockWadCost,
      definition.unlockCost,
    );
    const canAfford = canAffordUnlock(state, definition.unlockWadCost, definition.unlockCost);

    return `
      <article class="schema-screen__auth-card ${unlocked ? "schema-screen__auth-card--unlocked" : "schema-screen__auth-card--locked"}">
        <div class="schema-screen__auth-card-top">
          <div>
            <div class="schema-screen__auth-card-kicker">FIELD ASSET</div>
            <h3 class="schema-screen__auth-card-title">${definition.displayName}</h3>
          </div>
          <div class="schema-screen__auth-card-state schema-screen__auth-card-state--${unlocked ? "online" : "locked"}">
            ${unlocked ? "AUTHORIZED" : "LOCKED"}
          </div>
        </div>
        <p class="schema-screen__auth-card-copy">${definition.description}</p>
        <div class="schema-screen__auth-card-meta">
          <span>Fabrication Cost: ${formatResourceCostWallet(definition.buildCost)}</span>
          <span>Role: ${definition.tacticalRole}</span>
          <span>Deploy from Theater Command -> Tactical Map after a room is secured.</span>
        </div>
        ${unlocked
          ? `<div class="schema-screen__auth-card-footer">Available now in room Tactical Map tabs for persistent preparation.</div>`
          : `
            <div class="schema-screen__auth-card-footer">
              Unlock Cost: ${unlockCost}
            </div>
            <button class="schema-screen__unlock-btn" type="button" data-schema-unlock-field-asset="${fieldAssetType}" ${canAfford ? "" : "disabled"}>
              Authorize ${definition.displayName}
            </button>
          `}
      </article>
    `;
  }).join("");
}

function renderSchemaTabs(
  schema: ReturnType<typeof getSchemaUnlockState>,
  selectedTab: SchemaTabId,
): string {
  const tabs: Array<{ id: SchemaTabId; label: string; meta: string }> = [
    { id: "core", label: "C.O.R.E.", meta: `${schema.unlockedCoreTypes.length} live` },
    { id: "fortification", label: "Fortifications", meta: `${schema.unlockedFortificationPips.length} live` },
    { id: "field-assets", label: "Field Assets", meta: `${schema.unlockedFieldAssetTypes.length} live` },
  ];

  return `
    <div class="schema-screen__tabs" role="tablist" aria-label="S.C.H.E.M.A. authorization categories">
      ${tabs.map((tab) => `
        <button
          class="schema-screen__tab ${selectedTab === tab.id ? "schema-screen__tab--active" : ""}"
          type="button"
          role="tab"
          aria-selected="${selectedTab === tab.id ? "true" : "false"}"
          data-schema-tab="${tab.id}"
        >
          <span class="schema-screen__tab-label">${tab.label}</span>
          <span class="schema-screen__tab-meta">${tab.meta}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function getSchemaSectionContent(
  schema: ReturnType<typeof getSchemaUnlockState>,
  selectedTab: SchemaTabId,
): { title: string; count: string; bodyHtml: string } {
  switch (selectedTab) {
    case "fortification":
      return {
        title: "Fortification Authorizations",
        count: `${schema.unlockedFortificationPips.length} authorized`,
        bodyHtml: renderFortificationAuthorizationCards(),
      };
    case "field-assets":
      return {
        title: "Field Asset Authorizations",
        count: `${schema.unlockedFieldAssetTypes.length} authorized`,
        bodyHtml: renderFieldAssetAuthorizationCards(),
      };
    case "core":
    default:
      return {
        title: "C.O.R.E. Authorizations",
        count: `${schema.unlockedCoreTypes.length} authorized`,
        bodyHtml: renderCoreAuthorizationCards(),
      };
  }
}

function attachSchemaListeners(returnTo: BaseCampReturnTo): void {
  const backBtn = document.getElementById("schemaBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      cleanupSchemaMaterialsWindow();
      unregisterBaseCampReturnHotkey("schema-screen");
      returnFromBaseCampScreen(returnTo);
    });
  }

  document.querySelectorAll<HTMLElement>("[data-schema-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = getResolvedSchemaTab(button.getAttribute("data-schema-tab"));
      if (nextTab === activeSchemaTab) {
        return;
      }
      activeSchemaTab = nextTab;
      renderSchemaScreen(returnTo, 0);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-schema-unlock-core]").forEach((button) => {
    button.addEventListener("click", () => {
      const coreType = button.getAttribute("data-schema-unlock-core") as CoreType | null;
      if (!coreType) {
        return;
      }

      const scrollTop = getSchemaScrollPosition();
      const outcome = unlockSchemaCoreTypeInState(getGameState(), coreType);
      updateGameState(() => outcome.state);
      showSystemPing({
        type: outcome.success ? "success" : "error",
        title: outcome.success ? "S.C.H.E.M.A. Authorization Complete" : "S.C.H.E.M.A. Authorization Failed",
        message: outcome.message,
        channel: "schema-auth",
      });
      renderSchemaScreen(returnTo, scrollTop);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-schema-unlock-fortification]").forEach((button) => {
    button.addEventListener("click", () => {
      const fortificationType = button.getAttribute("data-schema-unlock-fortification") as FortificationType | null;
      if (!fortificationType) {
        return;
      }

      const scrollTop = getSchemaScrollPosition();
      const outcome = unlockSchemaFortificationInState(getGameState(), fortificationType);
      updateGameState(() => outcome.state);
      showSystemPing({
        type: outcome.success ? "success" : "error",
        title: outcome.success ? "S.C.H.E.M.A. Authorization Complete" : "S.C.H.E.M.A. Authorization Failed",
        message: outcome.message,
        channel: "schema-auth",
      });
      renderSchemaScreen(returnTo, scrollTop);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-schema-unlock-field-asset]").forEach((button) => {
    button.addEventListener("click", () => {
      const fieldAssetType = button.getAttribute("data-schema-unlock-field-asset") as FieldAssetType | null;
      if (!fieldAssetType) {
        return;
      }

      const scrollTop = getSchemaScrollPosition();
      const outcome = unlockSchemaFieldAssetInState(getGameState(), fieldAssetType);
      updateGameState(() => outcome.state);
      showSystemPing({
        type: outcome.success ? "success" : "error",
        title: outcome.success ? "S.C.H.E.M.A. Authorization Complete" : "S.C.H.E.M.A. Authorization Failed",
        message: outcome.message,
        channel: "schema-auth",
      });
      renderSchemaScreen(returnTo, scrollTop);
    });
  });

  registerBaseCampReturnHotkey("schema-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".schema-screen",
  });
}

export function renderSchemaScreen(returnTo: BaseCampReturnTo = "basecamp", restoreScrollTop = 0): void {
  cleanupSchemaMaterialsWindow();

  const app = document.getElementById("app");
  if (!app) return;
  document.body.setAttribute("data-screen", "schema");
  clearControllerContext();

  const state = getGameState();
  const wallet = getSessionResourcePool(state, getLocalSessionPlayerSlot(state));
  const resources = wallet.resources;
  const schema = getSchemaUnlockState(state);
  const selectedTab = getResolvedSchemaTab(activeSchemaTab);
  activeSchemaTab = selectedTab;
  const selectedSection = getSchemaSectionContent(schema, selectedTab);
  const backButtonText = getBaseCampReturnLabel(returnTo);

  app.innerHTML = `
    <div class="town-screen schema-screen">
      <div class="town-screen__panel schema-screen__panel">
        <header class="town-screen__header">
          <div class="town-screen__titleblock">
            <span class="schema-screen__eyebrow">HAVEN // C.O.R.E. AUTHORIZATION TERMINAL</span>
            <h1 class="town-screen__title">S.C.H.E.M.A.</h1>
            <p class="town-screen__subtitle">
              Strategic C.O.R.E. Housing, Engineering, and Modular Authorization
            </p>
          </div>
          <div class="town-screen__header-right">
            <button class="town-screen__back-btn" id="schemaBackBtn" type="button">
              <span class="btn-icon" aria-hidden="true">&larr;</span>
              <span class="btn-text">${backButtonText}</span>
            </button>
          </div>
        </header>

        <div class="schema-screen__layout">
          <aside class="schema-screen__sidebar">
            <article class="schema-screen__card schema-screen__materials-window">
              <h2 class="schema-screen__card-title">Available Materials</h2>
              <div class="schema-screen__resource-list">
                <div class="schema-screen__resource-item">
                  <span class="schema-screen__resource-label">Wad</span>
                  <span class="schema-screen__resource-value">${wallet.wad}</span>
                </div>
                ${RESOURCE_KEYS.map((key) => `
                  <div class="schema-screen__resource-item">
                    <span class="schema-screen__resource-label">${formatResourceLabel(key)}</span>
                    <span class="schema-screen__resource-value">${resources[key]}</span>
                  </div>
                `).join("")}
              </div>
            </article>
          </aside>

          <div class="schema-screen__content">
            ${renderSchemaTabs(schema, selectedTab)}
            <section class="town-screen__content-panel schema-screen__section">
              <div class="schema-screen__section-header">
                <h2 class="schema-screen__section-title">${selectedSection.title}</h2>
                <div class="schema-screen__section-count">${selectedSection.count}</div>
              </div>
              <div class="schema-screen__auth-grid">
                ${selectedSection.bodyHtml}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  `;

  attachSchemaListeners(returnTo);
  updateFocusableElements();
  restoreSchemaScrollPosition(restoreScrollTop);
  attachSchemaMaterialsWindow();
}
