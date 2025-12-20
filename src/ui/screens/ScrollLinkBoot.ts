// src/ui/screens/ScrollLinkBoot.ts
import { renderExpositionScreen } from "./ExpositionScreen";

export function renderScrollLinkBoot() {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  root.innerHTML = `
    <div class="scrolllink-boot">
      <div class="boot-inner">
        <div class="boot-header">
          <div class="boot-window-header">
            <span class="boot-window-title">SCROLLINK OS // SYSTEM_BOOT</span>
            <span class="boot-window-status">[INIT]</span>
          </div>
        </div>
        <div class="boot-body">
          <div class="boot-logo">SCROLLLINK OS</div>
          <div class="boot-subtitle">ARDCYTECH TERMINAL INTERFACE</div>
          <div class="boot-log"></div>
          <div class="boot-progress">
            <div class="boot-progress-bar"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const logEl = root.querySelector(".boot-log") as HTMLDivElement | null;
  const progressBar = root.querySelector(
    ".boot-progress-bar"
  ) as HTMLDivElement | null;

  if (!logEl || !progressBar) return;

  const logLines = [
    "[OK] Initializing bios...",
    "[OK] Mounting ARDCY-A01 core drive...",
    "[OK] Loading Chaos Core modules...",
    "[OK] Linking ScrollLink nodes...",
    "[OK] Verifying rift containment seals...",
    "[OK] Preparing OPS profile: AERISS.QW",
    "[OK] Legacy handoff from Solaris (defunct) — \"Working for you.\"",
    "[OK] Handshake with MISTGUARD relay...",
    "[OK] All systems nominal.",
    ">> Launching MAIN MENU..."
  ];

  let index = 0;
  const total = logLines.length;

  const interval = setInterval(() => {
    const line = logLines[index];
    const lineDiv = document.createElement("div");
    lineDiv.className = "boot-line";
    
    // Format as terminal line with prompt for [OK] lines
    if (line.startsWith("[OK]")) {
      const prompt = document.createElement("span");
      prompt.className = "boot-prompt";
      prompt.textContent = "SLK>";
      lineDiv.appendChild(prompt);
      
      const text = document.createElement("span");
      text.className = "boot-text";
      text.textContent = " " + line;
      lineDiv.appendChild(text);
    } else {
      const text = document.createElement("span");
      text.className = "boot-text boot-text--command";
      text.textContent = line;
      lineDiv.appendChild(text);
    }
    
    logEl.appendChild(lineDiv);
    logEl.scrollTop = logEl.scrollHeight;

    const percent = ((index + 1) / total) * 100;
    progressBar.style.width = `${percent}%`;

    index++;

    if (index >= total) {
      clearInterval(interval);
      setTimeout(() => {
        renderExpositionScreen();
      }, 700);
    }
  }, 400);
}
