import { afterEach, describe, expect, it } from "vitest";
import { createNewGameState } from "../../core/initialState";
import { setGameState } from "../../state/gameStore";
import { getFieldMap } from "../maps";
import { createNpc, getNpcInRange } from "../npcs";
import type { FieldMap, PlayerAvatar } from "../types";
import {
  HAVEN3D_FIELD_TILE_SIZE,
  canAvatarMoveTo,
  createHaven3DSceneLayout,
  fieldToHavenWorld,
  getInteractionZoneForAvatar,
  havenWorldToField,
} from "./coordinates";
import { HAVEN3D_GEARBLADE_MODES, createHaven3DModeController } from "./modes";
import {
  getHaven3DEnemyDefense,
  resolveHaven3DGearbladeDamage,
} from "./combatRules";
import {
  createHaven3DTargetCandidates,
  selectNextHaven3DTarget,
} from "./targeting";

function makeTestMap(): FieldMap {
  return {
    id: "test_haven3d",
    name: "Test HAVEN",
    width: 6,
    height: 4,
    tiles: Array.from({ length: 4 }, (_, y) => (
      Array.from({ length: 6 }, (_, x) => ({
        x,
        y,
        walkable: x > 0 && x < 5 && y > 0 && y < 3,
        type: x > 0 && x < 5 && y > 0 && y < 3 ? "floor" : "wall",
      }))
    )),
    objects: [],
    interactionZones: [
      {
        id: "interact_test_node",
        x: 2,
        y: 1,
        width: 2,
        height: 1,
        action: "shop",
        label: "TEST NODE",
      },
    ],
  };
}

function makeAvatar(x: number, y: number): PlayerAvatar {
  return {
    x,
    y,
    width: 32,
    height: 32,
    speed: 240,
    facing: "south",
  };
}

function makeEnemy(id: string, name: string, x: number, y: number, hp = 10) {
  return {
    id,
    name,
    x,
    y,
    width: 36,
    height: 36,
    hp,
    maxHp: 10,
    speed: 70,
    facing: "south" as const,
    lastMoveTime: 0,
    vx: 0,
    vy: 0,
    knockbackTime: 0,
    aggroRange: 320,
  };
}

