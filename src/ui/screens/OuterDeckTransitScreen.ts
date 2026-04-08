import { getGameState, updateGameState } from "../../state/gameStore";
import {
  OUTER_DECK_ZONE_ORDER,
  abortOuterDeckExpedition,
  beginOuterDeckExpedition,
  getOuterDeckActiveExpedition,
  getOuterDeckZoneDefinition,
  getUnlockedOuterDeckZoneIds,
  type OuterDeckZoneId,
} from "../../core/outerDecks";
import { loadCampaignProgress } from "../../core/campaign";

let outerDeckTransitKeyHandler: ((event: KeyboardEvent) => void) | null = null;

function cleanupOuterDeckTransitHotkey(): void {
  if (outerDeckTransitKeyHandler) {
    window.removeEventListener("keydown", outerDeckTransitKeyHandler);
    outerDeckTransitKeyHandler = null;
  }
}

function openOuterDeckMap(mapId: string): void {
  import("../../field/FieldScreen").then(({ renderFieldScreen, setNextFieldSpawnOverride }) => {
    setNextFieldSpawnOverride(mapId, { x: 3, y: 6, facing: "east" });
    renderFieldScreen(mapId);
  });
}

function renderZoneCard(zoneId: OuterDeckZoneId, activeZoneId: OuterDeckZoneId | null): string {
  const state = getGameState();
  const progress = loadCampaignProgress();
  const zone = getOuterDeckZoneDefinition(zoneId);
  const unlocked = getUnlockedOuterDeckZoneIds(progress).includes(zoneId);
  const completionCount = Number(state.outerDecks?.zoneCompletionCounts?.[zoneId] ?? 0);
  const firstClearDone = Boolean(state.outerDecks?.firstClearRecipeGranted?.[zoneId]);
  const expedition = getOuterDeckActiveExpedition(state);
  const isActiveZone = expedition?.zoneId === zoneId;

  const actionBlock = (() => {
    if (isActiveZone) {
      return `
        <div class="outer-deck-transit-card-actions">
          <button class="outer-deck-transit-btn outer-deck-transit-btn--primary" data-action="resume" data-zone-id="${zoneId}">RESUME</button>
          <button class="outer-deck-transit-btn" data-action="abandon" data-zone-id="${zoneId}">ABANDON</button>
        </div>
      `;
    }

    if (!unlocked) {
      return `
        <div class="outer-deck-transit-card-actions">
          <button class="outer-deck-transit-btn" type="button" disabled>LOCKED // FLOOR ${String(zone.unlockFloorOrdinal).padStart(2, "0")}</button>
        </div>
      `;
    }

    if (activeZoneId) {
      return `
        <div class="outer-deck-transit-card-actions">
          <button class="outer-deck-transit-btn" type="button" disabled>ACTIVE RUN IN PROGRESS</button>
        </div>
      `;
    }

    return `
      <div class="outer-deck-transit-card-actions">
        <button class="outer-deck-transit-btn outer-deck-transit-btn--primary" data-action="start" data-zone-id="${zoneId}">START EXPEDITION</button>
      </div>
    `;
  })();

  return `
    <article class="outer-deck-transit-card${isActiveZone ? " outer-deck-transit-card--active" : ""}">
      <div class="outer-deck-transit-card-header">
        <span class="outer-deck-transit-card-kicker">OUTER DECK ${String(zone.unlockFloorOrdinal).padStart(2, "0")}</span>
        <h2>${zone.label}</h2>
      </div>
      <p class="outer-deck-transit-card-copy">${zone.subtitle}</p>
      <div class="outer-deck-transit-card-meta">
        <span>${zone.gateVerb}</span>
        <span>${zone.environmentFlavors[0]}</span>
        <span>Clears: ${completionCount}</span>
        <span>${firstClearDone ? "Recipe recovered" : "First-clear recipe pending"}</span>
      </div>
      ${actionBlock}
    </article>
  `;
}

export function renderOuterDeckTransitScreen(
  options: {
    onClose?: () => void;
  } = {},
): void {
  cleanupOuterDeckTransitHotkey();

  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  const state = getGameState();
  const expedition = getOuterDeckActiveExpedition(state);
  const activeZoneId = expedition?.zoneId ?? null;

  root.innerHTML = `
    <div class="town-screen outer-deck-transit-screen">
      <header class="town-screen__hero outer-deck-transit-hero">
        <div>
          <div class="outer-deck-transit-eyebrow">HAVEN // OUTER DECK TRANSIT</div>
          <h1 class="town-screen__title">Outer Deck Expeditions</h1>
          <p class="town-screen__subtitle">Select a perimeter route, resume a live run, or stand down and return to the annex lane.</p>
        </div>
        <button class="outer-deck-transit-close" type="button" data-action="close">RETURN TO HAVEN</button>
      </header>
      <section class="outer-deck-transit-status">
        ${expedition
          ? `<div class="outer-deck-transit-status-chip">ACTIVE RUN // ${getOuterDeckZoneDefinition(expedition.zoneId).label}</div>`
          : `<div class="outer-deck-transit-status-chip">NO ACTIVE OUTER DECK RUN</div>`}
      </section>
      <section class="outer-deck-transit-grid">
        ${OUTER_DECK_ZONE_ORDER.map((zoneId) => renderZoneCard(zoneId, activeZoneId)).join("")}
      </section>
      <footer class="town-screen__footer outer-deck-transit-footer">
        <span>[ESC] Return to HAVEN field</span>
      </footer>
    </div>
  `;

  root.querySelectorAll<HTMLElement>("[data-action='close']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      cleanupOuterDeckTransitHotkey();
      options.onClose?.();
    });
  });

  root.querySelectorAll<HTMLElement>("[data-action='start'][data-zone-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const zoneId = button.dataset.zoneId as OuterDeckZoneId | undefined;
      if (!zoneId) {
        return;
      }

      const nextState = beginOuterDeckExpedition(getGameState(), zoneId);
      updateGameState(() => nextState);
      const nextExpedition = getOuterDeckActiveExpedition(nextState);
      const entrySubarea = nextExpedition?.subareas.find((subarea) => subarea.kind === "entry") ?? nextExpedition?.subareas[0];
      cleanupOuterDeckTransitHotkey();
      if (entrySubarea) {
        openOuterDeckMap(entrySubarea.mapId);
      } else {
        options.onClose?.();
      }
    });
  });

  root.querySelectorAll<HTMLElement>("[data-action='resume'][data-zone-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const expeditionState = getOuterDeckActiveExpedition(getGameState());
      const currentSubarea = expeditionState?.subareas.find((subarea) => subarea.id === expeditionState.currentSubareaId);
      cleanupOuterDeckTransitHotkey();
      if (currentSubarea) {
        openOuterDeckMap(currentSubarea.mapId);
      } else {
        options.onClose?.();
      }
    });
  });

  root.querySelectorAll<HTMLElement>("[data-action='abandon'][data-zone-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      updateGameState((prev) => abortOuterDeckExpedition(prev));
      renderOuterDeckTransitScreen(options);
    });
  });

  outerDeckTransitKeyHandler = (event: KeyboardEvent) => {
    const key = event.key?.toLowerCase() ?? "";
    if (key !== "escape") {
      return;
    }
    event.preventDefault();
    cleanupOuterDeckTransitHotkey();
    options.onClose?.();
  };
  window.addEventListener("keydown", outerDeckTransitKeyHandler);
}
