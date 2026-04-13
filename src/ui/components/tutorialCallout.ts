import { getSettings, updateSettings } from "../../core/settings";

export interface TutorialCalloutOptions {
  id: string;
  title: string;
  message: string;
  detail?: string;
  durationMs?: number;
  channel?: string;
}

const TUTORIAL_CALLOUT_STACK_ID = "tutorialCalloutStack";

function ensureTutorialCalloutStack(): HTMLElement {
  let stack = document.getElementById(TUTORIAL_CALLOUT_STACK_ID);
  if (stack) {
    return stack;
  }

  stack = document.createElement("div");
  stack.id = TUTORIAL_CALLOUT_STACK_ID;
  stack.className = "tutorial-callout-stack";
  document.body.appendChild(stack);
  return stack;
}

function hasDismissedTutorial(id: string): boolean {
  const settings = getSettings();
  return !settings.showTutorialHints || settings.dismissedTutorialHintIds.includes(id);
}

function rememberDismissedTutorial(id: string): void {
  const settings = getSettings();
  if (settings.dismissedTutorialHintIds.includes(id)) {
    return;
  }

  void updateSettings({
    dismissedTutorialHintIds: [...settings.dismissedTutorialHintIds, id],
  });
}

function removeTutorialCallout(callout: HTMLElement): void {
  callout.classList.remove("tutorial-callout--visible");
  window.setTimeout(() => {
    callout.remove();
  }, 220);
}

export function showTutorialCallout(options: TutorialCalloutOptions): boolean {
  if (hasDismissedTutorial(options.id)) {
    return false;
  }

  rememberDismissedTutorial(options.id);
  const stack = ensureTutorialCalloutStack();

  if (options.channel) {
    stack.querySelectorAll<HTMLElement>(`.tutorial-callout[data-channel="${options.channel}"]`).forEach((existing) => {
      existing.remove();
    });
  }

  const callout = document.createElement("aside");
  callout.className = "tutorial-callout";
  if (options.channel) {
    callout.dataset.channel = options.channel;
  }

  callout.innerHTML = `
    <div class="tutorial-callout__eyebrow">FIELD GUIDE</div>
    <button class="tutorial-callout__close" type="button" aria-label="Dismiss tutorial hint">x</button>
    <div class="tutorial-callout__title">${options.title}</div>
    <div class="tutorial-callout__message">${options.message}</div>
    ${options.detail ? `<div class="tutorial-callout__detail">${options.detail}</div>` : ""}
  `;

  callout.querySelector<HTMLButtonElement>(".tutorial-callout__close")?.addEventListener("click", () => {
    removeTutorialCallout(callout);
  });

  stack.appendChild(callout);
  requestAnimationFrame(() => {
    callout.classList.add("tutorial-callout--visible");
  });

  const durationMs = Math.max(3200, options.durationMs ?? 8200);
  window.setTimeout(() => {
    if (callout.isConnected) {
      removeTutorialCallout(callout);
    }
  }, durationMs);

  return true;
}

export function showTutorialCalloutSequence(
  items: TutorialCalloutOptions[],
  delayStepMs = 520,
): void {
  items.forEach((item, index) => {
    if (hasDismissedTutorial(item.id)) {
      return;
    }

    rememberDismissedTutorial(item.id);
    window.setTimeout(() => {
      const settings = getSettings();
      if (!settings.showTutorialHints) {
        return;
      }

      const stack = ensureTutorialCalloutStack();
      if (item.channel) {
        stack.querySelectorAll<HTMLElement>(`.tutorial-callout[data-channel="${item.channel}"]`).forEach((existing) => {
          existing.remove();
        });
      }

      const callout = document.createElement("aside");
      callout.className = "tutorial-callout";
      if (item.channel) {
        callout.dataset.channel = item.channel;
      }

      callout.innerHTML = `
        <div class="tutorial-callout__eyebrow">FIELD GUIDE</div>
        <button class="tutorial-callout__close" type="button" aria-label="Dismiss tutorial hint">x</button>
        <div class="tutorial-callout__title">${item.title}</div>
        <div class="tutorial-callout__message">${item.message}</div>
        ${item.detail ? `<div class="tutorial-callout__detail">${item.detail}</div>` : ""}
      `;

      callout.querySelector<HTMLButtonElement>(".tutorial-callout__close")?.addEventListener("click", () => {
        removeTutorialCallout(callout);
      });

      stack.appendChild(callout);
      requestAnimationFrame(() => {
        callout.classList.add("tutorial-callout--visible");
      });

      const durationMs = Math.max(3200, item.durationMs ?? 8200);
      window.setTimeout(() => {
        if (callout.isConnected) {
          removeTutorialCallout(callout);
        }
      }, durationMs);
    }, delayStepMs * index);
  });
}
