// ============================================================================
// SPLASH SCREEN SEQUENCE
// Plays publisher and studio splash videos before S/COM_OS boot
// ============================================================================

import mpSplashVideo from "../../assets/MP_splash.mp4";
import ardyciaSplashVideo from "../../assets/Ardycia_Splash.mp4";
import { renderScrollLinkBoot } from "./ScrollLinkBoot";

type SplashClip = {
  id: string;
  fallbackMs: number;
} & (
  | {
      kind: "video";
      src: string;
    }
  | {
      kind: "epigraph";
      word: string;
      partOfSpeech: string;
      definition: string;
    }
);

const SPLASH_SEQUENCE: SplashClip[] = [
  { id: "mr-planet", kind: "video", src: mpSplashVideo, fallbackMs: 15000 },
  { id: "ardycia", kind: "video", src: ardyciaSplashVideo, fallbackMs: 15000 },
  {
    id: "sprawl-epigraph",
    kind: "epigraph",
    fallbackMs: 4200,
    word: "Sprawl",
    partOfSpeech: "(v.)",
    definition: "to spread or develop irregularly, without restraint",
  },
];

let activeSplashTimeout: number | null = null;
let splashInputCleanup: (() => void) | null = null;
let splashSequenceExiting = false;

function syncSplashAudioCue(): void {
  void import("../../core/audioSystem")
    .then(({ setMusicCue }) => {
      setMusicCue("splash");
    })
    .catch((error) => {
      console.warn("[SPLASH] Failed to set splash music cue:", error);
    });
}

function clearSplashControllerContext(): void {
  void import("../../core/controllerSupport")
    .then(({ clearControllerContext }) => {
      clearControllerContext();
    })
    .catch((error) => {
      console.warn("[SPLASH] Failed to clear controller context:", error);
    });
}

function transitionToScrollLinkBoot(): void {
  if (splashSequenceExiting) {
    return;
  }

  splashSequenceExiting = true;
  clearSplashTimeout();
  clearSplashInputHandlers();
  renderScrollLinkBoot();
}

function clearSplashTimeout(): void {
  if (activeSplashTimeout !== null) {
    window.clearTimeout(activeSplashTimeout);
    activeSplashTimeout = null;
  }
}

function clearSplashInputHandlers(): void {
  if (splashInputCleanup) {
    splashInputCleanup();
    splashInputCleanup = null;
  }
}

function isGamepadButtonPressed(button: GamepadButton | undefined): boolean {
  if (!button) {
    return false;
  }
  return Boolean(button.pressed || button.value >= 0.35);
}

function completeSplashSequence(): void {
  transitionToScrollLinkBoot();
}

function attachSplashSkipInputs(skipSequence: () => void): void {
  clearSplashInputHandlers();

  const splashScreen = document.querySelector<HTMLElement>(".splash-screen");
  if (!splashScreen) {
    return;
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (!splashScreen.contains(event.target as Node)) {
      return;
    }
    skipSequence();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    event.preventDefault();
    skipSequence();
  };

  let gamepadFrameId: number | null = null;
  let previousButtonStates: boolean[][] = [];
  let hasPrimedGamepads = false;

  const pollGamepadButtons = () => {
    const gamepads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    const nextButtonStates: boolean[][] = [];
    let shouldSkip = false;

    for (let padIndex = 0; padIndex < gamepads.length; padIndex++) {
      const gamepad = gamepads[padIndex];
      const buttons = gamepad?.buttons ?? [];
      const nextStates = buttons.map((button) => isGamepadButtonPressed(button));
      const prevStates = previousButtonStates[padIndex] ?? [];

      if (hasPrimedGamepads && nextStates.some((pressed, buttonIndex) => pressed && !prevStates[buttonIndex])) {
        shouldSkip = true;
      }

      nextButtonStates[padIndex] = nextStates;
    }

    previousButtonStates = nextButtonStates;
    hasPrimedGamepads = true;

    if (shouldSkip) {
      skipSequence();
      return;
    }

    gamepadFrameId = window.requestAnimationFrame(pollGamepadButtons);
  };

  splashScreen.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("keydown", handleKeyDown, true);
  gamepadFrameId = window.requestAnimationFrame(pollGamepadButtons);

  splashInputCleanup = () => {
    splashScreen.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("keydown", handleKeyDown, true);
    if (gamepadFrameId !== null) {
      window.cancelAnimationFrame(gamepadFrameId);
      gamepadFrameId = null;
    }
    previousButtonStates = [];
    hasPrimedGamepads = false;
  };
}

function renderSplashClip(index: number): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }
  document.body.setAttribute("data-screen", "splash");
  clearSplashControllerContext();

  const clip = SPLASH_SEQUENCE[index];
  if (!clip) {
    transitionToScrollLinkBoot();
    return;
  }

  root.innerHTML = clip.kind === "video"
    ? `
      <div class="splash-screen splash-screen--video" data-splash-sequence="${clip.id}">
        <video
          class="splash-video"
          id="splashVideo"
          autoplay
          muted
          playsinline
          preload="auto"
        >
          <source src="${clip.src}" type="video/mp4" />
        </video>
        <button class="splash-skip-btn" id="splashSkipBtn" type="button">SKIP</button>
      </div>
    `
    : `
      <div class="splash-screen splash-screen--epigraph" data-splash-sequence="${clip.id}">
        <div class="splash-epigraph">
          <div class="splash-epigraph__word">${clip.word}</div>
          <div class="splash-epigraph__part">${clip.partOfSpeech}</div>
          <div class="splash-epigraph__definition">${clip.definition}</div>
        </div>
        <button class="splash-skip-btn" id="splashSkipBtn" type="button">SKIP</button>
      </div>
    `;

  const advance = () => {
    if (splashSequenceExiting) {
      return;
    }
    clearSplashTimeout();
    clearSplashInputHandlers();
    renderSplashClip(index + 1);
  };

  const video = root.querySelector<HTMLVideoElement>("#splashVideo");
  const skipBtn = root.querySelector<HTMLButtonElement>("#splashSkipBtn");

  skipBtn?.addEventListener("click", completeSplashSequence, { once: true });
  attachSplashSkipInputs(completeSplashSequence);

  if (video) {
    const safeAdvance = () => {
      if (!document.querySelector(`[data-splash-sequence="${clip.id}"]`)) return;
      advance();
    };

    video.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        clearSplashTimeout();
        activeSplashTimeout = window.setTimeout(() => {
          safeAdvance();
        }, Math.ceil(video.duration * 1000) + 250);
      }
    }, { once: true });
    video.addEventListener("ended", safeAdvance, { once: true });
    video.addEventListener("error", safeAdvance, { once: true });
    void video.play().catch(() => {
      // Autoplay can occasionally be blocked despite muted playback.
    });
  }

  activeSplashTimeout = window.setTimeout(() => {
    advance();
  }, clip.fallbackMs);
}

export function renderSplashScreen(): void {
  splashSequenceExiting = false;
  syncSplashAudioCue();
  clearSplashTimeout();
  clearSplashInputHandlers();
  renderSplashClip(0);
}
