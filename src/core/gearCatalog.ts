import {
  getAllImportedChassis,
  getAllImportedDoctrines,
  isTechnicaContentDisabled,
} from "../content/technica";
import {
  ALL_CHASSIS,
  type ChassisSlotType,
  type GearChassis,
} from "../data/gearChassis";
import {
  ALL_DOCTRINES,
  type GearDoctrine,
  type IntentTag,
} from "../data/gearDoctrines";
import { createEmptyResourceWallet } from "./resources";

function normalizeChassis(entry: GearChassis): GearChassis {
  return {
    ...entry,
    buildCost: createEmptyResourceWallet(entry.buildCost),
    unlockAfterFloor: Number(entry.unlockAfterFloor ?? 0),
    requiredQuestIds: Array.isArray(entry.requiredQuestIds)
      ? Array.from(new Set(entry.requiredQuestIds.map(String).map((value) => value.trim()).filter(Boolean)))
      : []
  };
}

function normalizeDoctrine(entry: GearDoctrine): GearDoctrine {
  return {
    ...entry,
    buildCostModifier: createEmptyResourceWallet(entry.buildCostModifier),
    unlockAfterFloor: Number(entry.unlockAfterFloor ?? 0),
    requiredQuestIds: Array.isArray(entry.requiredQuestIds)
      ? Array.from(new Set(entry.requiredQuestIds.map(String).map((value) => value.trim()).filter(Boolean)))
      : []
  };
}

export function getAllChassis(): GearChassis[] {
  const merged = new Map<string, GearChassis>();

  ALL_CHASSIS.forEach((entry) => {
    merged.set(entry.id, normalizeChassis(entry));
  });

  getAllImportedChassis().forEach((entry) => {
    merged.set(entry.id, normalizeChassis(entry as GearChassis));
  });

  return Array.from(merged.values()).filter((entry) => !isTechnicaContentDisabled("chassis", entry.id));
}

export function getChassisById(id: string): GearChassis | undefined {
  return getAllChassis().find((entry) => entry.id === id);
}

export function getChassisBySlotType(slotType: ChassisSlotType): GearChassis[] {
  return getAllChassis().filter((entry) => entry.slotType === slotType);
}

export function getAllChassisIds(): string[] {
  return getAllChassis().map((entry) => entry.id);
}

export function getAllDoctrines(): GearDoctrine[] {
  const merged = new Map<string, GearDoctrine>();

  ALL_DOCTRINES.forEach((entry) => {
    merged.set(entry.id, normalizeDoctrine(entry));
  });

  getAllImportedDoctrines().forEach((entry) => {
    merged.set(entry.id, normalizeDoctrine(entry as GearDoctrine));
  });

  return Array.from(merged.values()).filter((entry) => !isTechnicaContentDisabled("doctrine", entry.id));
}

export function getDoctrineById(id: string): GearDoctrine | undefined {
  return getAllDoctrines().find((entry) => entry.id === id);
}

export function getAllDoctrineIds(): string[] {
  return getAllDoctrines().map((entry) => entry.id);
}

export function getDoctrinesByIntent(intent: IntentTag): GearDoctrine[] {
  return getAllDoctrines().filter((entry) => entry.intentTags.includes(intent));
}
