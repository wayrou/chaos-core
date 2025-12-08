// ============================================================================
// DIALOGUE SCREEN - NPC Conversations (Headline 15b)
// Simple placeholder dialogue system
// ============================================================================

// ============================================================================
// STATE
// ============================================================================

let currentDialogue: string[] | null = null;
let currentLineIndex = 0;
let npcName = "";
let onCloseCallback: (() => void) | null = null;

// ============================================================================
// RENDER
// ============================================================================

export function showDialogue(npcName: string, dialogueLines: string[], onClose?: () => void): void {
  currentDialogue = dialogueLines;
  currentLineIndex = 0;
  npcName = npcName;
  onCloseCallback = onClose || null;
  
  renderDialogue();
  attachDialogueListeners();
}

export function closeDialogue(): void {
  currentDialogue = null;
  currentLineIndex = 0;
  npcName = "";
  
  const panel = document.getElementById("dialoguePanel");
  if (panel) {
    panel.remove();
  }
  
  if (onCloseCallback) {
    onCloseCallback();
    onCloseCallback = null;
  }
}

function renderDialogue(): void {
  if (!currentDialogue || currentDialogue.length === 0) return;
  
  // Remove existing dialogue panel if present
  const existing = document.getElementById("dialoguePanel");
  if (existing) {
    existing.remove();
  }
  
  const currentLine = currentDialogue[currentLineIndex];
  const isLastLine = currentLineIndex >= currentDialogue.length - 1;
  
  // Portrait path - using test_portrait for now
  const portraitPath = "/assets/portraits/units/core/Test_Portrait.png";
  
  const panel = document.createElement("div");
  panel.id = "dialoguePanel";
  panel.className = "dialogue-panel";
  panel.innerHTML = `
    <div class="dialogue-container">
      <div class="dialogue-portrait">
        <img src="${portraitPath}" alt="${npcName}" class="dialogue-portrait-img" 
             onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
      </div>
      <div class="dialogue-window">
        <div class="dialogue-header">
          <div class="dialogue-npc-name">${npcName}</div>
          <button class="dialogue-close-btn" id="dialogueCloseBtn">✕</button>
        </div>
        <div class="dialogue-body">
          <div class="dialogue-text">${currentLine}</div>
        </div>
        <div class="dialogue-footer">
          <div class="dialogue-progress">${currentLineIndex + 1} / ${currentDialogue.length}</div>
          <button class="dialogue-continue-btn" id="dialogueContinueBtn">
            ${isLastLine ? "CLOSE" : "CONTINUE →"}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(panel);
  
  // Fade in animation
  requestAnimationFrame(() => {
    panel.classList.add("dialogue-panel--visible");
  });
}

function attachDialogueListeners(): void {
  // Continue/Close button
  setTimeout(() => {
    const continueBtn = document.getElementById("dialogueContinueBtn");
    if (continueBtn) {
      continueBtn.onclick = () => {
        if (currentDialogue && currentLineIndex < currentDialogue.length - 1) {
          currentLineIndex++;
          renderDialogue();
          attachDialogueListeners();
        } else {
          closeDialogue();
        }
      };
    }
    
    // Close button
    const closeBtn = document.getElementById("dialogueCloseBtn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        closeDialogue();
      };
    }
    
    // Keyboard: E or Enter to continue/close
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E" || e.key === "Enter") {
        e.preventDefault();
        if (currentDialogue && currentLineIndex < currentDialogue.length - 1) {
          currentLineIndex++;
          renderDialogue();
          attachDialogueListeners();
        } else {
          closeDialogue();
        }
        window.removeEventListener("keydown", handleKeyPress);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeDialogue();
        window.removeEventListener("keydown", handleKeyPress);
      }
    };
    
    window.addEventListener("keydown", handleKeyPress);
  }, 50);
}

