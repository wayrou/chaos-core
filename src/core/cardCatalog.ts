import { getAllEquipmentCards, getAllStarterEquipment, EquipmentCard } from "./equipment";
import { Card, CardEffect } from "./types";
import { getImportedCard, isTechnicaContentDisabled } from "../content/technica";
import type { ImportedCard } from "../content/technica/types";
import { createEffectFlowFromLegacyCardEffects } from "./effectFlow";
import type { WeaponCardRules, WeaponCardTag } from "./weaponData";

type BattleCardTarget = "enemy" | "ally" | "self" | "tile";
const EQUIPPED_WEAPON_SOURCE_ID = "__equipped_weapon__";

export interface ResolvedBattleCard {
  id: string;
  name: string;
  type: "core" | "class" | "equipment" | "gambit";
  target: BattleCardTarget;
  strainCost: number;
  range: number;
  description: string;
  damage?: number;
  healing?: number;
  defBuff?: number;
  atkBuff?: number;
  effects: CardEffect[];
  effectFlow?: ReturnType<typeof createEffectFlowFromLegacyCardEffects>;
  artPath?: string;
  sourceEquipmentId?: string;
  weaponRules?: WeaponCardRules;
}

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

function pushWeaponTag(tags: WeaponCardTag[], tag: WeaponCardTag): void {
  if (!tags.includes(tag)) {
    tags.push(tag);
  }
}

function parseHeatDelta(description: string): number | null {
  const removeMatch = description.match(/remove\s+(\d+)\s+heat/i);
  if (removeMatch) {
    return -parseInt(removeMatch[1], 10);
  }

  const gainMatch =
    description.match(/\+(\d+)\s+heat/i) ||
    description.match(/gain\s+\+?(\d+)\s+heat/i) ||
    description.match(/adds?\s+(\d+)\s+heat/i);
  if (gainMatch) {
    return parseInt(gainMatch[1], 10);
  }

  return null;
}

