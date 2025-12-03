// src/ui/screens/ShopScreen.ts

import { renderBaseCampScreen } from "./BaseCampScreen";

export function renderShopScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="shop-root">
      <div class="shop-title">BASE CAMP SHOP</div>
      <div class="shop-subtitle">(Full shop added in 11c)</div>
      <button class="shop-back-btn">BACK</button>
    </div>
  `;

  root.querySelector(".shop-back-btn")?.addEventListener("click", () => {
    renderBaseCampScreen();
  });
}
