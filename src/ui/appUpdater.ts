import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { APP_VERSION } from "../core/appVersion";
import { getControllerMode, setControllerMode, updateFocusableElements } from "../core/controllerSupport";
import { showAlertDialog, showConfirmDialog } from "./components/confirmDialog";

const UPDATE_CHECK_STORAGE_KEY = "chaoscore_updater_last_check_at";
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_REQUEST_TIMEOUT_MS = 15_000;
const MAIN_MENU_SCREEN_ID = "main-menu";
const DIALOG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[data-controller-focusable='true']",
].join(", ");

let updaterInitialized = false;

type MutableWindow = Window & {
  __TAURI__?: {
    invoke?: unknown;
  };
};

type UpdateProgressOverlay = {
  close: () => void;
  setStatus: (message: string) => void;
  setProgress: (downloadedBytes: number, totalBytes?: number) => void;
};

function isTauriDesktopRuntime(): boolean {
  const tauriWindow = window as MutableWindow;
  return typeof tauriWindow.__TAURI__?.invoke === "function";
}

function readLastUpdateCheckAt(): number {
  try {
    const storedValue = window.localStorage.getItem(UPDATE_CHECK_STORAGE_KEY);
    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  } catch {
    return 0;
  }
}

function markUpdateCheck(now = Date.now()): void {
  try {
    window.localStorage.setItem(UPDATE_CHECK_STORAGE_KEY, String(now));
  } catch {
    // Ignore persistence failures and continue checking updates for this session.
  }
}

