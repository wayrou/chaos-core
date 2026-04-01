export type BaseCampReturnTo = "basecamp" | "esc" | "field";

const returnHotkeyHandlers = new Map<string, (e: KeyboardEvent) => void>();
let lastBaseCampFieldMapId = "base_camp";

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;

  return (
    element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
    || element.isContentEditable
  );
}

export function setBaseCampFieldReturnMap(mapId: string): void {
  lastBaseCampFieldMapId = mapId;
}

export function getBaseCampFieldReturnMap(): string {
  return lastBaseCampFieldMapId;
}

export function normalizeBaseCampReturnTo(returnTo: BaseCampReturnTo): "esc" | "field" {
  return returnTo === "field" ? "field" : "esc";
}

export function isFieldBaseCampReturn(returnTo: BaseCampReturnTo): boolean {
  return normalizeBaseCampReturnTo(returnTo) === "field";
}

export function getBaseCampReturnLabel(
  returnTo: BaseCampReturnTo,
  labels: { esc?: string; field?: string } = {},
): string {
  return isFieldBaseCampReturn(returnTo)
    ? (labels.field ?? "FIELD MODE")
    : (labels.esc ?? "E.S.C.");
}

export function returnFromBaseCampScreen(returnTo: BaseCampReturnTo): void {
  if (isFieldBaseCampReturn(returnTo)) {
    import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
      renderFieldScreen(lastBaseCampFieldMapId as any);
    });
    return;
  }

  import("./AllNodesMenuScreen").then(({ renderAllNodesMenuScreen }) => {
    renderAllNodesMenuScreen();
  });
}

export function unregisterBaseCampReturnHotkey(id: string): void {
  const existing = returnHotkeyHandlers.get(id);
  if (!existing) return;

  window.removeEventListener("keydown", existing);
  returnHotkeyHandlers.delete(id);
}

export function registerBaseCampReturnHotkey(
  id: string,
  returnTo: BaseCampReturnTo,
  options: {
    allowFieldEKey?: boolean;
    onReturn?: () => void;
    activeSelector?: string;
  } = {},
): void {
  unregisterBaseCampReturnHotkey(id);

  const handler = (e: KeyboardEvent) => {
    if (options.activeSelector && !document.querySelector(options.activeSelector)) {
      unregisterBaseCampReturnHotkey(id);
      return;
    }

    const key = e.key?.toLowerCase() ?? "";
    const isEscape = key === "escape" || e.key === "Escape" || e.keyCode === 27;
    const isFieldEKey = Boolean(options.allowFieldEKey) && isFieldBaseCampReturn(returnTo) && key === "e";

    if (!isEscape && !isFieldEKey) {
      return;
    }

    if (isFieldEKey && isEditableTarget(e.target)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    unregisterBaseCampReturnHotkey(id);
    options.onReturn?.();
    returnFromBaseCampScreen(returnTo);
  };

  returnHotkeyHandlers.set(id, handler);
  window.addEventListener("keydown", handler);
}
