import { getGameState, updateGameState } from "../state/gameStore";

export type CodexCategory = "Lore" | "Faction" | "Bestiary" | "Tech";

export interface CodexEntry {
    id: string;
    title: string;
    category: CodexCategory;
    content: string; // The "SLK://DATASTREAM" decrypted text
}

// Fixed repository of all Codex lore text in the game
export const CODEX_DATABASE: CodexEntry[] = [
    {
        id: "lore_the_collapse",
        title: "The Great Collapse",
        category: "Lore",
        content: "SLK//DECRYPTING...\n\nData fragment recovered. Subject: The Collapse.\n\nEighty years ago, the Aethernet shattered. It wasn't a slow fraying, but an instant, catastrophic severance. The steam engines that powered our wards died in a collective exhale. Over the next three days, the Mist rolled into the valleys.\n\nThose who survived did so behind the Iron Gates. We are the descendants of those who locked the doors.",
    },
    {
        id: "tech_scrolllink_os",
        title: "ScrollLink Operating System",
        category: "Tech",
        content: "SLK//DECRYPTING...\n\nScrollLink OS v4.2.1\n\nDeveloped by the Architects of the Iron Gate. ScrollLink utilizes minimal steam-power via harmonic crystals to maintain data integrity in high-Mist environments. \n\nWarning: Extended exposure to raw Aethernet data may cause ocular hemorrhaging.",
    },
    {
        id: "faction_mistguard",
        title: "The Mistguard",
        category: "Faction",
        content: "SLK//DECRYPTING...\n\nTo be a Mistguard is to accept an early grave. They are the only fools willing to step outside the Iron Gates and breathe the fog. Their mandate is twofold: reclaim lost tech, and ensure the horrors of the valley do not knock on our walls.",
    },
    {
        id: "bestiary_husk",
        title: "Wandering Husk",
        category: "Bestiary",
        content: "SLK//DECRYPTING...\n\nBiological Target Profile: Husk. \n\nFormer human, entirely corrupted by the Mist. The respiratory system has been replaced by a fungal-aether weave that perpetually exhales spores. Slow, but highly dangerous in numbers. Do not engage in melee if armor seals are comprised.",
    },
];

/**
 * Unlock a codex entry so it's readable to the player forever
 */
export function unlockCodexEntry(entryId: string): void {
    const state = getGameState();

    if (!state.unlockedCodexEntries) {
        updateGameState(s => ({ ...s, unlockedCodexEntries: [entryId] }));
        console.log(`[CODEX] Unlocked new entry: ${entryId}`);
        return;
    }

    if (state.unlockedCodexEntries.includes(entryId)) {
        return; // Already unlocked
    }

    updateGameState(s => ({
        ...s,
        unlockedCodexEntries: [...s.unlockedCodexEntries!, entryId],
    }));

    console.log(`[CODEX] Unlocked new entry: ${entryId}`);
}

/**
 * Get the list of all unlocked codex entries
 */
export function getUnlockedCodexEntries(): CodexEntry[] {
    const state = getGameState();
    const unlockedIds = state.unlockedCodexEntries || [];

    return CODEX_DATABASE.filter(entry => unlockedIds.includes(entry.id));
}

/**
 * Check if a specific entry is unlocked
 */
export function isCodexEntryUnlocked(entryId: string): boolean {
    const state = getGameState();
    const unlockedIds = state.unlockedCodexEntries || [];
    return unlockedIds.includes(entryId);
}

/**
 * Fully unlock everything (for debugging)
 */
export function debugUnlockAllCodexEntries(): void {
    const allIds = CODEX_DATABASE.map(e => e.id);
    updateGameState(s => ({
        ...s,
        unlockedCodexEntries: allIds,
    }));
    console.log(`[CODEX] DEBUG: Unlocked all entries.`);
}
