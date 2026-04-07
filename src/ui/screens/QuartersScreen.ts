// ============================================================================
// QUARTERS SCREEN
// ============================================================================

import { getGameState } from "../../state/gameStore";
import {
  getMailState,
  getUnreadCount,
  markMailRead,
  MailItem,
  syncImportedMailUnlocks,
} from "../../core/mailSystem";
import {
  getQuartersBuffsState,
  restAtBunk,
  canRest,
} from "../../core/quartersBuffs";
import {
  getDecorState,
  getAllDecorItems,
  getUnplacedDecor,
  getPlacedDecor,
  placeDecor,
  removeDecor,
  seedInitialDecor,
  DecorAnchorId,
} from "../../core/decorSystem";
import { loadCampaignProgress } from "../../core/campaign";
import { showDialogue } from "./DialogueScreen";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { showSystemPing } from "../components/systemPing";

type QuartersPanel = "main" | "mailbox" | "bunk" | "pinboard" | "footlocker";

let currentPanel: QuartersPanel = "main";
let currentMail: MailItem | null = null;
let currentMailPage = 0;

function renderQuartersShell(
  returnTo: BaseCampReturnTo,
  options: {
    title: string;
    subtitle: string;
    bodyClass: string;
    body: string;
    backText?: string;
  }
): string {
  return `
    <div class="quarters-root town-screen ard-noise">
      <div class="quarters-panel town-screen__panel">
        <div class="quarters-header town-screen__header">
          <div class="quarters-header-left town-screen__titleblock">
            <h1 class="quarters-title">${options.title}</h1>
            <div class="quarters-subtitle">${options.subtitle}</div>
          </div>
          <div class="quarters-header-right town-screen__header-right">
            <button class="quarters-back-btn town-screen__back-btn" id="quartersBackBtn">
              <span class="btn-icon">←</span>
              <span class="btn-text">${options.backText ?? getBaseCampReturnLabel(returnTo)}</span>
            </button>
          </div>
        </div>

        <div class="quarters-content town-screen__content-panel ${options.bodyClass}">
          ${options.body}
        </div>
      </div>
    </div>
  `;
}

function registerQuartersExitHotkey(returnTo: BaseCampReturnTo): void {
  registerBaseCampReturnHotkey("quarters-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".quarters-root",
  });
}

