import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const port = Number(process.env.HAVEN3D_SMOKE_PORT ?? 1431);
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotPath = join(tmpdir(), "chaos-haven3d-smoke.png");
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
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const canvasStats = getCanvasStats(canvasShot);
  assertSmoke(canvasStats.coloredRatio > 0.5, `HAVEN 3D canvas looks blank: ${JSON.stringify(canvasStats)}`);

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
  await page.keyboard.press("Space");
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
  await page.keyboard.press("Digit2");
  await page.waitForFunction(() => document.querySelector('[data-haven3d-mode="launcher"]')?.classList.contains("haven3d-mode-chip--active"));
  await cycleUntilTarget(page, "TARGET :: SMOKE LAUNCHER");
  await page.keyboard.press("Space");
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
  await page.keyboard.press("Digit3");
  await page.waitForFunction(() => document.querySelector('[data-haven3d-mode="grapple"]')?.classList.contains("haven3d-mode-chip--active"));
  await cycleUntilTarget(page, "TARGET :: SMOKE GRAPPLE");
  await page.keyboard.press("Space");
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
  await page.locator("#dialogueCloseBtn").click();
  await page.waitForSelector("#dialoguePanel", { state: "detached", timeout: 10000 });

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
      quartersObject: layout.objects.find((object) => object.id === "quarters_station")?.fieldOrigin ?? null,
      quartersZone: layout.zones.find((zone) => zone.id === "interact_quarters")?.fieldOrigin ?? null,
    };
  });
  assertSmoke(buildRoundTrip.hasHaven3d, "Returning from Build Mode did not remount HAVEN 3D.");
  assertSmoke(buildRoundTrip.quartersObject?.x === 16 && buildRoundTrip.quartersZone?.y === 8, "Saved node position did not reflect in 3D layout.");

  await page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    field.setNextFieldSpawnOverrideTile("base_camp", { x: 24, y: 23, facing: "south" });
    field.renderFieldScreen("base_camp");
  });
  await page.waitForFunction(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return field.getCurrentFieldMap() === "outer_deck_overworld" && document.body.dataset.screen === "field-outer_deck_overworld";
  }, null, { timeout: 10000 });
  const outerDeckState = await page.evaluate(() => ({
    hasHaven3d: Boolean(document.querySelector(".field-root--haven3d")),
    has2dViewport: Boolean(document.querySelector(".field-viewport")),
  }));
  assertSmoke(!outerDeckState.hasHaven3d && outerDeckState.has2dViewport, "Outer Deck map did not stay on 2D field runtime.");

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
    canvasPath,
  };
}

const server = spawn("pnpm", ["exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
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
