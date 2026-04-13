import {
  clearControllerContext,
  registerControllerContext,
  updateFocusableElements,
} from "../../core/controllerSupport";

export type StoryPlaceholderKind = "opening" | "ending";

type StoryPlaceholderConfig = {
  kind: StoryPlaceholderKind;
  onContinue: () => void;
};

type StoryPlaceholderCopy = {
  kicker: string;
  title: string;
  subtitle: string;
  body: string[];
  primaryLabel: string;
  secondaryLabel: string;
  footer: string;
};

const STORY_PLACEHOLDER_COPY: Record<StoryPlaceholderKind, StoryPlaceholderCopy> = {
  opening: {
    kicker: "S/COM_OS // STORY PLACEHOLDER",
    title: "OPENING CUTSCENE",
    subtitle: "This is where the campaign intro will play after the player starts a new operation.",
    body: [
      "Placeholder flow active. Replace this screen with the opening cinematic, dialogue, or animated briefing when story content is ready.",
      "For now, the player can continue into Base Camp immediately or skip past this placeholder at any time.",
    ],
    primaryLabel: "CONTINUE",
    secondaryLabel: "SKIP TO BASE CAMP",
    footer: "Temporary story waypoint. No gameplay state is blocked behind this placeholder.",
  },
  ending: {
    kicker: "S/COM_OS // STORY PLACEHOLDER",
    title: "FINAL CUTSCENE",
    subtitle: "This is where the ending sequence will play after the player clears the final floor.",
    body: [
      "Placeholder flow active. Replace this screen with the final cinematic, outro dialogue, credits lead-in, or any other campaign ending sequence.",
      "Continuing from here sends the player back into postgame, where they can keep redeploying and regenerate cleared floors from A.T.L.A.S.",
    ],
    primaryLabel: "CONTINUE TO POSTGAME",
    secondaryLabel: "SKIP TO POSTGAME",
    footer: "Campaign completion is already preserved. Skipping this placeholder does not skip the postgame unlock.",
  },
};

