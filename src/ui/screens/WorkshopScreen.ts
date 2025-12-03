// src/ui/screens/WorkshopScreen.ts

import { renderBaseCampScreen } from "./BaseCampScreen";

export function renderWorkshopScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="workshop-root">
      <div class="workshop-title">WORKSHOP</div>
      <div class="workshop-subtitle">Crafting system coming in 11d.</div>
      <button class="workshop-back-btn">BACK</button>
    </div>
  `;

  root.querySelector(".workshop-back-btn")?.addEventListener("click", () => {
    renderBaseCampScreen();
  });
}
