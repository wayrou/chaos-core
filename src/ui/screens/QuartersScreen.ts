// ============================================================================
// QUARTERS SCREEN
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import {
  getMailState,
  getUnreadCount,
  markMailRead,
  MailItem,
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

type QuartersPanel = "main" | "mailbox" | "bunk" | "pinboard" | "footlocker";

let currentPanel: QuartersPanel = "main";
let currentMail: MailItem | null = null;
let currentMailPage = 0;

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderQuartersScreen(
  returnTo: "basecamp" | "field" = "basecamp",
  initialPanel?: QuartersPanel
): void {
  const root = document.getElementById("app");
  if (!root) return;

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
  const mailState = getMailState(state);
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
  root.innerHTML = `
    <div class="quarters-root">
      <div class="quarters-header">
        <div class="quarters-title">QUARTERS</div>
        <button class="quarters-back-btn" id="quartersBackBtn">← BACK</button>
      </div>

      <div class="quarters-room">
        <div class="quarters-room-description">
          Your personal downtime space. A place to rest, reflect, and prepare.
        </div>

        <div class="quarters-interactables">
          <button class="quarters-interactable" id="mailboxBtn" data-unread="${unreadCount}">
            <span class="interactable-icon">📬</span>
            <span class="interactable-label">MAILBOX</span>
            ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ""}
          </button>

          <button class="quarters-interactable" id="bunkBtn">
            <span class="interactable-icon">🛏️</span>
            <span class="interactable-label">BUNK</span>
            ${buffsState.currentBuff && !buffsState.currentBuff.consumed
              ? `<span class="buff-active">BUFF ACTIVE</span>`
              : ""}
          </button>

          <button class="quarters-interactable" id="pinboardBtn">
            <span class="interactable-icon">📋</span>
            <span class="interactable-label">PINBOARD</span>
          </button>

          <button class="quarters-interactable" id="footlockerBtn">
            <span class="interactable-icon">📦</span>
            <span class="interactable-label">FOOTLOCKER</span>
          </button>

          <button class="quarters-interactable" id="sableBtn">
            <span class="interactable-icon">🐕</span>
            <span class="interactable-label">SABLE</span>
          </button>
        </div>

        <div class="quarters-decor-preview">
          ${renderDecorPreview(decorState)}
        </div>
      </div>
    </div>
  `;

  attachQuartersListeners(returnTo);
}

// ============================================================================
// MAILBOX PANEL
// ============================================================================

function renderMailboxPanel(returnTo: "basecamp" | "field"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const mailState = getMailState(state);

  if (currentMail) {
    // Show mail reading view
    const page = currentMail.bodyPages[currentMailPage] || "";
    const isLastPage = currentMailPage >= currentMail.bodyPages.length - 1;
    const isFirstPage = currentMailPage === 0;

    root.innerHTML = `
      <div class="quarters-root">
        <div class="quarters-header">
          <div class="quarters-title">MAILBOX - ${currentMail.subject}</div>
          <button class="quarters-back-btn" id="mailboxBackBtn">← BACK</button>
        </div>

        <div class="mail-view">
          <div class="mail-header">
            <div class="mail-from">From: ${currentMail.from}</div>
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
              Page ${currentMailPage + 1} / ${currentMail.bodyPages.length}
            </div>
            <button class="mail-nav-btn" id="mailNextBtn" ${isLastPage ? "disabled" : ""}>
              NEXT →
            </button>
          </div>
        </div>
      </div>
    `;

    root.querySelector("#mailboxBackBtn")?.addEventListener("click", () => {
      if (currentMail) {
        // If viewing a mail, go back to inbox
        currentMail = null;
        currentMailPage = 0;
        renderMailboxPanel(returnTo);
      } else {
        // If in inbox, go back to quarters
        if (returnTo === "field") {
          import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
            renderFieldScreen("quarters");
          });
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
  root.innerHTML = `
    <div class="quarters-root">
      <div class="quarters-header">
        <div class="quarters-title">MAILBOX</div>
        <button class="quarters-back-btn" id="mailboxBackBtn">← BACK</button>
      </div>

      <div class="mailbox-inbox">
        ${mailState.inbox.length === 0
          ? `<div class="mailbox-empty">No mail. The mailbox is empty.</div>`
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
            ${!mail.read ? `<div class="mail-item-unread-indicator">NEW</div>` : ""}
          </div>
        `
              )
              .join("")}
      </div>
    </div>
  `;

  root.querySelector("#mailboxBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      // Return to quarters field map
      import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("quarters");
      });
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

function renderBunkPanel(returnTo: "basecamp" | "field"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const buffsState = getQuartersBuffsState(state);
  const canRestNow = canRest(state);

  root.innerHTML = `
    <div class="quarters-root">
      <div class="quarters-header">
        <div class="quarters-title">BUNK</div>
        <button class="quarters-back-btn" id="bunkBackBtn">← BACK</button>
      </div>

      <div class="bunk-view">
        <div class="bunk-description">
          Rest here to receive a small randomized buff for your next operation run.
          Buffs are intentionally small and non-optimizable.
        </div>

        ${buffsState.currentBuff && !buffsState.currentBuff.consumed ? `
          <div class="bunk-current-buff">
            <div class="buff-title">Current Buff:</div>
            <div class="buff-name">${buffsState.currentBuff.name}</div>
            <div class="buff-description">${buffsState.currentBuff.description}</div>
          </div>
        ` : ""}

        <button class="bunk-rest-btn" id="restBtn" ${!canRestNow ? "disabled" : ""}>
          ${canRestNow ? "REST" : "ALREADY RESTED"}
        </button>

        <div class="bunk-note">
          ${canRestNow
            ? "Resting grants a random small buff for your next run."
            : "You've already rested this visit. Buff will apply to your next run."}
        </div>
      </div>
    </div>
  `;

  root.querySelector("#bunkBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      // Return to quarters field map
      import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("quarters");
      });
    } else {
      currentPanel = "main";
      renderQuartersScreen(returnTo);
    }
  });

  root.querySelector("#restBtn")?.addEventListener("click", async () => {
    if (!canRestNow) return;

    const buff = await restAtBunk();
    if (buff) {
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

      // Refresh panel
      renderBunkPanel(returnTo);
    }
  });
}

// ============================================================================
// PINBOARD PANEL
// ============================================================================

function renderPinboardPanel(returnTo: "basecamp" | "field"): void {
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

  root.innerHTML = `
    <div class="quarters-root">
      <div class="quarters-header">
        <div class="quarters-title">PINBOARD</div>
        <button class="quarters-back-btn" id="pinboardBackBtn">← BACK</button>
      </div>

      <div class="pinboard-view">
        <div class="pinboard-section">
          <div class="pinboard-section-title">COMPLETED OPERATIONS</div>
          <div class="pinboard-list">
            ${completedOps.length === 0
              ? `<div class="pinboard-empty">No operations completed yet.</div>`
              : completedOps.map((opId) => `<div class="pinboard-item">${opId}</div>`).join("")}
          </div>
        </div>

        <div class="pinboard-section">
          <div class="pinboard-section-title">FAILED OPERATIONS</div>
          <div class="pinboard-list">
            ${failedOps.length === 0
              ? `<div class="pinboard-empty">No failed operations recorded.</div>`
              : failedOps.map((opId) => `<div class="pinboard-item failed">${opId}</div>`).join("")}
          </div>
        </div>

        <div class="pinboard-section">
          <div class="pinboard-section-title">LOG</div>
          <div class="pinboard-log">
            ${log.length === 0
              ? `<div class="pinboard-empty">No log entries yet.</div>`
              : log
                  .slice()
                  .reverse()
                  .map(
                    (entry) => `
              <div class="pinboard-log-entry">
                <div class="log-timestamp">${new Date(entry.timestamp).toLocaleDateString()}</div>
                <div class="log-message">${entry.message}</div>
              </div>
            `
                  )
                  .join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector("#pinboardBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      // Return to quarters field map
      import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("quarters");
      });
    } else {
      currentPanel = "main";
      renderQuartersScreen(returnTo);
    }
  });
}

