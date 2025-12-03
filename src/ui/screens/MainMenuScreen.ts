// src/ui/screens/MainMenuScreen.ts
import { resetToNewGame } from "../../state/gameStore";
import { renderScrollLinkShell } from "./ScrollLinkShell";
import { renderBaseCampScreen } from "./BaseCampScreen";


renderBaseCampScreen();


export function renderMainMenu() {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  root.innerHTML = `
    <div class="mainmenu-root">
      <div class="mainmenu-card">
        <div class="mainmenu-logo">CHAOS CORE</div>
        <div class="mainmenu-subtitle">COMPANY OF QUILLS TACTICAL INTERFACE</div>

        <div class="mainmenu-divider"></div>

        <button class="mainmenu-btn" data-action="new-op">
          NEW OPERATION
        </button>

        <button class="mainmenu-btn mainmenu-btn-secondary" data-action="continue-op" disabled>
          CONTINUE (COMING SOON)
        </button>

        <button class="mainmenu-btn mainmenu-btn-secondary" data-action="exit">
          EXIT
        </button>

        <div class="mainmenu-footer">
          <span>SCROLLLINK OS BUILD 0.0.1</span>
          <span>ARDCYTECH PROTOTYPE</span>
        </div>
      </div>
    </div>
  `;

  const newOpBtn = root.querySelector<HTMLButtonElement>(
    'button[data-action="new-op"]'
  );
  const exitBtn = root.querySelector<HTMLButtonElement>(
    'button[data-action="exit"]'
  );

  if (newOpBtn) {
    newOpBtn.addEventListener("click", () => {
      // Start a fresh run and go to the shell
      resetToNewGame();
		renderBaseCampScreen();

    });
  }

  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      // For now, just close the window via Tauri
      // (it’s okay if this no-ops on web preview builds)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyWindow: any = window;
      if (anyWindow.__TAURI__) {
        anyWindow.__TAURI__.window.getCurrent().close();
      } else {
        // fallback in dev
        console.log("Exit requested (no Tauri window context in this environment).");
      }
    });
  }
}
