// ============================================================================
// DIALOGUE SCREEN
// Supports both legacy line-array dialogues and imported Technica node graphs
// ============================================================================

import { getAllImportedDialogues, getImportedDialogue } from "../../content/technica";
import type { DialogueChoice, DialogueEffect, DialogueNode, ImportedDialogue } from "../../content/technica/types";

type LegacyDialogueContent = {
  kind: "legacy";
  npcName: string;
  lines: string[];
};

type GraphDialogueContent = {
  kind: "graph";
  dialogue: ImportedDialogue;
  npcName: string;
};

type DialogueContent = LegacyDialogueContent | GraphDialogueContent;

let currentContent: DialogueContent | null = null;
let currentLineIndex = 0;
let currentNodeId: string | null = null;
let onCloseCallback: (() => void) | null = null;
const dialogueFlags = new Map<string, string | number | boolean>();

function getNode(dialogue: ImportedDialogue, nodeId: string): DialogueNode | null {
  return dialogue.nodes.find((node) => node.id === nodeId) || null;
}

function getCurrentNode(): DialogueNode | null {
  if (!currentContent || currentContent.kind !== "graph" || !currentNodeId) {
    return null;
  }

  return getNode(currentContent.dialogue, currentNodeId);
}

function applyEffects(effects: DialogueEffect[] | undefined): void {
  if (!effects) {
    return;
  }

  effects.forEach((effect) => {
    if (effect.type === "set_flag") {
      dialogueFlags.set(effect.key, effect.value);
    }
  });
}

