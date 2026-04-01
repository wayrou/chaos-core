import "../../styles.css";
import {
  CodexCategory,
  CodexEntry,
  getUnlockedCodexEntries,
  unlockCodexEntry,
  CODEX_DATABASE,
  debugUnlockAllCodexEntries
} from "../../core/codexSystem";
import { renderMainMenu } from "./MainMenuScreen";
import {
  BaseCampReturnTo,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
let activeCategory: CodexCategory = "Lore";
let activeEntry: CodexEntry | null = null;
let returnDestination: BaseCampReturnTo | "menu" = "basecamp";

export function renderCodexScreen(returnTo: BaseCampReturnTo | "menu" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  returnDestination = returnTo;

  // Get entries for the current category
  const allUnlocked = getUnlockedCodexEntries();
  const categoryEntries = allUnlocked.filter(e => e.category === activeCategory);

  // Auto-select the first entry if none exists or active is not in current list
  if (!activeEntry || activeEntry.category !== activeCategory) {
    activeEntry = categoryEntries.length > 0 ? categoryEntries[0] : null;
  }

  // Count known vs unknown
  const totalInCategory = CODEX_DATABASE.filter(e => e.category === activeCategory).length;
  const unlockedInCategory = categoryEntries.length;

  root.innerHTML = `
  < div class="ard-fullscreen ard-bg-dark ard-noise" style = "display: flex; flex-direction: column; height: 100vh;" >

    <!--Top Bar-- >
      <div class="ard-top-bar" >
        <div class="ard-top-bar-title" style = "color: var(--ard-orange)" > S/COM_OS//CODEX.SYS</div>
          </div>

          < !--Main Layout-- >
            <div style="flex: 1; display: flex; gap: var(--ard-spacing-4); padding: var(--ard-spacing-4); max-height: calc(100vh - 48px); box-sizing: border-box;" >

              <!--Left Sidebar: Categories & List-- >
                <div class="ard-panel" style = "width: 320px; display: flex; flex-direction: column; overflow: hidden;" >
                  <div class="ard-panel-header" > ARCHIVE QUERY </div>

                    < div style = "display: flex; gap: 4px; padding: var(--ard-spacing-2); border-bottom: 1px solid var(--ard-border);" >
                      ${["Lore", "Faction", "Bestiary", "Tech"].map((cat) => `
              <button class="ard-btn-${activeCategory === cat ? 'primary' : 'secondary'}" data-tab="${cat}" style="flex: 1; padding: 4px; font-size: 10px;">
                ${cat.toUpperCase()}
              </button>
            `).join('')
    }
</div>

  < div style = "padding: var(--ard-spacing-2); font-size: 10px; color: var(--ard-text-muted); text-align: center; border-bottom: 1px solid var(--ard-border);" >
    DECRYPTED: ${unlockedInCategory} / ${totalInCategory}
      </div>

      < div class="ard-scrollable" style = "flex: 1; padding: var(--ard-spacing-2); display: flex; flex-direction: column; gap: var(--ard-spacing-2);" >
        ${categoryEntries.length === 0 ? `
              <div style="text-align: center; color: var(--ard-text-muted); margin-top: 20px; font-style: italic;">
                NO DATA FRAGMENTS FOUND
              </div>
            ` : categoryEntries.map(entry => `
              <button class="codex-entry-btn ${activeEntry?.id === entry.id ? 'active' : ''}" data-entry-id="${entry.id}" style="
                background: ${activeEntry?.id === entry.id ? 'var(--ard-bg-elevated)' : 'transparent'};
                border: 1px solid ${activeEntry?.id === entry.id ? 'var(--ard-orange)' : 'var(--ard-border)'};
                color: ${activeEntry?.id === entry.id ? 'var(--ard-orange)' : 'var(--ard-text)'};
                padding: var(--ard-spacing-2);
                text-align: left;
                font-family: var(--ard-font-mono);
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
              ">
                > ${entry.title.toUpperCase()}
              </button>
            `).join('')
    }
</div>
  </div>

  < !--Right Content: The Datastream-- >
    <div class="ard-panel" style = "flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;" >
      ${activeEntry ? `
            <div class="ard-panel-header" style="color: var(--ard-orange); border-bottom: 2px solid var(--ard-orange);">
              DATASTREAM OPENED: [${activeEntry.id}]
            </div>
            
            <div class="ard-scrollable" style="flex: 1; padding: var(--ard-spacing-4);">
              <h1 style="color: var(--ard-text-accent); margin-top: 0; font-family: var(--ard-font-display); letter-spacing: 1px;">
                ${activeEntry.title}
              </h1>
              
              <div style="
                color: var(--ard-text-muted); 
                font-size: 12px; 
                margin-bottom: var(--ard-spacing-4);
                border-bottom: 1px solid var(--ard-border);
                padding-bottom: var(--ard-spacing-2);
              ">
                CLASS: ${activeEntry.category.toUpperCase()} | ENCRYPTION: KNOWLEDGE-TIER
              </div>

              <!-- Content parsed with simple linebreaks -->
              <div style="
                color: var(--ard-text); 
                font-size: 14px; 
                line-height: 1.6;
                white-space: pre-wrap;
              ">${activeEntry.content}</div>
            </div>
          ` : `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
              color: var(--ard-text-muted);
              font-size: 18px;
              opacity: 0.5;
            ">
              AWAITING DECRYPTION KEY...
            </div>
          `}

<div class="ard-ghost-text" style = "bottom: 10px; right: 10px; font-size: 40px; opacity: 0.03;" > THE ARCHIVE </div>
  </div>
  </div>

  < !--Action Bar-- >
    <div class="ard-action-bar" >
      <!--Optional debug button just for testing-- >
        <button id= "codex-debug-unlock" class= "ard-btn-secondary" style = "margin-right: auto;" >
          [DEV] UNLOCK ALL
            </button>

            < button id = "codex-btn-close" class="ard-btn-secondary" >
              <span class="btn-icon" >×</span>
          CLOSE SYSTEM
  </button>
  </div>

  </div>
    `;

  attachListeners();
}

function attachListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Category Tabs
  const tabBtns = root.querySelectorAll("button[data-tab]");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = (btn as HTMLElement).dataset.tab as CodexCategory;
      activeCategory = cat;
      // Selecting a new category shouldn't keep the old entry active
      activeEntry = null;
      renderCodexScreen(returnDestination);
    });
  });

  // Entry List
  const entryBtns = root.querySelectorAll(".codex-entry-btn");
  entryBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const entryId = (btn as HTMLElement).dataset.entryId;
      const allUnlocked = getUnlockedCodexEntries();
      const entry = allUnlocked.find(e => e.id === entryId);
      if (entry) {
        activeEntry = entry;
        renderCodexScreen(returnDestination);
      }
    });
  });

  // Dev Unlock
  const debugUnlockBtn = root.querySelector("#codex-debug-unlock");
  if (debugUnlockBtn) {
    debugUnlockBtn.addEventListener("click", () => {
      debugUnlockAllCodexEntries();
      renderCodexScreen(returnDestination);
    });
  }

  // Close
  const closeBtn = root.querySelector("#codex-btn-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      unregisterBaseCampReturnHotkey("codex-screen");
      if (returnDestination === "menu") {
        renderMainMenu();
      } else {
        returnFromBaseCampScreen(returnDestination);
      }
    });
  }

  if (returnDestination !== "menu") {
    registerBaseCampReturnHotkey("codex-screen", returnDestination, { activeSelector: "#codex-btn-close" });
  } else {
    unregisterBaseCampReturnHotkey("codex-screen");
  }
}