describe("HAVEN 3D field adapter", () => {
  afterEach(() => {
    setGameState(createNewGameState());
  });

  it("round-trips field pixels through centered 3D world coordinates", () => {
    const map = makeTestMap();
    const fieldPoint = { x: 3 * HAVEN3D_FIELD_TILE_SIZE, y: 2 * HAVEN3D_FIELD_TILE_SIZE };

    const world = fieldToHavenWorld(map, fieldPoint, 1.25);
    const restored = havenWorldToField(map, world);

    expect(world.y).toBe(1.25);
    expect(restored.x).toBeCloseTo(fieldPoint.x, 5);
    expect(restored.y).toBeCloseTo(fieldPoint.y, 5);
  });

  it("resolves interaction zones from the preserved field-space avatar position", () => {
    const map = makeTestMap();
    const avatar = makeAvatar(2.5 * HAVEN3D_FIELD_TILE_SIZE, 1.5 * HAVEN3D_FIELD_TILE_SIZE);

    expect(getInteractionZoneForAvatar(map, avatar)?.id).toBe("interact_test_node");
  });

  it("keeps movement collision based on the source field map walkability", () => {
    const map = makeTestMap();

    expect(canAvatarMoveTo(map, 2 * HAVEN3D_FIELD_TILE_SIZE, 2 * HAVEN3D_FIELD_TILE_SIZE, 32, 32)).toBe(true);
    expect(canAvatarMoveTo(map, 0.5 * HAVEN3D_FIELD_TILE_SIZE, 0.5 * HAVEN3D_FIELD_TILE_SIZE, 32, 32)).toBe(false);
  });

  it("reflects saved HAVEN node layout in the authoritative base camp map", () => {
    setGameState({
      ...createNewGameState(),
      uiLayout: {
        baseCampFieldNodeLayouts: {
          shop: { x: 9, y: 8 },
        },
      },
    });

    const map = getFieldMap("base_camp");
    const shop = map.objects.find((object) => object.id === "shop_station");
    const zone = map.interactionZones.find((entry) => entry.id === "interact_shop");

    expect(shop).toMatchObject({ x: 9, y: 8 });
    expect(zone).toMatchObject({ x: 9, y: 8 });
  });

  it("round-trips saved Build Mode node positions through the 3D scene layout", () => {
    setGameState({
      ...createNewGameState(),
      uiLayout: {
        baseCampFieldNodeLayouts: {
          quarters: { x: 15, y: 7 },
        },
      },
    });

    const map = getFieldMap("base_camp");
    const layout = createHaven3DSceneLayout(map);
    const quartersObject = layout.objects.find((object) => object.id === "quarters_station");
    const quartersZone = layout.zones.find((zone) => zone.id === "interact_quarters");
    const objectFieldCenter = havenWorldToField(map, quartersObject!.worldCenter);
    const zoneFieldCenter = havenWorldToField(map, quartersZone!.worldCenter);

    expect(quartersObject?.fieldOrigin).toEqual({ x: 15, y: 7 });
    expect(quartersZone?.fieldOrigin).toEqual({ x: 15, y: 7 });
    expect(objectFieldCenter.x).toBeCloseTo(quartersObject!.fieldCenter.x, 5);
    expect(objectFieldCenter.y).toBeCloseTo(quartersObject!.fieldCenter.y, 5);
    expect(zoneFieldCenter.x).toBeCloseTo(quartersZone!.fieldCenter.x, 5);
    expect(zoneFieldCenter.y).toBeCloseTo(quartersZone!.fieldCenter.y, 5);
  });

  it("does not include hidden HAVEN nodes in the 3D scene layout", () => {
    setGameState({
      ...createNewGameState(),
      uiLayout: {
        baseCampFieldNodeLayouts: {
          shop: { x: 3, y: 3, hidden: true },
        },
      },
    });

    const layout = createHaven3DSceneLayout(getFieldMap("base_camp"));

    expect(layout.objects.some((object) => object.id === "shop_station")).toBe(false);
    expect(layout.zones.some((zone) => zone.id === "interact_shop")).toBe(false);
  });

  it("keeps NPC talk range in field pixels for the 3D runtime", () => {
    const npc = createNpc("npc_test_range", "Range Tester", 132, 132, "npc_test");

    expect(getNpcInRange(makeAvatar(132, 178), [npc])?.id).toBe("npc_test_range");
    expect(getNpcInRange(makeAvatar(132, 240), [npc])).toBeNull();
  });

  it("keeps future Gearblade modes internally gated off by default", () => {
    const disabledController = createHaven3DModeController();
    const enabledController = createHaven3DModeController({
      enableGearbladeModes: true,
      initialMode: "launcher",
    });

    expect(HAVEN3D_GEARBLADE_MODES).toEqual(["blade", "launcher", "grapple"]);
    expect(disabledController.activeMode).toBeNull();
    expect([...disabledController.enabledModes]).toEqual([]);
    expect(enabledController.activeMode).toBe("launcher");
    expect([...enabledController.enabledModes]).toEqual(["blade", "launcher", "grapple"]);
  });

  it("can expose only the Blade mode for the first 3D HAVEN slice", () => {
    const bladeController = createHaven3DModeController({
      enableGearbladeModes: true,
      enabledModes: ["blade"],
      initialMode: "launcher",
    });

    expect(bladeController.activeMode).toBe("blade");
    expect([...bladeController.enabledModes]).toEqual(["blade"]);
  });

  it("builds Z-target candidates for every live NPC and enemy in range order", () => {
    const origin = { x: 100, y: 100 };
    const npc = createNpc("npc_close", "Close NPC", 132, 100, "npc_test", { routeMode: "none" });
    const liveEnemy = makeEnemy("enemy_live", "Live Enemy", 100, 170);
    const deadEnemy = makeEnemy("enemy_dead", "Dead Enemy", 104, 104, 0);

    const targets = createHaven3DTargetCandidates(origin, [npc], [liveEnemy, deadEnemy]);

    expect(targets.map((target) => target.key)).toEqual(["npc:npc_close", "enemy:enemy_live"]);
  });

  it("cycles Z-target selection across NPCs and enemies", () => {
    const targets = createHaven3DTargetCandidates(
      { x: 100, y: 100 },
      [createNpc("npc_one", "NPC One", 140, 100, "npc_test", { routeMode: "none" })],
      [
        makeEnemy("enemy_one", "Enemy One", 180, 100),
        makeEnemy("enemy_two", "Enemy Two", 220, 100),
      ],
    );

    const first = selectNextHaven3DTarget(targets, null);
    const second = selectNextHaven3DTarget(targets, first);
    const previous = selectNextHaven3DTarget(targets, second, true);

    expect(first?.key).toBe("npc:npc_one");
    expect(second?.key).toBe("enemy:enemy_one");
    expect(previous?.key).toBe("npc:npc_one");
  });

  it("requires Grapple to open shields and Launcher to crack armor", () => {
    const shieldedEnemy = {
      id: "shielded_enemy",
      name: "Shielded Enemy",
      kind: "shield",
      gearbladeDefenseBroken: false,
    };
    const armoredEnemy = {
      id: "armored_enemy",
      name: "Armored Enemy",
      kind: "armor",
      gearbladeDefenseBroken: false,
    };

    expect(getHaven3DEnemyDefense(shieldedEnemy)).toBe("shield");
    expect(resolveHaven3DGearbladeDamage(shieldedEnemy, "blade")).toMatchObject({
      blocked: true,
      requiredBreaker: "grapple",
    });
    expect(resolveHaven3DGearbladeDamage(shieldedEnemy, "grapple")).toMatchObject({
      blocked: false,
      breaksDefense: true,
    });
    expect(resolveHaven3DGearbladeDamage(armoredEnemy, "grapple")).toMatchObject({
      blocked: true,
      requiredBreaker: "launcher",
    });
    expect(resolveHaven3DGearbladeDamage(armoredEnemy, "launcher")).toMatchObject({
      blocked: false,
      breaksDefense: true,
    });
  });
});