function evaluateCondition(condition: string | undefined): boolean {
  if (!condition) {
    return true;
  }

  const normalized = condition.trim();
  if (!normalized) {
    return true;
  }

  if (normalized.startsWith("!")) {
    return !Boolean(dialogueFlags.get(normalized.slice(1)));
  }

  if (normalized.includes("==")) {
    const [rawKey, rawValue] = normalized.split("==");
    const key = rawKey.trim();
    const expectedValue = rawValue.trim().replace(/^['"]|['"]$/g, "");
    return String(dialogueFlags.get(key)) === expectedValue;
  }

  return Boolean(dialogueFlags.get(normalized));
}

function getVisibleChoices(node: Extract<DialogueNode, { type: "choice_set" }>): DialogueChoice[] {
  return node.choices.filter((choice) => evaluateCondition(choice.condition));
}

export function showDialogue(npcName: string, dialogueLines: string[], onClose?: () => void): void {
  currentContent = {
    kind: "legacy",
    npcName,
    lines: dialogueLines
  };
  currentLineIndex = 0;
  currentNodeId = null;
  onCloseCallback = onClose || null;

  renderDialogue();
  attachDialogueListeners();
}

function resolveImportedDialogue(dialogueId: string, fallbackNpcId?: string): ImportedDialogue | null {
  const exactDialogue = getImportedDialogue(dialogueId);
  if (exactDialogue) {
    return exactDialogue;
  }

  if (!fallbackNpcId) {
    return null;
  }

  return (
    getAllImportedDialogues().find(
      (dialogue) => String(dialogue.metadata?.linkedNpcId ?? "").trim() === fallbackNpcId
    ) || null
  );
}

export function showImportedDialogue(
  dialogueId: string,
  onClose?: () => void,
  fallbackNpcName?: string,
  fallbackNpcId?: string
): boolean {
  const dialogue = resolveImportedDialogue(dialogueId, fallbackNpcId);
  if (!dialogue) {
    return false;
  }

  currentContent = {
    kind: "graph",
    dialogue,
    npcName: fallbackNpcName || getDialogueSpeakerFallback(dialogue)
  };
  currentLineIndex = 0;
  currentNodeId = dialogue.entryNodeId;
  onCloseCallback = onClose || null;

  // Resolve leading effect/jump nodes before the first render.
  advanceGraphUntilRenderable();
  renderDialogue();
  attachDialogueListeners();
  return true;
}

function getDialogueSpeakerFallback(dialogue: ImportedDialogue): string {
  const firstLine = dialogue.nodes.find((node) => node.type === "line");
  return firstLine && firstLine.type === "line" ? firstLine.speaker : dialogue.title;
}

export function closeDialogue(): void {
  currentContent = null;
  currentLineIndex = 0;
  currentNodeId = null;

  const panel = document.getElementById("dialoguePanel");
  if (panel) {
    panel.remove();
  }

  if (onCloseCallback) {
    onCloseCallback();
    onCloseCallback = null;
  }
}

function advanceGraphUntilRenderable(): void {
  if (!currentContent || currentContent.kind !== "graph") {
    return;
  }

  let safetyCounter = 0;
  while (currentNodeId && safetyCounter < 100) {
    safetyCounter += 1;
    const node = getNode(currentContent.dialogue, currentNodeId);
    if (!node) {
      closeDialogue();
      return;
    }

    if (node.type === "effect") {
      if (evaluateCondition(node.condition)) {
        applyEffects(node.effects);
      }
      currentNodeId = node.nextNodeId ?? null;
      continue;
    }

    if (node.type === "jump") {
      if (evaluateCondition(node.condition)) {
        currentNodeId = node.targetNodeId;
      } else {
        currentNodeId = null;
      }
      continue;
    }

    break;
  }
}

function renderDialogue(): void {
  if (!currentContent) {
    return;
  }

  const existing = document.getElementById("dialoguePanel");
  if (existing) {
    existing.remove();
  }

  const portraitPath = "/assets/portraits/units/core/Test_Portrait.png";
  const panel = document.createElement("div");
  panel.id = "dialoguePanel";
  panel.className = "dialogue-panel";

  if (currentContent.kind === "legacy") {
    const currentLine = currentContent.lines[currentLineIndex];
    const isLastLine = currentLineIndex >= currentContent.lines.length - 1;

    panel.innerHTML = `
      <div class="dialogue-container">
        <div class="dialogue-portrait">
          <img src="${portraitPath}" alt="${currentContent.npcName}" class="dialogue-portrait-img"
               onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
        </div>
        <div class="dialogue-window">
          <div class="dialogue-header">
            <div class="dialogue-npc-name">${currentContent.npcName}</div>
            <button class="dialogue-close-btn" id="dialogueCloseBtn">✕</button>
          </div>
          <div class="dialogue-body">
            <div class="dialogue-text">${currentLine}</div>
          </div>
          <div class="dialogue-footer">
            <div class="dialogue-progress">${currentLineIndex + 1} / ${currentContent.lines.length}</div>
            <button class="dialogue-continue-btn" id="dialogueContinueBtn">
              ${isLastLine ? "CLOSE" : "CONTINUE →"}
            </button>
          </div>
        </div>
      </div>
    `;
  } else {
    const node = getCurrentNode();
    if (!node) {
      closeDialogue();
      return;
    }

    if (node.type === "line") {
      const nextNode = node.nextNodeId ? getNode(currentContent.dialogue, node.nextNodeId) : null;
      const continueLabel = !nextNode || nextNode.type === "end" ? "CLOSE" : "CONTINUE →";
      panel.innerHTML = `
        <div class="dialogue-container">
          <div class="dialogue-portrait">
            <img src="${portraitPath}" alt="${node.speaker}" class="dialogue-portrait-img"
                 onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
          </div>
          <div class="dialogue-window">
            <div class="dialogue-header">
              <div class="dialogue-npc-name">${node.speaker}</div>
              <button class="dialogue-close-btn" id="dialogueCloseBtn">✕</button>
            </div>
            <div class="dialogue-body">
              <div class="dialogue-text">${node.text}</div>
            </div>
            <div class="dialogue-footer">
              <div class="dialogue-progress">${currentContent.dialogue.title}</div>
              <button class="dialogue-continue-btn" id="dialogueContinueBtn">${continueLabel}</button>
            </div>
          </div>
        </div>
      `;
    } else if (node.type === "choice_set") {
      const choices = getVisibleChoices(node);
      panel.innerHTML = `
        <div class="dialogue-container">
          <div class="dialogue-portrait">
            <img src="${portraitPath}" alt="${currentContent.npcName}" class="dialogue-portrait-img"
                 onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
          </div>
          <div class="dialogue-window">
            <div class="dialogue-header">
              <div class="dialogue-npc-name">${currentContent.npcName}</div>
              <button class="dialogue-close-btn" id="dialogueCloseBtn">✕</button>
            </div>
            <div class="dialogue-body">
              <div class="dialogue-text">Choose a response.</div>
              <div class="dialogue-choice-list">
                ${choices
                  .map(
                    (choice) => `
                      <button class="dialogue-choice-btn" data-choice-id="${choice.id}">
                        ${choice.text}
                      </button>
                    `
                  )
                  .join("")}
              </div>
            </div>
            <div class="dialogue-footer">
              <div class="dialogue-progress">${currentContent.dialogue.title}</div>
            </div>
          </div>
        </div>
      `;
    } else if (node.type === "end") {
      closeDialogue();
      return;
    }
  }

  document.body.appendChild(panel);
  requestAnimationFrame(() => {
    panel.classList.add("dialogue-panel--visible");
  });
}

function advanceLegacyDialogue(): void {
  if (!currentContent || currentContent.kind !== "legacy") {
    return;
  }

  if (currentLineIndex < currentContent.lines.length - 1) {
    currentLineIndex += 1;
    renderDialogue();
    attachDialogueListeners();
  } else {
    closeDialogue();
  }
}

function advanceGraphDialogue(choiceId?: string): void {
  if (!currentContent || currentContent.kind !== "graph") {
    return;
  }

  const node = getCurrentNode();
  if (!node) {
    closeDialogue();
    return;
  }

  if (node.type === "line") {
    currentNodeId = node.nextNodeId ?? null;
  } else if (node.type === "choice_set") {
    const choice = getVisibleChoices(node).find((entry) => entry.id === choiceId);
    if (!choice) {
      return;
    }
    applyEffects(choice.effects);
    currentNodeId = choice.targetNodeId;
  } else if (node.type === "end") {
    closeDialogue();
    return;
  }

  advanceGraphUntilRenderable();
  if (!currentNodeId) {
    closeDialogue();
    return;
  }

  const nextNode = getCurrentNode();
  if (nextNode?.type === "end") {
    closeDialogue();
    return;
  }

  renderDialogue();
  attachDialogueListeners();
}

function handleContinue(): void {
  if (!currentContent) {
    return;
  }

  if (currentContent.kind === "legacy") {
    advanceLegacyDialogue();
    return;
  }

  advanceGraphDialogue();
}

function attachDialogueListeners(): void {
  setTimeout(() => {
    const continueBtn = document.getElementById("dialogueContinueBtn");
    if (continueBtn) {
      continueBtn.onclick = () => handleContinue();
    }

    const choiceButtons = Array.from(document.querySelectorAll(".dialogue-choice-btn"));
    choiceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const choiceId = (button as HTMLElement).getAttribute("data-choice-id");
        if (choiceId) {
          advanceGraphDialogue(choiceId);
        }
      });
    });

    const closeBtn = document.getElementById("dialogueCloseBtn");
    if (closeBtn) {
      closeBtn.onclick = () => closeDialogue();
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialogue();
        window.removeEventListener("keydown", handleKeyPress);
        return;
      }

      if (currentContent?.kind === "legacy" && (e.key === "e" || e.key === "E" || e.key === "Enter")) {
        e.preventDefault();
        handleContinue();
        window.removeEventListener("keydown", handleKeyPress);
        return;
      }

      if (currentContent?.kind === "graph") {
        if (getCurrentNode()?.type === "line" && (e.key === "e" || e.key === "E" || e.key === "Enter")) {
          e.preventDefault();
          handleContinue();
          window.removeEventListener("keydown", handleKeyPress);
          return;
        }

        if (getCurrentNode()?.type === "choice_set") {
          const numericChoice = Number(e.key);
          const choices = getVisibleChoices(getCurrentNode() as Extract<DialogueNode, { type: "choice_set" }>);
          if (!Number.isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= choices.length) {
            e.preventDefault();
            advanceGraphDialogue(choices[numericChoice - 1].id);
            window.removeEventListener("keydown", handleKeyPress);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
  }, 50);
}
