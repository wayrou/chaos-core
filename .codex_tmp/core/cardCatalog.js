import { getAllEquipmentCards, getAllStarterEquipment } from "./equipment";
import { getImportedCard, isTechnicaContentDisabled } from "../content/technica";
import { createEffectFlowFromLegacyCardEffects } from "./effectFlow";
const EQUIPPED_WEAPON_SOURCE_ID = "__equipped_weapon__";
const SELF_NAME_HINTS = [
    "guard",
    "stance",
    "brace",
    "ward",
    "barrier",
    "veil",
    "hide",
    "fade",
    "roll",
    "focus",
    "resolve",
    "dodge",
    "shield",
    "protection",
    "plating",
    "form",
    "bipod",
    "reload",
    "vent",
    "release",
    "lock",
    "memory",
    "turn",
    "glow",
    "attunement",
    "presence",
    "padding",
    "guard",
    "footing",
];
const ALLY_TEXT_HINTS = [
    "target ally",
    "an ally",
    "all allies",
    "adjacent allies",
    "allied",
];
function pushWeaponTag(tags, tag) {
    if (!tags.includes(tag)) {
        tags.push(tag);
    }
}
function parseHeatDelta(description) {
    const removeMatch = description.match(/remove\s+(\d+)\s+heat/i);
    if (removeMatch) {
        return -parseInt(removeMatch[1], 10);
    }
    const gainMatch = description.match(/\+(\d+)\s+heat/i) ||
        description.match(/gain\s+\+?(\d+)\s+heat/i) ||
        description.match(/adds?\s+(\d+)\s+heat/i);
    if (gainMatch) {
        return parseInt(gainMatch[1], 10);
    }
    return null;
}
function inferWeaponRules(card, target, description) {
    const lowerName = card.name.toLowerCase();
    const lowerDesc = description.toLowerCase();
    const equipmentById = getAllStarterEquipment();
    const sourceEquipment = card.sourceEquipmentId ? equipmentById[card.sourceEquipmentId] : null;
    const sourceWeapon = sourceEquipment && sourceEquipment.slot === "weapon"
        ? sourceEquipment
        : null;
    const isCoreWeaponCard = card.id === "core_basic_attack" || card.id === "core_overwatch";
    if (!sourceWeapon && !isCoreWeaponCard) {
        return undefined;
    }
    const tags = ["weapon_card"];
    const attackKeywords = ["attack", "shot", "strike", "slash", "jab", "blast", "bolt", "volley", "fire", "thrust", "swing"];
    const indirectKeywords = ["lob", "mortar", "radius", "aoe", "all enemies", "adjacent enemies", "chain lightning", "cone", "arc"];
    const multiKeywords = ["fire twice", "attack twice", "three attacks", "two shots", "double", "twice"];
    if (target === "enemy" ||
        typeof card.damage === "number" ||
        attackKeywords.some((keyword) => lowerName.includes(keyword) || lowerDesc.includes(keyword))) {
        pushWeaponTag(tags, "attack");
    }
    if (multiKeywords.some((keyword) => lowerDesc.includes(keyword) || lowerName.includes(keyword))) {
        pushWeaponTag(tags, "multi_attack");
    }
    if (indirectKeywords.some((keyword) => lowerDesc.includes(keyword) || lowerName.includes(keyword))) {
        pushWeaponTag(tags, "aoe");
    }
    if (tags.includes("attack") && !tags.includes("aoe")) {
        pushWeaponTag(tags, "direct");
    }
    if (lowerName.includes("reload") || lowerDesc.includes("reload")) {
        pushWeaponTag(tags, "reload");
    }
    if (lowerDesc.includes("remove") && lowerDesc.includes("heat")) {
        pushWeaponTag(tags, "heat_removal");
    }
    if (target === "self" &&
        ["guard", "brace", "parry", "ward", "barrier", "plating", "stance", "shield"].some((keyword) => lowerName.includes(keyword) || lowerDesc.includes(keyword))) {
        pushWeaponTag(tags, "guard_brace");
    }
    const explicitHeatDelta = parseHeatDelta(description);
    const isMechanical = Boolean(sourceWeapon?.isMechanical);
    const heatDelta = explicitHeatDelta ??
        ((isMechanical || isCoreWeaponCard) && tags.includes("attack") ? 1 : 0);
    const ammoProfile = sourceWeapon?.ammoProfile;
    const defaultAmmoCost = ammoProfile?.defaultAttackAmmoCost ?? (sourceWeapon?.ammoMax ? 1 : 0);
    const ammoCost = tags.includes("reload") || tags.includes("heat_removal")
        ? 0
        : tags.includes("attack") && (sourceWeapon?.ammoMax || isCoreWeaponCard)
            ? defaultAmmoCost || 1
            : 0;
    return {
        sourceWeaponId: sourceWeapon?.id ?? EQUIPPED_WEAPON_SOURCE_ID,
        heatDelta,
        ammoCost,
        tags,
        clutchCompatible: Boolean(sourceWeapon),
    };
}
function getCatalogCards() {
    return Object.values(getAllEquipmentCards());
}
function parseRange(range) {
    if (!range)
        return 1;
    const normalized = range.trim().toLowerCase();
    if (normalized.includes("self"))
        return 0;
    const numbers = normalized.match(/\d+/g);
    if (!numbers || numbers.length === 0)
        return 1;
    return parseInt(numbers[numbers.length - 1], 10);
}
function isPlaceholderDescription(description) {
    const normalized = description.trim().toLowerCase();
    return (normalized.startsWith("use ") ||
        normalized === "ranged attack." ||
        normalized === "defensive action or stance." ||
        normalized === "ranged attack");
}
function inferTarget(card, description) {
    const lowerName = card.name.toLowerCase();
    const lowerDesc = description.toLowerCase();
    if (ALLY_TEXT_HINTS.some(hint => lowerDesc.includes(hint)))
        return "ally";
    if (lowerDesc.includes("move ") && !lowerDesc.includes("damage") && !lowerDesc.includes("deal"))
        return "self";
    if ((card.range || "").toLowerCase().includes("self"))
        return "self";
    if (SELF_NAME_HINTS.some(hint => lowerName.includes(hint)))
        return "self";
    if (lowerDesc.includes("until next turn") || lowerDesc.includes("gain +"))
        return "self";
    if (lowerDesc.includes("heal") || lowerDesc.includes("restore") || lowerDesc.includes("recover")) {
        return lowerDesc.includes("self") ? "self" : "ally";
    }
    if (card.damage && card.damage > 0)
        return "enemy";
    if (lowerDesc.includes("enemy") || lowerDesc.includes("target"))
        return "enemy";
    return "self";
}
function buildGeneratedDescription(card, target) {
    const damage = card.damage;
    if (target === "enemy") {
        if (damage && damage > 0) {
            return `Deal ${damage} damage.`;
        }
        return "Disrupt an enemy unit.";
    }
    if (target === "ally") {
        return "Grant an allied unit a tactical boost.";
    }
    return "Gain +2 DEF until next turn.";
}
function normalizeDescription(card) {
    if (!isPlaceholderDescription(card.description)) {
        return card.description.trim();
    }
    const target = inferTarget(card, card.description);
    return buildGeneratedDescription(card, target);
}
function addEffect(effects, effect) {
    const exists = effects.some(existing => existing.type === effect.type &&
        existing.amount === effect.amount &&
        existing.duration === effect.duration &&
        existing.stat === effect.stat &&
        existing.tiles === effect.tiles);
    if (!exists)
        effects.push(effect);
}
function parseEffectsFromDescription(description, target, damage) {
    const effects = [];
    const lower = description.toLowerCase();
    if (damage && damage > 0 && target === "enemy") {
        addEffect(effects, { type: "damage", amount: damage });
    }
    else if (target === "enemy") {
        const damageMatch = lower.match(/deal\s+(\d+)\s+damage/);
        if (damageMatch) {
            addEffect(effects, { type: "damage", amount: parseInt(damageMatch[1], 10) });
        }
    }
    const healMatch = lower.match(/(?:restore|heal|recover)\s+(\d+)\s+hp/);
    if (healMatch) {
        addEffect(effects, { type: "heal", amount: parseInt(healMatch[1], 10) });
    }
    const defMatch = description.match(/\+(\d+)\s*DEF/i);
    if (defMatch) {
        addEffect(effects, { type: "def_up", amount: parseInt(defMatch[1], 10), duration: 1 });
    }
    const atkMatch = description.match(/\+(\d+)\s*ATK/i);
    if (atkMatch) {
        addEffect(effects, { type: "atk_up", amount: parseInt(atkMatch[1], 10), duration: 1 });
    }
    const agiMatch = description.match(/\+(\d+)\s*AGI/i);
    if (agiMatch) {
        addEffect(effects, { type: "agi_up", amount: parseInt(agiMatch[1], 10), duration: 1 });
    }
    const accUpMatch = description.match(/\+(\d+)\s*ACC/i);
    if (accUpMatch) {
        addEffect(effects, { type: "acc_up", amount: parseInt(accUpMatch[1], 10), duration: 1 });
    }
    const accDownMatch = description.match(/-(\d+)\s*ACC/i);
    if (accDownMatch) {
        addEffect(effects, { type: "acc_down", amount: parseInt(accDownMatch[1], 10), duration: 1, stat: "acc" });
    }
    const defDownMatch = description.match(/-(\d+)\s*DEF/i);
    if (defDownMatch) {
        addEffect(effects, { type: "def_down", amount: parseInt(defDownMatch[1], 10), duration: 1, stat: "def" });
    }
    const atkDownMatch = description.match(/-(\d+)\s*ATK/i);
    if (atkDownMatch) {
        addEffect(effects, { type: "atk_down", amount: parseInt(atkDownMatch[1], 10), duration: 1, stat: "atk" });
    }
    const agiDownMatch = description.match(/-(\d+)\s*AGI/i);
    if (agiDownMatch) {
        addEffect(effects, { type: "agi_down", amount: parseInt(agiDownMatch[1], 10), duration: 1, stat: "agi" });
    }
    const moveBoostMatch = lower.match(/move\s+(\d+)\s+extra\s+tiles?/);
    if (moveBoostMatch) {
        addEffect(effects, { type: "move", tiles: parseInt(moveBoostMatch[1], 10) });
    }
    const pushMatch = lower.match(/push\s+(?:target\s+)?(?:back\s+)?(\d+)\s+tile/);
    if (pushMatch) {
        addEffect(effects, { type: "push", amount: parseInt(pushMatch[1], 10) });
    }
    if (lower.includes("stun")) {
        addEffect(effects, { type: "stun", duration: 1 });
    }
    if (lower.includes("burn")) {
        addEffect(effects, { type: "burn", duration: 2 });
    }
    if (lower.includes("end turn")) {
        addEffect(effects, { type: "end_turn" });
    }
    if (effects.length === 0 && target === "self") {
        addEffect(effects, { type: "def_up", amount: 2, duration: 1 });
    }
    return effects;
}
function toResolvedBattleCard(card) {
    const description = normalizeDescription(card);
    const target = inferTarget(card, description);
    const effects = card.chaosCardsToCreate?.length
        ? []
        : parseEffectsFromDescription(description, target, card.damage);
    const weaponRules = card.weaponRules
        ? {
            sourceWeaponId: card.weaponRules.sourceWeaponId ?? card.sourceEquipmentId ?? EQUIPPED_WEAPON_SOURCE_ID,
            heatDelta: card.weaponRules.heatDelta ?? 0,
            ammoCost: card.weaponRules.ammoCost ?? 0,
            tags: card.weaponRules.tags ?? ["weapon_card"],
            clutchCompatible: card.weaponRules.clutchCompatible ?? Boolean(card.sourceEquipmentId),
        }
        : inferWeaponRules(card, target, description);
    const resolved = {
        id: card.id,
        name: card.name,
        type: card.type,
        target,
        strainCost: card.strainCost,
        range: parseRange(card.range),
        description,
        effects,
        effectFlow: effects.length > 0 ? createEffectFlowFromLegacyCardEffects(effects, target === "ally" ? "ally" : target) : undefined,
        sourceEquipmentId: card.sourceEquipmentId,
        weaponRules,
        isChaosCard: card.isChaosCard,
        chaosCardsToCreate: card.chaosCardsToCreate ? [...card.chaosCardsToCreate] : undefined,
    };
    if (card.damage !== undefined)
        resolved.damage = card.damage;
    const healEffect = effects.find(effect => effect.type === "heal");
    if (healEffect?.amount)
        resolved.healing = healEffect.amount;
    const defEffect = effects.find(effect => effect.type === "def_up");
    if (defEffect?.amount)
        resolved.defBuff = defEffect.amount;
    const atkEffect = effects.find(effect => effect.type === "atk_up");
    if (atkEffect?.amount)
        resolved.atkBuff = atkEffect.amount;
    if (card.artPath)
        resolved.artPath = card.artPath;
    return resolved;
}
function toResolvedImportedCard(card) {
    const sourceEquipmentId = card.sourceEquipmentId;
    const isChaosCard = Boolean(card.isChaosCard);
    const chaosCardsToCreate = card.chaosCardsToCreate;
    const equipmentCardLike = {
        id: card.id,
        name: card.name,
        type: card.type,
        strainCost: card.strainCost,
        description: card.description,
        range: `R(${card.range})`,
        damage: card.damage,
        effects: card.effects.map((effect) => effect.type),
        sourceEquipmentId,
        sourceClassId: card.sourceClassId,
        artPath: card.artPath,
    };
    const resolved = {
        id: card.id,
        name: card.name,
        type: card.type,
        target: card.targetType,
        strainCost: card.strainCost,
        range: card.range,
        description: card.description,
        effects: [...card.effects],
        effectFlow: card.effectFlow ?? (card.effects.length > 0 ? createEffectFlowFromLegacyCardEffects(card.effects, card.targetType) : undefined),
        sourceEquipmentId,
        isChaosCard,
        chaosCardsToCreate: chaosCardsToCreate ? [...chaosCardsToCreate] : undefined,
        weaponRules: inferWeaponRules(equipmentCardLike, card.targetType, card.description),
    };
    if (card.damage !== undefined)
        resolved.damage = card.damage;
    if (card.artPath)
        resolved.artPath = card.artPath;
    const healEffect = card.effects.find(effect => effect.type === "heal");
    if (healEffect?.amount)
        resolved.healing = healEffect.amount;
    const defEffect = card.effects.find(effect => effect.type === "def_up");
    if (defEffect?.amount)
        resolved.defBuff = defEffect.amount;
    const atkEffect = card.effects.find(effect => effect.type === "atk_up");
    if (atkEffect?.amount)
        resolved.atkBuff = atkEffect.amount;
    return resolved;
}
const BATTLE_CARD_LOOKUP = Object.fromEntries(getCatalogCards().map(card => [card.id, toResolvedBattleCard(card)]));
export function getResolvedBattleCard(id) {
    const imported = getImportedCard(id);
    if (imported) {
        return toResolvedImportedCard(imported);
    }
    if (isTechnicaContentDisabled("card", id)) {
        return null;
    }
    const direct = BATTLE_CARD_LOOKUP[id];
    if (direct)
        return direct;
    const normalized = id.toLowerCase().replace(/-/g, "_");
    const normalizedImported = getImportedCard(normalized);
    if (normalizedImported) {
        return toResolvedImportedCard(normalizedImported);
    }
    if (isTechnicaContentDisabled("card", normalized)) {
        return null;
    }
    return BATTLE_CARD_LOOKUP[normalized] || null;
}
export function isChaosBattleCardId(id) {
    return Boolean(getResolvedBattleCard(id)?.isChaosCard);
}
export function toCoreCard(card) {
    return {
        id: card.id,
        name: card.name,
        description: card.description,
        strainCost: card.strainCost,
        targetType: card.target === "ally" ? "ally" : card.target,
        range: card.range,
        effects: [...card.effects],
        effectFlow: card.effectFlow,
        artPath: card.artPath,
        sourceEquipmentId: card.sourceEquipmentId,
        weaponRules: card.weaponRules,
        isChaosCard: card.isChaosCard,
        chaosCardsToCreate: card.chaosCardsToCreate ? [...card.chaosCardsToCreate] : undefined,
    };
}
