import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.HAVEN3D_SMOKE_PORT ?? 1431);
const baseUrl = `http://127.0.0.1:${port}`;
const splitScreenshotPath = join(tmpdir(), "chaos-apron-coop-split.png");
const merchantScreenshotPath = join(tmpdir(), "chaos-apron-coop-merchant.png");
const gliderScreenshotPath = join(tmpdir(), "chaos-apron-coop-glider.png");
const regroupScreenshotPath = join(tmpdir(), "chaos-apron-coop-regrouped.png");
const interiorScreenshotPath = join(tmpdir(), "chaos-apron-coop-interior.png");
const interiorReturnScreenshotPath = join(tmpdir(), "chaos-apron-coop-interior-return.png");
const branchReturnScreenshotPath = join(tmpdir(), "chaos-apron-coop-branch-return.png");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      // Server is still starting.
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function assertSmoke(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
  const joined = await page.evaluate(async () => {
    const coop = await import("/src/core/coop.ts");
    return coop.tryJoinAsP2();
  });
  assertSmoke(joined, "Player 2 failed to join local co-op in the Apron smoke.");
  await page.waitForFunction(async () => {
    const store = await import("/src/state/gameStore.ts");
    return Boolean(store.getGameState().players.P2.active);
  }, null, { timeout: 5000 });
  await page.waitForTimeout(250);
}

async function toggleHybrid(page) {
  await pressCanvasKey(page, "KeyV", { key: "v" });
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

async function pressCanvasKey(page, code, options = {}) {
  const key = options.key ?? code;
  await page.evaluate(({ nextCode, nextKey }) => {
    const canvas = document.querySelector(".haven3d-canvas");
    if (!(canvas instanceof HTMLElement)) {
      return;
    }
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent("keydown", {
      key: nextKey,
      code: nextCode,
      bubbles: true,
      cancelable: true,
    }));
  }, {
    nextCode: code,
    nextKey: key,
  });
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
  assertSmoke(moved, `Could not place Apron field players: ${JSON.stringify(positions)}`);
  await page.waitForTimeout(220);
}

async function readApronSnapshot(page) {
  return page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const controller = globalThis.__CHAOS_CURRENT_HAVEN3D_FIELD_CONTROLLER__;
    const map = controller?.options?.map ?? field.getCurrentFieldRuntimeMap();
    const runtime = field.getCurrentFieldRuntimeState();
    const camera = field.getCurrentHaven3DFieldCameraState?.() ?? controller?.getCameraState?.() ?? null;
    const p1Avatar = controller?.options?.getPlayerAvatar?.("P1") ?? (runtime ? {
      x: runtime.player.x,
      y: runtime.player.y,
      facing: runtime.player.facing,
    } : null);
    const p2Avatar = controller?.options?.getPlayerAvatar?.("P2") ?? field.getCurrentFieldPlayerAvatar?.("P2") ?? null;
    return {
      map: map ? {
        id: map.id,
        width: map.width,
        height: map.height,
        metadata: map.metadata ? {
          worldOriginTileX: map.metadata.worldOriginTileX,
          worldOriginTileY: map.metadata.worldOriginTileY,
          centerChunkX: map.metadata.centerChunkX,
          centerChunkY: map.metadata.centerChunkY,
          streamRadius: map.metadata.streamRadius,
        } : null,
      } : null,
      camera,
      players: {
        P1: p1Avatar,
        P2: p2Avatar,
      },
    };
  });
}

async function readFieldSnapshot(page) {
  return page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const controller = globalThis.__CHAOS_CURRENT_HAVEN3D_FIELD_CONTROLLER__;
    const map = field.getCurrentFieldRuntimeMap();
    const screen = document.body.dataset.screen ?? null;
    const screenMapId = screen?.startsWith("field-")
      ? screen.slice("field-".length)
      : null;
    const hasHaven3DCanvas = Boolean(document.querySelector(".haven3d-canvas"));
    return {
      screen,
      mapId: screenMapId ?? map?.id ?? null,
      camera: hasHaven3DCanvas ? (field.getCurrentHaven3DFieldCameraState?.() ?? null) : null,
      players: {
        P1: controller?.options?.getPlayerAvatar?.("P1") ?? field.getCurrentFieldPlayerAvatar?.("P1") ?? null,
        P2: controller?.options?.getPlayerAvatar?.("P2") ?? field.getCurrentFieldPlayerAvatar?.("P2") ?? null,
      },
    };
  });
}

