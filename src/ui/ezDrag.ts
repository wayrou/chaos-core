const EZ_DRAG_WINDOW_SELECTORS = [
  ".window",
  ".all-nodes-panel",
  "[class$='-window']",
  "[class*='-window ']",
  "[class$='-panel']",
  "[class*='-panel ']",
  "[class$='-card']",
  "[class*='-card ']",
  "[class$='-modal']",
  "[class*='-modal ']",
  "[class$='-dialog']",
  "[class*='-dialog ']",
].join(", ");

const EZ_DRAG_HANDLE_SELECTORS = [
  ".window-header",
  ".ard-panel__header",
  "[class$='-header']",
  "[class*='-header ']",
].join(", ");

const EZ_DRAG_INTERACTIVE_SELECTORS = [
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "a",
  "[role='button']",
  "[contenteditable='true']",
].join(", ");

let ezDragBooted = false;
let ezDragObserver: MutationObserver | null = null;
let ezDragTopZIndex = 5000;

function isHTMLElement(value: Element | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

function getEZDragHandle(candidate: HTMLElement): HTMLElement | null {
  const handles = Array.from(candidate.querySelectorAll(EZ_DRAG_HANDLE_SELECTORS))
    .filter(isHTMLElement);

  for (const handle of handles) {
    const owner = handle.closest(EZ_DRAG_WINDOW_SELECTORS);
    if (owner === candidate) {
      return handle;
    }
  }

  return null;
}

function shouldEnableEZDrag(candidate: HTMLElement): boolean {
  if (candidate.dataset.ezDragDisable === "true") {
    return false;
  }

  const rect = candidate.getBoundingClientRect();
  if (rect.width < 160 || rect.height < 80) {
    return false;
  }

  const viewportWidth = Math.max(window.innerWidth, 1);
  const viewportHeight = Math.max(window.innerHeight, 1);
  const fillsViewportWidth = rect.width >= viewportWidth * 0.98;
  const fillsViewportHeight = rect.height >= viewportHeight * 0.98;

  // Skip true full-screen roots, but allow sidebars / large cards.
  if (fillsViewportWidth && fillsViewportHeight) {
    return false;
  }

  return getEZDragHandle(candidate) !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeEZDraggable(candidate: HTMLElement, handle: HTMLElement): void {
  if (candidate.dataset.ezDragReady === "true") {
    return;
  }

  candidate.dataset.ezDragReady = "true";
  handle.dataset.ezDragHandle = "true";
  handle.classList.add("ez-drag-handle");
  candidate.classList.add("ez-drag-window");

  let pointerId: number | null = null;
  let startPointerX = 0;
  let startPointerY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - startPointerX;
    const dy = event.clientY - startPointerY;
    const rect = candidate.getBoundingClientRect();
    const margin = 8;
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;

    candidate.style.left = `${clamp(startLeft + dx, margin, Math.max(margin, maxLeft))}px`;
    candidate.style.top = `${clamp(startTop + dy, margin, Math.max(margin, maxTop))}px`;
  };

  const endDrag = (event?: PointerEvent) => {
    if (event && pointerId !== null && event.pointerId !== pointerId) {
      return;
    }

    if (pointerId !== null) {
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        // Ignore capture release failures.
      }
    }

    pointerId = null;
    candidate.classList.remove("ez-drag-window--dragging");
    document.body.classList.remove("ez-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  };

  handle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target && target.closest(EZ_DRAG_INTERACTIVE_SELECTORS)) {
      return;
    }

    const rect = candidate.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(candidate);

    candidate.style.position = "fixed";
    candidate.style.left = `${rect.left}px`;
    candidate.style.top = `${rect.top}px`;
    candidate.style.width = `${rect.width}px`;
    candidate.style.height = `${rect.height}px`;
    candidate.style.margin = "0";
    candidate.style.maxWidth = `calc(100vw - 16px)`;
    candidate.style.maxHeight = `calc(100vh - 16px)`;
    candidate.style.transform = "none";
    candidate.style.zIndex = String(++ezDragTopZIndex);

    if (computedStyle.right !== "auto") {
      candidate.style.right = "auto";
    }
    if (computedStyle.bottom !== "auto") {
      candidate.style.bottom = "auto";
    }

    pointerId = event.pointerId;
    startPointerX = event.clientX;
    startPointerY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    candidate.classList.add("ez-drag-window--dragging");
    document.body.classList.add("ez-dragging");

    handle.setPointerCapture(pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    event.preventDefault();
  });
}

function scanEZDragCandidates(root: ParentNode): void {
  const candidates = [
    ...(root instanceof Element && root.matches(EZ_DRAG_WINDOW_SELECTORS) ? [root] : []),
    ...Array.from(root.querySelectorAll(EZ_DRAG_WINDOW_SELECTORS)),
  ].filter(isHTMLElement);

  for (const candidate of candidates) {
    if (!shouldEnableEZDrag(candidate)) {
      continue;
    }

    const handle = getEZDragHandle(candidate);
    if (handle) {
      makeEZDraggable(candidate, handle);
    }
  }
}

export function initEZDrag(): void {
  if (ezDragBooted) {
    return;
  }

  ezDragBooted = true;
  scanEZDragCandidates(document.body);

  ezDragObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          scanEZDragCandidates(node);
        }
      });
    }
  });

  ezDragObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