// ============================================================================
// FOOTLOCKER PANEL (DECOR MANAGEMENT)
// ============================================================================

function renderFootlockerPanel(returnTo: "basecamp" | "field"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const decorState = getDecorState(state);
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

  root.innerHTML = `
    <div class="quarters-root">
      <div class="quarters-header">
        <div class="quarters-title">FOOTLOCKER - DECOR</div>
        <button class="quarters-back-btn" id="footlockerBackBtn">← BACK</button>
      </div>

      <div class="footlocker-view">
        <div class="footlocker-section">
          <div class="footlocker-section-title">UNPLACED ITEMS</div>
          <div class="footlocker-items">
            ${unplaced.length === 0
              ? `<div class="footlocker-empty">No unplaced decor items.</div>`
              : unplaced
                  .map(
                    (decor) => `
              <div class="footlocker-item" data-decor-id="${decor.id}">
                <div class="footlocker-item-icon">${decor.iconKey || "📦"}</div>
                <div class="footlocker-item-name">${decor.name}</div>
                <div class="footlocker-item-desc">${decor.description}</div>
                <div class="footlocker-item-anchors">
                  Compatible: ${decor.allowedAnchors.join(", ")}
                </div>
                <button class="footlocker-place-btn" data-decor-id="${decor.id}">PLACE</button>
              </div>
            `
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
                  <div class="anchor-decor-icon">${placedDecor.decor.iconKey || "📦"}</div>
                  <div class="anchor-decor-name">${placedDecor.decor.name}</div>
                  <button class="anchor-remove-btn" data-anchor-id="${anchorId}">REMOVE</button>
                </div>
              `
                  : `<div class="anchor-empty">Empty</div>`}
              </div>
            `;
              })
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector("#footlockerBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      // Return to quarters field map
      import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("quarters");
      });
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

function attachQuartersListeners(returnTo: "basecamp" | "field"): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.querySelector("#quartersBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      // Return to quarters field map
      import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("quarters");
      });
    } else {
      import("./AllNodesMenuScreen").then(({ renderAllNodesMenuScreen }) => {
        renderAllNodesMenuScreen();
      });
    }
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

