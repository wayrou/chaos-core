import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.HAVEN3D_SMOKE_PORT ?? 1431);
const baseUrl = `http://127.0.0.1:${port}`;
const networkLobbyScreenshotPath = join(tmpdir(), "chaos-multiplayer-network-lobby-3d.png");
const havenReturnScreenshotPath = join(tmpdir(), "chaos-multiplayer-return-haven.png");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSmoke(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function distanceBetween(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
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

async function dismissMenuShell(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".splash-screen", { timeout: 5000 }).catch(() => undefined);
  if (await page.locator("#splashSkipBtn").count()) {
    await page.locator("#splashSkipBtn").click();
  } else {
    await page.mouse.click(20, 20);
  }
  await page.waitForSelector('button[data-action="new-op"], .mainmenu-root', { timeout: 10000 }).catch(() => undefined);
}

async function setupBaseCamp(page) {
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const initial = await import("/src/core/initialState.ts");
    const campaign = await import("/src/core/campaign.ts");
    const settings = await import("/src/core/settings.ts");
    store.setGameState(initial.createNewGameState());
    campaign.saveCampaignProgress({
      ...campaign.createDefaultCampaignProgress(),
      highestReachedFloorOrdinal: 10,
    });
    await settings.updateSettings({
      showTutorialHints: false,
      dismissedTutorialHintIds: ["tutorial_haven_field", "tutorial_outer_deck_beta"],
    });
    field.renderFieldScreen("base_camp");
  });
}

async function setupOuterDeck(page) {
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const initial = await import("/src/core/initialState.ts");
    const settings = await import("/src/core/settings.ts");
    const state = initial.createNewGameState();
    state.weaponsmith = {
      ...(state.weaponsmith ?? {}),
      installedUpgradeIds: [...(state.weaponsmith?.installedUpgradeIds ?? [])],
      ownedUtilityItemIds: Array.from(new Set([
        ...(state.weaponsmith?.ownedUtilityItemIds ?? []),
        "apron_glider",
      ])),
    };
    store.setGameState(state);
    await settings.updateSettings({
      showTutorialHints: false,
      dismissedTutorialHintIds: ["tutorial_haven_field", "tutorial_outer_deck_beta"],
    });
    field.renderFieldScreen("outer_deck_overworld");
  });
}

async function joinLocalCoopP2(page) {
  await page.evaluate(async () => {
    const store = await import("/src/state/gameStore.ts");
    const coop = await import("/src/core/coop.ts");
    if (store.getGameState().players.P2.active && store.getGameState().players.P2.avatar) {
      return true;
    }
    const joinedNow = coop.tryJoinAsP2();
    return joinedNow || store.getGameState().players.P2.active;
  });
  await page.waitForFunction(async () => {
    const store = await import("/src/state/gameStore.ts");
    return Boolean(store.getGameState().players.P2.active && store.getGameState().players.P2.avatar);
  }, null, { timeout: 5000 });
  await page.waitForTimeout(220);
}

async function focusCanvas(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector(".haven3d-canvas");
    if (canvas instanceof HTMLElement) {
      canvas.focus();
    }
  });
}

async function pressCanvasKey(page, code, key = code) {
  await page.evaluate(({ requestedCode, requestedKey }) => {
    const canvas = document.querySelector(".haven3d-canvas");
    if (!(canvas instanceof HTMLElement)) {
      return;
    }
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent("keydown", {
      key: requestedKey,
      code: requestedCode,
      bubbles: true,
      cancelable: true,
    }));
  }, {
    requestedCode: code,
    requestedKey: key,
  });
}

async function toggleHybrid(page) {
  await focusCanvas(page);
  await pressCanvasKey(page, "KeyV", "v");
  await page.waitForTimeout(240);
}

async function setFieldPlayerPositions(page, positions) {
  const moved = await page.evaluate(async (requestedPositions) => {
    const field = await import("/src/field/FieldScreen.ts");
    const controller = globalThis.__CHAOS_CURRENT_HAVEN3D_FIELD_CONTROLLER__;
    return requestedPositions.every((entry) => {
      const movedViaField = field.setCurrentFieldPlayerPosition(entry.playerId, entry.x, entry.y, entry.facing);
      if (controller?.options?.setPlayerAvatar) {
        controller.options.setPlayerAvatar(entry.playerId, entry.x, entry.y, entry.facing);
        return true;
      }
      return movedViaField;
    });
  }, positions);
  assertSmoke(moved, `Could not place field players: ${JSON.stringify(positions)}`);
  await page.waitForTimeout(240);
}

async function spreadPlayersAcrossCurrentField(page) {
  const positions = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const map = field.getCurrentFieldRuntimeMap();
    if (!map) {
      return null;
    }
    const tileSize = 64;
    const y = Math.max(3.5, Math.min(map.height - 3.5, map.height * 0.45)) * tileSize;
    const p1X = Math.max(3.5, Math.min(map.width - 3.5, map.width * 0.28)) * tileSize;
    const p2X = Math.max(3.5, Math.min(map.width - 3.5, map.width * 0.72)) * tileSize;
    return [
      { playerId: "P1", x: p1X, y, facing: "east" },
      { playerId: "P2", x: p2X, y, facing: "west" },
    ];
  });
  assertSmoke(Boolean(positions), "Unable to compute field positions for the multiplayer return smoke.");
  await setFieldPlayerPositions(page, positions);
}

