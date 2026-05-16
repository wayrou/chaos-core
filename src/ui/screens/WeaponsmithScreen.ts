import {
  getBowbladeWorkshopReadout,
  getWeaponsmithCatalog,
  getWeaponsmithInstalledUpgradeIds,
  getWeaponsmithOwnedUtilityItemIds,
  getWeaponsmithUtilityCatalog,
  installWeaponsmithUpgrade,
  isWeaponsmithUnlocked,
  purchaseWeaponsmithUtilityItem,
  WEAPONSMITH_UNLOCK_FLOOR_ORDINAL,
  type WeaponsmithCatalogEntry,
  type WeaponsmithUpgradeCategory,
  type WeaponsmithUpgradeId,
  type WeaponsmithUtilityCatalogEntry,
  type WeaponsmithUtilityCategory,
  type WeaponsmithUtilityItemId,
} from "../../core/weaponsmith";
import { getResourceEntries } from "../../core/resources";
import { getGameState, updateGameState } from "../../state/gameStore";
import { canSessionAffordCost, getLocalSessionPlayerSlot, getSessionResourcePool } from "../../core/session";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { showSystemPing } from "../components/systemPing";

const WEAPONSMITH_RESOURCE_KEYS = ["alloy", "drawcord", "fittings", "resin", "chargeCells"] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCategory(category: WeaponsmithUpgradeCategory): string {
  switch (category) {
    case "ranged":
      return "RANGED";
    case "melee":
      return "MELEE";
    case "handling":
      return "HANDLING";
    case "powered":
      return "POWERED";
  }

  const exhaustiveCategory: never = category;
  return exhaustiveCategory;
}

function formatUtilityCategory(category: WeaponsmithUtilityCategory): string {
  switch (category) {
    case "apron_utility":
      return "APRON UTILITY";
  }

  const exhaustiveCategory: never = category;
  return exhaustiveCategory;
}

function renderCostList(cost: WeaponsmithCatalogEntry["definition"]["cost"]): string {
  const resourceMarkup = getResourceEntries(cost.resources)
    .map((resource) => `<span class="weaponsmith-cost-chip">${resource.amount} ${escapeHtml(resource.shortLabel)}</span>`)
    .join("");

  return `
    <div class="weaponsmith-cost-row">
      <span class="weaponsmith-cost-chip weaponsmith-cost-chip--wad">${cost.wad} WAD</span>
      ${resourceMarkup}
    </div>
  `;
}

function renderStatusButton(entry: WeaponsmithCatalogEntry, canAfford: boolean): string {
  if (entry.installed) {
    return `<button class="weaponsmith-install-btn weaponsmith-install-btn--installed" type="button" disabled>INSTALLED</button>`;
  }

  if (!entry.unlocked) {
    return `<button class="weaponsmith-install-btn" type="button" disabled>LOCKED</button>`;
  }

  if (!canAfford) {
    return `<button class="weaponsmith-install-btn" type="button" disabled>INSUFFICIENT STOCK</button>`;
  }

  return `
    <button
      class="weaponsmith-install-btn weaponsmith-install-btn--ready"
      type="button"
      data-weaponsmith-install="${entry.definition.id}"
    >
      INSTALL
    </button>
  `;
}

function renderUtilityStatusButton(entry: WeaponsmithUtilityCatalogEntry, canAfford: boolean): string {
  if (entry.owned) {
    return `<button class="weaponsmith-install-btn weaponsmith-install-btn--installed" type="button" disabled>OWNED</button>`;
  }

  if (!entry.unlocked) {
    return `<button class="weaponsmith-install-btn" type="button" disabled>LOCKED</button>`;
  }

  if (!canAfford) {
    return `<button class="weaponsmith-install-btn" type="button" disabled>INSUFFICIENT STOCK</button>`;
  }

  return `
    <button
      class="weaponsmith-install-btn weaponsmith-install-btn--ready"
      type="button"
      data-weaponsmith-buy-utility="${entry.definition.id}"
    >
      BUY
    </button>
  `;
}