async function readApronTraversalSnapshot(page) {
  return page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentHaven3DPlayerTraversalStates?.() ?? null;
  });
}

async function waitForApronTraversalState(
  page,
  predicate,
  failureMessage,
  options = {},
) {
  const attempts = options.attempts ?? 30;
  const intervalMs = options.intervalMs ?? 100;
  let lastState = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastState = await readApronTraversalSnapshot(page);
    if (predicate(lastState)) {
      return lastState;
    }
    await page.waitForTimeout(intervalMs);
  }

  throw new Error(`${failureMessage}: ${JSON.stringify(lastState)}`);
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

async function getInteractionZoneCenter(page, handlerId) {
  const center = await page.evaluate(async (requestedHandlerId) => {
    const field = await import("/src/field/FieldScreen.ts");
    const map = field.getCurrentFieldRuntimeMap();
    const zone = map?.interactionZones?.find((entry) => entry.metadata?.handlerId === requestedHandlerId) ?? null;
    if (!zone) {
      return null;
    }
    return {
      x: (zone.x + (zone.width / 2)) * 64,
      y: (zone.y + (zone.height / 2)) * 64,
      label: zone.label,
    };
  }, handlerId);
  assertSmoke(Boolean(center), `Could not find interaction zone for ${handlerId}.`);
  return center;
}

async function startBranchRewardReturn(page, zoneId = "counterweight_shaft") {
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
            label: zone.label,
            targetMapId: String(zone.metadata?.targetMapId ?? ""),
            worldX,
            worldY,
          };
        }
      }
    }

    return { entered: false };
  });
}

async function invokeInteractionHandler(page, handlerId) {
  return page.evaluate(async (requestedHandlerId) => {
    const field = await import("/src/field/FieldScreen.ts");
    const interactions = await import("/src/field/interactions.ts");
    const maps = await import("/src/field/maps.ts");
    const screen = document.body.dataset.screen ?? null;
    const screenMapId = screen?.startsWith("field-")
      ? screen.slice("field-".length)
      : null;
    const map = screenMapId ? maps.getFieldMap(screenMapId) : field.getCurrentFieldRuntimeMap();
    const zone = map?.interactionZones?.find((entry) => entry.metadata?.handlerId === requestedHandlerId) ?? null;
    if (!map || !zone) {
      return { invoked: false, mapId: map?.id ?? null };
    }
    await interactions.handleInteraction(zone, map, () => undefined, () => undefined);
    return { invoked: true, mapId: map.id };
  }, handlerId);
}

async function completeBranchAndReturn(page, zoneId = "counterweight_shaft") {
  return page.evaluate(async (requestedZoneId) => {
    const field = await import("/src/field/FieldScreen.ts");
    const outerDecks = await import("/src/core/outerDecks.ts");
    const store = await import("/src/state/gameStore.ts");
    const completionResult = outerDecks.claimOuterDeckCompletion(store.getGameState());
    store.setGameState(completionResult.state);
    field.setNextFieldSpawnOverrideTile("outer_deck_overworld", outerDecks.getOuterDeckOverworldReturnSpawn(requestedZoneId));
    field.renderFieldScreen("outer_deck_overworld");
    return {
      awardedRecipeId: completionResult.awardedRecipeId ?? null,
      expeditionActive: Boolean(store.getGameState().outerDecks?.activeExpedition),
      screen: document.body.dataset.screen ?? null,
    };
  }, zoneId);
}