function returnFromQuartersScreen(returnTo: BaseCampReturnTo): void {
  unregisterBaseCampReturnHotkey("quarters-screen");
  returnFromBaseCampScreen(returnTo);
}

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderQuartersScreen(
  returnTo: BaseCampReturnTo = "basecamp",
  initialPanel?: QuartersPanel
): void {
  const root = document.getElementById("app");
  if (!root) return;

  syncImportedMailUnlocks();

  // If called from field mode, render the quarters field map instead
  if (returnTo === "field" && !initialPanel) {
    import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
      renderFieldScreen("quarters");
    });
    return;
  }

  // Set panel if provided
  if (initialPanel) {
    currentPanel = initialPanel;
  }

  const state = getGameState();
  const unreadCount = getUnreadCount(state);
  const buffsState = getQuartersBuffsState(state);
  const decorState = getDecorState(state);

  // Seed initial decor if needed
  seedInitialDecor();

  // Render based on current panel
  if (currentPanel === "mailbox") {
    renderMailboxPanel(returnTo);
    return;
  }

  if (currentPanel === "bunk") {
    renderBunkPanel(returnTo);
    return;
  }

  if (currentPanel === "pinboard") {
    renderPinboardPanel(returnTo);
    return;
  }

  if (currentPanel === "footlocker") {
    renderFootlockerPanel(returnTo);
    return;
  }

  // Main quarters view
  root.innerHTML = renderQuartersShell(returnTo, {
    title: "QUARTERS",
    subtitle: "S/COM_OS // DOWNTIME_STATION",
    bodyClass: "quarters-room",
    body: `
      <div class="quarters-room-description">
        Personal space for recovery, correspondence, and small bits of off-duty ritual before the next deployment.
      </div>

      <div class="quarters-interactables">
        <button class="quarters-interactable" id="mailboxBtn" data-unread="${unreadCount}">
          <span class="interactable-code">MAIL</span>
          <span class="interactable-label">Mailbox</span>
          <span class="interactable-text">Review dispatches, gossip, and official notices addressed to the squad.</span>
          ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount} NEW</span>` : `<span class="interactable-status">QUIET</span>`}
        </button>

        <button class="quarters-interactable" id="bunkBtn">
          <span class="interactable-code">REST</span>
          <span class="interactable-label">Bunk</span>
          <span class="interactable-text">Turn in early and carry a small edge into the next operation.</span>
          ${buffsState.currentBuff && !buffsState.currentBuff.consumed
            ? `<span class="buff-active">BUFF READY</span>`
            : `<span class="interactable-status">AVAILABLE</span>`}
        </button>

        <button class="quarters-interactable" id="pinboardBtn">
          <span class="interactable-code">LOG</span>
          <span class="interactable-label">Pinboard</span>
          <span class="interactable-text">Track completed ops, failures, and whatever the crew decided was worth remembering.</span>
          <span class="interactable-status">${(loadCampaignProgress().completedOperations || []).length} FILED</span>
        </button>

        <button class="quarters-interactable" id="footlockerBtn">
          <span class="interactable-code">DECO</span>
          <span class="interactable-label">Footlocker</span>
          <span class="interactable-text">Arrange the scraps of comfort you have managed to keep alive between deployments.</span>
          <span class="interactable-status">${getPlacedDecor(state).length} PLACED</span>
        </button>

        <button class="quarters-interactable" id="sableBtn">
          <span class="interactable-code">COMP</span>
          <span class="interactable-label">Sable</span>
          <span class="interactable-text">Check in with the camp hound. Morale support remains unofficial, but reliable.</span>
          <span class="interactable-status">WAITING</span>
        </button>
      </div>

      <div class="quarters-decor-preview">
        ${renderDecorPreview(decorState)}
      </div>
    `,
  });

  registerQuartersExitHotkey(returnTo);
  attachQuartersListeners(returnTo);
}

// ============================================================================
// MAILBOX PANEL
// ============================================================================

function renderMailboxPanel(returnTo: BaseCampReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const mailState = getMailState(state);

  if (currentMail) {
    // Show mail reading view
    const page = currentMail.bodyPages[currentMailPage] || "";
    const isLastPage = currentMailPage >= currentMail.bodyPages.length - 1;
    const isFirstPage = currentMailPage === 0;

  root.innerHTML = renderQuartersShell(returnTo, {
    title: "MAILBOX",
    subtitle: `S/COM_OS // MESSAGE_VIEWER • ${currentMail.subject}`,
    bodyClass: "mail-view",
    backText: "BACK TO MAILBOX",
    body: `
        <div class="mail-header">
          <div class="mail-from">FROM // ${currentMail.from}</div>
          <div class="mail-category">${currentMail.category.toUpperCase()}</div>
        </div>

        <div class="mail-body">
          <div class="mail-page">${page}</div>
        </div>

        <div class="mail-footer">
          <button class="mail-nav-btn" id="mailPrevBtn" ${isFirstPage ? "disabled" : ""}>
            ← PREV
          </button>
          <div class="mail-page-indicator">
            PAGE ${currentMailPage + 1} / ${currentMail.bodyPages.length}
          </div>
          <button class="mail-nav-btn" id="mailNextBtn" ${isLastPage ? "disabled" : ""}>
            NEXT →
          </button>
        </div>
      `,
    });

    registerQuartersExitHotkey(returnTo);
    root.querySelector("#quartersBackBtn")?.addEventListener("click", () => {
      if (currentMail) {
        // If viewing a mail, go back to inbox
        currentMail = null;
        currentMailPage = 0;
        renderMailboxPanel(returnTo);
      } else {
        // If in inbox, go back to quarters
        if (returnTo === "field") {
          returnFromQuartersScreen(returnTo);
        } else {
          currentPanel = "main";
          renderQuartersScreen(returnTo);
        }
      }
    });

    root.querySelector("#mailPrevBtn")?.addEventListener("click", () => {
      if (currentMailPage > 0) {
        currentMailPage--;
        renderMailboxPanel(returnTo);
      }
    });

    root.querySelector("#mailNextBtn")?.addEventListener("click", () => {
      if (currentMail && currentMailPage < currentMail.bodyPages.length - 1) {
        currentMailPage++;
        renderMailboxPanel(returnTo);
      } else if (currentMail && isLastPage) {
        // Mark as read when finished
        markMailRead(currentMail.id);
        currentMail = null;
        currentMailPage = 0;
        currentPanel = "mailbox";
        renderMailboxPanel(returnTo);
      }
    });

    return;
  }

  // Show inbox list
  root.innerHTML = renderQuartersShell(returnTo, {
    title: "MAILBOX",
    subtitle: "S/COM_OS // INBOX_INDEX",
    bodyClass: "mailbox-inbox",
    backText: "BACK TO QUARTERS",
    body: mailState.inbox.length === 0
      ? `<div class="mailbox-empty">No mail is waiting. Either command has gone quiet or the crew finally stopped leaving notes.</div>`
      : mailState.inbox
          .sort((a, b) => b.receivedAt - a.receivedAt)
          .map(
            (mail) => `
              <div class="mail-item ${mail.read ? "read" : "unread"}" data-mail-id="${mail.id}">
                <div class="mail-item-header">
                  <div class="mail-item-from">${mail.from}</div>
                  <div class="mail-item-category">${mail.category}</div>
                </div>
                <div class="mail-item-subject">${mail.subject}</div>
                ${!mail.read ? `<div class="mail-item-unread-indicator">NEW</div>` : `<div class="mail-item-unread-indicator mail-item-unread-indicator--read">READ</div>`}
              </div>
            `,
          )
          .join(""),
  });

  registerQuartersExitHotkey(returnTo);
  root.querySelector("#quartersBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      returnFromQuartersScreen(returnTo);
    } else {
      currentPanel = "main";
      renderQuartersScreen(returnTo);
    }
  });

  // Mail item clicks
  root.querySelectorAll(".mail-item").forEach((el) => {
    el.addEventListener("click", () => {
      const mailId = (el as HTMLElement).getAttribute("data-mail-id");
      if (mailId) {
        const mail = mailState.inbox.find((m) => m.id === mailId);
        if (mail) {
          currentMail = mail;
          currentMailPage = 0;
          renderMailboxPanel(returnTo);
        }
      }
    });
  });
}

