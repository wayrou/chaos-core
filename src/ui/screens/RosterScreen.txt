// src/ui/screens/RosterScreen.ts

import { renderBaseCampScreen } from "./BaseCampScreen";

export function renderRosterScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="roster-root">
      <div class="roster-title">UNIT ROSTER</div>
      <div class="roster-subtitle">Customization coming in 11b.</div>
      <button class="roster-back-btn">BACK</button>
    </div>
  `;

  root.querySelector(".roster-back-btn")?.addEventListener("click", () => {
    renderBaseCampScreen();
  });
}
