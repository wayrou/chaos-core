// src/ui/screens/BattleScreen.ts
import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";


import {
  getActiveUnit,
  advanceTurn,
  applyStrain,
  getStrainThreshold,
  isOverStrainThreshold,
  performEnemyTurn,
  evaluateBattleOutcome,
} from "../../core/battle";
import { renderScrollLinkShell } from "./ScrollLinkShell";

let selectedCardId: string | null = null;

// UI-only per-turn movement lock
let lastActiveUnitId: string | null = null;
let hasMovedThisTurn = false;
let cachedMoveStart:
  | { unitId: string; x: number; y: number }
  | null = null;

// Small helper for async enemy animation
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function renderBattleScreen(): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  const state = getGameState();
  const battle = state.currentBattle;


// No active battle
if (!battle) {
  root.innerHTML = `
    <div class="battle-root">
      <div class="battle-card">
        <div class="battle-header">
          <div class="battle-header-left">
            <div class="battle-title">NO ACTIVE ENGAGEMENT</div>
            <div class="battle-subtitle">
              Return to Scrollink Shell to initiate a node.
            </div>
          </div>
          <div class="battle-header-right">
            <button class="battle-back-btn">EXIT</button>
          </div>
        </div>

        <div class="battle-body">
          <div class="battle-grid"></div>
        </div>

        <div class="scrollink-console">
          <div class="scrollink-console-header">
            SCROLLINK OS // ENGAGEMENT_FEED
          </div>
          <div class="scrollink-console-body"></div>
        </div>

        <!-- DEBUG PANEL -->
        <div class="battle-debug-panel">
          <button class="battle-debug-autowin-btn">
            DEBUG: AUTO WIN
          </button>
        </div>
        <!-- /DEBUG PANEL -->
      </div>

      <div class="battle-hand"></div>
    </div>
  `;

  const backBtn = root.querySelector<HTMLButtonElement>(".battle-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
 renderBaseCampScreen();

    });
  }

  const debugAutoBtn =
    root.querySelector<HTMLButtonElement>(".battle-debug-autowin-btn");
  if (debugAutoBtn) {
    debugAutoBtn.addEventListener("click", () => {
      debugAutoWinBattle();
    });
  }

  return;
}

  // If the battle is over, show a result / reward screen
  if (battle.phase === "victory" || battle.phase === "defeat") {
    const rewards = battle.rewards ?? {
      wad: 0,
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
    };

    const isVictory = battle.phase === "victory";

    root.innerHTML = `
      <div class="battle-root">
        <div class="battle-card">
          <div class="battle-header">
            <div class="battle-header-left">
              <div class="battle-title">
                ${isVictory ? "ENGAGEMENT COMPLETE" : "LINK SEVERED"}
              </div>
              <div class="battle-subtitle">
                NODE ${battle.roomId} • TURNS ${battle.turnCount}
              </div>
            </div>
          </div>

          <div class="battle-body battle-body--result">
            <div class="battle-result-title">
              ${isVictory ? "REWARD SUMMARY" : "SQUAD OFFLINE"}
            </div>

            ${
              isVictory
                ? `
            <div class="battle-reward-grid">
              <div class="battle-reward-item">
                <div class="reward-label">WAD</div>
                <div class="reward-value">+${rewards.wad}</div>
              </div>
              <div class="battle-reward-item">
                <div class="reward-label">Metal Scrap</div>
                <div class="reward-value">+${rewards.metalScrap}</div>
              </div>
              <div class="battle-reward-item">
                <div class="reward-label">Wood</div>
                <div class="reward-value">+${rewards.wood}</div>
              </div>
              <div class="battle-reward-item">
                <div class="reward-label">Chaos Shards</div>
                <div class="reward-value">+${rewards.chaosShards}</div>
              </div>
              <div class="battle-reward-item">
                <div class="reward-label">Steam Components</div>
                <div class="reward-value">+${rewards.steamComponents}</div>
              </div>
            </div>
                `
                : `
            <div class="battle-defeat-text">
              All allied signals lost.<br/>
              Operation logged for after-action review.
            </div>
                `
            }

            <div class="battle-result-footer">
              <button class="battle-back-btn battle-result-btn">
                ${isVictory ? "RETURN TO SHELL" : "ACKNOWLEDGE"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const backBtn = root.querySelector<HTMLButtonElement>(".battle-result-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        updateGameState((prev) => {
          // Always clear the finished battle
          let next: typeof prev = {
            ...prev,
            currentBattle: null,
          };

          if (!isVictory) {
            return next;
          }

          // --- WAD stays as currency ---
          next = {
            ...next,
            wad: (prev.wad ?? 0) + (rewards.wad ?? 0),
          };

          // --- Inventory resources: go into BASE CAMP STORAGE as items ---
          const inv = (next as any).inventory ?? {
            forwardLocker: [],
            baseStorage: [],
          };

          const baseStorage: any[] = Array.isArray(inv.baseStorage)
            ? [...inv.baseStorage]
            : [];

          type ResourceKey =
            | "metalScrap"
            | "wood"
            | "chaosShards"
            | "steamComponents";

          const resourceDefs: Record<
            ResourceKey,
            { id: string; name: string; massKg: number; bulkBu: number; powerW: number }
          > = {
            metalScrap: {
              id: "res_metal_scrap",
              name: "Metal Scrap",
              massKg: 0.1,
              bulkBu: 0.4,
              powerW: 0,
            },
            wood: {
              id: "res_wood",
              name: "Wood Planks",
              massKg: 0.2,
              bulkBu: 0.6,
              powerW: 0,
            },
            chaosShards: {
              id: "res_chaos_shard",
              name: "Chaos Shards",
              massKg: 0.05,
              bulkBu: 0.2,
              powerW: 0.3,
            },
            steamComponents: {
              id: "res_steam_components",
              name: "Steam Components",
              massKg: 0.15,
              bulkBu: 0.3,
              powerW: 0.5,
            },
          };

          function addResourceItem(key: ResourceKey, amount: number) {
            if (!amount || amount <= 0) return;

            const def = resourceDefs[key];
            let entry = baseStorage.find((e) => e.id === def.id);

            if (!entry) {
              entry = {
                id: def.id,
                name: def.name,
                kind: "resource",
                quantity: 0,
                massKg: def.massKg,
                bulkBu: def.bulkBu,
                powerW: def.powerW,
                stackable: true,
              };
              baseStorage.push(entry);
            }

            entry.quantity = (entry.quantity ?? 0) + amount;
          }

          addResourceItem("metalScrap", rewards.metalScrap ?? 0);
          addResourceItem("wood", rewards.wood ?? 0);
          addResourceItem("chaosShards", rewards.chaosShards ?? 0);
          addResourceItem("steamComponents", rewards.steamComponents ?? 0);

          next = {
            ...next,
            inventory: {
              ...(inv as any),
              baseStorage,
            },
            // keep numeric counters in sync for now (legacy)
            resources: {
              metalScrap:
                (prev.resources?.metalScrap ?? 0) +
                (rewards.metalScrap ?? 0),
              wood: (prev.resources?.wood ?? 0) + (rewards.wood ?? 0),
              chaosShards:
                (prev.resources?.chaosShards ?? 0) +
                (rewards.chaosShards ?? 0),
              steamComponents:
                (prev.resources?.steamComponents ?? 0) +
                (rewards.steamComponents ?? 0),
            },
          };

          return next;
        });

renderBaseCampScreen();

      });
    }


    return;
  }


  const activeUnit = getActiveUnit(battle);

  // Reset per-turn move lock if the active unit changed
  if (activeUnit?.id !== lastActiveUnitId) {
    lastActiveUnitId = activeUnit ? activeUnit.id : null;
    hasMovedThisTurn = false;
    cachedMoveStart =
      activeUnit && activeUnit.pos
        ? { unitId: activeUnit.id, x: activeUnit.pos.x, y: activeUnit.pos.y }
        : null;
  }

  // Main layout: grid + console + hand
  root.innerHTML = `
    <div class="battle-root">
      <div class="battle-card">
        <div class="battle-header">
          <div class="battle-header-left">
            <div class="battle-title">ENGAGEMENT – ${battle.roomId}</div>
            <div class="battle-subtitle">
              TURN ${battle.turnCount} • GRID ${battle.gridWidth}×${battle.gridHeight}
            </div>
          </div>
          <div class="battle-header-right">
            <div class="battle-active-label">ACTIVE UNIT</div>
            <div class="battle-active-value">
              ${activeUnit ? activeUnit.name : "—"}
            </div>
            <button class="battle-back-btn">EXIT BATTLE</button>
          </div>
        </div>

        <div class="battle-body">
          <div class="battle-grid"></div>
        </div>

        <div class="scrollink-console">
          <div class="scrollink-console-header">
            SCROLLINK OS // ENGAGEMENT_FEED
          </div>
          <div class="scrollink-console-body"></div>
        </div>
      </div>

      <div class="battle-hand"></div>
    </div>
  `;

  const backBtn = root.querySelector<HTMLButtonElement>(".battle-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
renderBaseCampScreen();

    });
  }

  const gridEl = root.querySelector<HTMLDivElement>(".battle-grid");
  const consoleBodyEl =
    root.querySelector<HTMLDivElement>(".scrollink-console-body");

  if (!gridEl || !consoleBodyEl) return;

  // Configure CSS grid dimensions
  gridEl.style.setProperty("--battle-grid-cols", String(battle.gridWidth));
  gridEl.style.setProperty("--battle-grid-rows", String(battle.gridHeight));

  const unitsArray = Object.values(battle.units);
  const cardsById = state.cardsById;

  // ----- RENDER GRID -----
  for (let y = 0; y < battle.gridHeight; y++) {
    for (let x = 0; x < battle.gridWidth; x++) {
      const tile = battle.tiles.find(
        (t) => t.pos.x === x && t.pos.y === y
      );

      const cell = document.createElement("div");
      const terrainType = tile?.terrain ?? "floor";

      let extraClasses = "";

      const unitOnTile = unitsArray.find(
        (u) => u.pos && u.pos.x === x && u.pos.y === y
      );

      if (activeUnit && activeUnit.pos && !activeUnit.isEnemy) {
        const pos = { x, y };

        // --- Card-based highlighting (attacks / self-cast) ---
        if (selectedCardId) {
          const card = cardsById[selectedCardId];
          if (card) {
            // Enemy-target cards: highlight enemies in card.range
            if (
              card.targetType === "enemy" &&
              unitOnTile &&
              unitOnTile.isEnemy &&
              unitOnTile.pos &&
              isWithinCardRange(activeUnit.pos, unitOnTile.pos, card.range ?? 1)
            ) {
              extraClasses += " battle-tile--attack-option";
            }
            // Self-target card (Brace): highlight the active unit's tile
            else if (
              card.targetType === "self" &&
              unitOnTile &&
              unitOnTile.id === activeUnit.id
            ) {
              extraClasses += " battle-tile--move-option";
            }
          }
        } else {
          // --- No card selected → movement highlights only (no basic attack) ---
          if (
            !hasMovedThisTurn &&
            !unitOnTile &&
            canUnitMoveToUI(battle, activeUnit, pos)
          ) {
            extraClasses += " battle-tile--move-option";
          }
        }
      }

      cell.className = `battle-tile battle-tile--${terrainType}${extraClasses}`;

      // Render unit (if present)
      if (unitOnTile) {
        const unit = unitOnTile;
        const isActive = activeUnit && unit.id === activeUnit.id;
        const unitDiv = document.createElement("div");
        unitDiv.className =
          "battle-unit" +
          (unit.isEnemy ? " battle-unit--enemy" : " battle-unit--ally") +
          (isActive ? " battle-unit--active" : "");

        const buffChips = (unit.buffs ?? [])
          .map((b) => {
            const label =
              b.type === "def_up"
                ? "DEF"
                : b.type === "atk_up"
                ? "ATK"
                : b.type.toUpperCase();

            return `
              <span
                style="
                  margin-left: 4px;
                  padding: 2px 4px;
                  border-radius: 3px;
                  border: 1px solid #6f8cff;
                  background: rgba(111,140,255,0.3);
                  font-size: 10px;
                  white-space: nowrap;
                "
              >
                ${label}+${b.amount}
              </span>
            `;
          })
          .join("");

        unitDiv.innerHTML = `
          <div class="battle-unit-symbol"></div>
          <div class="battle-unit-name">
            ${unit.name}
            ${buffChips}
          </div>
          <div class="battle-unit-hp">HP: ${unit.hp}/${unit.maxHp}</div>
          <div class="battle-unit-strain">
            Strain: ${unit.strain}/${getStrainThreshold(unit)}
          </div>
        `;

        cell.appendChild(unitDiv);
      }

      // Tile click handler
      cell.addEventListener("click", () => {
        handleTileClick(x, y);
      });

      gridEl.appendChild(cell);
    }
  }

  // ----- RENDER SCROLLINK CONSOLE LOG -----
  const logHtml = battle.log
    .map((line) => `<div class="scrollink-log-line">${line}</div>`)
    .join("");

  consoleBodyEl.innerHTML = logHtml;
  consoleBodyEl.scrollTop = consoleBodyEl.scrollHeight;

  // ----- RENDER HAND -----
  renderHandUI();
}


function handleTileClick(x: number, y: number): void {
  updateGameState((prev) => {
    const battle = prev.currentBattle;
    if (!battle) return prev;

    const active = getActiveUnit(battle);
    if (!active || !active.pos || active.isEnemy) return prev;

    const pos = { x, y };
    const unitsArray = Object.values(battle.units);
    const targetUnit = unitsArray.find(
      (u) => u.pos && u.pos.x === x && u.pos.y === y
    );

    // We'll build changes onto this local copy
    let b = battle;

    // ==========================
    //  CARD SELECTED
    // ==========================
    if (selectedCardId) {
      const card = prev.cardsById[selectedCardId];
      if (!card) return prev;

      // Always re-read active from our local battle copy
      const currentActive = b.units[active.id];
      if (!currentActive || !currentActive.pos) return prev;

      // ---------------------------------------
      // 1) ENEMY-TARGET CARDS (Strike / Lunge / etc.)
      // ---------------------------------------
      if (
        card.targetType === "enemy" &&
        targetUnit &&
        targetUnit.isEnemy &&
        targetUnit.pos &&
        isWithinCardRange(
          currentActive.pos,
          targetUnit.pos,
          card.range ?? 1
        )
      ) {
        const damageEffect = card.effects.find((e) => e.type === "damage");
        const dmg = damageEffect?.amount ?? 0;

        // start from the latest local battle
        let newBattle: typeof b = { ...b };
        const defenderBefore = newBattle.units[targetUnit.id];
        if (!defenderBefore) return prev;

        const newHp = defenderBefore.hp - dmg;

        if (newHp <= 0) {
          // lethal
          const newUnits = { ...newBattle.units };
          delete newUnits[targetUnit.id];

          newBattle = {
            ...newBattle,
            units: newUnits,
            turnOrder: newBattle.turnOrder.filter(
              (id) => id !== targetUnit.id
            ),
            log: [
              ...newBattle.log,
              `SLK//HIT    :: ${currentActive.name} deletes ${targetUnit.name} for ${dmg} • TARGET OFFLINE.`,
            ],
          };
        } else {
          // non-lethal
          newBattle = {
            ...newBattle,
            units: {
              ...newBattle.units,
              [targetUnit.id]: { ...defenderBefore, hp: newHp },
            },
            log: [
              ...newBattle.log,
              `SLK//HIT    :: ${currentActive.name} hits ${targetUnit.name} for ${dmg} (HP ${newHp}/${defenderBefore.maxHp}).`,
            ],
          };
        }

        // Evaluate victory/defeat from this hit
        newBattle = evaluateBattleOutcome(newBattle);

        // Apply strain to attacker
        newBattle = applyStrain(newBattle, currentActive, card.strainCost);

        // Re-read attacker after strain (in case we ever mutate stats there)
        const attackerAfter = newBattle.units[currentActive.id];
        if (attackerAfter) {
          newBattle = {
            ...newBattle,
            units: {
              ...newBattle.units,
              [attackerAfter.id]: {
                ...attackerAfter,
                hand: attackerAfter.hand.filter(
                  (id) => id !== selectedCardId
                ),
                discardPile: [
                  ...attackerAfter.discardPile,
                  selectedCardId!,
                ],
              },
            },
          };
        }

        selectedCardId = null;
        return { ...prev, currentBattle: newBattle };
      }

      // ---------------------------------------
      // 2) SELF-TARGET CARD (Brace / etc.)
      // ---------------------------------------
      if (
        card.targetType === "self" &&
        currentActive.pos &&
        currentActive.pos.x === pos.x &&
        currentActive.pos.y === pos.y
      ) {
        const existing = b.units[currentActive.id];
        const existingBuffs = existing.buffs ?? [];

        const newBuff = {
          id: "brace_" + Date.now(),
          type: "def_up" as const,
          amount: 3,
          duration: 1,
        };

        // Apply strain via helper so threshold logging works
        let nextBattle = applyStrain(b, existing, card.strainCost);
        const strained = nextBattle.units[existing.id];

        const updatedUnit = {
          ...strained,
          buffs: [...existingBuffs, newBuff],
          hand: strained.hand.filter((id) => id !== selectedCardId),
          discardPile: [...strained.discardPile, selectedCardId!],
        };

        nextBattle = {
          ...nextBattle,
          units: {
            ...nextBattle.units,
            [updatedUnit.id]: updatedUnit,
          },
          log: [
            ...nextBattle.log,
            `SLK//UNIT   :: ${updatedUnit.name} braces [+3 DEF] • STRAIN +${card.strainCost}.`,
          ],
        };

        selectedCardId = null;
        return { ...prev, currentBattle: nextBattle };
      }

      // If we get here, click was not a valid target for that card
      return prev;
    }

    // ==========================
    //  NO CARD SELECTED → MOVE ONLY
    // ==========================
    if (
      !targetUnit &&
      !hasMovedThisTurn &&
      canUnitMoveToUI(b, active, pos)
    ) {
      // Lock movement for this unit until undo or next turn
      hasMovedThisTurn = true;

      // Remember starting tile if not already cached
      if (!cachedMoveStart && active.pos) {
        cachedMoveStart = {
          unitId: active.id,
          x: active.pos.x,
          y: active.pos.y,
        };
      }

      const updatedUnit = {
        ...active,
        pos: { x: pos.x, y: pos.y },
      };

      const movedBattle = {
        ...b,
        units: {
          ...b.units,
          [active.id]: updatedUnit,
        },
        log: [
          ...b.log,
          `SLK//MOVE   :: ${active.name} repositions to (${pos.x}, ${pos.y}).`,
        ],
      };

      return { ...prev, currentBattle: movedBattle };
    }

    // Clicking enemies without a card does nothing
    return prev;
  });

  renderBattleScreen();
}