// ============================================================================
// BUNK PANEL
// ============================================================================

function renderBunkPanel(returnTo: BaseCampReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const buffsState = getQuartersBuffsState(state);
  const canRestNow = canRest(state);

  root.innerHTML = renderQuartersShell(returnTo, {
    title: "BUNK",
    subtitle: "S/COM_OS // RECOVERY_PROTOCOL",
    bodyClass: "bunk-view",
    backText: "BACK TO QUARTERS",
    body: `
      <div class="bunk-description">
        Take the edge off and bank a small randomized benefit for the next operation. Nothing dramatic, just the kind of luck that comes from a decent night's sleep.
      </div>

      ${buffsState.currentBuff && !buffsState.currentBuff.consumed ? `
        <div class="bunk-current-buff">
          <div class="buff-title">CURRENT BUFF</div>
          <div class="buff-name">${buffsState.currentBuff.name}</div>
          <div class="buff-description">${buffsState.currentBuff.description}</div>
        </div>
      ` : `
        <div class="bunk-current-buff bunk-current-buff--empty">
          <div class="buff-title">NO BUFF STORED</div>
          <div class="buff-description">Turn in now to queue a small advantage for the next deployment.</div>
        </div>
      `}

      <button class="bunk-rest-btn" id="restBtn" ${!canRestNow ? "disabled" : ""}>
        ${canRestNow ? "REST UNTIL MORNING" : "RECOVERY ALREADY CLAIMED"}
      </button>

      <div class="bunk-note">
        ${canRestNow
          ? "Rest can only be claimed once per visit to quarters."
          : "The stored buff remains queued until your next run begins."}
      </div>
    `,
  });

  registerQuartersExitHotkey(returnTo);
  root.querySelector("#quartersBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      returnFromQuartersScreen(returnTo);
    } else {
      currentPanel = "main";
      renderQuartersScreen(returnTo);
    }
  });

  root.querySelector("#restBtn")?.addEventListener("click", async () => {
    if (!canRestNow) return;

    const buff = await restAtBunk();
    if (buff) {
      showSystemPing({
        title: "BUFF RECEIVED",
        message: buff.name,
        detail: buff.description,
        type: "success",
        channel: "quarters-buff",
      });
      renderBunkPanel(returnTo);
      return;

      /*
      // Show buff notification
      const notification = document.createElement("div");
      notification.className = "buff-notification";
      notification.innerHTML = `
        <div class="buff-notification-content">
          <div class="buff-notification-title">BUFF RECEIVED</div>
          <div class="buff-notification-name">${buff.name}</div>
          <div class="buff-notification-desc">${buff.description}</div>
        </div>
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.classList.add("visible");
      }, 10);

      setTimeout(() => {
        notification.classList.remove("visible");
        setTimeout(() => notification.remove(), 300);
      }, 3000);
      */

      // Refresh panel
      renderBunkPanel(returnTo);
    }
  });
}

