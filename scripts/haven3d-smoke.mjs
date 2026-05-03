import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const port = Number(process.env.HAVEN3D_SMOKE_PORT ?? 1431);
const baseUrl = `http://127.0.0.1:${port}`;
const sharedScreenshotPath = join(tmpdir(), "chaos-haven3d-shared.png");
const splitScreenshotPath = join(tmpdir(), "chaos-haven3d-split.png");
const p2ShopScreenshotPath = join(tmpdir(), "chaos-haven3d-p2-shop.png");
const screenshotPath = sharedScreenshotPath;
const canvasPath = join(tmpdir(), "chaos-haven3d-smoke-canvas.png");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(processHandle) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Vite exited before smoke test could connect. Exit code: ${processHandle.exitCode}`);
    }

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

function getCanvasStats(buffer) {
  const png = PNG.sync.read(buffer);
  let colored = 0;
  let nonTransparent = 0;

  for (let index = 0; index < png.data.length; index += 4) {
    const r = png.data[index];
    const g = png.data[index + 1];
    const b = png.data[index + 2];
    const a = png.data[index + 3];
    if (a > 0) {
      nonTransparent += 1;
    }
    if (a > 0 && (Math.max(r, g, b) - Math.min(r, g, b) > 3 || Math.max(r, g, b) > 20)) {
      colored += 1;
    }
  }

  return {
    width: png.width,
    height: png.height,
    coloredRatio: colored / Math.max(1, nonTransparent),
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function setupBaseCamp(page) {
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const initial = await import("/src/core/initialState.ts");
    const campaign = await import("/src/core/campaign.ts");
    const settings = await import("/src/core/settings.ts");
    store.setGameState(initial.createNewGameState());
    await settings.updateSettings({
      showTutorialHints: false,
      dismissedTutorialHintIds: ["tutorial_haven_field", "tutorial_outer_deck_beta"],
    });
    campaign.saveCampaignProgress({
      ...campaign.createDefaultCampaignProgress(),
      highestReachedFloorOrdinal: 10,
    });
    field.renderFieldScreen("base_camp");
  });
}

function assertSmoke(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function angleDeltaRadians(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function getActiveCameraView(state, playerId = "P1") {
  if (!state) {
    return null;
  }
  if (typeof state.distance === "number") {
    return state;
  }
  if (state.mode === "split") {
    return state.split?.[playerId] ?? state.shared ?? null;
  }
  return state.shared ?? null;
}

async function triggerPrimaryAction(page, canvas) {
  const box = await canvas.boundingBox();
  assertSmoke(Boolean(box), "HAVEN 3D canvas was not measurable for primary action.");
  await page.evaluate(() => {
    const canvasElement = document.querySelector(".haven3d-canvas");
    if (!(canvasElement instanceof HTMLCanvasElement)) {
      return;
    }
    canvasElement.focus();
    canvasElement.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  });
}

async function readHaven3DCameraState(page, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const state = await page.evaluate(async () => {
      const field = await import("/src/field/FieldScreen.ts");
      return field.getCurrentHaven3DFieldCameraState();
    });
    if (state) {
      return state;
    }
    await page.waitForTimeout(100);
  }

  const debugState = await page.evaluate(() => ({
    screen: document.body.dataset.screen ?? null,
    hasFieldRoot: Boolean(document.querySelector(".field-root--haven3d")),
    hasCanvas: Boolean(document.querySelector("canvas.haven3d-canvas")),
    prompt: document.querySelector("[data-haven3d-prompt]")?.textContent ?? null,
  }));
  return { __debug: debugState };
}

async function readHaven3DPlayerCombatStates(page, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const state = await page.evaluate(async () => {
      const field = await import("/src/field/FieldScreen.ts");
      return field.getCurrentHaven3DPlayerCombatStates?.() ?? null;
    });
    if (state) {
      return state;
    }
    await page.waitForTimeout(80);
  }
  return null;
}

async function ensureSplitHudMode(page, playerId, requestedMode) {
  const selector = `.haven3d-split-pane[data-haven3d-player="${playerId}"] [data-gearblade-mode-selector]`;
  const activeMode = await page.locator(selector).getAttribute("data-active-mode");
  if (activeMode === requestedMode) {
    return;
  }

  const clicked = await page.evaluate(({ playerId: requestedPlayerId, requestedMode: mode }) => {
    const button = document.querySelector(
      `.haven3d-split-pane[data-haven3d-player="${requestedPlayerId}"] [data-haven3d-mode="${mode}"]`,
    );
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }
    button.click();
    return true;
  }, { playerId, requestedMode });
  assertSmoke(clicked, `Missing split HUD mode button for ${playerId} -> ${requestedMode}.`);
  await page.waitForFunction(
    ({ playerId: requestedPlayerId, mode }) => document
      .querySelector(`.haven3d-split-pane[data-haven3d-player="${requestedPlayerId}"] [data-gearblade-mode-selector]`)
      ?.getAttribute("data-active-mode") === mode,
    { playerId, mode: requestedMode },
    { timeout: 2000 },
  );
}

async function joinLocalCoopP2(page) {
  const joined = await page.evaluate(async () => {
    const coop = await import("/src/core/coop.ts");
    return coop.tryJoinAsP2();
  });
  assertSmoke(joined, "Player 2 failed to join local co-op.");
  await page.waitForFunction(async () => {
    const store = await import("/src/state/gameStore.ts");
    const state = store.getGameState();
    return Boolean(state.players.P2.active && state.players.P2.avatar);
  }, null, { timeout: 5000 });
  await page.waitForTimeout(220);
}

async function dropLocalCoopP2(page) {
  const dropped = await page.evaluate(async () => {
    const coop = await import("/src/core/coop.ts");
    return coop.dropOutP2();
  });
  assertSmoke(dropped, "Player 2 failed to drop out of local co-op.");
  await page.waitForFunction(async () => {
    const store = await import("/src/state/gameStore.ts");
    return store.getGameState().players.P2.active === false;
  }, null, { timeout: 5000 });
  await page.waitForTimeout(220);
}

async function setFieldPlayerPositions(page, positions) {
  const moved = await page.evaluate(async (requestedPositions) => {
    const field = await import("/src/field/FieldScreen.ts");
    return requestedPositions.every((entry) =>
      field.setCurrentFieldPlayerPosition(entry.playerId, entry.x, entry.y, entry.facing),
    );
  }, positions);
  assertSmoke(moved, `Could not place field players: ${JSON.stringify(positions)}`);
  await page.waitForTimeout(220);
}

async function movePlayersForP2ShopEntry(page) {
  const moved = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");

    const tileSize = 64;
    const map = field.getCurrentFieldRuntimeMap();
    const shopZone = map?.interactionZones.find((zone) => zone.id === "interact_shop");
    if (!map || !shopZone) {
      return false;
    }

    const p1Avatar = {
      x: 20.5 * tileSize,
      y: 18.5 * tileSize,
      facing: "south",
    };
    const p2Avatar = {
      x: (shopZone.x + shopZone.width / 2) * tileSize,
      y: (shopZone.y + shopZone.height / 2) * tileSize,
      facing: "north",
    };

    return (
      field.setCurrentFieldPlayerPosition("P1", p1Avatar.x, p1Avatar.y, p1Avatar.facing)
      && field.setCurrentFieldPlayerPosition("P2", p2Avatar.x, p2Avatar.y, p2Avatar.facing)
    );
  });
  assertSmoke(moved, "Could not stage Player 2 shop entry.");
  await page.waitForTimeout(180);
}

async function setGearbladeMode(page, mode, key) {
  const fieldVisible = await page
    .waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (!fieldVisible) {
    const screenState = await page.evaluate(() => ({
      screen: document.body.dataset.screen,
      hasFieldRoot: Boolean(document.querySelector(".field-root--haven3d")),
      hasCanvas: Boolean(document.querySelector(".haven3d-canvas")),
      hasShopRoot: Boolean(document.querySelector(".shop-root")),
      modeHotspotCount: document.querySelectorAll("[data-haven3d-mode]").length,
      activeMode: document.querySelector("[data-gearblade-mode-selector]")?.getAttribute("data-active-mode") ?? null,
      appClass: document.getElementById("app")?.firstElementChild?.className ?? null,
    }));
    throw new Error(`HAVEN 3D field missing before switching to ${mode}: ${JSON.stringify(screenState)}`);
  }
  await page.evaluate(() => document.querySelector(".haven3d-canvas")?.focus());
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
  const isActive = await page
    .locator(`[data-gearblade-mode-selector][data-active-mode="${mode}"]`)
    .count()
    .then((count) => count > 0);
  if (!isActive) {
    const hasModeHotspot = await page.locator(`[data-haven3d-mode="${mode}"]`).count().then((count) => count > 0);
    if (!hasModeHotspot) {
      const screenState = await page.evaluate(() => ({
        screen: document.body.dataset.screen,
        hasFieldRoot: Boolean(document.querySelector(".field-root--haven3d")),
        hasCanvas: Boolean(document.querySelector(".haven3d-canvas")),
        hasShopRoot: Boolean(document.querySelector(".shop-root")),
        modeHotspotCount: document.querySelectorAll("[data-haven3d-mode]").length,
        activeMode: document.querySelector("[data-gearblade-mode-selector]")?.getAttribute("data-active-mode") ?? null,
        appClass: document.getElementById("app")?.firstElementChild?.className ?? null,
      }));
      throw new Error(`HAVEN 3D mode hotspot missing for ${mode}: ${JSON.stringify(screenState)}`);
    }
    await page.locator(`[data-haven3d-mode="${mode}"]`).click();
  }
  await page.waitForFunction(
    (requestedMode) => document
      .querySelector("[data-gearblade-mode-selector]")
      ?.getAttribute("data-active-mode") === requestedMode,
    mode,
  );
}

async function cycleUntilTarget(page, label, attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await page.keyboard.press("KeyZ");
    await page.waitForTimeout(120);
    const promptText = await page.locator("[data-haven3d-prompt]").innerText().catch(() => "");
    if (promptText.includes(label)) {
      return;
    }
  }

  throw new Error(`Could not Z-target ${label}.`);
}

async function runSmoke() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".splash-screen", { timeout: 5000 }).catch(() => undefined);
  if (await page.locator("#splashSkipBtn").count()) {
    await page.locator("#splashSkipBtn").click();
  } else {
    await page.mouse.click(20, 20);
  }
  await page.waitForSelector('button[data-action="new-op"], .mainmenu-root', { timeout: 10000 }).catch(() => undefined);
  await setupBaseCamp(page);
  await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
  await page.waitForTimeout(500);

  const canvas = page.locator(".haven3d-canvas").first();
  const canvasShot = await canvas.screenshot({ path: canvasPath });
  await page.screenshot({ path: sharedScreenshotPath, fullPage: false });
  const canvasStats = getCanvasStats(canvasShot);
  assertSmoke(canvasStats.coloredRatio > 0.5, `HAVEN 3D canvas looks blank: ${JSON.stringify(canvasStats)}`);

  await page.evaluate(() => {
    const canvas = document.querySelector(".haven3d-canvas");
    canvas?.focus();
    canvas?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "v",
      code: "KeyV",
      bubbles: true,
      cancelable: true,
    }));
  });
  await page.waitForTimeout(180);
  const splitCameraState = await readHaven3DCameraState(page);
  const splitHudState = await page.evaluate(() => ({
    sharedHidden: (document.querySelector("[data-haven3d-shared-ui]") instanceof HTMLElement)
      ? document.querySelector("[data-haven3d-shared-ui]").hidden
      : null,
    splitHidden: (document.querySelector("[data-haven3d-split-ui]") instanceof HTMLElement)
      ? document.querySelector("[data-haven3d-split-ui]").hidden
      : null,
    sharedDisplay: (document.querySelector("[data-haven3d-shared-ui]") instanceof HTMLElement)
      ? getComputedStyle(document.querySelector("[data-haven3d-shared-ui]")).display
      : null,
    splitDisplay: (document.querySelector("[data-haven3d-split-ui]") instanceof HTMLElement)
      ? getComputedStyle(document.querySelector("[data-haven3d-split-ui]")).display
      : null,
    splitToggleDisabled: (document.querySelector("[data-haven3d-coop-action='toggle-split']") instanceof HTMLButtonElement)
      ? document.querySelector("[data-haven3d-coop-action='toggle-split']").disabled
      : null,
  }));
  assertSmoke(
    splitCameraState?.mode === "shared"
      && splitCameraState?.behavior === "shared"
      && splitHudState.sharedHidden === false
      && splitHudState.splitHidden === true
      && splitHudState.sharedDisplay !== "none"
      && splitHudState.splitDisplay === "none"
      && splitHudState.splitToggleDisabled === true,
    `Solo HAVEN 3D should stay in shared mode with split HUD hidden: ${JSON.stringify({ splitCameraState, splitHudState })}`,
  );

  await joinLocalCoopP2(page);
  await setFieldPlayerPositions(page, [
    { playerId: "P1", x: 18.5 * 64, y: 18.5 * 64, facing: "south" },
    { playerId: "P2", x: 20 * 64, y: 18.5 * 64, facing: "south" },
  ]);

  await page.evaluate(() => {
    const canvas = document.querySelector(".haven3d-canvas");
    canvas?.focus();
    canvas?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "v",
      code: "KeyV",
      bubbles: true,
      cancelable: true,
    }));
  });
  await page.waitForTimeout(220);
  const hybridCameraState = await readHaven3DCameraState(page);
  assertSmoke(
    hybridCameraState?.behavior === "hybrid"
      && hybridCameraState?.mode === "shared",
    `Co-op hybrid camera did not enable from a close regroup: ${JSON.stringify(hybridCameraState)}`,
  );

  await setFieldPlayerPositions(page, [
    { playerId: "P1", x: 18.5 * 64, y: 18.5 * 64, facing: "south" },
    { playerId: "P2", x: 24 * 64, y: 18.5 * 64, facing: "south" },
  ]);
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentHaven3DFieldCameraState()?.mode === "split";
  }, null, { timeout: 3000 });
  const coopSplitCameraState = await readHaven3DCameraState(page);
  assertSmoke(
    coopSplitCameraState?.behavior === "hybrid"
      && coopSplitCameraState?.mode === "split",
    `Co-op hybrid camera did not auto-split when players separated: ${JSON.stringify(coopSplitCameraState)}`,
  );

  await ensureSplitHudMode(page, "P1", "launcher");
  await ensureSplitHudMode(page, "P2", "grapple");
  await page.waitForTimeout(120);

  const splitModeHudState = await page.evaluate(() => ({
    P1: document
      .querySelector('.haven3d-split-pane[data-haven3d-player="P1"] [data-gearblade-mode-selector]')
      ?.getAttribute("data-active-mode") ?? null,
    P2: document
      .querySelector('.haven3d-split-pane[data-haven3d-player="P2"] [data-gearblade-mode-selector]')
      ?.getAttribute("data-active-mode") ?? null,
  }));
  const splitCombatState = await readHaven3DPlayerCombatStates(page);
  assertSmoke(
    splitModeHudState.P1 === "launcher"
      && splitModeHudState.P2 === "grapple"
      && splitCombatState?.P1?.gearbladeMode === "launcher"
      && splitCombatState?.P2?.gearbladeMode === "grapple",
    `Split per-player modes did not persist independently: ${JSON.stringify({ splitModeHudState, splitCombatState })}`,
  );
  await page.screenshot({ path: splitScreenshotPath, fullPage: false });

  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(100);
  const afterP1ActionState = await readHaven3DPlayerCombatStates(page);
  assertSmoke(
    (afterP1ActionState?.P1?.attackCooldown ?? 0) > 0
      && (afterP1ActionState?.P1?.gearbladeMode ?? null) === "launcher",
    `P1 action did not update independent combat state: ${JSON.stringify(afterP1ActionState)}`,
  );

  await ensureSplitHudMode(page, "P2", "blade");
  await page.keyboard.press("Numpad0");
  await page.waitForTimeout(60);
  const afterP2ActionState = await readHaven3DPlayerCombatStates(page);
  assertSmoke(
    ((afterP2ActionState?.P2?.attackCooldown ?? 0) > 0 || (afterP2ActionState?.P2?.isAttacking ?? false))
      && (afterP2ActionState?.P2?.gearbladeMode ?? null) === "blade",
    `P2 action did not update independent combat state: ${JSON.stringify(afterP2ActionState)}`,
  );

  await movePlayersForP2ShopEntry(page);
  const p2ShopTriggerState = await page.evaluate(async () => {
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
    p2ShopTriggerState.opened || p2ShopTriggerState.triggered,
    `P2 could not trigger the current HAVEN field interaction: ${JSON.stringify(p2ShopTriggerState)}`,
  );
  await page.waitForSelector(".shop-root", { timeout: 10000 });
  await page.waitForTimeout(180);
  const p2ShopScreenState = await page.evaluate(() => ({
    screen: document.body.dataset.screen ?? null,
    hasShopRoot: Boolean(document.querySelector(".shop-root")),
    backButton: Boolean(document.querySelector("#backBtn")),
  }));
  assertSmoke(
    p2ShopScreenState.screen === "shop"
      && p2ShopScreenState.hasShopRoot
      && p2ShopScreenState.backButton,
    `P2 HAVEN building interaction did not open the shared shop screen: ${JSON.stringify(p2ShopScreenState)}`,
  );
  await page.screenshot({ path: p2ShopScreenshotPath, fullPage: false });
  await page.locator("#backBtn").click();
  await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
  await page.waitForTimeout(420);
  const postP2ReturnState = await page.evaluate(() => ({
    screen: document.body.dataset.screen ?? null,
    hasShopRoot: Boolean(document.querySelector(".shop-root")),
    hasFieldCanvas: Boolean(document.querySelector(".field-root--haven3d canvas.haven3d-canvas")),
  }));
  const postP2ReturnCameraState = await readHaven3DCameraState(page);
  assertSmoke(
    postP2ReturnState.hasFieldCanvas
      && !postP2ReturnState.hasShopRoot
      && postP2ReturnCameraState?.behavior === "hybrid"
      && (postP2ReturnCameraState?.mode === "shared" || postP2ReturnCameraState?.mode === "split"),
    `P2 field return did not restore the hybrid HAVEN runtime cleanly: ${JSON.stringify({ postP2ReturnState, postP2ReturnCameraState })}`,
  );

  await setFieldPlayerPositions(page, [
    { playerId: "P1", x: 22 * 64, y: 18.5 * 64, facing: "south" },
    { playerId: "P2", x: 23.8 * 64, y: 18.5 * 64, facing: "south" },
  ]);
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentHaven3DFieldCameraState()?.mode === "shared";
  }, null, { timeout: 3000 });
  const regroupedHybridCameraState = await readHaven3DCameraState(page);
  assertSmoke(
    regroupedHybridCameraState?.behavior === "hybrid"
      && regroupedHybridCameraState?.mode === "shared",
    `Hybrid HAVEN camera did not merge back to shared after regrouping: ${JSON.stringify(regroupedHybridCameraState)}`,
  );

  await page.evaluate(() => {
    const canvas = document.querySelector(".haven3d-canvas");
    canvas?.focus();
    canvas?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "v",
      code: "KeyV",
      bubbles: true,
      cancelable: true,
    }));
  });
  await page.waitForTimeout(180);
  const restoredSharedAfterCoopState = await readHaven3DCameraState(page);
  assertSmoke(
    restoredSharedAfterCoopState?.behavior === "shared"
      && restoredSharedAfterCoopState?.mode === "shared",
    `Co-op smoke cleanup did not restore shared camera mode: ${JSON.stringify(restoredSharedAfterCoopState)}`,
  );

  await dropLocalCoopP2(page);
  const postDropState = await page.evaluate(async () => {
    const store = await import("/src/state/gameStore.ts");
    const state = store.getGameState();
    return {
      p2Active: state.players.P2.active,
      p2Avatar: state.players.P2.avatar,
    };
  });
  assertSmoke(
    postDropState.p2Active === false && postDropState.p2Avatar === null,
    `P2 drop-out did not cleanly clear local co-op state: ${JSON.stringify(postDropState)}`,
  );

  const havenBuildingCollision = await page.evaluate(async () => {
    const maps = await import("/src/field/maps.ts");
    const map = maps.getFieldMap("base_camp");
    const shop = map.objects.find((object) => object.id === "shop_station");
    const shopDoor = map.interactionZones.find((zone) => zone.id === "interact_shop");
    const outerGate = map.objects.find((object) => object.id === "haven_outer_deck_south_gate");
    return {
      width: map.width,
      height: map.height,
      shopBodyWalkable: shop ? map.tiles[shop.y]?.[shop.x]?.walkable ?? null : null,
      shopDoorWalkable: shopDoor ? map.tiles[shopDoor.y]?.[shopDoor.x]?.walkable ?? null : null,
      shopDoorAuto: shopDoor?.metadata?.autoTrigger === true,
      outerGateBodyWalkable: outerGate ? map.tiles[outerGate.y]?.[outerGate.x]?.walkable ?? null : null,
    };
  });
  assertSmoke(
    havenBuildingCollision.width >= 80
      && havenBuildingCollision.height >= 50
      && havenBuildingCollision.shopBodyWalkable === false
      && havenBuildingCollision.shopDoorWalkable === true
      && havenBuildingCollision.shopDoorAuto === true
      && havenBuildingCollision.outerGateBodyWalkable === false,
    `HAVEN building collision/door contract failed: ${JSON.stringify(havenBuildingCollision)}`,
  );

  const havenZiplineRideSetup = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const maps = await import("/src/field/maps.ts");
    const coords = await import("/src/field/haven3d/coordinates.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const map = maps.getFieldMap("base_camp");
    const track = map.objects.find((object) => (
      object.metadata?.ziplineTrack === true
      && object.metadata?.routeId === "haven_campus_zipline"
    ));
    const startAnchor = track
      ? map.objects.find((object) => object.id === track.metadata?.startAnchorId)
      : null;
    const endAnchor = track
      ? map.objects.find((object) => object.id === track.metadata?.endAnchorId)
      : null;
    if (!runtime || !track || !startAnchor || !endAnchor) {
      throw new Error("No HAVEN zipline route available for ride smoke.");
    }

    const center = (object) => ({
      x: (object.x + object.width / 2) * 64,
      y: (object.y + object.height / 2) * 64,
    });
    const start = center(startAnchor);
    const end = center(endAnchor);
    const attachT = 0.22;
    const attach = {
      x: start.x + ((end.x - start.x) * attachT),
      y: start.y + ((end.y - start.y) * attachT),
    };
    const offsets = [
      { x: 0, y: 86 },
      { x: 0, y: -86 },
      { x: 48, y: 0 },
      { x: -48, y: 0 },
      { x: 0, y: 28 },
    ];
    const player = offsets
      .map((offset) => ({ x: attach.x + offset.x, y: attach.y + offset.y }))
      .find((candidate) => coords.canAvatarMoveTo(map, candidate.x, candidate.y, 32, 32));
    if (!player) {
      throw new Error("No walkable HAVEN zipline ride setup tile.");
    }

    runtime.player.x = player.x;
    runtime.player.y = player.y;
    runtime.player.facing = "east";
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    runtime.fieldEnemies = [];
    runtime.npcs = [];
    runtime.companion = undefined;
    document.querySelector(".haven3d-canvas")?.focus();

    return { start, end, attach, attachT, playerBefore: player };
  });
  await setGearbladeMode(page, "grapple", "Digit3");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(3200);
  const havenZiplineRideResult = await page.evaluate(async (setup) => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (!runtime) {
      return null;
    }
    const projectRawT = (point) => {
      const dx = setup.end.x - setup.start.x;
      const dy = setup.end.y - setup.start.y;
      const lengthSq = Math.max(1, (dx * dx) + (dy * dy));
      return (((point.x - setup.start.x) * dx) + ((point.y - setup.start.y) * dy)) / lengthSq;
    };
    const after = { x: runtime.player.x, y: runtime.player.y };
    const segmentLength = Math.hypot(setup.end.x - setup.start.x, setup.end.y - setup.start.y);
    const afterRawT = projectRawT(after);
    const afterT = Math.max(0, Math.min(1, afterRawT));
    const endDistance = Math.min(
      Math.hypot(after.x - setup.start.x, after.y - setup.start.y),
      Math.hypot(after.x - setup.end.x, after.y - setup.end.y),
    );
    return {
      moved: Math.hypot(after.x - setup.playerBefore.x, after.y - setup.playerBefore.y),
      ziplineTravel: Math.abs(afterT - setup.attachT) * segmentLength,
      endDistance,
      carriedOffEnd: afterRawT < -0.02 || afterRawT > 1.02,
      afterRawT,
      afterT,
    };
  }, havenZiplineRideSetup);
  assertSmoke(
    havenZiplineRideResult
      && havenZiplineRideResult.moved > 340
      && havenZiplineRideResult.ziplineTravel > 300
      && havenZiplineRideResult.carriedOffEnd
      && havenZiplineRideResult.endDistance > 70
      && havenZiplineRideResult.endDistance < 420,
    `HAVEN zipline grapple did not carry the player off the cable end with momentum: ${JSON.stringify(havenZiplineRideResult)}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const maps = await import("/src/field/maps.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const map = maps.getFieldMap("base_camp");
    const shopDoor = map.interactionZones.find((zone) => zone.id === "interact_shop");
    if (!runtime || !shopDoor) {
      throw new Error("No HAVEN runtime or shop door for node return smoke.");
    }
    runtime.player.x = (shopDoor.x + (shopDoor.width / 2)) * 64;
    runtime.player.y = shopDoor.y * 64 + 32;
    runtime.player.facing = "north";
    runtime.player.vx = 0;
    runtime.player.vy = 0;
  });
  await page.waitForSelector(".shop-root", { timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
  await page.waitForTimeout(500);
  const nodeReturnTrapResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const maps = await import("/src/field/maps.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const map = maps.getFieldMap("base_camp");
    const shopDoor = map.interactionZones.find((zone) => zone.id === "interact_shop");
    const tileX = runtime ? Math.floor(runtime.player.x / 64) : null;
    const tileY = runtime ? Math.floor(runtime.player.y / 64) : null;
    const inShopDoor = Boolean(shopDoor && tileX !== null && tileY !== null
      && tileX >= shopDoor.x
      && tileX < shopDoor.x + shopDoor.width
      && tileY >= shopDoor.y
      && tileY < shopDoor.y + shopDoor.height);
    return {
      screen: document.body.dataset.screen,
      hasShopRoot: Boolean(document.querySelector(".shop-root")),
      mapId: field.getCurrentFieldMap(),
      tileX,
      tileY,
      inShopDoor,
    };
  });
  assertSmoke(
    nodeReturnTrapResult.screen === "field-base-camp"
      && nodeReturnTrapResult.mapId === "base_camp"
      && nodeReturnTrapResult.hasShopRoot === false
      && nodeReturnTrapResult.inShopDoor === false,
    `Returning from a HAVEN node retrapped the player: ${JSON.stringify(nodeReturnTrapResult)}`,
  );
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (!runtime) {
      return;
    }
    runtime.player.x = 41 * 64 + 32;
    runtime.player.y = 27 * 64 + 32;
    runtime.player.facing = "south";
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    runtime.npcs = [];
    runtime.fieldEnemies = [];
  });
  await page.waitForTimeout(150);

  const temporaryFixtureState = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const temporaryNames = new Set([
      "HAVEN Sparring Bulwark",
      "HAVEN Latchwire Slinger",
      "HAVEN Plate Sentinel",
    ]);
    return (runtime?.fieldEnemies ?? [])
      .filter((enemy) => temporaryNames.has(enemy.name))
      .map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        defense: enemy.gearbladeDefense ?? "none",
        attackStyle: enemy.attackStyle ?? "slash",
      }));
  });
  assertSmoke(
    temporaryFixtureState.length === 0,
    `Temporary HAVEN enemy fixtures are still present: ${JSON.stringify(temporaryFixtureState)}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (!runtime) {
      throw new Error("No field runtime for blade miss smoke.");
    }
    runtime.player.facing = "north";
    runtime.npcs = [];
    runtime.companion = undefined;
    runtime.fieldEnemies = [{
      id: "enemy_smoke_near_miss",
      name: "Smoke Near Miss",
      x: runtime.player.x,
      y: runtime.player.y + 48,
      width: 36,
      height: 36,
      hp: 20,
      maxHp: 20,
      speed: 0,
      facing: "north",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 0,
    }];
  });
  await page.evaluate(() => document.querySelector(".haven3d-canvas")?.focus());
  await setGearbladeMode(page, "blade", "Digit1");
  await page.keyboard.press("Space");
  await page.waitForTimeout(240);
  const spaceNoActionResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_near_miss");
    return { hp: enemy?.hp ?? null, knockbackTime: enemy?.knockbackTime ?? null };
  });
  assertSmoke(
    spaceNoActionResult.hp === 20 && spaceNoActionResult.knockbackTime === 0,
    `Space triggered a Gearblade action instead of remaining jump-only in HAVEN 3D: ${JSON.stringify(spaceNoActionResult)}`,
  );
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(950);
  const bladeNearMissResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_near_miss");
    return { hp: enemy?.hp ?? null, knockbackTime: enemy?.knockbackTime ?? null };
  });
  assertSmoke(
    bladeNearMissResult.hp === 20 && bladeNearMissResult.knockbackTime === 0,
    `Nearby enemy was hit outside the blade swing segment: ${JSON.stringify(bladeNearMissResult)}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const npcs = await import("/src/field/npcs.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (!runtime) {
      throw new Error("No field runtime for target smoke.");
    }
    runtime.npcs = [npcs.createNpc("npc_smoke_dialogue", "Smoke Tester", runtime.player.x, runtime.player.y + 20, "npc_medic", { routeMode: "none" })];
    runtime.fieldEnemies = [{
      id: "enemy_smoke_target",
      name: "Smoke Enemy",
      x: runtime.player.x + 48,
      y: runtime.player.y,
      width: 36,
      height: 36,
      hp: 12,
      maxHp: 12,
      speed: 70,
      facing: "south",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 320,
    }];
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector(".haven3d-canvas")?.focus());
  await cycleUntilTarget(page, "TARGET :: SMOKE TESTER");
  await cycleUntilTarget(page, "TARGET :: SMOKE ENEMY");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(1100);
  const bladeHitResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const enemy = runtime?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_target");
    return {
      enemyHp: enemy?.hp ?? null,
      energyCells: runtime?.combat?.energyCells ?? null,
    };
  });
  assertSmoke(
    bladeHitResult.enemyHp === null || bladeHitResult.enemyHp <= 0,
    `Blade swing did not defeat the locked smoke enemy: ${JSON.stringify(bladeHitResult)}`,
  );
  assertSmoke(
    (bladeHitResult.energyCells ?? 0) > 0,
    `Blade swing did not grant melee energy on hit: ${JSON.stringify(bladeHitResult)}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (!runtime) {
      return;
    }
    runtime.fieldEnemies = [{
      id: "enemy_smoke_launcher",
      name: "Smoke Launcher",
      x: runtime.player.x + 116,
      y: runtime.player.y,
      width: 36,
      height: 36,
      hp: 20,
      maxHp: 20,
      speed: 0,
      facing: "south",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 0,
    }];
  });
  await setGearbladeMode(page, "launcher", "Digit2");
  await cycleUntilTarget(page, "TARGET :: SMOKE LAUNCHER");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(900);
  const launcherHitResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const enemy = runtime?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_launcher");
    return { enemyHp: enemy?.hp ?? null };
  });
  assertSmoke(
    launcherHitResult.enemyHp === null || launcherHitResult.enemyHp <= 0,
    `Launcher mode did not defeat the smoke enemy: ${JSON.stringify(launcherHitResult)}`,
  );

  const grappleBefore = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (!runtime) {
      return null;
    }
    runtime.fieldEnemies = [{
      id: "enemy_smoke_grapple",
      name: "Smoke Grapple",
      x: runtime.player.x + 190,
      y: runtime.player.y + 12,
      width: 36,
      height: 36,
      hp: 34,
      maxHp: 34,
      speed: 0,
      facing: "south",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 0,
    }];
    return {
      player: { x: runtime.player.x, y: runtime.player.y },
      enemy: { x: runtime.fieldEnemies[0].x, y: runtime.fieldEnemies[0].y, hp: runtime.fieldEnemies[0].hp },
    };
  });
  await setGearbladeMode(page, "grapple", "Digit3");
  await cycleUntilTarget(page, "TARGET :: SMOKE GRAPPLE");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(900);
  const grappleAfter = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const enemy = runtime?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_grapple");
    return runtime && enemy
      ? {
        player: { x: runtime.player.x, y: runtime.player.y },
        enemy: { x: enemy.x, y: enemy.y, hp: enemy.hp, knockbackTime: enemy.knockbackTime },
      }
      : null;
  });
  const grappleStartDistance = grappleBefore
    ? Math.hypot(grappleBefore.enemy.x - grappleBefore.player.x, grappleBefore.enemy.y - grappleBefore.player.y)
    : 0;
  const grappleEndDistance = grappleAfter
    ? Math.hypot(grappleAfter.enemy.x - grappleAfter.player.x, grappleAfter.enemy.y - grappleAfter.player.y)
    : Number.POSITIVE_INFINITY;
  assertSmoke(
    grappleAfter && grappleEndDistance < grappleStartDistance - 30 && grappleAfter.enemy.hp < 34,
    `Grapple mode did not pull and stagger the smoke enemy: ${JSON.stringify({ grappleStartDistance, grappleEndDistance, grappleAfter })}`,
  );

  const attackSetup = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const maps = await import("/src/field/maps.ts");
    const coords = await import("/src/field/haven3d/coordinates.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const map = maps.getFieldMap("base_camp");
    if (!runtime) {
      return null;
    }

    const offsets = [
      { enemy: { x: 76, y: 0 }, dodge: { x: 0, y: 176 } },
      { enemy: { x: -76, y: 0 }, dodge: { x: 0, y: 176 } },
      { enemy: { x: 0, y: 76 }, dodge: { x: 176, y: 0 } },
      { enemy: { x: 0, y: -76 }, dodge: { x: 176, y: 0 } },
    ];
    let placement = null;
    for (let y = 1; y < map.height - 1 && !placement; y += 1) {
      for (let x = 1; x < map.width - 1 && !placement; x += 1) {
        const player = { x: x * 64 + 32, y: y * 64 + 32 };
        if (!coords.canAvatarMoveTo(map, player.x, player.y, 32, 32)) {
          continue;
        }
        for (const offset of offsets) {
          const enemy = { x: player.x + offset.enemy.x, y: player.y + offset.enemy.y };
          const dodge = { x: player.x + offset.dodge.x, y: player.y + offset.dodge.y };
          if (
            coords.canAvatarMoveTo(map, enemy.x, enemy.y, 36, 36)
            && coords.canAvatarMoveTo(map, dodge.x, dodge.y, 32, 32)
          ) {
            placement = { player, enemy, dodge };
            break;
          }
        }
      }
    }
    if (!placement) {
      throw new Error("Could not find a HAVEN attack smoke placement.");
    }

    runtime.player.x = placement.player.x;
    runtime.player.y = placement.player.y;
    runtime.player.hp = 100;
    runtime.player.maxHp = 100;
    runtime.player.invulnerabilityTime = 0;
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    runtime.companion = undefined;
    runtime.fieldEnemies = [{
      id: "enemy_smoke_striker",
      name: "Smoke Striker",
      x: placement.enemy.x,
      y: placement.enemy.y,
      width: 36,
      height: 36,
      hp: 60,
      maxHp: 60,
      speed: 0,
      facing: "west",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 260,
    }];
    return placement;
  });
  assertSmoke(Boolean(attackSetup), "Attack smoke setup failed.");
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_striker");
    return enemy?.attackState === "windup";
  }, null, { timeout: 10000 });
  await page.evaluate((dodge) => {
    window.__haven3dSmokeDodge = dodge;
  }, attackSetup.dodge);
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const dodge = window.__haven3dSmokeDodge;
    if (runtime && dodge) {
      runtime.player.x = dodge.x;
      runtime.player.y = dodge.y;
    }
  });
  await page.waitForTimeout(1100);
  const dodgedAttackResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    return { hp: runtime?.player.hp ?? null };
  });
  assertSmoke(dodgedAttackResult.hp === 100, `Enemy windup was not avoidable: ${JSON.stringify(dodgedAttackResult)}`);

  await page.evaluate((placement) => {
    window.__haven3dSmokeAttackPlacement = placement;
  }, attackSetup);
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const placement = window.__haven3dSmokeAttackPlacement;
    if (!runtime || !placement) {
      return;
    }
    runtime.player.x = placement.player.x;
    runtime.player.y = placement.player.y;
    runtime.player.hp = 100;
    runtime.player.invulnerabilityTime = 0;
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    runtime.fieldEnemies = [{
      id: "enemy_smoke_striker",
      name: "Smoke Striker",
      x: placement.enemy.x,
      y: placement.enemy.y,
      width: 36,
      height: 36,
      hp: 60,
      maxHp: 60,
      speed: 0,
      facing: "west",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 260,
    }];
  });
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_striker");
    return enemy?.attackState === "windup";
  }, null, { timeout: 10000 });
  await page.waitForTimeout(1100);
  const committedAttackResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    return { hp: runtime?.player.hp ?? null };
  });
  assertSmoke(
    typeof committedAttackResult.hp === "number" && committedAttackResult.hp < 100,
    `Enemy timed strike did not apply damage: ${JSON.stringify(committedAttackResult)}`,
  );

  await page.evaluate((placement) => {
    window.__haven3dSmokeVulnerabilityPlacement = placement;
  }, attackSetup);
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const placement = window.__haven3dSmokeVulnerabilityPlacement;
    if (!runtime || !placement) {
      return;
    }
    runtime.player.x = placement.player.x;
    runtime.player.y = placement.player.y;
    runtime.player.hp = 100;
    runtime.player.invulnerabilityTime = 0;
    runtime.companion = undefined;
    runtime.fieldEnemies = [{
      id: "enemy_smoke_shield",
      name: "Smoke Shield",
      x: placement.player.x + 48,
      y: placement.player.y,
      width: 36,
      height: 36,
      hp: 30,
      maxHp: 30,
      speed: 0,
      facing: "west",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 0,
      gearbladeDefense: "shield",
      gearbladeDefenseBroken: false,
    }];
  });
  await setGearbladeMode(page, "blade", "Digit1");
  await cycleUntilTarget(page, "TARGET :: SMOKE SHIELD");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(600);
  const shieldBladeResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_shield");
    return { hp: enemy?.hp ?? null, broken: enemy?.gearbladeDefenseBroken ?? null };
  });
  assertSmoke(
    typeof shieldBladeResult.hp === "number" && shieldBladeResult.hp >= 28 && shieldBladeResult.broken === false,
    `Shielded enemy did not block Blade mode: ${JSON.stringify(shieldBladeResult)}`,
  );
  await setGearbladeMode(page, "grapple", "Digit3");
  await cycleUntilTarget(page, "TARGET :: SMOKE SHIELD");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(900);
  const shieldGrappleResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_shield");
    return { hp: enemy?.hp ?? null, broken: enemy?.gearbladeDefenseBroken ?? null };
  });
  assertSmoke(
    shieldGrappleResult.broken === true && typeof shieldGrappleResult.hp === "number" && shieldGrappleResult.hp < shieldBladeResult.hp,
    `Grapple mode did not open the shielded enemy: ${JSON.stringify(shieldGrappleResult)}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const placement = window.__haven3dSmokeVulnerabilityPlacement;
    if (!runtime || !placement) {
      return;
    }
    runtime.player.x = placement.player.x;
    runtime.player.y = placement.player.y;
    runtime.player.hp = 100;
    runtime.player.invulnerabilityTime = 0;
    runtime.companion = undefined;
    runtime.fieldEnemies = [{
      id: "enemy_smoke_armor",
      name: "Smoke Armor",
      x: placement.player.x + 116,
      y: placement.player.y,
      width: 36,
      height: 36,
      hp: 32,
      maxHp: 32,
      speed: 0,
      facing: "west",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 0,
      gearbladeDefense: "armor",
      gearbladeDefenseBroken: false,
    }];
  });
  await setGearbladeMode(page, "blade", "Digit1");
  await cycleUntilTarget(page, "TARGET :: SMOKE ARMOR");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(600);
  const armorBladeResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_armor");
    return { hp: enemy?.hp ?? null, broken: enemy?.gearbladeDefenseBroken ?? null };
  });
  assertSmoke(
    typeof armorBladeResult.hp === "number" && armorBladeResult.hp >= 30 && armorBladeResult.broken === false,
    `Armored enemy did not block Blade mode: ${JSON.stringify(armorBladeResult)}`,
  );
  await setGearbladeMode(page, "launcher", "Digit2");
  await cycleUntilTarget(page, "TARGET :: SMOKE ARMOR");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(900);
  const armorLauncherResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const enemy = field.getCurrentFieldRuntimeState()?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_armor");
    return { hp: enemy?.hp ?? null, broken: enemy?.gearbladeDefenseBroken ?? null };
  });
  assertSmoke(
    armorLauncherResult.broken === true && typeof armorLauncherResult.hp === "number" && armorLauncherResult.hp < armorBladeResult.hp,
    `Launcher mode did not crack the armored enemy: ${JSON.stringify(armorLauncherResult)}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (!runtime) {
      return;
    }
    runtime.player.x = 18 * 64 + 32;
    runtime.player.y = 12 * 64 + 32;
    runtime.player.invulnerabilityTime = 0;
    runtime.fieldEnemies = [{
      id: "enemy_smoke_snap_target",
      name: "Smoke Snap Target",
      x: runtime.player.x + 76,
      y: runtime.player.y,
      width: 36,
      height: 36,
      hp: 20,
      maxHp: 20,
      speed: 0,
      facing: "west",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 0,
    }];
  });
  await cycleUntilTarget(page, "TARGET :: SMOKE SNAP TARGET");
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (runtime) {
      runtime.player.x += 780;
    }
  });
  await page.waitForTimeout(300);
  const snapPrompt = await page.locator("[data-haven3d-prompt]").innerText().catch(() => "");
  assertSmoke(!snapPrompt.includes("SMOKE SNAP TARGET"), `Z-target lock did not snap out at distance: ${snapPrompt}`);

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const npcs = await import("/src/field/npcs.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    if (runtime) {
      runtime.fieldEnemies = [];
      runtime.npcs = [npcs.createNpc("npc_smoke_dialogue", "Smoke Tester", runtime.player.x, runtime.player.y + 20, "npc_medic", { routeMode: "none" })];
    }
  });
  await page.waitForTimeout(150);

  await page.keyboard.press("e");
  await page.waitForSelector("#dialoguePanel.dialogue-panel--visible", { timeout: 10000 });
  const dialogueText = await page.locator("#dialoguePanel").innerText();
  assertSmoke(/Smoke Tester|Medic|Hello there|commander/i.test(dialogueText), "NPC dialogue did not open from HAVEN 3D.");
  await page.evaluate(async () => {
    const dialogue = await import("/src/ui/screens/DialogueScreen.ts");
    dialogue.closeDialogue();
  });
  await page.waitForSelector("#dialoguePanel", { state: "detached", timeout: 10000 });

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const maps = await import("/src/field/maps.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const mapId = field.getCurrentFieldMap() ?? "base_camp";
    const map = maps.getFieldMap(mapId);
    if (!runtime) {
      return;
    }
    runtime.npcs = [];
    let safePoint = null;
    for (let y = 4; y < map.height - 4 && !safePoint; y += 1) {
      for (let x = 4; x < map.width - 4; x += 1) {
        const tile = map.tiles[y]?.[x];
        if (!tile?.walkable) {
          continue;
        }
        const insideInteractionZone = map.interactionZones.some((zone) => (
          x >= zone.x
          && x < zone.x + zone.width
          && y >= zone.y
          && y < zone.y + zone.height
        ));
        if (!insideInteractionZone) {
          safePoint = { x: x * 64 + 32, y: y * 64 + 32 };
          break;
        }
      }
    }
    if (safePoint) {
      runtime.player.x = safePoint.x;
      runtime.player.y = safePoint.y;
    }
  });

  const beforeMove = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    document.querySelector(".haven3d-canvas")?.focus();
    return runtime ? { x: runtime.player.x, y: runtime.player.y } : null;
  });
  const box = await canvas.boundingBox();
  assertSmoke(Boolean(box), "HAVEN 3D canvas was not measurable.");

  await page.mouse.move(box.x + 520, box.y + 360);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 650, box.y + 330, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await page.keyboard.down("w");
  await page.waitForTimeout(360);
  await page.keyboard.up("w");
  await page.waitForTimeout(180);

  const afterMove = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    return runtime ? { x: runtime.player.x, y: runtime.player.y } : null;
  });
  const moveDistance = beforeMove && afterMove
    ? Math.hypot(afterMove.x - beforeMove.x, afterMove.y - beforeMove.y)
    : 0;
  assertSmoke(moveDistance > 20, `WASD movement did not move enough: ${moveDistance.toFixed(2)}px`);
  assertSmoke(Math.abs((afterMove?.x ?? 0) - (beforeMove?.x ?? 0)) > 4, "Right-drag free camera did not affect camera-relative movement.");

  await page.evaluate(() => {
    const canvas = document.querySelector(".haven3d-canvas");
    canvas?.focus();
    canvas?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      bubbles: true,
      cancelable: true,
    }));
    canvas?.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Tab",
      code: "Tab",
      bubbles: true,
      cancelable: true,
    }));
  });
  await page.evaluate(() => {
    document.querySelector("canvas.haven3d-canvas")?.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 620,
    }));
  });
  await page.waitForTimeout(360);
  const cameraBeforeScreenRoundTrip = await readHaven3DCameraState(page);
  const activeCameraBeforeScreenRoundTrip = getActiveCameraView(cameraBeforeScreenRoundTrip, "P1");
  assertSmoke(
    activeCameraBeforeScreenRoundTrip?.distance > 9.2,
    `HAVEN 3D camera zoom did not change before remount: ${JSON.stringify(cameraBeforeScreenRoundTrip)}`,
  );
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    field.renderFieldScreen(field.getCurrentFieldMap() ?? "base_camp");
  });
  await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
  const cameraAfterScreenRoundTrip = await readHaven3DCameraState(page);
  const activeCameraAfterScreenRoundTrip = getActiveCameraView(cameraAfterScreenRoundTrip, "P1");
  assertSmoke(Boolean(cameraAfterScreenRoundTrip), "HAVEN 3D camera was not available after field remount.");
  assertSmoke(
    Boolean(activeCameraBeforeScreenRoundTrip && activeCameraAfterScreenRoundTrip)
      && Math.abs(activeCameraAfterScreenRoundTrip.distance - activeCameraBeforeScreenRoundTrip.distance) < 0.01
      && Math.abs(activeCameraAfterScreenRoundTrip.pitch - activeCameraBeforeScreenRoundTrip.pitch) < 0.01
      && angleDeltaRadians(activeCameraAfterScreenRoundTrip.yaw, activeCameraBeforeScreenRoundTrip.yaw) < 0.02,
    `HAVEN 3D camera reset after screen round-trip: ${JSON.stringify({ before: cameraBeforeScreenRoundTrip, after: cameraAfterScreenRoundTrip })}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForSelector("#allNodesMenuGrid", { timeout: 10000 });
  assertSmoke(await page.locator("#allNodesBuildModeBtn").count() === 1, "All Nodes did not expose Field Build Mode.");
  await page.locator("#allNodesBuildModeBtn").click();
  await page.waitForSelector(".field-build-panel", { timeout: 10000 });
  const buildModeState = await page.evaluate(() => ({
    hasHaven3d: Boolean(document.querySelector(".field-root--haven3d")),
    hasLegacyViewport: Boolean(document.querySelector(".field-viewport")),
  }));
  assertSmoke(!buildModeState.hasHaven3d && buildModeState.hasLegacyViewport, "Build Mode did not use the legacy 2D editor.");

  const buildRoundTrip = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const maps = await import("/src/field/maps.ts");
    const coords = await import("/src/field/haven3d/coordinates.ts");
    store.updateGameState((state) => ({
      ...state,
      uiLayout: {
        ...(state.uiLayout ?? {}),
        baseCampFieldNodeLayouts: {
          ...(state.uiLayout?.baseCampFieldNodeLayouts ?? {}),
          quarters: { x: 16, y: 8 },
        },
      },
    }));
    field.renderFieldScreen("base_camp");
    const layout = coords.createHaven3DSceneLayout(maps.getFieldMap("base_camp"));
    return {
      hasHaven3d: Boolean(document.querySelector(".field-root--haven3d")),
      quartersObject: layout.objects.find((object) => object.id === "quarters_station") ?? null,
      quartersZone: layout.zones.find((zone) => zone.id === "interact_quarters") ?? null,
    };
  });
  assertSmoke(buildRoundTrip.hasHaven3d, "Returning from Build Mode did not remount HAVEN 3D.");
  assertSmoke(
    buildRoundTrip.quartersObject?.fieldOrigin?.x === 16
      && buildRoundTrip.quartersObject?.fieldOrigin?.y === 8
      && buildRoundTrip.quartersZone?.fieldOrigin?.y === 13,
    `Saved node position did not reflect in 3D building/door layout: ${JSON.stringify(buildRoundTrip)}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    field.setNextFieldSpawnOverrideTile("base_camp", { x: 41, y: 47, facing: "south" });
    field.renderFieldScreen("base_camp");
  });
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentFieldMap() === "outer_deck_overworld" && document.body.dataset.screen === "field-outer_deck_overworld";
  }, null, { timeout: 10000 });
  const outerDeckState = await page.evaluate(() => ({
    hasHaven3d: Boolean(document.querySelector(".field-root--haven3d")),
    has2dViewport: Boolean(document.querySelector(".field-viewport")),
    hasFieldTag: Boolean(document.querySelector(".haven3d-field-tag")),
  }));
  assertSmoke(
    outerDeckState.hasHaven3d && !outerDeckState.has2dViewport && !outerDeckState.hasFieldTag,
    `Outer Deck overworld did not mount in HAVEN 3D runtime: ${JSON.stringify(outerDeckState)}`,
  );

  const outerDeckPickupProbe = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const map = field.getCurrentFieldRuntimeMap();
    const resource = map?.objects.find((object) => (
      object.type === "resource"
      && !(runtime?.collectedResourceObjectIds ?? []).includes(object.id)
    ));
    if (!runtime || !resource) {
      return null;
    }
    runtime.player.x = (resource.x + resource.width / 2) * 64;
    runtime.player.y = (resource.y + resource.height / 2) * 64;
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    runtime.fieldEnemies = [];
    return { id: resource.id };
  });
  assertSmoke(Boolean(outerDeckPickupProbe), "Outer Deck 3D pickup smoke could not find an uncollected resource.");
  await page.waitForTimeout(350);
  const outerDeckPickupResult = await page.evaluate(async (probe) => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    return {
      collected: Boolean(runtime?.collectedResourceObjectIds?.includes(probe.id)),
      visibleIn3d: field.isCurrentHaven3DFieldObjectVisible(probe.id),
    };
  }, outerDeckPickupProbe);
  assertSmoke(
    outerDeckPickupResult.collected && outerDeckPickupResult.visibleIn3d === false,
    `Outer Deck 3D pickup did not hide after collection: ${JSON.stringify(outerDeckPickupResult)}`,
  );

  const lootOrbBefore = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const map = field.getCurrentFieldRuntimeMap();
    if (!runtime || !map) {
      return null;
    }
    const isClearTile = (x, y) => {
      const tile = map.tiles[y]?.[x];
      if (!tile?.walkable) {
        return false;
      }
      return !map.objects.some((object) => (
        object.type !== "enemy"
        && x >= object.x
        && x < object.x + object.width
        && y >= object.y
        && y < object.y + object.height
      ));
    };
    let probeTile = null;
    const centerTileX = Math.floor(runtime.player.x / 64);
    const centerTileY = Math.floor(runtime.player.y / 64);
    for (let radius = 0; radius < 12 && !probeTile; radius += 1) {
      for (let dy = -radius; dy <= radius && !probeTile; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
            continue;
          }
          const x = centerTileX + dx;
          const y = centerTileY + dy;
          if (x < 2 || y < 2 || x >= map.width - 3 || y >= map.height - 2) {
            continue;
          }
          if (isClearTile(x, y) && isClearTile(x + 1, y)) {
            probeTile = { x, y };
            break;
          }
        }
      }
    }
    if (!probeTile) {
      return null;
    }
    const playerX = (probeTile.x + 0.5) * 64;
    const playerY = (probeTile.y + 0.5) * 64;
    runtime.player.x = playerX;
    runtime.player.y = playerY;
    runtime.player.facing = "east";
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    runtime.companion = undefined;
    runtime.npcs = [];
    runtime.lootOrbs = [];
    runtime.collectedResourceObjectIds = Array.from(new Set([
      ...(runtime.collectedResourceObjectIds ?? []),
      ...map.objects.filter((object) => object.type === "resource").map((object) => object.id),
    ]));
    runtime.fieldEnemies = [{
      id: "enemy_smoke_loot_orb",
      name: "Smoke Loot Carrier",
      x: playerX + 54,
      y: playerY,
      width: 36,
      height: 36,
      hp: 12,
      maxHp: 12,
      speed: 0,
      facing: "west",
      lastMoveTime: 0,
      vx: 0,
      vy: 0,
      knockbackTime: 0,
      aggroRange: 0,
      drops: {
        wad: 7,
        resources: { metalScrap: 2 },
        items: [],
      },
    }];
    const state = store.getGameState();
    return {
      wad: state.wad,
      metalScrap: state.resources.metalScrap,
    };
  });
  assertSmoke(Boolean(lootOrbBefore), "Outer Deck loot orb smoke could not prepare runtime.");
  await setGearbladeMode(page, "blade", "Digit1");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(120);
  await cycleUntilTarget(page, "TARGET :: SMOKE LOOT CARRIER");
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(700);
  const lootOrbDefeatResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const state = store.getGameState();
    const enemy = runtime?.fieldEnemies?.find((entry) => entry.id === "enemy_smoke_loot_orb");
    return {
      enemyHp: enemy?.hp ?? null,
      orbCount: runtime?.lootOrbs?.length ?? 0,
      orb: runtime?.lootOrbs?.[0] ? {
        x: runtime.lootOrbs[0].x,
        y: runtime.lootOrbs[0].y,
        wad: runtime.lootOrbs[0].drops?.wad ?? 0,
        metalScrap: runtime.lootOrbs[0].drops?.resources?.metalScrap ?? 0,
      } : null,
      wad: state.wad,
      metalScrap: state.resources.metalScrap,
    };
  });
  assertSmoke(
    lootOrbDefeatResult.orbCount === 1
      && (lootOrbDefeatResult.enemyHp === null || lootOrbDefeatResult.enemyHp <= 0)
      && lootOrbDefeatResult.orb?.wad === 7
      && lootOrbDefeatResult.orb?.metalScrap === 2,
    `Defeated Outer Deck enemy did not defer drops into a loot orb: ${JSON.stringify({ lootOrbBefore, lootOrbDefeatResult })}`,
  );
  const lootOrbDriftSetup = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const orb = runtime?.lootOrbs?.[0];
    if (!runtime || !orb) {
      return null;
    }
    runtime.player.x = orb.x - 128;
    runtime.player.y = orb.y;
    runtime.player.facing = "east";
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    document.querySelector(".haven3d-canvas")?.focus();
    return {
      playerX: runtime.player.x,
      orbX: orb.x,
      orbY: orb.y,
      distance: Math.hypot(orb.x - runtime.player.x, orb.y - runtime.player.y),
    };
  });
  assertSmoke(Boolean(lootOrbDriftSetup), "Outer Deck loot orb drift setup could not find the spawned orb.");
  await page.waitForTimeout(650);
  const lootOrbDriftResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const orb = runtime?.lootOrbs?.[0];
    if (!runtime || !orb) {
      return null;
    }
    return {
      playerX: runtime.player.x,
      orbX: orb.x,
      orbY: orb.y,
      vx: orb.vx ?? 0,
      distance: Math.hypot(orb.x - runtime.player.x, orb.y - runtime.player.y),
    };
  });
  assertSmoke(
    Boolean(lootOrbDriftResult)
      && lootOrbDriftResult.orbX < lootOrbDriftSetup.orbX - 4
      && lootOrbDriftResult.distance < lootOrbDriftSetup.distance,
    `Loot orb did not drift toward the nearby player: ${JSON.stringify({ lootOrbDriftSetup, lootOrbDriftResult })}`,
  );
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const orb = runtime?.lootOrbs?.[0];
    if (!runtime || !orb) {
      return;
    }
    runtime.player.x = orb.x - 58;
    runtime.player.y = orb.y;
    runtime.player.facing = "east";
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    document.querySelector(".haven3d-canvas")?.focus();
  });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(120);
  await cycleUntilTarget(page, "TARGET :: SMOKE LOOT CARRIER ORB", 4);
  await triggerPrimaryAction(page, canvas);
  await page.waitForTimeout(700);
  const lootOrbBreakResult = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const runtime = field.getCurrentFieldRuntimeState();
    const state = store.getGameState();
    return {
      orbCount: runtime?.lootOrbs?.length ?? 0,
      wad: state.wad,
      metalScrap: state.resources.metalScrap,
    };
  });
  assertSmoke(
    lootOrbBreakResult.orbCount === 0
      && lootOrbBreakResult.wad === lootOrbDefeatResult.wad + 7
      && lootOrbBreakResult.metalScrap === lootOrbDefeatResult.metalScrap + 2,
    `Blade did not break the Outer Deck loot orb and grant deferred drops: ${JSON.stringify({ lootOrbDefeatResult, lootOrbBreakResult })}`,
  );

  const outerDeckNoSwitcherState = await page.evaluate(() => ({
    hasViewToggle: Boolean(document.querySelector("[data-field-view-toggle]")),
    hasHaven3d: Boolean(document.querySelector(".field-root--haven3d")),
    has2dViewport: Boolean(document.querySelector(".field-viewport")),
  }));
  assertSmoke(
    !outerDeckNoSwitcherState.hasViewToggle && outerDeckNoSwitcherState.hasHaven3d && !outerDeckNoSwitcherState.has2dViewport,
    `Outer Deck view switcher was not fully removed: ${JSON.stringify(outerDeckNoSwitcherState)}`,
  );
  await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
  await page.waitForSelector("[data-haven3d-apron-nav]", { timeout: 10000 });
  await page.waitForTimeout(120);
  const apronNavigatorState = await page.evaluate(() => {
    const nav = document.querySelector("[data-haven3d-apron-nav]");
    return {
      exists: Boolean(nav),
      hidden: nav?.hasAttribute("hidden") ?? true,
      text: nav?.textContent ?? "",
      bearing: nav instanceof HTMLElement ? nav.style.getPropertyValue("--apron-bearing") : "",
    };
  });
  assertSmoke(
    apronNavigatorState.exists
      && !apronNavigatorState.hidden
      && /HAVEN/i.test(apronNavigatorState.text)
      && /CELL/i.test(apronNavigatorState.text)
      && apronNavigatorState.bearing.trim().length > 0,
    `Outer Deck HAVEN navigator did not render/update: ${JSON.stringify(apronNavigatorState)}`,
  );
  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const outerDecks = await import("/src/core/outerDecks.ts");
    store.updateGameState((state) => ({
      ...state,
      outerDecks: {
        ...state.outerDecks,
        openWorld: {
          ...state.outerDecks.openWorld,
          seed: 6666,
          playerWorldX: (outerDecks.OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.x + 0.5) * outerDecks.OUTER_DECK_OPEN_WORLD_TILE_SIZE,
          playerWorldY: (outerDecks.OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.y + 0.5) * outerDecks.OUTER_DECK_OPEN_WORLD_TILE_SIZE,
          playerFacing: outerDecks.OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.facing,
        },
      },
    }));
    field.renderFieldScreen(outerDecks.OUTER_DECK_OVERWORLD_MAP_ID);
  });
  await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
  await page.waitForTimeout(200);
  const apronTraversalRouteState = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const map = field.getCurrentFieldRuntimeMap();
    const zipline = map?.objects.find((object) => object.metadata?.ziplineTrack === true);
    const routeAnchorCount = map?.objects.filter((object) => object.metadata?.grappleAnchor === true && object.metadata?.routeId).length ?? 0;
    const grappleRouteAnchors = field.getCurrentHaven3DGrappleRouteAnchorState();
    const linkedRouteAnchor = grappleRouteAnchors.find((anchor) => anchor.connectedAnchorIds.some((id) => grappleRouteAnchors.some((candidate) => candidate.id === id)));
    const linkedRouteTargets = linkedRouteAnchor
      ? linkedRouteAnchor.connectedAnchorIds.filter((id) => grappleRouteAnchors.some((candidate) => candidate.id === id))
      : [];
    const runtime = field.getCurrentFieldRuntimeState();
    if (runtime && linkedRouteAnchor && linkedRouteTargets.length > 0) {
      runtime.player.x = linkedRouteAnchor.x + 6;
      runtime.player.y = linkedRouteAnchor.y + 6;
      runtime.player.vx = 0;
      runtime.player.vy = 0;
      runtime.player.facing = "east";
    }
    const preferredGrappleAnchor = field.getCurrentHaven3DPreferredGrappleAnchorState();
    const resourceWalkable = map?.objects
      .filter((object) => object.type === "resource")
      .every((object) => map.tiles[object.y]?.[object.x]?.walkable === true && object.metadata?.requiresSable !== true);
    return {
      ziplineId: zipline?.id ?? null,
      ziplineVisible: zipline ? field.isCurrentHaven3DFieldObjectVisible(zipline.id) : false,
      ziplineTraversalNeed: zipline?.metadata?.traversalNeed ?? null,
      ziplineElevationDelta: Number(zipline?.metadata?.traversalElevationDelta ?? 0),
      ziplineBlockedTiles: Number(zipline?.metadata?.traversalBlockedTiles ?? 0),
      routeAnchorCount,
      routeGraphLinked: Boolean(linkedRouteAnchor && linkedRouteTargets.length > 0),
      routeSnapPreferredId: preferredGrappleAnchor?.id ?? null,
      routeSnapTargetIds: linkedRouteTargets,
      resourceWalkable,
    };
  });
  assertSmoke(
    Boolean(apronTraversalRouteState.ziplineId)
      && apronTraversalRouteState.ziplineVisible
      && (
        (apronTraversalRouteState.ziplineTraversalNeed === "elevation" && apronTraversalRouteState.ziplineElevationDelta >= 10)
        || (apronTraversalRouteState.ziplineTraversalNeed === "chasm" && apronTraversalRouteState.ziplineBlockedTiles >= 3)
      )
      && apronTraversalRouteState.routeAnchorCount >= 2
      && apronTraversalRouteState.routeGraphLinked
      && apronTraversalRouteState.routeSnapTargetIds.includes(apronTraversalRouteState.routeSnapPreferredId)
      && apronTraversalRouteState.resourceWalkable,
    `Outer Deck traversal routes or visible pickup contract failed: ${JSON.stringify(apronTraversalRouteState)}`,
  );

  const outerDeckDistantHavenSetup = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const outerDecks = await import("/src/core/outerDecks.ts");
    const outerDeckWorld = await import("/src/field/outerDeckWorld.ts");
    const farWorldX = ((outerDecks.OUTER_DECK_OPEN_WORLD_CHUNK_SIZE * 7) + 10.5) * outerDecks.OUTER_DECK_OPEN_WORLD_TILE_SIZE;
    const farWorldY = (8.5) * outerDecks.OUTER_DECK_OPEN_WORLD_TILE_SIZE;
    store.updateGameState((state) => outerDecks.setOuterDeckOpenWorldPlayerWorldPosition(state, farWorldX, farWorldY, "west"));
    field.renderFieldScreen(outerDecks.OUTER_DECK_OVERWORLD_MAP_ID);
    const map = field.getCurrentFieldRuntimeMap();
    const runtime = field.getCurrentFieldRuntimeState();
    if (map && runtime && outerDeckWorld.isOuterDeckOpenWorldMap(map)) {
      const local = outerDeckWorld.outerDeckWorldPixelToLocal(map, farWorldX, farWorldY);
      runtime.player.x = local.x;
      runtime.player.y = local.y;
      runtime.player.vx = 0;
      runtime.player.vy = 0;
    }
    return {
      hasPhysicalHaven: Boolean(map?.objects.some((object) => object.metadata?.havenCargoElevatorExterior === true)),
      mapId: field.getCurrentFieldMap(),
    };
  });
  await page.waitForSelector(".field-root--haven3d canvas.haven3d-canvas", { timeout: 10000 });
  await page.waitForTimeout(350);
  const outerDeckDistantHavenState = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const map = field.getCurrentFieldRuntimeMap();
    const physicalHaven = map?.objects.find((object) => object.metadata?.havenCargoElevatorExterior === true);
    return {
      mapId: field.getCurrentFieldMap(),
      hasPhysicalHaven: Boolean(physicalHaven),
      physicalHavenVisible: physicalHaven ? field.isCurrentHaven3DFieldObjectVisible(physicalHaven.id) : false,
      distantLandmarkVisible: field.isCurrentHaven3DDistantHavenLandmarkVisible(),
    };
  });
  assertSmoke(
    (outerDeckDistantHavenState.hasPhysicalHaven && outerDeckDistantHavenState.physicalHavenVisible)
      || (!outerDeckDistantHavenState.hasPhysicalHaven && outerDeckDistantHavenState.distantLandmarkVisible),
    `Outer Deck HAVEN landmark was not visible after moving far from the elevator: ${JSON.stringify({ outerDeckDistantHavenSetup, outerDeckDistantHavenState })}`,
  );

  const outerDeckBranchState = await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    const store = await import("/src/state/gameStore.ts");
    const outerDecks = await import("/src/core/outerDecks.ts");
    store.updateGameState((state) => outerDecks.beginOuterDeckExpedition(state, "counterweight_shaft"));
    const subarea = outerDecks.getCurrentOuterDeckSubarea(store.getGameState());
    if (!subarea) {
      return null;
    }
    field.renderFieldScreen(subarea.mapId);
    return { mapId: subarea.mapId, title: subarea.title };
  });
  assertSmoke(Boolean(outerDeckBranchState), "Could not start an outer deck branch smoke expedition.");
  await page.waitForFunction(async (expectedMapId) => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentFieldMap() === expectedMapId && Boolean(document.querySelector(".field-root--haven3d canvas.haven3d-canvas"));
  }, outerDeckBranchState.mapId, { timeout: 10000 });
  const outerDeckBranchRuntime = await page.evaluate(() => ({
    hasHaven3d: Boolean(document.querySelector(".field-root--haven3d")),
    has2dViewport: Boolean(document.querySelector(".field-viewport")),
    hasFieldTag: Boolean(document.querySelector(".haven3d-field-tag")),
  }));
  assertSmoke(
    outerDeckBranchRuntime.hasHaven3d && !outerDeckBranchRuntime.has2dViewport && !outerDeckBranchRuntime.hasFieldTag,
    `Outer Deck branch map did not mount in HAVEN 3D runtime: ${JSON.stringify({ outerDeckBranchState, outerDeckBranchRuntime })}`,
  );

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    field.renderFieldScreen("quarters");
  });
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentFieldMap() === "quarters" && document.body.dataset.screen === "field-quarters";
  }, null, { timeout: 10000 });
  const quartersState = await page.evaluate(() => ({
    hasHaven3d: Boolean(document.querySelector(".field-root--haven3d")),
    has2dViewport: Boolean(document.querySelector(".field-viewport")),
  }));
  assertSmoke(!quartersState.hasHaven3d && quartersState.has2dViewport, "Quarters did not stay on 2D field runtime.");

  assertSmoke(pageErrors.length === 0, `Browser page errors: ${pageErrors.join("\\n")}`);
  const relevantConsoleErrors = consoleErrors.filter((entry) => !/Failed to load resource.*404/i.test(entry));
  assertSmoke(relevantConsoleErrors.length === 0, `Browser console errors: ${relevantConsoleErrors.join("\\n")}`);

  await browser.close();
  return {
    canvasStats,
    moveDistance: Number(moveDistance.toFixed(2)),
    screenshotPath,
    sharedScreenshotPath,
    splitScreenshotPath,
    p2ShopScreenshotPath,
    canvasPath,
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
  console.log(`HAVEN 3D smoke passed: ${JSON.stringify(result)}`);
} finally {
  server.kill("SIGTERM");
}
