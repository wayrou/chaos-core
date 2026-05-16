const FPS_COUNTER_ID = "debugFpsCounter";
const FPS_SAMPLE_WINDOW_MS = 1000;
const FPS_UPDATE_INTERVAL_MS = 250;

let fpsCounterElement: HTMLElement | null = null;
let fpsAnimationFrameId: number | null = null;
let lastFrameAt = 0;
let lastUiUpdateAt = 0;
let frameSamples: Array<{ at: number; duration: number }> = [];

function ensureFpsCounterElement(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const existing = document.getElementById(FPS_COUNTER_ID) as HTMLElement | null;
  if (existing) {
    fpsCounterElement = existing;
    return existing;
  }

  if (!document.body) {
    return null;
  }

  const element = document.createElement("div");
  element.id = FPS_COUNTER_ID;
  element.className = "debug-fps-counter";
  element.setAttribute("aria-hidden", "true");
  element.textContent = "FPS --";
  document.body.appendChild(element);
  fpsCounterElement = element;
  return element;
}

function formatFpsValue(now: number): string {
  const recentSamples = frameSamples.filter((sample) => now - sample.at <= FPS_SAMPLE_WINDOW_MS);
  frameSamples = recentSamples;
  if (recentSamples.length <= 0) {
    return "FPS --";
  }

  const frameCount = recentSamples.length;
  const averageFrameMs = recentSamples.reduce((sum, sample) => sum + sample.duration, 0) / frameCount;
  const fps = averageFrameMs > 0 ? Math.round(1000 / averageFrameMs) : 0;
  return `FPS ${fps} • ${averageFrameMs.toFixed(1)} ms`;
}

function tickFpsCounter(now: number): void {
  const counter = ensureFpsCounterElement();
  if (!counter) {
    fpsAnimationFrameId = requestAnimationFrame(tickFpsCounter);
    return;
  }

  if (lastFrameAt > 0) {
    frameSamples.push({ at: now, duration: now - lastFrameAt });
  }
  lastFrameAt = now;

  if (now - lastUiUpdateAt >= FPS_UPDATE_INTERVAL_MS) {
    counter.textContent = formatFpsValue(now);
    lastUiUpdateAt = now;
  }

  fpsAnimationFrameId = requestAnimationFrame(tickFpsCounter);
}

export function initializeFpsCounter(): void {
  if (typeof window === "undefined") {
    return;
  }
  ensureFpsCounterElement();
  if (fpsAnimationFrameId !== null) {
    return;
  }

  lastFrameAt = 0;
  lastUiUpdateAt = 0;
  frameSamples = [];
  fpsAnimationFrameId = requestAnimationFrame(tickFpsCounter);
}