function renderUpgradeCard(entry: WeaponsmithCatalogEntry, canAfford: boolean): string {
  return `
    <article class="weaponsmith-card${entry.installed ? " weaponsmith-card--installed" : ""}${!entry.unlocked || !canAfford ? " weaponsmith-card--locked" : ""}">
      <div class="weaponsmith-card__header">
        <div>
          <div class="weaponsmith-card__kicker">${formatCategory(entry.definition.category)}</div>
          <h3 class="weaponsmith-card__title">${escapeHtml(entry.definition.name)}</h3>
        </div>
        <div class="weaponsmith-card__status">${entry.installed ? "ONLINE" : entry.unlocked ? "READY" : "SEALED"}</div>
      </div>
      <p class="weaponsmith-card__summary">${escapeHtml(entry.definition.summary)}</p>
      <p class="weaponsmith-card__detail">${escapeHtml(entry.definition.detail)}</p>
      <div class="weaponsmith-card__unlock">${escapeHtml(entry.unlockLabel)}</div>
      ${renderCostList(entry.definition.cost)}
      ${renderStatusButton(entry, canAfford)}
    </article>
  `;
}

function renderUtilityCard(entry: WeaponsmithUtilityCatalogEntry, canAfford: boolean): string {
  return `
    <article class="weaponsmith-card${entry.owned ? " weaponsmith-card--installed" : ""}${!entry.unlocked || !canAfford ? " weaponsmith-card--locked" : ""}">
      <div class="weaponsmith-card__header">
        <div>
          <div class="weaponsmith-card__kicker">${formatUtilityCategory(entry.definition.category)}</div>
          <h3 class="weaponsmith-card__title">${escapeHtml(entry.definition.name)}</h3>
        </div>
        <div class="weaponsmith-card__status">${entry.owned ? "PACKED" : entry.unlocked ? "READY" : "SEALED"}</div>
      </div>
      <p class="weaponsmith-card__summary">${escapeHtml(entry.definition.summary)}</p>
      <p class="weaponsmith-card__detail">${escapeHtml(entry.definition.detail)}</p>
      <div class="weaponsmith-card__unlock">${escapeHtml(entry.unlockLabel)}</div>
      ${renderCostList(entry.definition.cost)}
      ${renderUtilityStatusButton(entry, canAfford)}
    </article>
  `;
}

