import { getInstalledTechnicaContent, getInstalledTechnicaCounts, installTechnicaFiles, type InstalledTechnicaContent, type TechnicaFileImportResult } from "../../content/technica/library";
import { notifyIfNewTechnicaContentLoaded } from "../../content/technica/notifier";
import { updateFocusableElements } from "../../core/controllerSupport";
import { renderFieldScreen } from "../../field/FieldScreen";
import { showImportedDialogue } from "./DialogueScreen";
import { renderMainMenu } from "./MainMenuScreen";

let lastImportResults: TechnicaFileImportResult[] = [];
let isImporting = false;

function formatImportedTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getTypeLabel(entry: InstalledTechnicaContent): string {
  if (entry.manifest.contentType === "map") {
    return "FIELD MAP";
  }
  if (entry.manifest.contentType === "quest") {
    return "QUEST";
  }
  if (entry.manifest.contentType === "chatter") {
    return "CHATTER";
  }
  if (entry.manifest.contentType === "key_item") {
    return "KEY ITEM";
  }
  if (entry.manifest.contentType === "faction") {
    return "FACTION";
  }
  if (entry.manifest.contentType === "dialogue") {
    return "DIALOGUE";
  }
  if (entry.manifest.contentType === "mail") {
    return "MAIL";
  }
  if (entry.manifest.contentType === "field_enemy") {
    return "FIELD ENEMY";
  }
  if (entry.manifest.contentType === "npc") {
    return "NPC";
  }
  if (entry.manifest.contentType === "gear") {
    return "GEAR";
  }
  if (entry.manifest.contentType === "item") {
    return "ITEM";
  }
  if (entry.manifest.contentType === "card") {
    return "CARD";
  }
  if (entry.manifest.contentType === "fieldmod") {
    return "FIELD MOD";
  }
  if (entry.manifest.contentType === "unit") {
    return "UNIT";
  }
  if (entry.manifest.contentType === "operation") {
    return "OPERATION";
  }
  if (entry.manifest.contentType === "class") {
    return "CLASS";
  }
  return "CODEX";
}

function getEntryActionLabel(entry: InstalledTechnicaContent): string | null {
  if (entry.manifest.contentType === "map") {
    return "ENTER MAP";
  }
  if (entry.manifest.contentType === "dialogue") {
    return "PREVIEW";
  }
  return null;
}

function getEntryPassiveHint(entry: InstalledTechnicaContent): string {
  if (entry.manifest.contentType === "chatter") {
    return "Shows up in the black market, tavern, or port chatter pools.";
  }

  return "Ready for Chaos Core.";
}

function renderResultSection(results: TechnicaFileImportResult[]): string {
  if (results.length === 0) {
    return `
      <section class="import-content-results town-screen__panel">
        <div class="import-content-section-header">
          <h2>LAST IMPORT</h2>
          <span>Nothing imported yet</span>
        </div>
      </section>
    `;
  }

  return `
    <section class="import-content-results town-screen__panel">
      <div class="import-content-section-header">
        <h2>LAST IMPORT</h2>
        <span>${results.length} file(s)</span>
      </div>
      <div class="import-content-result-list">
        ${results
          .map(
            (result) => `
              <article class="import-result-card ${result.success ? "import-result-card--success" : "import-result-card--error"}">
                <div class="import-result-card__title">
                  <strong>${result.title || result.sourceName}</strong>
                  <span>${result.success ? "READY" : "FAILED"}</span>
                </div>
                <div class="import-result-card__meta">
                  <span>${result.sourceName}</span>
                  ${result.contentType ? `<span>${result.contentType.toUpperCase()}</span>` : ""}
                  ${result.contentId ? `<span>${result.contentId}</span>` : ""}
                </div>
                ${result.warnings.length > 0 ? `<p class="import-result-card__warnings">${result.warnings.join(" ")}</p>` : ""}
                ${result.error ? `<p class="import-result-card__error">${result.error}</p>` : ""}
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderInstalledContentSection(installedEntries: InstalledTechnicaContent[]): string {
  if (installedEntries.length === 0) {
    return `
      <section class="import-content-library town-screen__panel">
        <div class="import-content-section-header">
          <h2>INSTALLED CONTENT</h2>
          <span>0 packages</span>
        </div>
        <div class="import-content-empty">
          Drag a Technica export bundle here and Chaos Core will register it for the current install.
        </div>
      </section>
    `;
  }

  return `
    <section class="import-content-library town-screen__panel">
      <div class="import-content-section-header">
        <h2>INSTALLED CONTENT</h2>
        <span>${installedEntries.length} package(s)</span>
      </div>
      <div class="import-content-library-grid">
        ${installedEntries
          .map((entry) => {
            const actionLabel = getEntryActionLabel(entry);
            return `
              <article class="import-library-card">
                <div class="import-library-card__topline">
                  <span class="import-library-card__badge">${getTypeLabel(entry)}</span>
                  <span class="import-library-card__timestamp">${formatImportedTimestamp(entry.importedAt)}</span>
                </div>
                <h3>${entry.manifest.title}</h3>
                <p>${entry.manifest.description}</p>
                <div class="import-library-card__meta">
                  <span>ID: ${entry.manifest.contentId}</span>
                  <span>Source: ${entry.sourceName}</span>
                </div>
                ${
                  entry.warnings.length > 0
                    ? `<p class="import-library-card__warnings">${entry.warnings.join(" ")}</p>`
                    : `<p class="import-library-card__ready">${getEntryPassiveHint(entry)}</p>`
                }
                <div class="import-library-card__footer">
                  ${
                    actionLabel
                      ? `<button class="import-library-card__action" data-entry-key="${entry.key}" data-entry-action="${actionLabel.toLowerCase()}">${actionLabel}</button>`
                      : `<span class="import-library-card__hint">${getEntryPassiveHint(entry)}</span>`
                  }
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

async function handleFileImport(files: File[] | FileList): Promise<void> {
  const fileArray = Array.from(files);
  if (fileArray.length === 0 || isImporting) {
    return;
  }

  isImporting = true;
  renderImportContentScreen();

  try {
    lastImportResults = await installTechnicaFiles(fileArray);
    notifyIfNewTechnicaContentLoaded();
  } catch (error) {
    lastImportResults = [
      {
        sourceName: "Technica import",
        success: false,
        warnings: [],
        error: error instanceof Error ? error.message : "Unknown import error."
      }
    ];
  } finally {
    isImporting = false;
    renderImportContentScreen();
  }
}

function attachImportScreenListeners(): void {
  const backButton = document.getElementById("importContentBackBtn");
  backButton?.addEventListener("click", () => {
    void renderMainMenu();
  });

  const selectButton = document.getElementById("importContentSelectBtn");
  const fileInput = document.getElementById("importContentFileInput") as HTMLInputElement | null;
  selectButton?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", async () => {
    if (fileInput.files && fileInput.files.length > 0) {
      await handleFileImport(fileInput.files);
      fileInput.value = "";
    }
  });

  const dropZone = document.getElementById("importContentDropZone");
  if (dropZone) {
    const setDropState = (isActive: boolean) => {
      dropZone.classList.toggle("import-content-dropzone--active", isActive);
    };

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isImporting) {
          setDropState(true);
        }
      });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        setDropState(false);
      });
    });

    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDropState(false);

      if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
        await handleFileImport(event.dataTransfer.files);
      }
    });
  }

  document.querySelectorAll<HTMLElement>("[data-entry-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const entryKey = button.dataset.entryKey;
      if (!entryKey) {
        return;
      }

      const entry = getInstalledTechnicaContent().find((item) => item.key === entryKey);
      if (!entry) {
        return;
      }

      if (entry.manifest.contentType === "map") {
        renderFieldScreen(entry.manifest.contentId);
        return;
      }

      if (entry.manifest.contentType === "dialogue") {
        showImportedDialogue(entry.manifest.contentId, undefined, entry.manifest.title);
      }
    });
  });
}

