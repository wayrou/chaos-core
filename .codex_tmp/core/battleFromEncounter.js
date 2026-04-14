// ============================================================================
// CHAOS CORE - BATTLE CREATION FROM ENCOUNTERS
// Creates battle state from encounter definitions
// ============================================================================
import { getEnemyDefinition } from "./enemies";
import { createBattleUnitState } from "./battle";
import { generateCover } from "./coverGenerator";
import { generateStructuredBoardLayout } from "./terrainGeneration";
import { getActiveRunTavernMealBuff } from "./tavernMeals";
import { getImportedUnit } from "../content/technica";
function createImportedEnemyBaseUnit(instanceId, template, pos) {
    return {
        id: instanceId,
        name: template.name,
        isEnemy: true,
        hp: template.stats.maxHp,
        maxHp: template.stats.maxHp,
        agi: template.stats.agi,
        pos,
        hand: [],
        drawPile: [],
        discardPile: [],
        strain: 0,
        atk: template.stats.atk,
        def: template.stats.def,
        acc: template.stats.acc,
        unitClass: template.currentClassId,
        stats: {
            maxHp: template.stats.maxHp,
            atk: template.stats.atk,
            def: template.stats.def,
            agi: template.stats.agi,
            acc: template.stats.acc,
        },
        loadout: {
            primaryWeapon: template.loadout.primaryWeapon ?? null,
            secondaryWeapon: template.loadout.secondaryWeapon ?? null,
            helmet: template.loadout.helmet ?? null,
            chestpiece: template.loadout.chestpiece ?? null,
            accessory1: template.loadout.accessory1 ?? null,
            accessory2: template.loadout.accessory2 ?? null,
            weapon: template.loadout.primaryWeapon ?? null,
        },
    };
}
export function createBattleFromEncounter(gameState, encounter, encounterSeed, options = {}) {
    // Get party units
    const partyUnitIds = options.partyUnitIds ?? gameState.partyUnitIds ?? [];
    const sourceUnitsById = options.unitsById ?? gameState.unitsById;
    const units = {};
    const activeRunMealBuff = getActiveRunTavernMealBuff(gameState);
    // Create player units (without positions initially - placement phase)
    partyUnitIds.forEach(unitId => {
        const baseUnit = sourceUnitsById[unitId];
        if (baseUnit) {
            units[unitId] = createBattleUnitState(baseUnit, {
                isEnemy: false,
                pos: null, // Will be placed in placement phase
                gearSlots: gameState.gearSlots ?? {},
            }, gameState.equipmentById);
            if (activeRunMealBuff) {
                const battleUnit = units[unitId];
                switch (activeRunMealBuff.effect) {
                    case "hp":
                        battleUnit.maxHp += activeRunMealBuff.amount;
                        battleUnit.hp += activeRunMealBuff.amount;
                        break;
                    case "atk":
                        battleUnit.atk += activeRunMealBuff.amount;
                        break;
                    case "def":
                        battleUnit.def += activeRunMealBuff.amount;
                        break;
                    case "agi":
                        battleUnit.agi += activeRunMealBuff.amount;
                        break;
                }
            }
        }
    });
    // Create enemy units from encounter
    let enemyInstanceCounter = 0;
    // Calculate middle Y position to center enemies around
    const middleY = Math.floor(encounter.gridHeight / 2);
    const rightEdgeX = encounter.gridWidth - 1;
    // Calculate total number of enemies
    let totalEnemyCount = 0;
    encounter.enemyUnits.forEach(({ count }) => {
        totalEnemyCount += count;
    });
    // Generate enemy positions centered around the middle line on right edge
    const enemyPositions = [];
    if (totalEnemyCount > 0) {
        for (let i = 0; i < totalEnemyCount; i++) {
            const offset = Math.floor((i + 1) / 2);
            const direction = i % 2 === 1 ? -1 : 1;
            let yPos = middleY + direction * offset;
            // Clamp to valid grid bounds
            yPos = Math.max(0, Math.min(encounter.gridHeight - 1, yPos));
            enemyPositions.push({ x: rightEdgeX, y: yPos });
        }
    }
    let positionIndex = 0;
    encounter.enemyUnits.forEach(({ enemyId, count, levelMod = 0, elite = false }) => {
        const importedTemplate = getImportedUnit(enemyId);
        if (importedTemplate?.spawnRole === "enemy") {
            for (let i = 0; i < count; i++) {
                const instanceId = `enemy_${enemyId}_${enemyInstanceCounter++}`;
                const pos = enemyPositions[positionIndex];
                positionIndex++;
                units[instanceId] = createBattleUnitState(createImportedEnemyBaseUnit(instanceId, importedTemplate, pos), {
                    isEnemy: true,
                    pos,
                }, gameState.equipmentById);
            }
            return;
        }
        const enemyDef = getEnemyDefinition(enemyId);
        if (!enemyDef) {
            console.warn(`[BATTLE] Unknown enemy: ${enemyId}`);
            return;
        }
        // Create count instances of this enemy
        for (let i = 0; i < count; i++) {
            const instanceId = `enemy_${enemyId}_${enemyInstanceCounter++}`;
            // Apply level mod and elite bonuses
            const hpMod = levelMod * 2 + (elite ? 5 : 0);
            const statMod = levelMod + (elite ? 1 : 0);
            // Get position (centered around middle line)
            const pos = enemyPositions[positionIndex];
            positionIndex++;
            // Create base unit from enemy definition
            const baseUnit = {
                id: instanceId,
                name: elite ? `Elite ${enemyDef.name}` : enemyDef.name,
                isEnemy: true,
                hp: enemyDef.baseStats.hp + hpMod,
                maxHp: enemyDef.baseStats.hp + hpMod,
                agi: enemyDef.baseStats.agi + statMod,
                pos: pos,
                hand: [],
                drawPile: enemyDef.deck || ["card_strike", "card_guard"], // Default cards
                discardPile: [],
                strain: 0,
                atk: enemyDef.baseStats.atk + statMod,
                def: enemyDef.baseStats.def + statMod,
                acc: 80, // Default accuracy
                move: enemyDef.baseStats.move,
            };
            units[instanceId] = createBattleUnitState(baseUnit, {
                isEnemy: true,
                pos: pos,
            }, gameState.equipmentById);
        }
    });
    const seedForCover = encounterSeed ||
        `cover_${encounter.gridWidth}x${encounter.gridHeight}_${encounter.enemyUnits.length}_${encounter.enemyUnits.map(e => e.enemyId).join("_")}`;
    const boardLayout = generateStructuredBoardLayout(encounter.gridWidth, encounter.gridHeight, seedForCover, "encounter");
    // Create tiles
    const tiles = [];
    for (let y = 0; y < encounter.gridHeight; y++) {
        for (let x = 0; x < encounter.gridWidth; x++) {
            tiles.push({
                pos: { x, y },
                terrain: "floor",
                elevation: boardLayout.elevations[x]?.[y] ?? 0,
                surface: boardLayout.surfaces[`${x},${y}`] ?? "industrial",
            });
        }
    }
    // Generate cover deterministically based on battle ID (which includes timestamp, but we'll use a deterministic seed)
    // Get reserved cells (spawn zones - left edge for players, right edge for enemies)
    const reservedCells = [];
    // Left edge (player spawn)
    for (let y = 0; y < encounter.gridHeight; y++) {
        reservedCells.push({ x: 0, y });
    }
    // Right edge (enemy spawn)
    for (let y = 0; y < encounter.gridHeight; y++) {
        reservedCells.push({ x: encounter.gridWidth - 1, y });
    }
    const tilesWithCover = generateCover(tiles, encounter.gridWidth, encounter.gridHeight, seedForCover, reservedCells);
    // Create battle state (will start in placement phase)
    const battle = {
        id: `battle_${Date.now()}`,
        floorId: encounter.floorId ?? "current_floor",
        roomId: encounter.roomId ?? "current_room",
        gridWidth: encounter.gridWidth,
        gridHeight: encounter.gridHeight,
        tiles: tilesWithCover,
        units,
        turnOrder: [], // Will be computed after placement
        activeUnitId: null,
        phase: "placement",
        turnCount: 0,
        log: [
            `SLK//ENGAGE :: Engagement feed online.`,
            `SLK//ROOM   :: Linked to node.`,
            ...(activeRunMealBuff
                ? [`S/COM//BUFF :: ${activeRunMealBuff.name} active for this run.`]
                : []),
            encounter.introText || `SLK//PLACE  :: Unit placement phase - position your squad.`,
        ],
        placementState: {
            placedUnitIds: [],
            selectedUnitId: null,
            maxUnitsPerSide: options.maxUnitsPerSide ?? Math.max(3, Math.min(10, Math.floor(encounter.gridWidth * encounter.gridHeight * 0.25))),
        },
        modeContext: options.modeContext,
    };
    return battle;
}