function renderInstalledUpgradeList(installedUpgradeIds: WeaponsmithUpgradeId[], catalog: WeaponsmithCatalogEntry[]): string {
  if (installedUpgradeIds.length === 0) {
    return `<div class="weaponsmith-empty">No bowblade upgrades installed yet.</div>`;
  }

  const installedById = new Map(catalog.map((entry) => [entry.definition.id, entry.definition]));

  return `
    <div class="weaponsmith-installed-list">
      ${installedUpgradeIds.map((upgradeId) => {
        const definition = installedById.get(upgradeId);
        if (!definition) {
          return "";
        }

        return `
          <div class="weaponsmith-installed-item">
            <span>${escapeHtml(definition.name)}</span>
            <span>${formatCategory(definition.category)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderOwnedUtilityList(ownedUtilityItemIds: WeaponsmithUtilityItemId[], catalog: WeaponsmithUtilityCatalogEntry[]): string {
  if (ownedUtilityItemIds.length === 0) {
    return `<div class="weaponsmith-empty">No apron utility items packed yet.</div>`;
  }

  const ownedById = new Map(catalog.map((entry) => [entry.definition.id, entry.definition]));

  return `
    <div class="weaponsmith-installed-list">
      ${ownedUtilityItemIds.map((itemId) => {
        const definition = ownedById.get(itemId);
        if (!definition) {
          return "";
        }

        return `
          <div class="weaponsmith-installed-item">
            <span>${escapeHtml(definition.name)}</span>
            <span>${formatUtilityCategory(definition.category)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function renderWeaponsmithScreen(returnTo: BaseCampReturnTo = "field"): void {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  const state = getGameState();
  const unlocked = isWeaponsmithUnlocked(state);
  const catalog = getWeaponsmithCatalog(state);
  const utilityCatalog = getWeaponsmithUtilityCatalog(state);
  const bowblade = getBowbladeWorkshopReadout(state);
  const installedUpgradeIds = getWeaponsmithInstalledUpgradeIds(state);
  const ownedUtilityItemIds = getWeaponsmithOwnedUtilityItemIds(state);
  const wallet = getSessionResourcePool(state, getLocalSessionPlayerSlot(state));

  root.innerHTML = `
    <div class="weaponsmith-root town-screen town-screen--hub">
      <header class="weaponsmith-header town-screen__header">
        <div class="weaponsmith-header__copy">
          <div class="weaponsmith-header__kicker">HAVEN // ANNEX SERVICE NODE</div>
          <h1 class="weaponsmith-header__title">WEAPONSMITH WORKSHOP</h1>
          <p class="weaponsmith-header__subtitle">The Weaponsmith has set a temporary bench inside HAVEN so Aeriss's bowblade can be serviced on-site.</p>
        </div>
        <button class="weaponsmith-back-btn town-screen__back-btn" id="weaponsmithBackBtn" type="button">${getBaseCampReturnLabel(returnTo, { field: "HAVEN ANNEX" })}</button>
      </header>

      ${!unlocked ? `
        <section class="weaponsmith-locked">
          <h2>Workshop Offline</h2>
          <p>Reach Floor ${String(WEAPONSMITH_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} so the Weaponsmith can set up his temporary HAVEN bench.</p>
        </section>
      ` : `
        <div class="weaponsmith-layout">
          <aside class="weaponsmith-sidebar">
            <section class="weaponsmith-panel">
              <div class="weaponsmith-panel__kicker">SIGNATURE WEAPON</div>
              <h2 class="weaponsmith-panel__title">${escapeHtml(bowblade.name)}</h2>
              <div class="weaponsmith-stat-grid">
                <div class="weaponsmith-stat"><span>Melee Dmg</span><strong>${bowblade.meleeDamage}</strong></div>
                <div class="weaponsmith-stat"><span>Charge / Hit</span><strong>${bowblade.meleeChargeGain}</strong></div>
                <div class="weaponsmith-stat"><span>Impact</span><strong>${bowblade.meleeImpact}</strong></div>
                <div class="weaponsmith-stat"><span>Ranged Dmg</span><strong>${bowblade.rangedDamage}</strong></div>
                <div class="weaponsmith-stat"><span>Range</span><strong>${bowblade.rangedRange}</strong></div>
                <div class="weaponsmith-stat"><span>Projectile</span><strong>${bowblade.projectileSpeed}</strong></div>
                <div class="weaponsmith-stat"><span>Cycle</span><strong>${bowblade.attackCycleMs}ms</strong></div>
                <div class="weaponsmith-stat"><span>Energy Cells</span><strong>${bowblade.maxEnergyCells}</strong></div>
                <div class="weaponsmith-stat"><span>Installed</span><strong>${installedUpgradeIds.length}</strong></div>
              </div>
              <div class="weaponsmith-empty">
                Field tuning only. Weaponsmith upgrades do not add tactical battle cards or loadout gear.
              </div>
            </section>

            <section class="weaponsmith-panel">
              <div class="weaponsmith-panel__kicker">INSTALLED WORK</div>
              <h2 class="weaponsmith-panel__title">Bench Ledger</h2>
              ${renderInstalledUpgradeList(installedUpgradeIds, catalog)}
            </section>

            <section class="weaponsmith-panel">
              <div class="weaponsmith-panel__kicker">APRON UTILITY</div>
              <h2 class="weaponsmith-panel__title">Packed Kit</h2>
              ${renderOwnedUtilityList(ownedUtilityItemIds, utilityCatalog)}
            </section>

            <section class="weaponsmith-panel">
              <div class="weaponsmith-panel__kicker">MATERIALS ON HAND</div>
              <h2 class="weaponsmith-panel__title">Workshop Stock</h2>
              <div class="weaponsmith-wallet">WAD // ${Number(wallet.wad ?? 0).toLocaleString()}</div>
              <div class="weaponsmith-material-list">
                ${getResourceEntries(wallet.resources, {
                  includeZero: true,
                  keys: WEAPONSMITH_RESOURCE_KEYS,
                })
                  .map((resource) => `
                    <div class="weaponsmith-material-row">
                      <span>${escapeHtml(resource.label)}</span>
                      <strong>${resource.amount}</strong>
                    </div>
                  `)
                  .join("")}
              </div>
            </section>
          </aside>

          <section class="weaponsmith-catalog">
            <div class="weaponsmith-panel weaponsmith-panel--catalog">
              <div class="weaponsmith-panel__kicker">CURATED UPGRADE CATALOG</div>
              <h2 class="weaponsmith-panel__title">Counterweight Install Set</h2>
              <div class="weaponsmith-card-grid">
                ${catalog.map((entry) => renderUpgradeCard(
                  entry,
                  canSessionAffordCost(state, {
                    wad: entry.definition.cost.wad,
                    resources: entry.definition.cost.resources,
                  }),
                )).join("")}
              </div>
            </div>
            <div class="weaponsmith-panel weaponsmith-panel--catalog">
              <div class="weaponsmith-panel__kicker">FIELD UTILITY CATALOG</div>
              <h2 class="weaponsmith-panel__title">Apron Kit</h2>
              <div class="weaponsmith-card-grid">
                ${utilityCatalog.map((entry) => renderUtilityCard(
                  entry,
                  canSessionAffordCost(state, {
                    wad: entry.definition.cost.wad,
                    resources: entry.definition.cost.resources,
                  }),
                )).join("")}
              </div>
            </div>
          </section>
        </div>
      `}
    </div>
  `;

  root.querySelector<HTMLButtonElement>("#weaponsmithBackBtn")?.addEventListener("click", () => {
    unregisterBaseCampReturnHotkey("weaponsmith-screen");
    returnFromBaseCampScreen(returnTo);
  });

  root.querySelectorAll<HTMLElement>("[data-weaponsmith-install]").forEach((button) => {
    button.addEventListener("click", () => {
      const upgradeId = button.dataset.weaponsmithInstall as WeaponsmithUpgradeId | undefined;
      if (!upgradeId) {
        return;
      }

      const result = installWeaponsmithUpgrade(getGameState(), upgradeId);
      if (!result.ok) {
        showSystemPing({
          type: "error",
          title: "INSTALL FAILED",
          message: result.error ?? "The upgrade could not be installed.",
          channel: "weaponsmith-install",
          replaceChannel: true,
        });
        return;
      }

      updateGameState(() => result.state);
      showSystemPing({
        type: "success",
        title: "BOWBLADE UPDATED",
        message: catalog.find((entry) => entry.definition.id === upgradeId)?.definition.name ?? "Upgrade installed.",
        detail: "Installed at the Counterweight workshop.",
        channel: "weaponsmith-install",
        replaceChannel: true,
      });
      renderWeaponsmithScreen(returnTo);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-weaponsmith-buy-utility]").forEach((button) => {
    button.addEventListener("click", () => {
      const utilityItemId = button.dataset.weaponsmithBuyUtility as WeaponsmithUtilityItemId | undefined;
      if (!utilityItemId) {
        return;
      }

      const result = purchaseWeaponsmithUtilityItem(getGameState(), utilityItemId);
      if (!result.ok) {
        showSystemPing({
          type: "error",
          title: "PURCHASE FAILED",
          message: result.error ?? "The utility item could not be purchased.",
          channel: "weaponsmith-install",
          replaceChannel: true,
        });
        return;
      }

      updateGameState(() => result.state);
      showSystemPing({
        type: "success",
        title: "APRON KIT UPDATED",
        message: utilityCatalog.find((entry) => entry.definition.id === utilityItemId)?.definition.name ?? "Utility item purchased.",
        detail: "Press jump while airborne to deploy owned traversal utilities.",
        channel: "weaponsmith-install",
        replaceChannel: true,
      });
      renderWeaponsmithScreen(returnTo);
    });
  });

  registerBaseCampReturnHotkey("weaponsmith-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".weaponsmith-root",
  });
}
