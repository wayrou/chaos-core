"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGearBalanceScore = computeGearBalanceScore;
exports.getGearBalanceReference = getGearBalanceReference;
exports.toBalanceableImportedGear = toBalanceableImportedGear;
exports.validateGearBalance = validateGearBalance;
const armor_1 = require("../data/armor");
const weapons_1 = require("../data/weapons");
const STAT_KEYS = ["atk", "def", "agi", "acc", "hp"];
const STAT_WEIGHTS = {
    atk: 1.35,
    def: 1.15,
    agi: 1.05,
    acc: 1,
    hp: 0.9,
};
const CARD_SCORE_WEIGHT = 0.85;
const SCORE_BAND_PADDING = {
    weapon: 0.9,
    helmet: 0.75,
    chestpiece: 0.75,
    accessory: 0.7,
};
const CARD_BAND_PADDING = 1;
const STAT_BAND_PADDING = {
    atk: 2,
    def: 2,
    agi: 2,
    acc: 2,
    hp: 2,
};
const REFERENCE_CATALOG = {
    weapon: weapons_1.STARTER_WEAPONS.map((gear) => ({
        id: gear.id,
        name: gear.name,
        slot: "weapon",
        stats: { ...gear.stats },
        cardsGranted: [...gear.cardsGranted],
        weaponType: gear.weaponType,
        isMechanical: gear.isMechanical,
    })),
    helmet: armor_1.STARTER_HELMETS.map((gear) => ({
        id: gear.id,
        name: gear.name,
        slot: "helmet",
        stats: { ...gear.stats },
        cardsGranted: [...gear.cardsGranted],
    })),
    chestpiece: armor_1.STARTER_CHESTPIECES.map((gear) => ({
        id: gear.id,
        name: gear.name,
        slot: "chestpiece",
        stats: { ...gear.stats },
        cardsGranted: [...gear.cardsGranted],
    })),
    accessory: armor_1.STARTER_ACCESSORIES.map((gear) => ({
        id: gear.id,
        name: gear.name,
        slot: "accessory",
        stats: { ...gear.stats },
        cardsGranted: [...gear.cardsGranted],
    })),
};
const REFERENCE_BANDS = {
    weapon: buildReferenceBand("weapon"),
    helmet: buildReferenceBand("helmet"),
    chestpiece: buildReferenceBand("chestpiece"),
    accessory: buildReferenceBand("accessory"),
};
function roundMetric(value) {
    return Math.round(value * 10) / 10;
}
function average(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}
function getEffectiveCardCount(gear) {
    const grantedCards = Array.isArray(gear.cardsGranted) ? gear.cardsGranted.length : 0;
    const slotCapacity = Number.isFinite(gear.validationSlotCapacity) ? Math.max(0, gear.validationSlotCapacity ?? 0) : 0;
    return grantedCards + slotCapacity;
}
function buildReferenceBand(slot) {
    const referenceItems = REFERENCE_CATALOG[slot];
    const scoreValues = referenceItems.map((gear) => computeGearBalanceScore(gear));
    const cardValues = referenceItems.map((gear) => getEffectiveCardCount(gear));
    return {
        score: {
            min: roundMetric(Math.min(...scoreValues)),
            max: roundMetric(Math.max(...scoreValues)),
            average: roundMetric(average(scoreValues)),
        },
        cards: {
            min: Math.min(...cardValues),
            max: Math.max(...cardValues),
            average: roundMetric(average(cardValues)),
        },
        stats: STAT_KEYS.reduce((stats, statKey) => {
            const values = referenceItems.map((gear) => gear.stats[statKey]);
            stats[statKey] = {
                min: Math.min(...values),
                max: Math.max(...values),
                average: roundMetric(average(values)),
            };
            return stats;
        }, {
            atk: { min: 0, max: 0, average: 0 },
            def: { min: 0, max: 0, average: 0 },
            agi: { min: 0, max: 0, average: 0 },
            acc: { min: 0, max: 0, average: 0 },
            hp: { min: 0, max: 0, average: 0 },
        }),
    };
}
function formatSlotLabel(slot) {
    switch (slot) {
        case "weapon":
            return "weapon";
        case "helmet":
            return "helmet";
        case "chestpiece":
            return "chestpiece";
        case "accessory":
            return "accessory";
        default:
            return "gear";
    }
}
function computeGearBalanceScore(gear) {
    const statScore = STAT_KEYS.reduce((total, statKey) => total + gear.stats[statKey] * STAT_WEIGHTS[statKey], 0);
    const effectiveCards = getEffectiveCardCount(gear);
    return roundMetric(statScore + effectiveCards * CARD_SCORE_WEIGHT);
}
function getGearBalanceReference(slot) {
    return REFERENCE_BANDS[slot];
}
function toBalanceableImportedGear(gear) {
    return {
        id: gear.id,
        name: gear.name,
        slot: gear.slot,
        stats: { ...gear.stats },
        cardsGranted: [...(gear.cardsGranted ?? [])],
        weaponType: gear.weaponType,
        isMechanical: gear.isMechanical,
    };
}
function validateGearBalance(gear) {
    const slotLabel = formatSlotLabel(gear.slot);
    const reference = getGearBalanceReference(gear.slot);
    const findings = [];
    const effectiveCardCount = getEffectiveCardCount(gear);
    const targetCardCountMin = Math.max(0, reference.cards.min - CARD_BAND_PADDING);
    const targetCardCountMax = reference.cards.max + CARD_BAND_PADDING;
    const score = computeGearBalanceScore(gear);
    const targetScoreMin = roundMetric(reference.score.min - SCORE_BAND_PADDING[gear.slot]);
    const targetScoreMax = roundMetric(reference.score.max + SCORE_BAND_PADDING[gear.slot]);
    if (gear.slot === "weapon" && !gear.weaponType) {
        findings.push({
            severity: "error",
            code: "missing_weapon_type",
            message: "Weapon entries should declare a weapon type before they are considered balance-safe.",
        });
    }
    if (effectiveCardCount < targetCardCountMin) {
        findings.push({
            severity: targetCardCountMin - effectiveCardCount >= 2 ? "error" : "warning",
            code: "card_package_low",
            message: `Card package ${effectiveCardCount} is below the current ${slotLabel} band (${targetCardCountMin}-${targetCardCountMax}).`,
        });
    }
    else if (effectiveCardCount > targetCardCountMax) {
        findings.push({
            severity: effectiveCardCount - targetCardCountMax >= 2 ? "error" : "warning",
            code: "card_package_high",
            message: `Card package ${effectiveCardCount} is above the current ${slotLabel} band (${targetCardCountMin}-${targetCardCountMax}).`,
        });
    }
    for (const statKey of STAT_KEYS) {
        const value = gear.stats[statKey];
        const targetMin = reference.stats[statKey].min - STAT_BAND_PADDING[statKey];
        const targetMax = reference.stats[statKey].max + STAT_BAND_PADDING[statKey];
        if (value < targetMin) {
            findings.push({
                severity: targetMin - value >= 3 ? "error" : "warning",
                code: `${statKey}_low`,
                message: `${statKey.toUpperCase()} ${value} is below the current ${slotLabel} range (${targetMin} to ${targetMax}).`,
            });
        }
        else if (value > targetMax) {
            findings.push({
                severity: value - targetMax >= 3 ? "error" : "warning",
                code: `${statKey}_high`,
                message: `${statKey.toUpperCase()} ${value} is above the current ${slotLabel} range (${targetMin} to ${targetMax}).`,
            });
        }
    }
    if (score < targetScoreMin) {
        findings.push({
            severity: targetScoreMin - score >= 2 ? "error" : "warning",
            code: "score_low",
            message: `Power score ${score} is below the current ${slotLabel} target band (${targetScoreMin}-${targetScoreMax}).`,
        });
    }
    else if (score > targetScoreMax) {
        findings.push({
            severity: score - targetScoreMax >= 2 ? "error" : "warning",
            code: "score_high",
            message: `Power score ${score} is above the current ${slotLabel} target band (${targetScoreMin}-${targetScoreMax}).`,
        });
    }
    const status = findings.some((finding) => finding.severity === "error")
        ? "fail"
        : findings.length > 0
            ? "caution"
            : "pass";
    const summary = status === "pass"
        ? `Within the current ${slotLabel} balance band.`
        : status === "caution"
            ? `Close, but this ${slotLabel} is drifting outside the current balance band.`
            : `This ${slotLabel} sits well outside the current balance band.`;
    return {
        slot: gear.slot,
        status,
        summary,
        metrics: {
            score,
            targetScoreMin,
            targetScoreMax,
            effectiveCardCount,
            targetCardCountMin,
            targetCardCountMax,
        },
        findings,
    };
}