// ============================================================================
// PINBOARD PANEL
// ============================================================================

function renderPinboardPanel(returnTo: BaseCampReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const progress = loadCampaignProgress();
  const pinboardState = state.quarters?.pinboard ?? {
    completedOperations: [],
    failedOperations: [],
    log: [],
  };

  // Get completed operations
  const completedOps = progress.completedOperations || [];
  const failedOps = pinboardState.failedOperations || [];
  const log = pinboardState.log || [];

  root.innerHTML = renderQuartersShell(returnTo, {
    title: "PINBOARD",
    subtitle: "S/COM_OS // ROOM_LOGBOOK",
    bodyClass: "pinboard-view",
    backText: "BACK TO QUARTERS",
    body: `
      <div class="pinboard-section">
        <div class="pinboard-section-title">COMPLETED OPERATIONS</div>
        <div class="pinboard-list">
          ${completedOps.length === 0
            ? `<div class="pinboard-empty">No operations have been pinned here yet.</div>`
            : completedOps.map((opId) => `<div class="pinboard-item">${opId}</div>`).join("")}
        </div>
      </div>

      <div class="pinboard-section">
        <div class="pinboard-section-title">FAILED OPERATIONS</div>
        <div class="pinboard-list">
          ${failedOps.length === 0
            ? `<div class="pinboard-empty">No failures logged. Keep it that way.</div>`
            : failedOps.map((opId) => `<div class="pinboard-item failed">${opId}</div>`).join("")}
        </div>
      </div>

      <div class="pinboard-section">
        <div class="pinboard-section-title">ROOM LOG</div>
        <div class="pinboard-log">
          ${log.length === 0
            ? `<div class="pinboard-empty">No handwritten notes, sketches, or records have been archived yet.</div>`
            : log
                .slice()
                .reverse()
                .map(
                  (entry) => `
                    <div class="pinboard-log-entry">
                      <div class="log-timestamp">${new Date(entry.timestamp).toLocaleDateString()}</div>
                      <div class="log-message">${entry.message}</div>
                    </div>
                  `,
                )
                .join("")}
        </div>
      </div>
    `,
  });

  registerQuartersExitHotkey(returnTo);
  root.querySelector("#quartersBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      returnFromQuartersScreen(returnTo);
    } else {
      currentPanel = "main";
      renderQuartersScreen(returnTo);
    }
  });
}

// ============================================================================
// FOOTLOCKER PANEL (DECOR MANAGEMENT)
// ============================================================================