export function renderImportContentScreen(): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const installedEntries = getInstalledTechnicaContent();
  const counts = getInstalledTechnicaCounts();
  const enemyCount = counts.field_enemy;
  const systemsCount =
    counts.mail +
    counts.key_item +
    counts.npc +
    counts.gear +
    counts.item +
    counts.card +
    counts.fieldmod +
    counts.unit +
    counts.operation +
    counts.class +
    counts.codex;

  app.innerHTML = `
    <div class="import-content-root town-screen ard-noise">
      <div class="import-content-header town-screen__header">
        <div class="town-screen__titleblock">
          <h1 class="import-content-title">IMPORT CONTENT</h1>
          <div class="import-content-subtitle">TECHNICA // CHAOS CORE BRIDGE</div>
        </div>
        <div class="import-content-header-right town-screen__header-right">
          <div class="import-content-counts">
            <div class="import-content-count">
              <span>MAPS</span>
              <strong>${counts.map}</strong>
            </div>
            <div class="import-content-count">
              <span>QUESTS</span>
              <strong>${counts.quest}</strong>
            </div>
            <div class="import-content-count">
              <span>DIALOGUE</span>
              <strong>${counts.dialogue}</strong>
            </div>
            <div class="import-content-count">
              <span>ENEMIES</span>
              <strong>${enemyCount}</strong>
            </div>
            <div class="import-content-count">
              <span>SYSTEMS</span>
              <strong>${systemsCount}</strong>
            </div>
          </div>
          <button class="town-screen__back-btn" id="importContentBackBtn">
            <span class="btn-icon">&larr;</span>
            <span class="btn-text">MAIN MENU</span>
          </button>
        </div>
      </div>

      <div class="import-content-body town-screen__content-panel">
        <section class="import-content-dropzone-wrapper town-screen__panel">
          <div class="import-content-section-header">
            <h2>DROP TECHNICA EXPORTS</h2>
            <span>${isImporting ? "Importing..." : "ZIP bundles or runtime JSON"}</span>
          </div>
          <div class="import-content-dropzone ${isImporting ? "import-content-dropzone--busy" : ""}" id="importContentDropZone">
            <div class="import-content-dropzone__label">Drag Technica files here</div>
            <p>
              Drop exported Technica <code>.zip</code> bundles or standalone Chaos Core runtime
              <code>.json</code> files.
            </p>
            <button class="import-content-select-btn" id="importContentSelectBtn" ${isImporting ? "disabled" : ""}>
              ${isImporting ? "IMPORTING..." : "SELECT FILES"}
            </button>
            <input id="importContentFileInput" type="file" accept=".zip,.json" multiple hidden />
          </div>
          <div class="import-content-notes">
            <span>Maps open from here. Field enemies, quests, key items, dialogue, mail, NPCs, gear, items, cards, units, operations, classes, and codex entries sync into the live runtime.</span>
          </div>
        </section>

        ${renderResultSection(lastImportResults)}
        ${renderInstalledContentSection(installedEntries)}
      </div>
    </div>
  `;

  attachImportScreenListeners();
  updateFocusableElements();
}
