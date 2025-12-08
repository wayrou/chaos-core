// ============================================================================
// SPLASH SCREEN - Mr. Planet Software Planning
// Appears before ScrollLink boot screen
// ============================================================================

import { renderScrollLinkBoot } from "./ScrollLinkBoot";

export function renderSplashScreen(): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  root.innerHTML = `
    <div class="splash-screen">
      <div class="splash-content">
        <div class="splash-logo">MR. PLANET</div>
        <div class="splash-subtitle">SOFTWARE PLANNING</div>
        <div class="splash-tagline">Game Development Studio</div>
      </div>
    </div>
  `;

  // Auto-advance to ScrollLink boot after 2 seconds
  setTimeout(() => {
    renderScrollLinkBoot();
  }, 2000);
}

