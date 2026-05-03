import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.HAVEN3D_SMOKE_PORT ?? 1431);
const baseUrl = `http://127.0.0.1:${port}`;
const quartersScreenshotPath = join(tmpdir(), "chaos-field-3d-quarters.png");
const keyroomScreenshotPath = join(tmpdir(), "chaos-field-3d-keyroom.png");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSmoke(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function prepareFieldState(page) {
  await page.evaluate(async () => {
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
  });
}

async function renderFieldMap(page, mapId) {
  await page.evaluate(async (requestedMapId) => {
    const field = await import("/src/field/FieldScreen.ts");
    field.renderFieldScreen(requestedMapId);
  }, mapId);
}

async function readFieldSnapshot(page) {
  return page.evaluate(async () => {
    const field = await import("/src/field/FieldScreen.ts");
    return {
      mapId: field.getCurrentFieldRuntimeMap()?.id ?? null,
      isHaven3D: Boolean(document.querySelector(".field-root--haven3d .haven3d-canvas")),
      camera: field.getCurrentHaven3DFieldCameraState?.() ?? null,
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

async function verify3DFieldMap(page, mapId, screenshotPath = null) {
  await renderFieldMap(page, mapId);
  const snapshot = await waitForFieldSnapshot(
    page,
    (current) => current.mapId === mapId && current.isHaven3D && current.camera,
    `Expected ${mapId} to mount in the 3D field runtime`,
  );
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  return snapshot;
}

async function runSmoke() {
  await waitForServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  try {
    await dismissMenuShell(page);
    await prepareFieldState(page);

    const quartersSnapshot = await verify3DFieldMap(page, "quarters", quartersScreenshotPath);
    const freeZoneSnapshot = await verify3DFieldMap(page, "free_zone_1");
    const workshopSnapshot = await verify3DFieldMap(page, "counterweight_workshop");
    const keyroomSnapshot = await verify3DFieldMap(page, "keyroom_smoke", keyroomScreenshotPath);

    assertSmoke(quartersSnapshot.camera.mode === "shared", "Quarters should boot into the shared 3D camera.");
    assertSmoke(freeZoneSnapshot.camera.mode === "shared", "Free Zone should boot into the shared 3D camera.");
    assertSmoke(workshopSnapshot.camera.mode === "shared", "Weaponsmith workshop should boot into the shared 3D camera.");
    assertSmoke(keyroomSnapshot.camera.mode === "shared", "Keyroom field map should boot into the shared 3D camera.");

    console.log("[field-3d-parity-smoke] Quarters:", JSON.stringify(quartersSnapshot, null, 2));
    console.log("[field-3d-parity-smoke] Free Zone:", JSON.stringify(freeZoneSnapshot, null, 2));
    console.log("[field-3d-parity-smoke] Weaponsmith workshop:", JSON.stringify(workshopSnapshot, null, 2));
    console.log("[field-3d-parity-smoke] Keyroom:", JSON.stringify(keyroomSnapshot, null, 2));
    console.log(`[field-3d-parity-smoke] Quarters screenshot: ${quartersScreenshotPath}`);
    console.log(`[field-3d-parity-smoke] Keyroom screenshot: ${keyroomScreenshotPath}`);
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

runSmoke().catch((error) => {
  console.error("[field-3d-parity-smoke] failure");
  console.error(error);
  process.exitCode = 1;
});