function debugAutoWinBattle(): void {
  updateGameState((prev) => {
    const battle = prev.currentBattle;
    if (!battle) return prev;

    // Remove all enemy units
    const filteredUnits = Object.fromEntries(
      Object.entries(battle.units).filter(
        ([, u]) => !u.isEnemy
      )
    );

    const clearedBattle = {
      ...battle,
      units: filteredUnits,
    };

    // Let core logic decide victory + rewards
    const withOutcome = evaluateBattleOutcome(clearedBattle);

    return {
      ...prev,
      currentBattle: withOutcome,
    };
  });

  renderBattleScreen();
}


/**
 * Async enemy phase: enemies act one at a time with a small delay,
 * then control returns to the player.
 */
async function endPlayerTurn(): Promise<void> {
  // Step to the next unit (likely an enemy)
  updateGameState((prev) => {
    const battle = prev.currentBattle;
    if (!battle) return prev;

    const advanced = advanceTurn(battle);
    return { ...prev, currentBattle: advanced };
  });

  // Reset UI turn state
  hasMovedThisTurn = false;
  cachedMoveStart = null;
  selectedCardId = null;

  renderBattleScreen();

  // Now run enemy phase with per-enemy animation
  while (true) {
    const state = getGameState();
    const battle = state.currentBattle;
    if (!battle) break;

    const active = getActiveUnit(battle);
    if (!active || !active.isEnemy) break; // back to player or no units

    // Small delay so movement/attacks are visible
    await sleep(400);

    updateGameState((prev) => {
      const current = prev.currentBattle;
      if (!current) return prev;
      const afterEnemy = performEnemyTurn(current);
      return { ...prev, currentBattle: afterEnemy };
    });

    renderBattleScreen();
  }
}