function inferWeaponRules(card: EquipmentCard, target: BattleCardTarget, description: string): WeaponCardRules | undefined {
  const lowerName = card.name.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const equipmentById = getAllStarterEquipment();
  const sourceEquipment = card.sourceEquipmentId ? equipmentById[card.sourceEquipmentId] : null;
  const sourceWeapon =
    sourceEquipment && sourceEquipment.slot === "weapon"
      ? sourceEquipment
      : null;

  const isCoreWeaponCard = card.id === "core_basic_attack" || card.id === "core_overwatch";
  if (!sourceWeapon && !isCoreWeaponCard) {
    return undefined;
  }

  const tags: WeaponCardTag[] = ["weapon_card"];
  const attackKeywords = ["attack", "shot", "strike", "slash", "jab", "blast", "bolt", "volley", "fire", "thrust", "swing"];
  const indirectKeywords = ["lob", "mortar", "radius", "aoe", "all enemies", "adjacent enemies", "chain lightning", "cone", "arc"];
  const multiKeywords = ["fire twice", "attack twice", "three attacks", "two shots", "double", "twice"];

  if (
    target === "enemy" ||
    typeof card.damage === "number" ||
    attackKeywords.some((keyword) => lowerName.includes(keyword) || lowerDesc.includes(keyword))
  ) {
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

  if (
    target === "self" &&
    ["guard", "brace", "parry", "ward", "barrier", "plating", "stance", "shield"].some(
      (keyword) => lowerName.includes(keyword) || lowerDesc.includes(keyword),
    )
  ) {
    pushWeaponTag(tags, "guard_brace");
  }

  const explicitHeatDelta = parseHeatDelta(description);
  const isMechanical = Boolean(sourceWeapon?.isMechanical);
  const heatDelta =
    explicitHeatDelta ??
    ((isMechanical || isCoreWeaponCard) && tags.includes("attack") ? 1 : 0);

  const ammoProfile = sourceWeapon?.ammoProfile;
  const defaultAmmoCost = ammoProfile?.defaultAttackAmmoCost ?? (sourceWeapon?.ammoMax ? 1 : 0);
  const ammoCost =
    tags.includes("reload") || tags.includes("heat_removal")
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

function getCatalogCards(): EquipmentCard[] {
  return Object.values(getAllEquipmentCards());
}

function parseRange(range?: string): number {
  if (!range) return 1;
  const normalized = range.trim().toLowerCase();
  if (normalized.includes("self")) return 0;
  const numbers = normalized.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 1;
  return parseInt(numbers[numbers.length - 1], 10);
}

function isPlaceholderDescription(description: string): boolean {
  const normalized = description.trim().toLowerCase();
  return (
    normalized.startsWith("use ") ||
    normalized === "ranged attack." ||
    normalized === "defensive action or stance." ||
    normalized === "ranged attack"
  );
}

function inferTarget(card: EquipmentCard, description: string): BattleCardTarget {
  const lowerName = card.name.toLowerCase();
  const lowerDesc = description.toLowerCase();

  if (ALLY_TEXT_HINTS.some(hint => lowerDesc.includes(hint))) return "ally";
  if (lowerDesc.includes("move ") && !lowerDesc.includes("damage") && !lowerDesc.includes("deal")) return "self";
  if ((card.range || "").toLowerCase().includes("self")) return "self";
  if (SELF_NAME_HINTS.some(hint => lowerName.includes(hint))) return "self";
  if (lowerDesc.includes("until next turn") || lowerDesc.includes("gain +")) return "self";
  if (lowerDesc.includes("heal") || lowerDesc.includes("restore") || lowerDesc.includes("recover")) {
    return lowerDesc.includes("self") ? "self" : "ally";
  }
  if (card.damage && card.damage > 0) return "enemy";
  if (lowerDesc.includes("enemy") || lowerDesc.includes("target")) return "enemy";
  return "self";
}

function buildGeneratedDescription(card: EquipmentCard, target: BattleCardTarget): string {
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

function normalizeDescription(card: EquipmentCard): string {
  if (!isPlaceholderDescription(card.description)) {
    return card.description.trim();
  }

  const target = inferTarget(card, card.description);
  return buildGeneratedDescription(card, target);
}

function addEffect(effects: CardEffect[], effect: CardEffect): void {
  const exists = effects.some(existing =>
    existing.type === effect.type &&
    existing.amount === effect.amount &&
    existing.duration === effect.duration &&
    existing.stat === effect.stat &&
    existing.tiles === effect.tiles
  );
  if (!exists) effects.push(effect);
}

function parseEffectsFromDescription(description: string, target: BattleCardTarget, damage?: number): CardEffect[] {
  const effects: CardEffect[] = [];
  const lower = description.toLowerCase();

  if (damage && damage > 0 && target === "enemy") {
    addEffect(effects, { type: "damage", amount: damage });
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

function toResolvedBattleCard(card: EquipmentCard): ResolvedBattleCard {
  const description = normalizeDescription(card);
  const target = inferTarget(card, description);
  const effects = parseEffectsFromDescription(description, target, card.damage);
  const weaponRules = card.weaponRules
    ? {
        sourceWeaponId: card.weaponRules.sourceWeaponId ?? card.sourceEquipmentId ?? EQUIPPED_WEAPON_SOURCE_ID,
        heatDelta: card.weaponRules.heatDelta ?? 0,
        ammoCost: card.weaponRules.ammoCost ?? 0,
        tags: card.weaponRules.tags ?? ["weapon_card"],
        clutchCompatible: card.weaponRules.clutchCompatible ?? Boolean(card.sourceEquipmentId),
      }
    : inferWeaponRules(card, target, description);

  const resolved: ResolvedBattleCard = {
    id: card.id,
    name: card.name,
    type: card.type,
    target,
    strainCost: card.strainCost,
    range: parseRange(card.range),
    description,
    effects,
    effectFlow: createEffectFlowFromLegacyCardEffects(effects, target === "ally" ? "ally" : target),
    sourceEquipmentId: card.sourceEquipmentId,
    weaponRules,
  };

  if (card.damage !== undefined) resolved.damage = card.damage;

  const healEffect = effects.find(effect => effect.type === "heal");
  if (healEffect?.amount) resolved.healing = healEffect.amount;

  const defEffect = effects.find(effect => effect.type === "def_up");
  if (defEffect?.amount) resolved.defBuff = defEffect.amount;

  const atkEffect = effects.find(effect => effect.type === "atk_up");
  if (atkEffect?.amount) resolved.atkBuff = atkEffect.amount;
  if (card.artPath) resolved.artPath = card.artPath;

  return resolved;
}

function toResolvedImportedCard(card: ImportedCard): ResolvedBattleCard {
  const sourceEquipmentId = (card as ImportedCard & { sourceEquipmentId?: string }).sourceEquipmentId;
  const equipmentCardLike: EquipmentCard = {
    id: card.id,
    name: card.name,
    type: card.type,
    strainCost: card.strainCost,
    description: card.description,
    range: `R(${card.range})`,
    damage: card.damage,
    effects: card.effects.map((effect) => effect.type),
    sourceEquipmentId,
    sourceClassId: (card as ImportedCard & { sourceClassId?: string }).sourceClassId,
    artPath: card.artPath,
  };

  const resolved: ResolvedBattleCard = {
    id: card.id,
    name: card.name,
    type: card.type,
    target: card.targetType,
    strainCost: card.strainCost,
    range: card.range,
    description: card.description,
    effects: [...card.effects],
    effectFlow: card.effectFlow ?? createEffectFlowFromLegacyCardEffects(card.effects, card.targetType),
    sourceEquipmentId,
    weaponRules: inferWeaponRules(equipmentCardLike, card.targetType, card.description),
  };

  if (card.damage !== undefined) resolved.damage = card.damage;
  if (card.artPath) resolved.artPath = card.artPath;

  const healEffect = card.effects.find(effect => effect.type === "heal");
  if (healEffect?.amount) resolved.healing = healEffect.amount;

  const defEffect = card.effects.find(effect => effect.type === "def_up");
  if (defEffect?.amount) resolved.defBuff = defEffect.amount;

  const atkEffect = card.effects.find(effect => effect.type === "atk_up");
  if (atkEffect?.amount) resolved.atkBuff = atkEffect.amount;

  return resolved;
}

const BATTLE_CARD_LOOKUP: Record<string, ResolvedBattleCard> = Object.fromEntries(
  getCatalogCards().map(card => [card.id, toResolvedBattleCard(card)])
);

export function getResolvedBattleCard(id: string): ResolvedBattleCard | null {
  const imported = getImportedCard(id);
  if (imported) {
    return toResolvedImportedCard(imported);
  }

  if (isTechnicaContentDisabled("card", id)) {
    return null;
  }

  const direct = BATTLE_CARD_LOOKUP[id];
  if (direct) return direct;

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

export function toCoreCard(card: ResolvedBattleCard): Card {
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
  };
}