let cleanupStoryPlaceholderScreen: (() => void) | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderStoryPlaceholderScreen(config: StoryPlaceholderConfig): void {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  cleanupStoryPlaceholderScreen?.();
  cleanupStoryPlaceholderScreen = null;
  clearControllerContext();

  const copy = STORY_PLACEHOLDER_COPY[config.kind];
  root.innerHTML = `
    <style>
      .story-placeholder-root {
        min-height: 100vh;
        padding: 2.5rem;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 18% 18%, rgba(255, 204, 110, 0.14), transparent 0 22%),
          radial-gradient(circle at 82% 28%, rgba(115, 181, 191, 0.14), transparent 0 24%),
          linear-gradient(180deg, #0d1014 0%, #131820 48%, #090b0f 100%);
        color: #edf1f3;
      }

      .story-placeholder-panel {
        width: min(920px, 100%);
        border: 1px solid rgba(255, 204, 110, 0.34);
        border-radius: 20px;
        background:
          linear-gradient(180deg, rgba(27, 33, 42, 0.96) 0%, rgba(13, 17, 23, 0.97) 100%);
        box-shadow:
          0 22px 90px rgba(0, 0, 0, 0.42),
          inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        overflow: hidden;
      }

      .story-placeholder-header {
        padding: 1.1rem 1.3rem 1rem;
        border-bottom: 1px solid rgba(255, 204, 110, 0.18);
        background: linear-gradient(90deg, rgba(255, 204, 110, 0.08), rgba(115, 181, 191, 0.06));
      }

      .story-placeholder-kicker {
        margin: 0 0 0.6rem;
        font-size: 0.76rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #ffcc6e;
      }

      .story-placeholder-title {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.5rem);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .story-placeholder-subtitle {
        margin: 0.7rem 0 0;
        max-width: 46rem;
        color: rgba(237, 241, 243, 0.72);
        line-height: 1.6;
      }

      .story-placeholder-body {
        padding: 1.6rem 1.3rem 1.25rem;
        display: grid;
        gap: 1rem;
      }

      .story-placeholder-block {
        padding: 1rem 1.05rem;
        border: 1px solid rgba(115, 181, 191, 0.18);
        border-radius: 14px;
        background: rgba(16, 22, 29, 0.82);
        color: rgba(237, 241, 243, 0.86);
        line-height: 1.7;
      }

      .story-placeholder-note {
        padding: 0.9rem 1.05rem 1.15rem;
        color: rgba(237, 241, 243, 0.62);
        font-size: 0.92rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }

      .story-placeholder-actions {
        padding: 0 1.3rem 1.35rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
      }

      .story-placeholder-btn {
        min-width: 220px;
        padding: 0.95rem 1.15rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 204, 110, 0.25);
        background: rgba(255, 255, 255, 0.03);
        color: #edf1f3;
        font: inherit;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
      }

      .story-placeholder-btn:hover,
      .story-placeholder-btn:focus-visible {
        transform: translateY(-1px);
        border-color: rgba(255, 204, 110, 0.7);
        background: rgba(255, 204, 110, 0.08);
        box-shadow: 0 0 0 2px rgba(255, 204, 110, 0.12);
        outline: none;
      }

      .story-placeholder-btn--primary {
        background: linear-gradient(135deg, rgba(255, 204, 110, 0.22), rgba(115, 181, 191, 0.18));
        border-color: rgba(255, 204, 110, 0.42);
      }

      @media (max-width: 720px) {
        .story-placeholder-root {
          padding: 1rem;
        }

        .story-placeholder-actions {
          flex-direction: column;
        }

        .story-placeholder-btn {
          width: 100%;
          min-width: 0;
        }
      }
    </style>
    <div class="story-placeholder-root">
      <section class="story-placeholder-panel" aria-label="${escapeHtml(copy.title)} placeholder">
        <header class="story-placeholder-header">
          <div class="story-placeholder-kicker">${escapeHtml(copy.kicker)}</div>
          <h1 class="story-placeholder-title">${escapeHtml(copy.title)}</h1>
          <p class="story-placeholder-subtitle">${escapeHtml(copy.subtitle)}</p>
        </header>
        <div class="story-placeholder-body">
          ${copy.body.map((paragraph) => `
            <div class="story-placeholder-block">${escapeHtml(paragraph)}</div>
          `).join("")}
        </div>
        <div class="story-placeholder-actions">
          <button
            class="story-placeholder-btn story-placeholder-btn--primary"
            type="button"
            id="storyPlaceholderContinueBtn"
            data-controller-default-focus="true"
          >
            ${escapeHtml(copy.primaryLabel)}
          </button>
          <button
            class="story-placeholder-btn"
            type="button"
            id="storyPlaceholderSkipBtn"
          >
            ${escapeHtml(copy.secondaryLabel)}
          </button>
        </div>
        <div class="story-placeholder-note">${escapeHtml(copy.footer)}</div>
      </section>
    </div>
  `;
  document.body.setAttribute("data-screen", "story-placeholder");

  const finish = () => {
    cleanupStoryPlaceholderScreen?.();
    cleanupStoryPlaceholderScreen = null;
    config.onContinue();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      finish();
    }
  };

  const continueButton = document.getElementById("storyPlaceholderContinueBtn");
  const skipButton = document.getElementById("storyPlaceholderSkipBtn");
  continueButton?.addEventListener("click", finish);
  skipButton?.addEventListener("click", finish);
  window.addEventListener("keydown", handleKeyDown);

  const cleanupControllerContext = registerControllerContext({
    id: "story-placeholder",
    defaultMode: "focus",
    focusRoot: () => document.querySelector<HTMLElement>(".story-placeholder-root"),
    defaultFocusSelector: "#storyPlaceholderContinueBtn",
    suppressGameplayInput: true,
  });
  updateFocusableElements();
  (continueButton as HTMLButtonElement | null)?.focus();

  cleanupStoryPlaceholderScreen = () => {
    continueButton?.removeEventListener("click", finish);
    skipButton?.removeEventListener("click", finish);
    window.removeEventListener("keydown", handleKeyDown);
    cleanupControllerContext();
  };
}
