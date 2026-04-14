"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMailState = getMailState;
exports.addMail = addMail;
exports.markMailRead = markMailRead;
exports.getUnreadCount = getUnreadCount;
exports.getMailById = getMailById;
exports.syncImportedMailUnlocks = syncImportedMailUnlocks;
exports.triggerMailOnOperationComplete = triggerMailOnOperationComplete;
exports.triggerMailOnBaseCampReturn = triggerMailOnBaseCampReturn;
const technica_1 = require("../content/technica");
const campaign_1 = require("./campaign");
const schemaSystem_1 = require("./schemaSystem");
const gameStore_1 = require("../state/gameStore");
// ============================================================================
// SAMPLE MAIL DATA
// ============================================================================
const SAMPLE_MAIL = [
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
function normalizeMailCategory(value) {
    switch (String(value ?? "").trim().toLowerCase()) {
        case "personal":
        case "official":
        case "system":
            return String(value).trim().toLowerCase();
        default:
            return "system";
    }
}
function toStringList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map(String).map((entry) => entry.trim()).filter(Boolean)));
}
function normalizeImportedMailEntry(entry) {
    const bodyPages = Array.isArray(entry.bodyPages)
        ? entry.bodyPages.map((page) => String(page).trim()).filter(Boolean)
        : [];
    return {
        id: entry.id,
        category: normalizeMailCategory(entry.category),
        from: String(entry.from ?? "S/COM_OS"),
        subject: String(entry.subject ?? entry.id),
        bodyPages: bodyPages.length > 0 ? bodyPages : [String(entry.subject ?? entry.id)],
        unlockAfterFloor: Number.isFinite(Number(entry.unlockAfterFloor)) && Number(entry.unlockAfterFloor) > 0
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
function getImportedMailDatabase() {
    return (0, technica_1.getAllImportedMailEntries)().map(normalizeImportedMailEntry);
}
function getMailTemplateById(mailId) {
    return (getImportedMailDatabase().find((entry) => entry.id === mailId) ??
        SAMPLE_MAIL.find((entry) => entry.id === mailId) ??
        null);
}
function createMailItem(template, receivedAt) {
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
function getOwnedGearIds(state) {
    return new Set(Object.keys(state.equipmentById ?? {}));
}
function getOwnedItemIds(state) {
    const itemIds = new Set();
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
function getOwnedFieldModIds(state) {
    const campaignProgress = (0, campaign_1.loadCampaignProgress)();
    const fieldModIds = new Set();
    [...(state.runFieldModInventory ?? [])].forEach((instance) => {
        if (instance?.defId) {
            fieldModIds.add(instance.defId);
        }
    });
    [...(campaignProgress.queuedFieldModsForNextRun ?? []), ...(campaignProgress.activeRun?.runFieldModInventory ?? [])].forEach((instance) => {
        if (instance?.defId) {
            fieldModIds.add(instance.defId);
        }
    });
    return fieldModIds;
}
function getUnlockedSchemaIds(state) {
    const schemaState = (0, schemaSystem_1.getSchemaUnlockState)(state);
    return new Set([...schemaState.unlockedCoreTypes, ...schemaState.unlockedFortificationPips]);
}
function areImportedMailRequirementsMet(entry, state) {
    const highestReachedFloorOrdinal = (0, campaign_1.getHighestReachedFloorOrdinal)((0, campaign_1.loadCampaignProgress)());
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
function getMailState(state) {
    return state.quarters?.mail ?? { inbox: [] };
}
function addMail(mailId, receivedAt = Date.now()) {
    const template = getMailTemplateById(mailId);
    if (!template) {
        console.warn(`[MAIL] Mail template not found: ${mailId}`);
        return null;
    }
    const mail = createMailItem(template, receivedAt);
    (0, gameStore_1.updateGameState)((state) => {
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
function markMailRead(mailId) {
    (0, gameStore_1.updateGameState)((state) => {
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
function getUnreadCount(state) {
    const mailState = getMailState(state);
    return mailState.inbox.filter((mail) => !mail.read).length;
}
function getMailById(state, mailId) {
    const mailState = getMailState(state);
    return mailState.inbox.find((mail) => mail.id === mailId) ?? null;
}
function syncImportedMailUnlocks() {
    const state = (0, gameStore_1.getGameState)();
    const deliveredIds = new Set(getMailState(state).inbox.map((mail) => mail.id));
    const eligibleEntries = getImportedMailDatabase().filter((entry) => !deliveredIds.has(entry.id) && areImportedMailRequirementsMet(entry, state));
    if (eligibleEntries.length === 0) {
        return [];
    }
    (0, gameStore_1.updateGameState)((current) => {
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
function triggerMailOnOperationComplete(success) {
    const currentState = (0, gameStore_1.getGameState)();
    const mailState = getMailState(currentState);
    if (success) {
        const hasFirstSuccess = mailState.inbox.some((mail) => mail.id === "mail_first_success");
        if (!hasFirstSuccess) {
            addMail("mail_first_success");
        }
        else if (Math.random() < 0.3) {
            const options = ["mail_personal_1", "mail_official_1"];
            const selected = options[Math.floor(Math.random() * options.length)];
            addMail(selected);
        }
    }
    else {
        const hasFirstFailure = mailState.inbox.some((mail) => mail.id === "mail_first_failure");
        if (!hasFirstFailure) {
            addMail("mail_first_failure");
        }
    }
    syncImportedMailUnlocks();
}
function triggerMailOnBaseCampReturn() {
    if (Math.random() < 0.1) {
        const options = ["mail_personal_2", "mail_official_2"];
        const selected = options[Math.floor(Math.random() * options.length)];
        addMail(selected);
    }
    syncImportedMailUnlocks();
}
