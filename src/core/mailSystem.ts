import { getAllImportedMailEntries } from "../content/technica";
import { getHighestReachedFloorOrdinal, loadCampaignProgress } from "./campaign";
import { getSchemaUnlockState } from "./schemaSystem";
import type { GameState } from "./types";
import { getGameState, updateGameState } from "../state/gameStore";

// ============================================================================
// QUARTERS - MAIL SYSTEM
// ============================================================================

export type MailCategory = "personal" | "official" | "system";

export interface MailItem {
  id: string;
  category: MailCategory;
  from: string;
  subject: string;
  bodyPages: string[];
  receivedAt: number;
  read: boolean;
}

export interface MailState {
  inbox: MailItem[];
}

type MailTemplate = Omit<MailItem, "receivedAt" | "read">;

interface UnlockableImportedMailTemplate extends MailTemplate {
  unlockAfterFloor?: number;
  requiredDialogueIds?: string[];
  requiredGearIds?: string[];
  requiredItemIds?: string[];
  requiredSchemaIds?: string[];
  requiredFieldModIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// SAMPLE MAIL DATA
// ============================================================================

const SAMPLE_MAIL: MailTemplate[] = [
  {
    id: "mail_welcome",
    category: "system",
    from: "S/COM_OS",
    subject: "Welcome to Quarters",
    bodyPages: [
      "Welcome to your personal quarters, Commander.",
      "This is your downtime space. Check your mailbox for messages, rest at your bunk, review operations on the pinboard, and make yourself at home.",
      "The footlocker stores your decorative items. Place them around the room to personalize your space.",
    ],
  },
  {
    id: "mail_first_success",
    category: "personal",
    from: "Aeriss",
    subject: "Good work out there",
    bodyPages: [
      "I saw the operation report. You handled yourself well.",
      "Keep it up, and we'll make real progress.",
    ],
  },
  {
    id: "mail_first_failure",
    category: "personal",
    from: "Aeriss",
    subject: "Don't let it get to you",
    bodyPages: [
      "I heard about what happened. It's okay.",
      "Every operation teaches us something. Rest up, and we'll try again when you're ready.",
    ],
  },
  {
    id: "mail_official_1",
    category: "official",
    from: "Command",
    subject: "Operation Status Update",
    bodyPages: [
      "Your recent operations have been noted.",
      "Continue completing objectives to unlock new areas and resources.",
    ],
  },
  {
    id: "mail_personal_1",
    category: "personal",
    from: "Squad Member",
    subject: "Thanks for having my back",
    bodyPages: [
      "Just wanted to say thanks for the support out there.",
      "Couldn't have made it without the team.",
    ],
  },
  {
    id: "mail_system_tutorial",
    category: "system",
    from: "S/COM_OS",
    subject: "Quarters Features",
    bodyPages: [
      "QUARTERS GUIDE:",
      "- Mailbox: Check for messages after operations",
      "- Bunk: Rest to receive a small buff for your next run",
      "- Pinboard: Review completed operations and failures",
      "- Footlocker: Manage and place decorative items",
      "- Sable: Interact with your companion in her corner",
    ],
  },
  {
    id: "mail_official_2",
    category: "official",
    from: "Quartermaster",
    subject: "Resource Allocation",
    bodyPages: [
      "Your resource collection has been processed.",
      "Use the Workshop to craft new equipment with your materials.",
    ],
  },
  {
    id: "mail_personal_2",
    category: "personal",
    from: "Medic",
    subject: "Health Check",
    bodyPages: [
      "I've reviewed your unit status reports.",
      "Everyone's holding up well. Keep an eye on strain levels during operations.",
    ],
  },
];

function normalizeMailCategory(value: unknown): MailCategory {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "personal":
    case "official":
    case "system":
      return String(value).trim().toLowerCase() as MailCategory;
    default:
      return "system";
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map(String).map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeImportedMailEntry(
  entry: ReturnType<typeof getAllImportedMailEntries>[number]
): UnlockableImportedMailTemplate {
  const bodyPages = Array.isArray(entry.bodyPages)
    ? entry.bodyPages.map((page) => String(page).trim()).filter(Boolean)
    : [];

  return {
    id: entry.id,
    category: normalizeMailCategory(entry.category),
    from: String(entry.from ?? "S/COM_OS"),
    subject: String(entry.subject ?? entry.id),
    bodyPages: bodyPages.length > 0 ? bodyPages : [String(entry.subject ?? entry.id)],
    unlockAfterFloor:
      Number.isFinite(Number(entry.unlockAfterFloor)) && Number(entry.unlockAfterFloor) > 0
        ? Math.round(Number(entry.unlockAfterFloor))
        : 0,
    requiredDialogueIds: toStringList(entry.requiredDialogueIds),
    requiredGearIds: toStringList(entry.requiredGearIds),
    requiredItemIds: toStringList(entry.requiredItemIds),
    requiredSchemaIds: toStringList(entry.requiredSchemaIds),
    requiredFieldModIds: toStringList(entry.requiredFieldModIds),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function getImportedMailDatabase(): UnlockableImportedMailTemplate[] {
  return getAllImportedMailEntries().map(normalizeImportedMailEntry);
}

function getMailTemplateById(mailId: string): (MailTemplate | UnlockableImportedMailTemplate) | null {
  return (
    getImportedMailDatabase().find((entry) => entry.id === mailId) ??
    SAMPLE_MAIL.find((entry) => entry.id === mailId) ??
    null
  );
}

function createMailItem(template: MailTemplate | UnlockableImportedMailTemplate, receivedAt: number): MailItem {
  return {
    id: template.id,
    category: template.category,
    from: template.from,
    subject: template.subject,
    bodyPages: [...template.bodyPages],
    receivedAt,
    read: false,
  };
}

function getOwnedGearIds(state: GameState): Set<string> {
  return new Set(Object.keys(state.equipmentById ?? {}));
}

function getOwnedItemIds(state: GameState): Set<string> {
  const itemIds = new Set<string>();

  Object.entries(state.consumables ?? {}).forEach(([itemId, quantity]) => {
    if (Number(quantity) > 0) {
      itemIds.add(itemId);
    }
  });

  [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].forEach((item) => {
    if (Number(item.quantity ?? 0) > 0) {
      itemIds.add(item.id);
    }
  });

  return itemIds;
}

function getOwnedFieldModIds(state: GameState): Set<string> {
  const campaignProgress = loadCampaignProgress();
  const fieldModIds = new Set<string>();

  [...(state.runFieldModInventory ?? [])].forEach((instance) => {
    if (instance?.defId) {
      fieldModIds.add(instance.defId);
    }
  });

  [...(campaignProgress.queuedFieldModsForNextRun ?? []), ...(campaignProgress.activeRun?.runFieldModInventory ?? [])].forEach(
    (instance) => {
      if (instance?.defId) {
        fieldModIds.add(instance.defId);
      }
    }
  );

  return fieldModIds;
}

function getUnlockedSchemaIds(state: GameState): Set<string> {
  const schemaState = getSchemaUnlockState(state);
  return new Set([...schemaState.unlockedCoreTypes, ...schemaState.unlockedFortificationPips]);
}

function areImportedMailRequirementsMet(entry: UnlockableImportedMailTemplate, state: GameState): boolean {
  const highestReachedFloorOrdinal = getHighestReachedFloorOrdinal(loadCampaignProgress());
  if ((entry.unlockAfterFloor ?? 0) > 0 && highestReachedFloorOrdinal < (entry.unlockAfterFloor ?? 0)) {
    return false;
  }

  const completedDialogueIds = new Set(state.completedDialogueIds ?? []);
  if ((entry.requiredDialogueIds ?? []).some((dialogueId) => !completedDialogueIds.has(dialogueId))) {
    return false;
  }

  const ownedGearIds = getOwnedGearIds(state);
  if ((entry.requiredGearIds ?? []).some((gearId) => !ownedGearIds.has(gearId))) {
    return false;
  }

  const ownedItemIds = getOwnedItemIds(state);
  if ((entry.requiredItemIds ?? []).some((itemId) => !ownedItemIds.has(itemId))) {
    return false;
  }

  const unlockedSchemaIds = getUnlockedSchemaIds(state);
  if ((entry.requiredSchemaIds ?? []).some((schemaId) => !unlockedSchemaIds.has(schemaId))) {
    return false;
  }

  const ownedFieldModIds = getOwnedFieldModIds(state);
  if ((entry.requiredFieldModIds ?? []).some((fieldModId) => !ownedFieldModIds.has(fieldModId))) {
    return false;
  }

  return true;
}

// ============================================================================
// MAIL MANAGEMENT
// ============================================================================

export function getMailState(state: { quarters?: { mail?: MailState } }): MailState {
  return state.quarters?.mail ?? { inbox: [] };
}

export function addMail(mailId: string, receivedAt: number = Date.now()): MailItem | null {
  const template = getMailTemplateById(mailId);
  if (!template) {
    console.warn(`[MAIL] Mail template not found: ${mailId}`);
    return null;
  }

  const mail = createMailItem(template, receivedAt);

  updateGameState((state) => {
    const quarters = state.quarters ?? {};
    const mailState = quarters.mail ?? { inbox: [] };

    if (mailState.inbox.some((entry) => entry.id === mailId)) {
      return state;
    }

    return {
      ...state,
      quarters: {
        ...quarters,
        mail: {
          inbox: [...mailState.inbox, mail],
        },
      },
    };
  });

  return mail;
}

export function markMailRead(mailId: string): void {
  updateGameState((state) => {
    const quarters = state.quarters ?? {};
    const mailState = quarters.mail ?? { inbox: [] };

    return {
      ...state,
      quarters: {
        ...quarters,
        mail: {
          inbox: mailState.inbox.map((mail) => (mail.id === mailId ? { ...mail, read: true } : mail)),
        },
      },
    };
  });
}

export function getUnreadCount(state: { quarters?: { mail?: MailState } }): number {
  const mailState = getMailState(state);
  return mailState.inbox.filter((mail) => !mail.read).length;
}

export function getMailById(
  state: { quarters?: { mail?: MailState } },
  mailId: string
): MailItem | null {
  const mailState = getMailState(state);
  return mailState.inbox.find((mail) => mail.id === mailId) ?? null;
}

export function syncImportedMailUnlocks(): string[] {
  const state = getGameState();
  const deliveredIds = new Set(getMailState(state).inbox.map((mail) => mail.id));
  const eligibleEntries = getImportedMailDatabase().filter(
    (entry) => !deliveredIds.has(entry.id) && areImportedMailRequirementsMet(entry, state)
  );

  if (eligibleEntries.length === 0) {
    return [];
  }

  updateGameState((current) => {
    const quarters = current.quarters ?? {};
    const mailState = quarters.mail ?? { inbox: [] };
    const nextInbox = [...mailState.inbox];
    const existingIds = new Set(nextInbox.map((mail) => mail.id));
    let nextReceivedAt = Date.now();

    eligibleEntries.forEach((entry) => {
      if (existingIds.has(entry.id)) {
        return;
      }

      nextInbox.push(createMailItem(entry, nextReceivedAt));
      existingIds.add(entry.id);
      nextReceivedAt += 1;
    });

    return {
      ...current,
      quarters: {
        ...quarters,
        mail: {
          inbox: nextInbox,
        },
      },
    };
  });

  return eligibleEntries.map((entry) => entry.id);
}

// ============================================================================
// MAIL TRIGGERS
// ============================================================================

export function triggerMailOnOperationComplete(success: boolean): void {
  const currentState = getGameState();
  const mailState = getMailState(currentState);

  if (success) {
    const hasFirstSuccess = mailState.inbox.some((mail) => mail.id === "mail_first_success");

    if (!hasFirstSuccess) {
      addMail("mail_first_success");
    } else if (Math.random() < 0.3) {
      const options = ["mail_personal_1", "mail_official_1"];
      const selected = options[Math.floor(Math.random() * options.length)];
      addMail(selected);
    }
  } else {
    const hasFirstFailure = mailState.inbox.some((mail) => mail.id === "mail_first_failure");

    if (!hasFirstFailure) {
      addMail("mail_first_failure");
    }
  }

  syncImportedMailUnlocks();
}

export function triggerMailOnBaseCampReturn(): void {
  if (Math.random() < 0.1) {
    const options = ["mail_personal_2", "mail_official_2"];
    const selected = options[Math.floor(Math.random() * options.length)];
    addMail(selected);
  }

  syncImportedMailUnlocks();
}
