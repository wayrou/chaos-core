// src/ui/screens/ScrollLinkBoot.ts
import { setMusicCue } from "../../core/audioSystem";
import { startTerminalTypingByIds } from "../components/terminalFeedback";

async function loadMainMenu(): Promise<void> {
  const { renderMainMenu } = await import("./MainMenuScreen");
  await renderMainMenu();
}

export function renderScrollLinkBoot() {
  setMusicCue("boot");
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  root.innerHTML = `
    <div class="scrolllink-boot">
      <div class="boot-inner boot-window">
        <div class="boot-header">
          <div class="boot-window-header">
            <span class="boot-window-title">S/COM_OS // SYSTEM_BOOT</span>
            
            <span class="boot-window-status">[INIT]</span>
          </div>
        </div>
        <div class="boot-body" id="bootBody">
          <div class="boot-logo">S/COM_OS</div>
          <div class="boot-subtitle">SOLARIS TERMINAL INTERFACE</div>
          <div class="boot-log" id="bootLog"></div>
          <div class="boot-progress">
            <div class="boot-progress-bar"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const progressBar = root.querySelector(
    ".boot-progress-bar"
  ) as HTMLDivElement | null;

  if (!progressBar) return;

  const logLines = [
    "[OK] Initializing bios...",
    "[OK] Mounting ARDCY-A01 core drive...",
    "[OK] Loading Chaos Core modules...",
    "[OK] Linking S/COM_OS nodes...",
    "[OK] Verifying rift containment seals...",
    "[OK] Preparing OPS profile: AERISS.QW",
    "[OK] Legacy handoff from Solaris (defunct) — \"Working for you.\"",
    "[OK] Handshake with MISTGUARD relay...",
    "[OK] All systems nominal.",
    ">> Launching MAIN MENU..."
  ];

  const total = logLines.length;
  startTerminalTypingByIds("bootBody", "bootLog", logLines, {
    showCursor: false,
    loop: false,
    baseCharDelayMs: 18,
    minCharDelayMs: 6,
    accelerationPerCharMs: 0.7,
    pauseAfterLineMs: 150,
    pauseAfterEmptyLineMs: 80,
    maxLines: total,
    lineClassName: "boot-line",
    promptClassName: "boot-prompt",
    textClassName: "boot-text",
    promptParser: (line) => {
      if (!line.startsWith("[OK]")) {
        return null;
      }
      return {
        prompt: "S/COM>",
        text: ` ${line}`,
      };
    },
    onLineCommitted: (index) => {
      const percent = ((index + 1) / total) * 100;
      progressBar.style.width = `${percent}%`;
    },
    onComplete: () => {
      window.setTimeout(() => {
        void loadMainMenu().catch((error) => {
          console.error("[BOOT] Failed to open main menu:", error);
          const bootRoot = document.getElementById("app");
          if (!bootRoot) {
            return;
          }
          const detail = error instanceof Error ? error.message : "Unknown startup failure";
          bootRoot.innerHTML = `
            <div class="scrolllink-boot">
              <div class="boot-inner boot-window">
                <div class="boot-header">
                  <div class="boot-window-header">
                    <span class="boot-window-title">S/COM_OS // BOOT RECOVERY</span>
                    <span class="boot-window-status">[HALT]</span>
                  </div>
                </div>
                <div class="boot-body" id="bootBody">
                  <div class="boot-logo">S/COM_OS</div>
                  <div class="boot-subtitle">MAIN MENU HANDOFF FAILED</div>
                  <div class="boot-log">
                    <div class="boot-line"><span class="boot-prompt">S/COM&gt;</span><span class="boot-text"> ${detail}</span></div>
                    <div class="boot-line"><span class="boot-prompt">S/COM&gt;</span><span class="boot-text"> Retry boot to continue.</span></div>
                  </div>
                  <div style="margin-top:18px;display:flex;justify-content:center;">
                    <button id="bootRetryBtn" class="splash-skip-btn" type="button">RETRY</button>
                  </div>
                </div>
              </div>
            </div>
          `;
          document.getElementById("bootRetryBtn")?.addEventListener("click", () => {
            renderScrollLinkBoot();
          });
        });
      }, 520);
    },
  });
}