function renderFootlockerPanel(returnTo: BaseCampReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const unplaced = getUnplacedDecor(state);
  const placed = getPlacedDecor(state);
  const allAnchors: DecorAnchorId[] = [
    "wall_left",
    "wall_right",
    "floor_corner",
    "desk_top",
    "shelf_top",
    "window_sill",
    "bedside_table",
  ];

  root.innerHTML = renderQuartersShell(returnTo, {
    title: "FOOTLOCKER",
    subtitle: "S/COM_OS // DECOR_LAYOUT",
    bodyClass: "footlocker-view",
    backText: "BACK TO QUARTERS",
    body: `
      <div class="footlocker-section">
        <div class="footlocker-section-title">UNPLACED ITEMS</div>
        <div class="footlocker-items">
          ${unplaced.length === 0
            ? `<div class="footlocker-empty">Everything you own is already on display, packed away, or spoken for.</div>`
            : unplaced
                .map(
                  (decor) => `
                    <div class="footlocker-item" data-decor-id="${decor.id}">
                      <div class="footlocker-item-icon">${decor.iconKey || "CRATE"}</div>
                      <div class="footlocker-item-name">${decor.name}</div>
                      <div class="footlocker-item-desc">${decor.description}</div>
                      <div class="footlocker-item-anchors">
                        COMPATIBLE: ${decor.allowedAnchors.join(", ")}
                      </div>
                      <button class="footlocker-place-btn" data-decor-id="${decor.id}">PLACE ITEM</button>
                    </div>
                  `,
                )
                .join("")}
        </div>
      </div>

      <div class="footlocker-section">
        <div class="footlocker-section-title">PLACED ITEMS</div>
        <div class="footlocker-anchors">
          ${allAnchors
            .map((anchorId) => {
              const placedDecor = placed.find((p) => p.anchorId === anchorId);
              return `
                <div class="footlocker-anchor" data-anchor-id="${anchorId}">
                  <div class="anchor-label">${anchorId.replace(/_/g, " ").toUpperCase()}</div>
                  ${placedDecor
                    ? `
                      <div class="anchor-decor">
                        <div class="anchor-decor-icon">${placedDecor.decor.iconKey || "ITEM"}</div>
                        <div class="anchor-decor-name">${placedDecor.decor.name}</div>
                        <button class="anchor-remove-btn" data-anchor-id="${anchorId}">REMOVE</button>
                      </div>
                    `
                    : `<div class="anchor-empty">EMPTY SLOT</div>`}
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `,
  });

  registerQuartersExitHotkey(returnTo);
  root.querySelector("#quartersBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      returnFromQuartersScreen(returnTo);
    } else {
      currentPanel = "main";
      renderQuartersScreen(returnTo);
    }
  });

  // Place decor buttons
  root.querySelectorAll(".footlocker-place-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const decorId = (btn as HTMLElement).getAttribute("data-decor-id");
      if (!decorId) return;

      const decor = getAllDecorItems().find((d) => d.id === decorId);
      if (!decor) return;

      // Show anchor selection
      const anchorOptions = decor.allowedAnchors
        .map(
          (anchorId) => `
        <button class="anchor-select-btn" data-decor-id="${decorId}" data-anchor-id="${anchorId}">
          ${anchorId.replace(/_/g, " ").toUpperCase()}
        </button>
      `
        )
        .join("");

      const modal = document.createElement("div");
      modal.className = "anchor-select-modal";
      modal.innerHTML = `
        <div class="anchor-select-content">
          <div class="anchor-select-title">Select Anchor for ${decor.name}</div>
          <div class="anchor-select-options">${anchorOptions}</div>
          <button class="anchor-select-cancel">CANCEL</button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector(".anchor-select-cancel")?.addEventListener("click", () => {
        modal.remove();
      });

      modal.querySelectorAll(".anchor-select-btn").forEach((optBtn) => {
        optBtn.addEventListener("click", async () => {
          const targetAnchorId = (optBtn as HTMLElement).getAttribute(
            "data-anchor-id"
          ) as DecorAnchorId;
          const success = await placeDecor(decorId, targetAnchorId);
          if (success) {
            modal.remove();
            renderFootlockerPanel(returnTo);
          }
        });
      });
    });
  });

  // Remove decor buttons
  root.querySelectorAll(".anchor-remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const anchorId = (btn as HTMLElement).getAttribute("data-anchor-id") as DecorAnchorId;
      const success = await removeDecor(anchorId);
      if (success) {
        renderFootlockerPanel(returnTo);
      }
    });
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function renderDecorPreview(decorState: any): string {
  const placed = getPlacedDecor({ quarters: { decor: decorState } });
  if (placed.length === 0) return "";

  return `
    <div class="quarters-decor-hint">
      ${placed.length} decor item${placed.length > 1 ? "s" : ""} placed
    </div>
  `;
}

function attachQuartersListeners(returnTo: BaseCampReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.querySelector("#quartersBackBtn")?.addEventListener("click", () => {
    returnFromQuartersScreen(returnTo);
  });

  root.querySelector("#mailboxBtn")?.addEventListener("click", () => {
    currentPanel = "mailbox";
    currentMail = null;
    currentMailPage = 0;
    renderQuartersScreen(returnTo);
  });

  root.querySelector("#bunkBtn")?.addEventListener("click", () => {
    currentPanel = "bunk";
    renderQuartersScreen(returnTo);
  });

  root.querySelector("#pinboardBtn")?.addEventListener("click", () => {
    currentPanel = "pinboard";
    renderQuartersScreen(returnTo);
  });

  root.querySelector("#footlockerBtn")?.addEventListener("click", () => {
    currentPanel = "footlocker";
    renderQuartersScreen(returnTo);
  });

  root.querySelector("#sableBtn")?.addEventListener("click", () => {
    // Show Aeriss dialogue
    showDialogue("Aeriss", ["you've done a great job today"]);
  });
}
