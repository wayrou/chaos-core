import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.HAVEN3D_SMOKE_PORT ?? 1431);
const baseUrl = `http://127.0.0.1:${port}`;
const networkLobbyScreenshotPath = join(tmpdir(), "chaos-multiplayer-network-lobby-3d.png");
const havenReturnScreenshotPath = join(tmpdir(), "chaos-multiplayer-return-haven.png");
const apronReturnScreenshotPath = join(tmpdir(), "chaos-multiplayer-return-apron.png");
const apronInteriorReturnScreenshotPath = join(tmpdir(), "chaos-multiplayer-return-apron-interior.png");
const apronBranchReturnScreenshotPath = join(tmpdir(), "chaos-multiplayer-return-apron-branch.png");

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

function getComparablePlayerPosition(snapshot, playerId) {
  if (snapshot?.mapId === "outer_deck_overworld" && snapshot.worldPlayers?.[playerId]) {
    return snapshot.worldPlayers[playerId];
  }
  return snapshot?.players?.[playerId] ?? null;
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

async function enterApronInterior(page) {
  return page.evaluate(async () => {
    const outerDecks = await import("/src/core/outerDecks.ts");
    const outerDeckWorld = await import("/src/field/outerDeckWorld.ts");
    const interactions = await import("/src/field/interactions.ts");
    const store = await import("/src/state/gameStore.ts");
    const chunkSizeTiles = 24;
    const tileSize = 64;
    const baseState = store.getGameState();
    const openWorld = outerDecks.getOuterDeckOpenWorldState(baseState);
    const baseChunkX = Math.floor((openWorld.playerWorldX / tileSize) / chunkSizeTiles);
    const baseChunkY = Math.floor((openWorld.playerWorldY / tileSize) / chunkSizeTiles);

    for (let radius = 2; radius <= 18; radius += 1) {
      for (let chunkY = baseChunkY - radius; chunkY <= baseChunkY + radius; chunkY += 1) {
        for (let chunkX = baseChunkX - radius; chunkX <= baseChunkX + radius; chunkX += 1) {
          const worldX = (((chunkX * chunkSizeTiles) + Math.floor(chunkSizeTiles / 2)) + 0.5) * tileSize;
          const worldY = (((chunkY * chunkSizeTiles) + Math.floor(chunkSizeTiles / 2)) + 0.5) * tileSize;
          let candidateState = outerDecks.setOuterDeckOpenWorldPlayerWorldPosition(baseState, worldX, worldY, "east");
          candidateState = outerDecks.setOuterDeckOpenWorldStreamWindow(candidateState, worldX, worldY, 2);
          const candidateMap = outerDeckWorld.createOuterDeckOpenWorldFieldMap(candidateState);
          const zone = candidateMap.interactionZones.find((entry) => entry.metadata?.handlerId === "outer_deck_interior_entry") ?? null;
          if (!zone) {
            continue;
          }

          store.setGameState(candidateState);
          await interactions.handleInteraction(zone, candidateMap, () => undefined, () => undefined);
          return {
            entered: true,
            targetMapId: String(zone.metadata?.targetMapId ?? ""),
          };
        }
      }
    }

    return { entered: false, targetMapId: "" };
  });
}

async function startBranchRewardMap(page, zoneId = "counterweight_shaft") {
  return page.evaluate(async (requestedZoneId) => {
    const field = await import("/src/field/FieldScreen.ts");
    const outerDecks = await import("/src/core/outerDecks.ts");
    const store = await import("/src/state/gameStore.ts");
    let state = store.getGameState();
    state = outerDecks.beginOuterDeckExpedition(state, requestedZoneId);
    const rewardSubarea = outerDecks.getOuterDeckZoneDefinition(requestedZoneId).subareas.find((subarea) => subarea.kind === "reward");
    if (!rewardSubarea) {
      throw new Error(`No reward subarea found for ${requestedZoneId}.`);
    }
    const expedition = state.outerDecks?.activeExpedition;
    if (!expedition) {
      throw new Error(`No active expedition was created for ${requestedZoneId}.`);
    }
    state = {
      ...state,
      outerDecks: {
        ...state.outerDecks,
        activeExpedition: {
          ...expedition,
          currentSubareaId: rewardSubarea.id,
          clearedSubareaIds: Array.from(new Set([
            ...(expedition.clearedSubareaIds ?? []),
            rewardSubarea.id,
          ])),
        },
      },
    };
    store.setGameState(state);
    field.renderFieldScreen(rewardSubarea.mapId);
    return rewardSubarea.mapId;
  }, zoneId);
}

async function setupOuterDeckInterior(page) {
  await setupOuterDeck(page);
  const result = await enterApronInterior(page);
  assertSmoke(result?.entered && result?.targetMapId, `Failed to enter an Apron interior for the multiplayer return smoke: ${JSON.stringify(result)}`);
  return result.targetMapId;
}

async function setupOuterDeckBranch(page) {
  await setupOuterDeck(page);
  const mapId = await startBranchRewardMap(page, "counterweight_shaft");
  assertSmoke(Boolean(mapId), "Failed to load an Apron branch reward map for the multiplayer return smoke.");
  return mapId;
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
    const spawnResolver = await import("/src/field/spawnResolver.ts");
    const map = field.getCurrentFieldRuntimeMap();
    if (!map) {
      return null;
    }
    const tileSize = 64;
    const spawnSource = typeof map.id === "string" && map.id.startsWith("keyroom_") ? "FCP" : "normal";
    const y = Math.max(3.5, Math.min(map.height - 3.5, map.height * 0.45)) * tileSize;
    const p1TargetX = Math.max(3.5, Math.min(map.width - 3.5, map.width * 0.28)) * tileSize;
    const p2TargetX = Math.max(3.5, Math.min(map.width - 3.5, map.width * 0.72)) * tileSize;
    const p1Spawn = spawnResolver.resolvePlayerSpawn(
      spawnSource,
      map,
      { x: p1TargetX, y },
    );
    const p2Spawn = spawnResolver.resolvePlayerSpawn(
      spawnSource,
      map,
      { x: p2TargetX, y },
    );
    return [
      { playerId: "P1", x: p1Spawn.x, y: p1Spawn.y, facing: "east" },
      { playerId: "P2", x: p2Spawn.x, y: p2Spawn.y, facing: "west" },
    ];
  });
  assertSmoke(Boolean(positions), "Unable to compute field positions for the multiplayer return smoke.");
  await setFieldPlayerPositions(page, positions);
}