function shouldCheckForUpdates(now = Date.now()): boolean {
  if (import.meta.env.DEV || !isTauriDesktopRuntime()) {
    return false;
  }

  return now - readLastUpdateCheckAt() >= UPDATE_CHECK_INTERVAL_MS;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveMountTarget(): HTMLElement {
  const app = document.getElementById("app");
  const screenRoot = app?.firstElementChild;
  return (screenRoot as HTMLElement | null) ?? app ?? document.body ?? document.documentElement;
}

function stripMarkdown(value: string): string {
  return value.replace(/[`*_>#-]+/g, " ").replace(/\s+/g, " ").trim();
}

function summarizeReleaseNotes(notes?: string): string {
  if (!notes) {
    return "";
  }

  const summary = notes
    .split(/\r?\n/)
    .map((line) => stripMarkdown(line))
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  if (!summary) {
    return "";
  }

  return summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}...` : summary;
}

function buildUpdatePromptMessage(update: Update): string {
  const releaseNotes = summarizeReleaseNotes(update.body);
  const messageParts = [
    `A signed Chaos Core update is ready. Current build: v${APP_VERSION}. Available build: v${update.version}.`,
  ];

  if (releaseNotes) {
    messageParts.push(`Release notes preview: ${releaseNotes}`);
  }

  messageParts.push("Install now? The game will restart after the update finishes.");
  return messageParts.join(" ");
}

function waitForMainMenuScreen(): Promise<void> {
  if (document.body.getAttribute("data-screen") === MAIN_MENU_SCREEN_ID) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.body.getAttribute("data-screen") === MAIN_MENU_SCREEN_ID) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-screen"],
    });
  });
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 100 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function createUpdateProgressOverlay(targetVersion: string): UpdateProgressOverlay {
  const mountTarget = resolveMountTarget();
  const previousMode = getControllerMode();
  const previousActiveElement = document.activeElement as HTMLElement | null;
  const overlay = document.createElement("div");
  overlay.className = "game-confirm-modal-backdrop";
  overlay.innerHTML = `
    <div class="game-confirm-modal game-confirm-modal--update" role="dialog" aria-modal="true" aria-labelledby="gameUpdateProgressTitle">
      <div class="game-confirm-modal__header">
        <div class="game-confirm-modal__kicker">SYSTEM UPDATE</div>
        <h2 class="game-confirm-modal__title" id="gameUpdateProgressTitle">INSTALLING V${escapeHtml(targetVersion)}</h2>
      </div>
      <div class="game-confirm-modal__copy game-update-progress">
        <div class="game-update-progress__status" data-update-progress-status aria-live="polite">
          Preparing signed update package...
        </div>
        <div class="game-update-progress__meter" aria-hidden="true">
          <div class="game-update-progress__fill" data-update-progress-fill></div>
        </div>
        <div class="game-update-progress__stats" data-update-progress-stats>
          Waiting for download to begin...
        </div>
        <div class="game-update-progress__hint">
          Chaos Core will restart automatically after the installer finishes.
        </div>
        <div class="game-update-progress__focus-guard" tabindex="0" data-controller-default-focus="true" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const mutatedElements = Array.from(mountTarget.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR))
    .filter((element) => !overlay.contains(element))
    .map((element) => ({
      element,
      previousExclude: element.getAttribute("data-controller-exclude"),
    }));

  mutatedElements.forEach(({ element }) => {
    element.setAttribute("data-controller-exclude", "true");
  });

  mountTarget.appendChild(overlay);
  setControllerMode("focus");
  updateFocusableElements();

  const statusElement = overlay.querySelector<HTMLElement>("[data-update-progress-status]");
  const statsElement = overlay.querySelector<HTMLElement>("[data-update-progress-stats]");
  const fillElement = overlay.querySelector<HTMLElement>("[data-update-progress-fill]");
  const focusGuard = overlay.querySelector<HTMLElement>(".game-update-progress__focus-guard");

  requestAnimationFrame(() => {
    focusGuard?.focus();
    updateFocusableElements();
  });

  let closed = false;

  return {
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      overlay.remove();
      mutatedElements.forEach(({ element, previousExclude }) => {
        if (previousExclude === null) {
          element.removeAttribute("data-controller-exclude");
        } else {
          element.setAttribute("data-controller-exclude", previousExclude);
        }
      });
      setControllerMode(previousMode);
      updateFocusableElements();
      requestAnimationFrame(() => {
        previousActiveElement?.focus();
      });
    },
    setStatus: (message: string) => {
      if (statusElement) {
        statusElement.textContent = message;
      }
    },
    setProgress: (downloadedBytes: number, totalBytes?: number) => {
      if (fillElement) {
        const widthPercent = totalBytes && totalBytes > 0
          ? Math.max(8, Math.min(100, (downloadedBytes / totalBytes) * 100))
          : 100;
        fillElement.style.width = `${widthPercent}%`;
      }

      if (statsElement) {
        if (totalBytes && totalBytes > 0) {
          const percentage = Math.max(0, Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
          statsElement.textContent = `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} (${percentage}%)`;
        } else {
          statsElement.textContent = `${formatBytes(downloadedBytes)} downloaded`;
        }
      }
    },
  };
}

async function promptForUpdate(update: Update): Promise<boolean> {
  return showConfirmDialog({
    title: `UPDATE V${update.version} READY`,
    message: buildUpdatePromptMessage(update),
    confirmLabel: "INSTALL",
    cancelLabel: "LATER",
  });
}

async function installUpdate(update: Update): Promise<void> {
  const overlay = createUpdateProgressOverlay(update.version);
  let downloadedBytes = 0;
  let totalBytes: number | undefined;
  let relaunchRequested = false;

  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          totalBytes = event.data.contentLength;
          overlay.setStatus("Downloading signed update package...");
          overlay.setProgress(0, totalBytes);
          break;
        case "Progress":
          downloadedBytes += event.data.chunkLength;
          overlay.setProgress(downloadedBytes, totalBytes);
          break;
        case "Finished":
          overlay.setProgress(totalBytes ?? downloadedBytes, totalBytes);
          overlay.setStatus("Applying update package...");
          break;
      }
    }, {
      timeout: UPDATE_REQUEST_TIMEOUT_MS,
    });

    overlay.setStatus("Update installed. Relaunching Chaos Core...");
    relaunchRequested = true;
    await relaunch();
  } finally {
    if (!relaunchRequested) {
      overlay.close();
      await update.close().catch(() => {
        // Ignore cleanup failures after an install attempt.
      });
    }
  }
}

export async function initializeAppUpdater(): Promise<void> {
  if (updaterInitialized || !shouldCheckForUpdates()) {
    return;
  }

  updaterInitialized = true;
  markUpdateCheck();

  let update: Update | null = null;

  try {
    update = await check({
      timeout: UPDATE_REQUEST_TIMEOUT_MS,
    });

    if (!update) {
      return;
    }

    await waitForMainMenuScreen();

    const shouldInstall = await promptForUpdate(update);
    if (!shouldInstall) {
      await update.close().catch(() => {
        // Ignore cleanup failures when the player postpones the update.
      });
      return;
    }

    await installUpdate(update);
  } catch (error) {
    console.warn("[UPDATER] Failed to check for or install an update", error);

    if (update) {
      await update.close().catch(() => {
        // Ignore cleanup failures after a failed update flow.
      });
    }

    if (error instanceof Error && update) {
      await showAlertDialog({
        title: "UPDATE FAILED",
        message: "Chaos Core could not finish downloading or applying the update. The current build is still usable, and you can try again next launch.",
        variant: "danger",
      });
    }
  }
}