/**
 * Undo the last move for the current active unit (if any), UI-only.
 */
function handleUndoMoveClick(): void {
  if (!cachedMoveStart || !hasMovedThisTurn) return;

  updateGameState((prev) => {
    const battle = prev.currentBattle;
    if (!battle) return prev;

    const active = getActiveUnit(battle);
    if (!active || !active.pos || active.id !== cachedMoveStart!.unitId) {
      return prev;
    }

    const reverted = {
      ...battle,
      units: {
        ...battle.units,
        [active.id]: {
          ...active,
          pos: { x: cachedMoveStart.x, y: cachedMoveStart.y },
        },
      },
      log: [
        ...battle.log,
        `SLK//MOVE   :: ${active.name} resets to starting position.`,
      ],
    };

    return { ...prev, currentBattle: reverted };
  });

  hasMovedThisTurn = false;
  selectedCardId = null;
  renderBattleScreen();
}


/**
 * Render the card hand
 */
function renderHandUI(): void {
  const state = getGameState();
  const battle = state.currentBattle;
  if (!battle) return;

  const active = getActiveUnit(battle);
  const handEl = document.querySelector<HTMLDivElement>(".battle-hand");
  if (!handEl) return;

  // Enemy or no unit → no hand
  if (!active || active.isEnemy) {
    handEl.innerHTML = "";
    handEl.className = "battle-hand";
    return;
  }

  const deckCount = active.drawPile.length;
  const discardCount = active.discardPile.length;

  const strained = isOverStrainThreshold(active);
  handEl.className = strained
    ? "battle-hand battle-hand--strained"
    : "battle-hand";

  handEl.innerHTML = `
    <div class="hand-header">
      <div class="hand-unit">
        <span class="hand-unit-label">ACTIVE HAND</span>
        <span class="hand-unit-name">${active.name}</span>
        <span class="hand-unit-meta">
          HP ${active.hp}/${active.maxHp} • STRAIN ${active.strain}/${getStrainThreshold(
            active
          )}
        </span>
      </div>
      <div class="hand-meters">
        <span class="hand-counter">Deck: ${deckCount}</span>
        <span class="hand-counter">Discard: ${discardCount}</span>
        <button class="battle-undo-btn">UNDO MOVE</button>
        <button class="battle-endturn-btn">END TURN</button>
        <button class="battle-debug-autowin-btn">DEBUG: AUTO WIN</button>
      </div>
    </div>
    <div class="hand-cards-row"></div>
  `;

  // --- buttons ---
  const undoBtn = handEl.querySelector<HTMLButtonElement>(".battle-undo-btn");
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      handleUndoMoveClick();
    });
  }

  const endTurnBtn = handEl.querySelector<HTMLButtonElement>(
    ".battle-endturn-btn"
  );
  if (endTurnBtn) {
    endTurnBtn.addEventListener("click", () => {
      selectedCardId = null;
      void endPlayerTurn();
    });
  }

  const debugBtn = handEl.querySelector<HTMLButtonElement>(
    ".battle-debug-autowin-btn"
  );
  if (debugBtn) {
    debugBtn.addEventListener("click", () => {
      debugAutoWinBattle();
    });
  }

  const cardsRow = handEl.querySelector<HTMLDivElement>(".hand-cards-row");
  if (!cardsRow) return;

  const handSize = active.hand.length;
  const mid = (handSize - 1) / 2;

  active.hand.forEach((cardId, index) => {
    const card = state.cardsById[cardId];
    if (!card) return;

    let rarityClass = "card-rarity-common";
    if (card.id === "brace") {
      rarityClass = "card-rarity-uncommon";
    } else if (card.id === "lunge") {
      rarityClass = "card-rarity-rare";
    }

    let icon = "⚔️";
    if (card.targetType === "self") icon = "🛡️";
    else if (card.targetType === "tile") icon = "⇄";

    const offset = index - mid;
    const angle = offset * 7;
    const vertical = -Math.abs(offset) * 4;

    const slot = document.createElement("div");
    slot.className = "battle-card-slot";
    slot.style.setProperty("--fan-rotate", `${angle}deg`);
    slot.style.setProperty("--fan-translateY", `${vertical}px`);

    const el = document.createElement("div");
    el.className =
      "battle-cardui " +
      rarityClass +
      (selectedCardId === cardId ? " battle-cardui--selected" : "");

    el.innerHTML = `
      <div class="card-top-row">
        <div class="card-icon">${icon}</div>
        <div class="card-cost">STR ${card.strainCost}</div>
      </div>
      <div class="card-name">${card.name}</div>
      <div class="card-tag">
        ${
          card.targetType === "enemy"
            ? "OFFENSE"
            : card.targetType === "self"
            ? "SELF"
            : "MOBILITY"
        }
      </div>
      <div class="card-desc">${card.description}</div>
    `;

    el.addEventListener("click", () => {
      if (selectedCardId === cardId) {
        selectedCardId = null;
      } else {
        selectedCardId = cardId;
      }
      renderBattleScreen();
    });

    slot.appendChild(el);
    cardsRow.appendChild(slot);
  });
}


