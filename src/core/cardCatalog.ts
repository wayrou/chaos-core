import { getAllEquipmentCards, EquipmentCard } from "./equipment";
import { Card, CardEffect } from "./types";
import { getImportedCard, isTechnicaContentDisabled } from "../content/technica";
import type { ImportedCard } from "../content/technica/types";

type BattleCardTarget = "enemy" | "ally" | "self" | "tile";

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
  artPath?: string;
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

function getCatalogCards(): EquipmentCard[] {
<<<<<<< HEAD
  return Object.values(getAllEquipmentCards());
=======
  const cards: EquipmentCard[] = [...CORE_CARDS, ...EQUIPMENT_CARDS];
  for (const unitClass of Object.keys(CLASS_CARDS) as UnitClass[]) {
    cards.push(...CLASS_CARDS[unitClass]);
  }
  return cards.filter((card) => !isTechnicaContentDisabled("card", card.id));
>>>>>>> 3307f1b (technica compat)
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

  const resolved: ResolvedBattleCard = {
    id: card.id,
    name: card.name,
    type: card.type,
    target,
    strainCost: card.strainCost,
    range: parseRange(card.range),
    description,
    effects,
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
  const resolved: ResolvedBattleCard = {
    id: card.id,
    name: card.name,
    type: card.type,
    target: card.targetType,
    strainCost: card.strainCost,
    range: card.range,
    description: card.description,
    effects: [...card.effects],
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
    artPath: card.artPath,
  };
}
