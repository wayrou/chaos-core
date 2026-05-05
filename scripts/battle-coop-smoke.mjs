import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.BATTLE_COOP_SMOKE_PORT ?? 1432);
const baseUrl = `http://127.0.0.1:${port}`;
const placementScreenshotPath = join(tmpdir(), "chaos-battle-coop-placement.png");
const p2TurnScreenshotPath = join(tmpdir(), "chaos-battle-coop-p2-turn.png");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSmoke(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer(processHandle) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Vite exited before battle smoke could connect. Exit code: ${processHandle.exitCode}`);
    }

    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Waiting for the dev server.
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function setupBattle(page) {
  return page.evaluate(async () => {
    const store = await import("/src/state/gameStore.ts");
    const initial = await import("/src/core/initialState.ts");
    const settings = await import("/src/core/settings.ts");
    const coop = await import("/src/core/coop.ts");
    const session = await import("/src/core/session.ts");
    const battleCore = await import("/src/core/battle.ts");
    const battleScreen = await import("/src/ui/screens/BattleScreen.ts");

    let state = initial.createNewGameState();
    const baseUnitId = state.partyUnitIds[0] ?? Object.keys(state.unitsById)[0];
    const baseUnit = baseUnitId ? state.unitsById[baseUnitId] : null;
    const syntheticUnitIds = [];
    if (baseUnit) {
      const syntheticUnits = [
        {
          id: "smoke_unit_p2",
          name: "Sable Smoke",
          controller: "P2",
        },
        {
          id: "smoke_unit_p1_b",
          name: "Warden Smoke",
          controller: "P1",
        },
      ];
      for (const syntheticUnit of syntheticUnits) {
        state.unitsById[syntheticUnit.id] = {
          ...baseUnit,
          id: syntheticUnit.id,
          name: syntheticUnit.name,
          controller: syntheticUnit.controller,
        };
        syntheticUnitIds.push(syntheticUnit.id);
      }
    }
    const expandedPartyUnitIds = Array.from(new Set([
      ...state.partyUnitIds,
      ...syntheticUnitIds,
    ])).slice(0, 4);
    state = {
      ...state,
      partyUnitIds: expandedPartyUnitIds,
      players: {
        ...state.players,
        P2: {
          ...state.players.P2,
          active: true,
          inputSource: "keyboard2",
          color: "#6849c2",
          presence: "local",
          authorityRole: "local",
        },
      },
    };
    state = coop.redistributeUnitsForCoop(state);
    state = session.setPlayerJoinState(state, "P2", true);
    store.setGameState(state);
    await settings.updateSettings({
      showTutorialHints: false,
      dismissedTutorialHintIds: [
        "tutorial_haven_field",
        "tutorial_outer_deck_beta",
        "tutorial_battle_placement",
        "tutorial_battle_cards_strain",
      ],
    });

    let battle = battleCore.createTestBattleForCurrentParty(store.getGameState(), { width: 6, height: 4 });
    if (!battle) {
      return null;
    }

    battle = {
      ...battle,
      units: Object.fromEntries(Object.entries(battle.units).map(([unitId, unit]) => [
        unitId,
        unit.isEnemy
          ? { ...unit, agi: 1 }
          : { ...unit, agi: (unit.controller ?? "P1") === "P1" ? 14 : 13 },
      ])),
      log: [
        ...battle.log,
        "SLK//SMOKE :: Local tactical co-op verification primed.",
      ],
    };

    battleScreen.applyExternalBattleState(battle, "always");

    const friendlyUnits = Object.values(battle.units).filter((unit) => !unit.isEnemy);
    return {
      friendlyControllers: friendlyUnits.map((unit) => ({
        id: unit.id,
        controller: unit.controller ?? "P1",
      })),
      p1UnitId: friendlyUnits.find((unit) => (unit.controller ?? "P1") === "P1")?.id ?? null,
      p2UnitId: friendlyUnits.find((unit) => (unit.controller ?? "P1") === "P2")?.id ?? null,
    };
  });
}

async function placeFirstUnitForPlayer(page, playerId) {
  return page.evaluate(async (requestedPlayerId) => {
    const battleCore = await import("/src/core/battle.ts");
    const battleScreen = await import("/src/ui/screens/BattleScreen.ts");
    const currentBattle = battleScreen.getCurrentRenderedBattleState?.() ?? null;
    if (!currentBattle?.placementState) {
      return null;
    }

    const unit = Object.values(currentBattle.units)
      .filter((entry) => !entry.isEnemy && (entry.controller ?? "P1") === requestedPlayerId)
      .find((entry) => !currentBattle.placementState.placedUnitIds.includes(entry.id));
    if (!unit) {
      return null;
    }

    const occupied = new Set(
      Object.values(currentBattle.units)
        .filter((entry) => entry.hp > 0 && entry.pos)
        .map((entry) => `${entry.pos.x},${entry.pos.y}`),
    );
    const tile = battleCore.getPlacementTilesForUnit(currentBattle, unit)
      .find((candidate) => !occupied.has(`${candidate.x},${candidate.y}`));
    if (!tile) {
      return null;
    }

    const nextBattle = battleCore.placeUnit(currentBattle, unit.id, tile);
    battleScreen.applyExternalBattleState(nextBattle, "always");
    return {
      unitId: unit.id,
      tile,
    };
  }, playerId);
}

async function readPlacementUi(page) {
  return page.evaluate(() => ({
    confirmText: document.querySelector("#confirmPlacementBtn")?.textContent?.trim() ?? null,
    confirmDisabled: Boolean(document.querySelector("#confirmPlacementBtn")?.hasAttribute("disabled")),
    confirmState: document.querySelector("#confirmPlacementBtn")?.getAttribute("data-battle-placement-confirm-state") ?? null,
    confirmDetail: document.querySelector(".placement-confirm-detail")?.textContent?.trim() ?? null,
    authority: Array.from(document.querySelectorAll("[data-placement-player]")).map((element) => ({
      playerId: element.getAttribute("data-placement-player"),
      ready: element.getAttribute("data-placement-ready"),
      text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
    })),
  }));
}

async function readTurnOwner(page) {
  return page.evaluate(() => ({
    headerOwner: document.querySelector("[data-battle-turn-owner]")?.getAttribute("data-battle-turn-owner") ?? null,
    handOwner: document.querySelector("[data-battle-hand-owner]")?.getAttribute("data-battle-hand-owner") ?? null,
    endTurnOwner: document.querySelector("#endTurnBtn")?.getAttribute("data-battle-endturn-owner") ?? null,
    activeName: document.querySelector(".battle-active-value")?.textContent?.trim() ?? null,
    endTurnDisabled: Boolean(document.querySelector("#endTurnBtn")?.hasAttribute("disabled")),
    endTurnText: document.querySelector("#endTurnBtn")?.textContent?.trim() ?? null,
  }));
}

async function advancePlayerTurn(page) {
  await page.locator("#endTurnBtn").click();
  await page.waitForFunction(() => {
    const button = document.querySelector("#endTurnBtn");
    return button?.textContent?.includes("CONFIRM FACING");
  }, null, { timeout: 3000 });
  await page.locator("#endTurnBtn").click();
}

async function runSmoke() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const battleSetup = await setupBattle(page);
  assertSmoke(battleSetup?.p1UnitId && battleSetup?.p2UnitId, `Could not create a mixed local co-op battle roster: ${JSON.stringify(battleSetup)}`);

  await page.waitForSelector(".battle-root--placement", { timeout: 10000 });
  await page.waitForSelector("#confirmPlacementBtn", { timeout: 5000 });

  const initialPlacement = await readPlacementUi(page);
  assertSmoke(initialPlacement.confirmDisabled, `Placement confirm should start disabled for local co-op: ${JSON.stringify(initialPlacement)}`);
  assertSmoke(initialPlacement.confirmText === "PLACE A UNIT", `Unexpected initial confirm label: ${JSON.stringify(initialPlacement)}`);
  assertSmoke(initialPlacement.authority.some((entry) => entry.playerId === "P1"), `Missing P1 placement authority summary: ${JSON.stringify(initialPlacement)}`);
  assertSmoke(initialPlacement.authority.some((entry) => entry.playerId === "P2"), `Missing P2 placement authority summary: ${JSON.stringify(initialPlacement)}`);

  const p1Placement = await placeFirstUnitForPlayer(page, "P1");
  assertSmoke(Boolean(p1Placement?.unitId), `Failed to place a P1 unit during battle smoke: ${JSON.stringify(p1Placement)}`);
  await page.waitForTimeout(220);

  const waitingOnP2Placement = await readPlacementUi(page);
  assertSmoke(waitingOnP2Placement.confirmDisabled, `Placement confirm should still be blocked after only P1 deploys: ${JSON.stringify(waitingOnP2Placement)}`);
  assertSmoke(
    (waitingOnP2Placement.confirmText ?? "").includes("PLAYER 2"),
    `Placement confirm should explicitly wait on PLAYER 2: ${JSON.stringify(waitingOnP2Placement)}`,
  );
  assertSmoke(
    waitingOnP2Placement.authority.some((entry) => entry.playerId === "P1" && entry.ready === "true"),
    `P1 should read as ready after deploying: ${JSON.stringify(waitingOnP2Placement)}`,
  );
  assertSmoke(
    waitingOnP2Placement.authority.some((entry) => entry.playerId === "P2" && entry.ready === "false"),
    `P2 should still read as waiting before deployment: ${JSON.stringify(waitingOnP2Placement)}`,
  );
  await page.screenshot({ path: placementScreenshotPath, fullPage: true });

  const p2Placement = await placeFirstUnitForPlayer(page, "P2");
  assertSmoke(Boolean(p2Placement?.unitId), `Failed to place a P2 unit during battle smoke: ${JSON.stringify(p2Placement)}`);
  await page.waitForTimeout(220);

  const readyPlacement = await readPlacementUi(page);
  assertSmoke(!readyPlacement.confirmDisabled && readyPlacement.confirmState === "ready", `Placement confirm should be ready after both local players deploy: ${JSON.stringify(readyPlacement)}`);
  assertSmoke(
    readyPlacement.authority.every((entry) => entry.ready === "true"),
    `All local placement summaries should be ready after both deploy: ${JSON.stringify(readyPlacement)}`,
  );

  await page.locator("#confirmPlacementBtn").click();
  await page.waitForSelector("#endTurnBtn", { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector(".battle-root--placement"), null, { timeout: 10000 });

  const p1Turn = await readTurnOwner(page);
  assertSmoke(
    p1Turn.headerOwner === "P1" && p1Turn.handOwner === "P1" && p1Turn.endTurnOwner === "P1",
    `Battle should open on a PLAYER 1 turn after confirm: ${JSON.stringify(p1Turn)}`,
  );
  assertSmoke(!p1Turn.endTurnDisabled, `P1 end turn should be available on the local opening turn: ${JSON.stringify(p1Turn)}`);

  await advancePlayerTurn(page);
  await page.waitForFunction(() => document.querySelector("[data-battle-turn-owner]")?.getAttribute("data-battle-turn-owner") === "P2", null, { timeout: 5000 });
  await page.waitForTimeout(220);

  const p2Turn = await readTurnOwner(page);
  assertSmoke(
    p2Turn.headerOwner === "P2" && p2Turn.handOwner === "P2" && p2Turn.endTurnOwner === "P2",
    `Battle HUD ownership did not switch cleanly onto PLAYER 2: ${JSON.stringify(p2Turn)}`,
  );
  assertSmoke(!p2Turn.endTurnDisabled, `P2 end turn should be available on PLAYER 2's turn: ${JSON.stringify(p2Turn)}`);
  await page.screenshot({ path: p2TurnScreenshotPath, fullPage: true });

  assertSmoke(pageErrors.length === 0, `Browser page errors: ${pageErrors.join("\n")}`);
  const relevantConsoleErrors = consoleErrors.filter((entry) => !/Failed to load resource.*404/i.test(entry));
  assertSmoke(relevantConsoleErrors.length === 0, `Browser console errors: ${relevantConsoleErrors.join("\n")}`);

  await browser.close();
  return {
    placementScreenshotPath,
    p2TurnScreenshotPath,
    battleSetup,
    p1Placement,
    p2Placement,
    p1Turn,
    p2Turn,
  };
}

const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
});
server.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

try {
  await waitForServer(server);
  const result = await runSmoke();
  console.log(`Battle co-op smoke passed: ${JSON.stringify(result)}`);
} finally {
  server.kill("SIGTERM");
}