async function readFieldSnapshot(page) {
  return page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const outerDeckWorld = await import("/src/field/outerDeckWorld.ts");
    const controller = globalThis.__CHAOS_CURRENT_HAVEN3D_FIELD_CONTROLLER__;
    const map = field.getCurrentFieldRuntimeMap();
    const isOuterDeckOpenWorld = outerDeckWorld.isOuterDeckOpenWorldMap(map);
    const p1Avatar = controller?.options?.getPlayerAvatar?.("P1") ?? field.getCurrentFieldPlayerAvatar?.("P1") ?? null;
    const p2Avatar = controller?.options?.getPlayerAvatar?.("P2") ?? field.getCurrentFieldPlayerAvatar?.("P2") ?? null;
    return {
      mapId: map?.id ?? null,
      isHaven3D: Boolean(document.querySelector(".field-root--haven3d .haven3d-canvas")),
      camera: controller?.getCameraState?.() ?? field.getCurrentHaven3DFieldCameraState?.() ?? field.getStoredHaven3DFieldCameraState?.(map?.id ?? "") ?? null,
      players: {
        P1: p1Avatar,
        P2: p2Avatar,
      },
      worldPlayers: isOuterDeckOpenWorld && map ? {
        P1: p1Avatar ? outerDeckWorld.outerDeckLocalPixelToWorld(map, p1Avatar.x, p1Avatar.y) : null,
        P2: p2Avatar ? outerDeckWorld.outerDeckLocalPixelToWorld(map, p2Avatar.x, p2Avatar.y) : null,
      } : null,
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

async function waitForStableComparableSnapshot(page, seedSnapshot, options = {}) {
  const attempts = options.attempts ?? 24;
  const intervalMs = options.intervalMs ?? 120;
  const requiredStableReads = options.requiredStableReads ?? 3;
  let baseline = seedSnapshot;
  let stableReads = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await page.waitForTimeout(intervalMs);
    const snapshot = await readFieldSnapshot(page);
    const p1Distance = distanceBetween(getComparablePlayerPosition(baseline, "P1"), getComparablePlayerPosition(snapshot, "P1"));
    const p2Distance = distanceBetween(getComparablePlayerPosition(baseline, "P2"), getComparablePlayerPosition(snapshot, "P2"));
    if (p1Distance <= 1 && p2Distance <= 1) {
      stableReads += 1;
      baseline = snapshot;
      if (stableReads >= requiredStableReads) {
        return snapshot;
      }
      continue;
    }
    baseline = snapshot;
    stableReads = 0;
  }
  return baseline;
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

async function runReturnScenario(page, setup, fallbackExpectedMapId, screenshotPath) {
  await dismissMenuShell(page);
  const setupResult = await setup(page);
  const expectedMapId = typeof setupResult === "string" && setupResult.length > 0
    ? setupResult
    : fallbackExpectedMapId;
  assertSmoke(Boolean(expectedMapId), `Missing expected field map id for multiplayer return scenario: ${String(screenshotPath)}`);
  await page.waitForFunction(async (targetMapId) => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentFieldRuntimeMap()?.id === targetMapId;
  }, expectedMapId, { timeout: 10000 });
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return Boolean(field.getCurrentFieldRuntimeMap());
  }, null, { timeout: 5000 });

  await joinLocalCoopP2(page);
  await toggleHybrid(page);
  await spreadPlayersAcrossCurrentField(page);

  let beforeLobby = await waitForFieldSnapshot(
    page,
    (snapshot) => snapshot.mapId === expectedMapId && snapshot.camera?.behavior === "hybrid" && snapshot.camera?.mode === "split" && snapshot.players.P2,
    `Expected ${expectedMapId} to be in hybrid split before entering the multiplayer lobby`,
  );
  if (expectedMapId === "outer_deck_overworld") {
    beforeLobby = await waitForStableComparableSnapshot(page, beforeLobby);
  }

  const returnContext = await hostPreviewLobby(page);
  assertSmoke(returnContext?.kind === "field" && returnContext.mapId === expectedMapId, `Unexpected lobby return context for ${expectedMapId}: ${JSON.stringify(returnContext)}`);
  const expectedReturnPositions = expectedMapId === "outer_deck_overworld"
    ? returnContext?.outerDeckWorldPlayers ?? null
    : null;
  const lobbySnapshot = await waitForFieldSnapshot(
    page,
    (snapshot) => snapshot.mapId === "network_lobby" && snapshot.isHaven3D && snapshot.camera,
    "Expected host preview to enter the 3D network lobby field",
  );
  await page.screenshot({ path: networkLobbyScreenshotPath, fullPage: true });

  await leaveLobby(page);
  const afterReturn = await waitForFieldSnapshot(
    page,
    (snapshot) => {
      const restoredLayout = snapshot.mapId === expectedMapId
        && snapshot.camera?.behavior === "hybrid"
        && snapshot.camera?.mode === "split"
        && snapshot.players.P2;
      if (!restoredLayout) {
        return false;
      }
      if (expectedMapId !== "outer_deck_overworld") {
        return true;
      }
      return (
        distanceBetween(expectedReturnPositions?.P1 ?? null, getComparablePlayerPosition(snapshot, "P1")) <= 12
        && distanceBetween(expectedReturnPositions?.P2 ?? null, getComparablePlayerPosition(snapshot, "P2")) <= 12
      );
    },
    `Expected ${expectedMapId} to restore hybrid split local co-op after leaving the lobby. Before=${JSON.stringify({
      P1: expectedReturnPositions?.P1 ?? getComparablePlayerPosition(beforeLobby, "P1"),
      P2: expectedReturnPositions?.P2 ?? getComparablePlayerPosition(beforeLobby, "P2"),
    })}`,
    { attempts: 80, intervalMs: 150 },
  );

  assertSmoke(
    distanceBetween(expectedReturnPositions?.P1 ?? getComparablePlayerPosition(beforeLobby, "P1"), getComparablePlayerPosition(afterReturn, "P1")) <= 12,
    `${expectedMapId} P1 did not restore to the captured field position. Before=${JSON.stringify(expectedReturnPositions?.P1 ?? getComparablePlayerPosition(beforeLobby, "P1"))} After=${JSON.stringify(getComparablePlayerPosition(afterReturn, "P1"))}`,
  );
  assertSmoke(
    distanceBetween(expectedReturnPositions?.P2 ?? getComparablePlayerPosition(beforeLobby, "P2"), getComparablePlayerPosition(afterReturn, "P2")) <= 12,
    `${expectedMapId} P2 did not restore to the captured field position. Before=${JSON.stringify(expectedReturnPositions?.P2 ?? getComparablePlayerPosition(beforeLobby, "P2"))} After=${JSON.stringify(getComparablePlayerPosition(afterReturn, "P2"))}`,
  );

  await page.screenshot({ path: screenshotPath, fullPage: true });
  return { beforeLobby, lobbySnapshot, afterReturn };
}

