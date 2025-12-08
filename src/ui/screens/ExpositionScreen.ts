// ============================================================================
// EXPOSITION SCREEN - Story introduction
// Appears after ScrollLink boot, before main menu
// Terminal/ScrollLink aesthetic window with exposition text
// ============================================================================

import { renderMainMenu } from "./MainMenuScreen";

export function renderExpositionScreen(): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  const expositionText = `In ARDYCIA- bandits, knights, wizards and gunslingers fight for control over cold and rocky terrain. As reports of a dark, growing chasm of evil magic in the north threaten the stability of the Fairhaven empire, a company of soldiers are sent on a secret mission to find the CHAOS CORE and close the rift. Leading the mission is evergreen knight AERISS THORNE- the only soul naive enough to do it...`;

  root.innerHTML = `
    <div class="exposition-screen">
      <div class="exposition-window">
        <div class="exposition-window-header">
          <span class="window-title">SCROLLINK OS // CLASSIFIED_BRIEFING</span>
          <span class="window-status">[SECURE]</span>
        </div>
        <div class="exposition-window-body">
          <div class="exposition-terminal">
            <div class="terminal-line">
              <span class="terminal-prompt">SLK&gt;</span>
              <span class="terminal-text">ACCESSING CLASSIFIED OPERATION BRIEFING...</span>
            </div>
            <div class="terminal-line">
              <span class="terminal-prompt">SLK&gt;</span>
              <span class="terminal-text">DECRYPTING MISSION PARAMETERS...</span>
            </div>
            <div class="terminal-line terminal-line--divider">────────────────────────────────────────────</div>
            <div class="terminal-line terminal-line--exposition">
              <span class="terminal-text">${expositionText}</span>
            </div>
            <div class="terminal-line terminal-line--divider">────────────────────────────────────────────</div>
            <div class="terminal-line terminal-line--continue">
              <span class="terminal-prompt">SLK&gt;</span>
              <span class="terminal-text">PRESS ANY KEY TO CONTINUE<span class="terminal-cursor">_</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Handle keyboard input to advance
  const handleKeyPress = (e: KeyboardEvent) => {
    e.preventDefault();
    window.removeEventListener("keydown", handleKeyPress);
    window.removeEventListener("click", handleClick);
    renderMainMenu();
  };

  // Handle click to advance
  const handleClick = () => {
    window.removeEventListener("keydown", handleKeyPress);
    window.removeEventListener("click", handleClick);
    renderMainMenu();
  };

  // Add listeners
  window.addEventListener("keydown", handleKeyPress);
  window.addEventListener("click", handleClick);
}

