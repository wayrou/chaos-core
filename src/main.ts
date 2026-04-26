import { initializeFpsCounter } from "./ui/fpsCounter";

const STARTUP_TIMEOUT_MS = 2500;
let startupBootRendered = false;

type BootMonitorState = {
  progress?: string;
  startedAt?: number;
  error?: unknown;
  renderFallback?: (detail: unknown) => void;
};

type BootMonitorWindow = Window & {
  __CHAOS_CORE_BOOT__?: BootMonitorState;
};

function getBootMonitor(): BootMonitorState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const bootWindow = window as BootMonitorWindow;
  bootWindow.__CHAOS_CORE_BOOT__ ??= {
    progress: "module-loaded",
    startedAt: Date.now(),
  };
  return bootWindow.__CHAOS_CORE_BOOT__ ?? null;
}

function markBootProgress(progress: string): void {
  const bootMonitor = getBootMonitor();
  if (bootMonitor) {
    bootMonitor.progress = progress;
  }
}

function renderStartupRecovery(error: unknown): void {
  const bootMonitor = getBootMonitor();
  if (bootMonitor?.renderFallback) {
    bootMonitor.error = error;
    bootMonitor.renderFallback(error instanceof Error ? error.message : String(error ?? "Unknown startup failure"));
    return;
  }
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  const detail = error instanceof Error ? error.message : String(error ?? "Unknown startup failure");
  root.innerHTML = `
    <div class="scrolllink-boot">
      <div class="boot-inner boot-window">
        <div class="boot-header">
          <div class="boot-window-header">
            <span class="boot-window-title">S/COM_OS // STARTUP RECOVERY</span>
            <span class="boot-window-status">[HALT]</span>
          </div>
        </div>
        <div class="boot-body">
          <div class="boot-logo">S/COM_OS</div>
          <div class="boot-subtitle">FRONTEND STARTUP FAILED</div>
          <div class="boot-log">
            <div class="boot-line"><span class="boot-prompt">S/COM&gt;</span><span class="boot-text"> ${detail}</span></div>
            <div class="boot-line"><span class="boot-prompt">S/COM&gt;</span><span class="boot-text"> Reload the startup pipeline to continue.</span></div>
          </div>
          <div style="margin-top:18px;display:flex;justify-content:center;">
            <button id="startupRecoveryRetryBtn" class="splash-skip-btn" type="button">RETRY</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("startupRecoveryRetryBtn")?.addEventListener("click", () => {
    window.location.reload();
  });
}

async function withStartupTimeout<T>(label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  let timeoutId: number | null = null;
  try {
    return await Promise.race([
      task(),
      new Promise<T>((resolve) => {
        timeoutId = window.setTimeout(() => {
          console.warn(`[STARTUP] ${label} timed out after ${STARTUP_TIMEOUT_MS}ms. Using fallback.`);
          resolve(fallback);
        }, STARTUP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function warmStartupServices(): Promise<void> {
  markBootProgress("startup-warmup");
  const [
    technicaModule,
    technicaLibraryModule,
    audioSystemModule,
    controllerSupportModule,
    settingsModule,
    notifierModule,
    ezDragModule,
    confirmDialogModule,
  ] = await Promise.all([
    import("./content/technica"),
    import("./content/technica/library"),
    import("./core/audioSystem"),
    import("./core/controllerSupport"),
    import("./core/settings"),
    import("./content/technica/notifier"),
    import("./ui/ezDrag"),
    import("./ui/components/confirmDialog"),
  ]);

  technicaLibraryModule.initializeTechnicaContentLibrary();
  notifierModule.watchForGeneratedTechnicaContentChanges();
  audioSystemModule.initializeAudioSystem();
  await settingsModule.initializeSettings();
  controllerSupportModule.initControllerSupport();
  confirmDialogModule.installNativeDialogOverrides();
  ezDragModule.initEZDrag();
  await withStartupTimeout("Technica registry hydration", async () => {
    await technicaModule.hydrateGeneratedTechnicaRegistry();
    return true;
  }, true);
  notifierModule.notifyIfNewTechnicaContentLoaded();
  await notifierModule.notifyIfTechnicaPublishVersionAdvanced();
}

async function renderInitialSplash(): Promise<void> {
  const { renderSplashScreen } = await import("./ui/screens/SplashScreen");
  renderSplashScreen();
}

async function initializeUpdaterServices(): Promise<void> {
  const { initializeAppUpdater } = await import("./ui/appUpdater");
  await initializeAppUpdater();
}

markBootProgress("module-loaded");

async function startApplication(): Promise<void> {
  markBootProgress("dom-ready");
  initializeFpsCounter();
  try {
    await renderInitialSplash();
    startupBootRendered = true;
    markBootProgress("splash-rendered");
  } catch (error) {
    console.error("[STARTUP] Failed to render splash screen:", error);
    renderStartupRecovery(error);
    return;
  }

  void warmStartupServices().catch((error) => {
    console.error("[STARTUP] Background startup warmup failed:", error);
    if (!startupBootRendered) {
      renderStartupRecovery(error);
    }
  });

  void initializeUpdaterServices().catch((error) => {
    console.warn("[STARTUP] App updater initialization failed:", error);
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    void startApplication();
  }, { once: true });
} else {
  void startApplication();
}