async function runSmoke() {
  await waitForServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    const havenScenario = await runReturnScenario(
      page,
      setupBaseCamp,
      "base_camp",
      havenReturnScreenshotPath,
    );
    const apronScenario = await runReturnScenario(
      page,
      setupOuterDeck,
      "outer_deck_overworld",
      apronReturnScreenshotPath,
    );
    const apronInteriorScenario = await runReturnScenario(
      page,
      setupOuterDeckInterior,
      null,
      apronInteriorReturnScreenshotPath,
    );
    const apronBranchScenario = await runReturnScenario(
      page,
      setupOuterDeckBranch,
      null,
      apronBranchReturnScreenshotPath,
    );
    console.log("[multiplayer-return-smoke] Network lobby 3D:", JSON.stringify(havenScenario.lobbySnapshot, null, 2));
    console.log("[multiplayer-return-smoke] HAVEN return:", JSON.stringify(havenScenario.afterReturn, null, 2));
    console.log("[multiplayer-return-smoke] Apron return:", JSON.stringify(apronScenario.afterReturn, null, 2));
    console.log("[multiplayer-return-smoke] Apron interior return:", JSON.stringify(apronInteriorScenario.afterReturn, null, 2));
    console.log("[multiplayer-return-smoke] Apron branch return:", JSON.stringify(apronBranchScenario.afterReturn, null, 2));

    console.log(`[multiplayer-return-smoke] Network lobby screenshot: ${networkLobbyScreenshotPath}`);
    console.log(`[multiplayer-return-smoke] HAVEN screenshot: ${havenReturnScreenshotPath}`);
    console.log(`[multiplayer-return-smoke] Apron screenshot: ${apronReturnScreenshotPath}`);
    console.log(`[multiplayer-return-smoke] Apron interior screenshot: ${apronInteriorReturnScreenshotPath}`);
    console.log(`[multiplayer-return-smoke] Apron branch screenshot: ${apronBranchReturnScreenshotPath}`);
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
