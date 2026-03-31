import {
    CampaignProgress,
    KeyRoomState,
    loadCampaignProgress,
    saveCampaignProgress,
} from "./campaign";

// Configuration for Key Room Upkeep and Threat
const DISTANCE_PENALTY_RATES = [100, 85, 70, 60]; // index = floors away

const BASE_UPKEEP_COST = 5; // Base supply bandwidth required
const DEPTH_MULTIPLIER = 2; // Upkeep increases by +2 per floor depth

const THREAT_INCREASE_TIME = 2; // Threat +2 per time step
const THREAT_INCREASE_UPKEEP_FAIL = 10; // Threat +10 if upkeep fails
const THREAT_INCREASE_FLOOR = 15; // Threat +15 when descending

/**
 * Recalculate the distance penalties for all active key rooms
 */
export function recalculateDistancePenalties(progress: CampaignProgress): CampaignProgress {
    if (!progress.activeRun) return progress;

    const activeRun = progress.activeRun;
    const currentFloor = activeRun.floorIndex;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const updatedKeyRoomsByFloor = { ...keyRoomsByFloor };

    for (const [fIndexStr, floorKeyRooms] of Object.entries(updatedKeyRoomsByFloor)) {
        const fIndex = parseInt(fIndexStr, 10);
        const floorsAway = Math.max(0, currentFloor - fIndex);
        const penaltyIndex = Math.min(floorsAway, DISTANCE_PENALTY_RATES.length - 1);
        const effectiveness = DISTANCE_PENALTY_RATES[penaltyIndex];

        updatedKeyRoomsByFloor[fIndex] = floorKeyRooms.map(kr => ({
            ...kr,
            distancePenalty: effectiveness,
        }));
    }

    return {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: updatedKeyRoomsByFloor,
        },
    };
}

/**
 * Process a single time step across all Controlled Rooms
 * Consumes supply routing and handles Threat increases
 */
export function processControlledRoomsTimeStep(
    reason: "room_cleared" | "floor_transition" | "field_mode",
    globalSupplyAvailable: number
): { progress: CampaignProgress, remainingSupply: number } {
    const progress = loadCampaignProgress();
    if (!progress.activeRun) return { progress, remainingSupply: globalSupplyAvailable };

    const activeRun = progress.activeRun;
    const currentFloor = activeRun.floorIndex;
    let remainingSupply = globalSupplyAvailable;

    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const updatedKeyRoomsByFloor: Record<number, KeyRoomState[]> = {};

    for (const [fIndexStr, floorKeyRooms] of Object.entries(keyRoomsByFloor)) {
        const fIndex = parseInt(fIndexStr, 10);
        const updatedFloorRooms = floorKeyRooms.map(kr => {
            let threatIncrease = 0;
            let upkeepFailed = false;

            // Base time threat increase
            if (reason === "room_cleared" || reason === "field_mode") {
                threatIncrease += THREAT_INCREASE_TIME;
            }

            if (reason === "floor_transition") {
                threatIncrease += THREAT_INCREASE_FLOOR;
            }

            // Calculate Upkeep
            const upkeepCost = BASE_UPKEEP_COST + (currentFloor * DEPTH_MULTIPLIER);

            // Attempt to pay upkeep with available supply
            if (remainingSupply >= upkeepCost) {
                remainingSupply -= upkeepCost;
                upkeepFailed = false;
            } else {
                // Failed upkeep
                upkeepFailed = true;
                threatIncrease += THREAT_INCREASE_UPKEEP_FAIL;
            }

            const newThreat = Math.min(100, (kr.threatLevel || 0) + threatIncrease - (kr.fortificationLevel * 5));

            return {
                ...kr,
                threatLevel: Math.max(0, newThreat),
                upkeepFailed,
            };
        });

        updatedKeyRoomsByFloor[fIndex] = updatedFloorRooms;
    }

    const updatedProgress = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: updatedKeyRoomsByFloor,
        },
    };

    saveCampaignProgress(updatedProgress);
    return { progress: updatedProgress, remainingSupply };
}
