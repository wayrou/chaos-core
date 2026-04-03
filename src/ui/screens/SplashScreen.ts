// ============================================================================
// SPLASH SCREEN SEQUENCE
// Plays publisher and studio splash videos before S/COM_OS boot
// ============================================================================

import mpSplashVideo from "../../assets/MP_splash.mp4";
import ardyciaSplashVideo from "../../assets/Ardycia_Splash.mp4";
import { renderScrollLinkBoot } from "./ScrollLinkBoot";

type SplashClip = {
  id: string;
  src: string;
  fallbackMs: number;
};

const SPLASH_SEQUENCE: SplashClip[] = [
  { id: "mr-planet", src: mpSplashVideo, fallbackMs: 15000 },
  { id: "ardycia", src: ardyciaSplashVideo, fallbackMs: 15000 },
];

let activeSplashTimeout: number | null = null;

function clearSplashTimeout(): void {
  if (activeSplashTimeout !== null) {
    window.clearTimeout(activeSplashTimeout);
    activeSplashTimeout = null;
  }
}

function renderSplashClip(index: number): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  const clip = SPLASH_SEQUENCE[index];
  if (!clip) {
    renderScrollLinkBoot();
    return;
  }

  root.innerHTML = `
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
  `;

  const advance = () => {
    clearSplashTimeout();
    renderSplashClip(index + 1);
  };

  const video = root.querySelector<HTMLVideoElement>("#splashVideo");
  const skipBtn = root.querySelector<HTMLButtonElement>("#splashSkipBtn");

  skipBtn?.addEventListener("click", advance, { once: true });

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
  clearSplashTimeout();
  renderSplashClip(0);
}