async function readFieldSnapshot(page) {
  return page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const controller = globalThis.__CHAOS_CURRENT_HAVEN3D_FIELD_CONTROLLER__;
    const map = field.getCurrentFieldRuntimeMap();
    return {
      mapId: map?.id ?? null,
      isHaven3D: Boolean(document.querySelector(".field-root--haven3d .haven3d-canvas")),
      camera: controller?.getCameraState?.() ?? field.getCurrentHaven3DFieldCameraState?.() ?? field.getStoredHaven3DFieldCameraState?.(map?.id ?? "") ?? null,
      players: {
        P1: controller?.options?.getPlayerAvatar?.("P1") ?? field.getCurrentFieldPlayerAvatar?.("P1") ?? null,
        P2: controller?.options?.getPlayerAvatar?.("P2") ?? field.getCurrentFieldPlayerAvatar?.("P2") ?? null,
      },
    };
  });
}

async function waitForFieldSnapshot(page, predicate, failureMessage, options = {}) {
  const attempts = options.attempts ?? 40;
  const intervalMs = options.intervalMs ?? 120;
  let lastSnapshot = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastSnapshot = await readFieldSnapshot(page);
    if (predicate(lastSnapshot)) {
      return lastSnapshot;
    }
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(`${failureMessage}: ${JSON.stringify(lastSnapshot)}`);
}

async function hostPreviewLobby(page) {
  return page.evaluate(async () => {
    const comms = await import("/src/ui/screens/CommsArrayScreen.ts");
    const field = await import("/src/field/FieldScreen.ts");
    const lobby = await comms.hostOrPreviewMultiplayerLobby("SMOKE");
    field.renderFieldScreen("network_lobby");
    return lobby?.returnContext ?? null;
  });
}

async function leaveLobby(page) {
  return page.evaluate(async () => {
    const comms = await import("/src/ui/screens/CommsArrayScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const field = await import("/src/field/FieldScreen.ts");
    await comms.leaveCurrentMultiplayerLobby();
    return {
      lobby: store.getGameState().lobby,
      mapId: field.getCurrentFieldRuntimeMap()?.id ?? null,
    };
  });
}

async function runReturnScenario(page, setup, expectedMapId, screenshotPath) {
  await setup(page);
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return Boolean(field.getCurrentFieldRuntimeMap());
  }, null, { timeout: 5000 });

  await joinLocalCoopP2(page);
  await toggleHybrid(page);
  await spreadPlayersAcrossCurrentField(page);

  const beforeLobby = await waitForFieldSnapshot(
    page,
    (snapshot) => snapshot.mapId === expectedMapId && snapshot.camera?.behavior === "hybrid" && snapshot.camera?.mode === "split" && snapshot.players.P2,
    `Expected ${expectedMapId} to be in hybrid split before entering the multiplayer lobby`,
  );

  const returnContext = await hostPreviewLobby(page);
  assertSmoke(returnContext?.kind === "field" && returnContext.mapId === expectedMapId, `Unexpected lobby return context for ${expectedMapId}: ${JSON.stringify(returnContext)}`);
  const lobbySnapshot = await waitForFieldSnapshot(
    page,
    (snapshot) => snapshot.mapId === "network_lobby" && snapshot.isHaven3D && snapshot.camera,
    "Expected host preview to enter the 3D network lobby field",
  );
  await page.screenshot({ path: networkLobbyScreenshotPath, fullPage: true });

  await leaveLobby(page);
  const afterReturn = await waitForFieldSnapshot(
    page,
    (snapshot) => snapshot.mapId === expectedMapId && snapshot.camera?.behavior === "hybrid" && snapshot.camera?.mode === "split" && snapshot.players.P2,
    `Expected ${expectedMapId} to restore hybrid split local co-op after leaving the lobby`,
    { attempts: 60, intervalMs: 150 },
  );

  assertSmoke(
    distanceBetween(beforeLobby.players.P1, afterReturn.players.P1) <= 12,
    `${expectedMapId} P1 did not restore to the captured field position.`,
  );
  assertSmoke(
    distanceBetween(beforeLobby.players.P2, afterReturn.players.P2) <= 12,
    `${expectedMapId} P2 did not restore to the captured field position.`,
  );

  await page.screenshot({ path: screenshotPath, fullPage: true });
  return { beforeLobby, lobbySnapshot, afterReturn };
}

async function runSmoke() {
  await waitForServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    await dismissMenuShell(page);

    const havenScenario = await runReturnScenario(
      page,
      setupBaseCamp,
      "base_camp",
      havenReturnScreenshotPath,
    );
    console.log("[multiplayer-return-smoke] Network lobby 3D:", JSON.stringify(havenScenario.lobbySnapshot, null, 2));
    console.log("[multiplayer-return-smoke] HAVEN return:", JSON.stringify(havenScenario.afterReturn, null, 2));

    console.log(`[multiplayer-return-smoke] Network lobby screenshot: ${networkLobbyScreenshotPath}`);
    console.log(`[multiplayer-return-smoke] HAVEN screenshot: ${havenReturnScreenshotPath}`);
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

runSmoke().catch((error) => {
  console.error("[multiplayer-return-smoke] failure");
  console.error(error);
  process.exitCode = 1;
});
