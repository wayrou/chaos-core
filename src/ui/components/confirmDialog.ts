import { getControllerMode, setControllerMode, updateFocusableElements } from "../../core/controllerSupport";

type DialogMountTarget = HTMLElement | null | (() => HTMLElement | null);

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  mount?: DialogMountTarget;
  restoreFocusSelector?: string;
  variant?: "default" | "danger";
};

type AlertDialogOptions = {
  title?: string;
  message: string;
  acknowledgeLabel?: string;
  mount?: DialogMountTarget;
  restoreFocusSelector?: string;
  variant?: "default" | "danger";
};

const DIALOG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[data-controller-focusable='true']",
].join(", ");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveMountTarget(explicitTarget?: DialogMountTarget): HTMLElement | null {
  if (typeof explicitTarget === "function") {
    return resolveMountTarget(explicitTarget());
  }

  if (explicitTarget) {
    return explicitTarget;
  }

  const app = document.getElementById("app");
  const screenRoot = app?.firstElementChild;
  return (screenRoot as HTMLElement | null) ?? app ?? document.body ?? document.documentElement;
}

export function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const mountTarget = resolveMountTarget(options.mount);
  if (!mountTarget) {
    return Promise.resolve(false);
  }

  const previousMode = getControllerMode();
  const previousActiveElement = document.activeElement as HTMLElement | null;
  const overlay = document.createElement("div");
  overlay.className = "game-confirm-modal-backdrop";
  overlay.innerHTML = `
    <div class="game-confirm-modal game-confirm-modal--${escapeHtml(options.variant ?? "default")}" role="dialog" aria-modal="true" aria-labelledby="gameConfirmDialogTitle">
      <div class="game-confirm-modal__header">
        <div class="game-confirm-modal__kicker">CONFIRM ACTION</div>
        <h2 class="game-confirm-modal__title" id="gameConfirmDialogTitle">${escapeHtml(options.title)}</h2>
      </div>
      <div class="game-confirm-modal__copy">${escapeHtml(options.message)}</div>
      <div class="game-confirm-modal__actions">
        <button class="game-confirm-modal__btn game-confirm-modal__btn--primary" type="button" data-confirm-dialog-action="confirm" data-controller-default-focus="true">
          ${escapeHtml(options.confirmLabel ?? "CONFIRM")}
        </button>
        <button class="game-confirm-modal__btn" type="button" data-confirm-dialog-action="cancel">
          ${escapeHtml(options.cancelLabel ?? "CANCEL")}
        </button>
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

  const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-confirm-dialog-action="confirm"]');
  const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-confirm-dialog-action="cancel"]');

  requestAnimationFrame(() => {
    confirmBtn?.focus();
    updateFocusableElements();
  });

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.removeEventListener("click", handleOverlayClick);
      window.removeEventListener("keydown", handleKeyDown, true);
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
        const restoreTarget = options.restoreFocusSelector
          ? document.querySelector<HTMLElement>(options.restoreFocusSelector)
          : previousActiveElement;
        restoreTarget?.focus();
      });
    };

    const finish = (accepted: boolean) => {
      cleanup();
      resolve(accepted);
    };

    const handleOverlayClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.target === overlay) {
        finish(false);
        return;
      }

      const action = target?.closest<HTMLElement>("[data-confirm-dialog-action]")?.getAttribute("data-confirm-dialog-action");
      if (action === "confirm") {
        finish(true);
      } else if (action === "cancel") {
        finish(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      } else if (event.key === "Enter") {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement?.closest("[data-confirm-dialog-action='cancel']")) {
          event.preventDefault();
          finish(false);
        } else if (activeElement?.closest("[data-confirm-dialog-action='confirm']")) {
          event.preventDefault();
          finish(true);
        }
      }
    };

    overlay.addEventListener("click", handleOverlayClick);
    window.addEventListener("keydown", handleKeyDown, true);
  });
}

export function showAlertDialog(options: AlertDialogOptions): Promise<void> {
  const mountTarget = resolveMountTarget(options.mount);
  if (!mountTarget) {
    return Promise.resolve();
  }

  const previousMode = getControllerMode();
  const previousActiveElement = document.activeElement as HTMLElement | null;
  const overlay = document.createElement("div");
  overlay.className = "game-confirm-modal-backdrop";
  overlay.innerHTML = `
    <div class="game-confirm-modal game-confirm-modal--${escapeHtml(options.variant ?? "default")}" role="dialog" aria-modal="true" aria-labelledby="gameAlertDialogTitle">
      <div class="game-confirm-modal__header">
        <div class="game-confirm-modal__kicker">SYSTEM NOTICE</div>
        <h2 class="game-confirm-modal__title" id="gameAlertDialogTitle">${escapeHtml(options.title ?? "NOTICE")}</h2>
      </div>
      <div class="game-confirm-modal__copy">${escapeHtml(options.message)}</div>
      <div class="game-confirm-modal__actions">
        <button class="game-confirm-modal__btn game-confirm-modal__btn--primary" type="button" data-alert-dialog-action="dismiss" data-controller-default-focus="true">
          ${escapeHtml(options.acknowledgeLabel ?? "OK")}
        </button>
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

  const dismissBtn = overlay.querySelector<HTMLButtonElement>('[data-alert-dialog-action="dismiss"]');
  requestAnimationFrame(() => {
    dismissBtn?.focus();
    updateFocusableElements();
  });

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.removeEventListener("click", handleOverlayClick);
      window.removeEventListener("keydown", handleKeyDown, true);
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
        const restoreTarget = options.restoreFocusSelector
          ? document.querySelector<HTMLElement>(options.restoreFocusSelector)
          : previousActiveElement;
        restoreTarget?.focus();
      });
    };

    const finish = () => {
      cleanup();
      resolve();
    };

    const handleOverlayClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.target === overlay) {
        finish();
        return;
      }
      const action = target?.closest<HTMLElement>("[data-alert-dialog-action]")?.getAttribute("data-alert-dialog-action");
      if (action === "dismiss") {
        finish();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        finish();
      }
    };

    overlay.addEventListener("click", handleOverlayClick);
    window.addEventListener("keydown", handleKeyDown, true);
  });
}

let nativeAlertOverrideInstalled = false;

export function installNativeDialogOverrides(): void {
  if (nativeAlertOverrideInstalled) {
    return;
  }

  window.alert = (message?: unknown) => {
    void showAlertDialog({
      title: "NOTICE",
      message: typeof message === "string" ? message : String(message ?? ""),
    });
  };

  nativeAlertOverrideInstalled = true;
}