async function runSmoke() {
  await waitForServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];

  try {
    page.on("console", (message) => {
      if (message.type() === "error") {
        const text = message.text();
        if (
          text.includes("Failed to load resource")
          && text.includes("404")
        ) {
          return;
        }
        consoleErrors.push(text);
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await dismissMenuShell(page);
    await setupOuterDeck(page);
    await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
    await page.waitForTimeout(800);

    await joinLocalCoopP2(page);
    await toggleHybrid(page);

    const initialSnapshot = await readApronSnapshot(page);
    assertSmoke(
      initialSnapshot.camera?.behavior === "hybrid" && initialSnapshot.camera?.mode === "shared",
      `Apron smoke did not start in hybrid shared view: ${JSON.stringify(initialSnapshot.camera)}`,
    );

    const merchantCenter = await getInteractionZoneCenter(page, "outer_deck_traveling_merchant");
    const mapWidthPx = Number(initialSnapshot.map?.width ?? 0) * 64;
    const midY = Math.max(
      merchantCenter?.y ?? 0,
      8 * 64,
      Math.floor((Number(initialSnapshot.map?.height ?? 0) / 2) * 64),
    );
    await setFieldPlayerPositions(page, [
      { playerId: "P1", x: mapWidthPx + (24 * 64), y: midY, facing: "west" },
      { playerId: "P2", x: merchantCenter.x, y: merchantCenter.y, facing: "west" },
    ]);

    await page.waitForFunction(async () => {
      const field = await import("/src/field/FieldScreen.ts");
      const map = field.getCurrentFieldRuntimeMap();
      const camera = field.getCurrentHaven3DFieldCameraState?.();
      return Boolean(
        map?.metadata?.streamRadius > 2
        && camera?.behavior === "hybrid"
        && camera?.mode === "split",
      );
    }, null, { timeout: 5000 });

    const splitSnapshot = await readApronSnapshot(page);
    const mapBoundsX = Number(splitSnapshot.map?.width ?? 0) * 64;
    const mapBoundsY = Number(splitSnapshot.map?.height ?? 0) * 64;
    assertSmoke(
      Number(splitSnapshot.map?.metadata?.streamRadius ?? 0) > 2
        && splitSnapshot.camera?.mode === "split"
        && splitSnapshot.players.P1
        && splitSnapshot.players.P1.x >= 0
        && splitSnapshot.players.P1.x <= mapBoundsX
        && splitSnapshot.players.P1.y >= 0
        && splitSnapshot.players.P1.y <= mapBoundsY
        && splitSnapshot.players.P2
        && splitSnapshot.players.P2.x >= 0
        && splitSnapshot.players.P2.x <= mapBoundsX
        && splitSnapshot.players.P2.y >= 0
        && splitSnapshot.players.P2.y <= mapBoundsY,
      `Apron split stream window did not expand cleanly for co-op: ${JSON.stringify(splitSnapshot)}`,
    );
    await page.screenshot({ path: splitScreenshotPath, fullPage: false });

    await page.evaluate(() => {
      const controller = globalThis.__CHAOS_CURRENT_HAVEN3D_FIELD_CONTROLLER__;
      if (!controller?.options) {
        return;
      }
      const previousHasUtility = controller.options.hasApronUtility?.bind(controller.options);
      controller.options.canUseGlider = () => true;
      controller.options.hasApronUtility = (playerId, itemId) => (
        itemId === "apron_glider"
        || previousHasUtility?.(playerId, itemId) === true
      );
      controller.tryStartPlayerJump?.("P2");
    });
    await page.waitForTimeout(180);
    await waitForApronTraversalState(
      page,
      (traversal) => Boolean(
        traversal?.P2
        && traversal.P2.grounded === false
        && traversal.P2.elevation > 0.45,
      ),
      "P2 never entered a clean airborne jump state in the Apron runtime",
    );
    await page.evaluate(() => {
      const controller = globalThis.__CHAOS_CURRENT_HAVEN3D_FIELD_CONTROLLER__;
      controller?.tryStartPlayerJump?.("P2");
    });
    const gliderTraversalState = await waitForApronTraversalState(
      page,
      (traversal) => traversal?.P2?.gliding === true,
      "P2 glider deployment did not stick in the Apron runtime",
    );
    await page.screenshot({ path: gliderScreenshotPath, fullPage: false });
    await waitForApronTraversalState(
      page,
      (traversal) => Boolean(
        traversal?.P2
        && traversal.P2.grounded === true
        && traversal.P2.gliding === false,
      ),
      "P2 glider never cleanly settled back to the ground",
      { attempts: 40, intervalMs: 120 },
    );

    const merchantTriggerState = await page.evaluate(async () => {
      if (document.querySelector(".shop-root")) {
        return { opened: true, triggered: false };
      }
      const field = await import("/src/field/FieldScreen.ts");
      return {
        opened: false,
        triggered: field.triggerFieldInteractionForPlayer("P2"),
      };
    });
    assertSmoke(
      merchantTriggerState.opened || merchantTriggerState.triggered,
      `P2 could not trigger the Apron merchant interaction: ${JSON.stringify(merchantTriggerState)}`,
    );
    await page.waitForSelector(".shop-root", { timeout: 10000 });
    await page.waitForTimeout(180);
    const merchantScreenState = await page.evaluate(() => ({
      screen: document.body.dataset.screen ?? null,
      hasShopRoot: Boolean(document.querySelector(".shop-root")),
      backButton: Boolean(document.querySelector("#backBtn")),
    }));
    assertSmoke(
      merchantScreenState.screen === "shop"
        && merchantScreenState.hasShopRoot
        && merchantScreenState.backButton,
      `Apron merchant did not open the shared shop screen from P2: ${JSON.stringify(merchantScreenState)}`,
    );
    await page.screenshot({ path: merchantScreenshotPath, fullPage: false });
    await page.locator("#backBtn").click();
    await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
    await page.waitForFunction(async () => {
      const field = await import("/src/field/FieldScreen.ts");
      const camera = field.getCurrentHaven3DFieldCameraState?.();
      return camera?.behavior === "hybrid" && camera.mode === "split";
    }, null, { timeout: 5000 });

    await setFieldPlayerPositions(page, [
      { playerId: "P1", x: (Number(splitSnapshot.map?.width ?? 0) / 2) * 64, y: midY, facing: "east" },
      { playerId: "P2", x: (Number(splitSnapshot.map?.width ?? 0) / 2) * 64 + (1.2 * 64), y: midY, facing: "east" },
    ]);

    await page.waitForFunction(async () => {
      const field = await import("/src/field/FieldScreen.ts");
      const map = field.getCurrentFieldRuntimeMap();
      const camera = field.getCurrentHaven3DFieldCameraState?.();
      return Boolean(
        map?.metadata?.streamRadius === 2
        && camera?.behavior === "hybrid"
        && camera?.mode === "shared",
      );
    }, null, { timeout: 5000 });

    const regroupedSnapshot = await readApronSnapshot(page);
    assertSmoke(
      Number(regroupedSnapshot.map?.metadata?.streamRadius ?? 0) === 2
        && regroupedSnapshot.camera?.mode === "shared",
      `Apron hybrid regroup did not collapse back to the default streamed window: ${JSON.stringify(regroupedSnapshot)}`,
    );
    await page.screenshot({ path: regroupScreenshotPath, fullPage: false });

    const interiorEntryState = await enterApronInterior(page);
    assertSmoke(
      interiorEntryState.entered,
      `Apron interior entry handler could not be invoked: ${JSON.stringify(interiorEntryState)}`,
    );
    const interiorSnapshot = await waitForFieldSnapshot(
      page,
      (snapshot) => Boolean(snapshot?.mapId?.startsWith("outerdeck_interior_")),
      "Apron interior entry did not load an interior field map",
    );
    assertSmoke(
      interiorSnapshot.screen?.startsWith("field-outerdeck_interior_"),
      `Apron interior entry landed on an unexpected screen shell: ${JSON.stringify(interiorSnapshot)}`,
    );
    await page.screenshot({ path: interiorScreenshotPath, fullPage: false });
    const interiorExitState = await invokeInteractionHandler(page, "outer_deck_interior_exit");
    assertSmoke(
      interiorExitState.invoked,
      `Apron interior exit did not invoke cleanly: ${JSON.stringify(interiorExitState)}`,
    );
    const postInteriorSnapshot = await waitForFieldSnapshot(
      page,
      (snapshot) => snapshot?.mapId === "outer_deck_overworld" && snapshot?.camera?.behavior === "hybrid",
      "Apron interior exit did not return to the 3D overworld with hybrid camera restored",
      { attempts: 50, intervalMs: 140 },
    );
    assertSmoke(
      postInteriorSnapshot.camera?.mode === "shared"
        && postInteriorSnapshot.players.P1
        && postInteriorSnapshot.players.P2
        && Math.hypot(
          postInteriorSnapshot.players.P1.x - postInteriorSnapshot.players.P2.x,
          postInteriorSnapshot.players.P1.y - postInteriorSnapshot.players.P2.y,
        ) <= 160,
      `Apron interior return did not regroup both players near the entrance: ${JSON.stringify(postInteriorSnapshot)}`,
    );
    await page.screenshot({ path: interiorReturnScreenshotPath, fullPage: false });

    const branchRewardMapId = await startBranchRewardReturn(page, "counterweight_shaft");
    const branchSnapshot = await waitForFieldSnapshot(
      page,
      (snapshot) => snapshot?.mapId === branchRewardMapId,
      "Apron branch reward route did not load the recovery node map",
    );
    assertSmoke(
      branchSnapshot.screen === `field-${branchRewardMapId}`,
      `Apron branch reward route opened an unexpected screen shell: ${JSON.stringify(branchSnapshot)}`,
    );
    const branchCompletionState = await completeBranchAndReturn(page, "counterweight_shaft");
    assertSmoke(
      branchCompletionState.expeditionActive === false,
      `Apron branch completion sequence did not clear the expedition state: ${JSON.stringify(branchCompletionState)}`,
    );
    const branchReturnSnapshot = await waitForFieldSnapshot(
      page,
      (snapshot) => snapshot?.mapId === "outer_deck_overworld" && snapshot?.camera?.behavior === "hybrid",
      "Apron branch completion did not return to the 3D overworld",
      { attempts: 50, intervalMs: 140 },
    );
    const branchExpeditionCleared = await page.evaluate(async () => {
      const store = await import("/src/state/gameStore.ts");
      return !store.getGameState().outerDecks?.activeExpedition;
    });
    assertSmoke(
      branchReturnSnapshot.camera?.mode === "shared"
        && branchReturnSnapshot.players.P1
        && branchReturnSnapshot.players.P2
        && Math.hypot(
          branchReturnSnapshot.players.P1.x - branchReturnSnapshot.players.P2.x,
          branchReturnSnapshot.players.P1.y - branchReturnSnapshot.players.P2.y,
        ) <= 160
        && branchExpeditionCleared,
      `Apron branch return did not restore co-op state cleanly: ${JSON.stringify({
        branchReturnSnapshot,
        branchExpeditionCleared,
      })}`,
    );
    await page.screenshot({ path: branchReturnScreenshotPath, fullPage: false });

    if (consoleErrors.length || pageErrors.length) {
      throw new Error(`Apron co-op smoke hit browser errors.\nConsole: ${consoleErrors.join("\n")}\nPage: ${pageErrors.join("\n")}`);
    }

    console.log(
      [
        "Apron co-op smoke passed.",
        `Split screenshot: ${splitScreenshotPath}`,
        `Merchant screenshot: ${merchantScreenshotPath}`,
        `Glider screenshot: ${gliderScreenshotPath}`,
        `Regroup screenshot: ${regroupScreenshotPath}`,
        `Interior screenshot: ${interiorScreenshotPath}`,
        `Interior return screenshot: ${interiorReturnScreenshotPath}`,
        `Branch return screenshot: ${branchReturnScreenshotPath}`,
      ].join("\n"),
    );
  } finally {
    await browser.close();
  }
}

runSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