/**
 * Manhattan distance <= range?
 */
function isWithinCardRange(
  from: { x: number; y: number },
  to: { x: number; y: number },
  range: number
): boolean {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return dx + dy <= range;
}

/**
 * UI-side movement check:
 * - Within AGI range
 * - In bounds / not wall
 * - No other unit on tile
 */
function canUnitMoveToUI(
  state: any,
  unit: any,
  dest: { x: number; y: number }
): boolean {
  if (!unit.pos) return false;

  const dx = Math.abs(unit.pos.x - dest.x);
  const dy = Math.abs(unit.pos.y - dest.y);
  const distance = dx + dy;

  if (distance === 0 || distance > unit.agi) return false;

  // In bounds
  if (
    dest.x < 0 ||
    dest.y < 0 ||
    dest.x >= state.gridWidth ||
    dest.y >= state.gridHeight
  ) {
    return false;
  }

  // Not a wall
  const tile = state.tiles.find(
    (t: any) => t.pos.x === dest.x && t.pos.y === dest.y
  );
  if (!tile || tile.terrain === "wall") return false;

  // No other unit there
  const occupied = Object.values(state.units).some(
    (u: any) => u.pos && u.pos.x === dest.x && u.pos.y === dest.y
  );
  if (occupied) return false;

  return true;
}
