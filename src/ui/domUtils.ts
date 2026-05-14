type FocusableTarget = {
  focus: (options?: FocusOptions) => void;
} | null | undefined;

export type AppScrollSnapshot = {
  appLeft: number;
  appTop: number;
  documentLeft: number;
  documentTop: number;
  screenLeft: number;
  screenTop: number;
  windowX: number;
  windowY: number;
};

function clampScrollOffset(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(value, Math.max(0, max)));
}

export function focusElementWithoutScroll(target: FocusableTarget): void {
  if (!target) {
    return;
  }
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
}

export function getAppScreenSignature(root: HTMLElement | null): string {
  const screenRoot = root?.firstElementChild as HTMLElement | null;
  if (!screenRoot) {
    return "";
  }
  const stableKey = screenRoot.getAttribute("data-screen-key")
    ?? screenRoot.id
    ?? screenRoot.classList.item(0)
    ?? screenRoot.tagName.toLowerCase();
  return `${screenRoot.tagName.toLowerCase()}:${stableKey}`;
}

export function readAppScrollSnapshot(root: HTMLElement | null): AppScrollSnapshot {
  const scrollingElement = document.scrollingElement;
  const screenRoot = root?.firstElementChild as HTMLElement | null;
  return {
    appLeft: root?.scrollLeft ?? 0,
    appTop: root?.scrollTop ?? 0,
    documentLeft: scrollingElement?.scrollLeft ?? window.scrollX ?? 0,
    documentTop: scrollingElement?.scrollTop ?? window.scrollY ?? 0,
    screenLeft: screenRoot?.scrollLeft ?? 0,
    screenTop: screenRoot?.scrollTop ?? 0,
    windowX: window.scrollX ?? 0,
    windowY: window.scrollY ?? 0,
  };
}

export function maybeRestoreAppScrollSnapshot(
  root: HTMLElement | null,
  snapshot: AppScrollSnapshot,
  threshold = 24,
): boolean {
  const scrollingElement = document.scrollingElement;
  const screenRoot = root?.firstElementChild as HTMLElement | null;
  const currentAppTop = root?.scrollTop ?? 0;
  const currentDocumentTop = scrollingElement?.scrollTop ?? window.scrollY ?? 0;
  const currentScreenTop = screenRoot?.scrollTop ?? 0;
  const currentWindowY = window.scrollY ?? 0;
  const verticalSnapDetected = (snapshot.appTop - currentAppTop) > threshold
    || (snapshot.documentTop - currentDocumentTop) > threshold
    || (snapshot.screenTop - currentScreenTop) > threshold
    || (snapshot.windowY - currentWindowY) > threshold;

  if (!verticalSnapDetected) {
    return false;
  }

  if (root) {
    root.scrollLeft = clampScrollOffset(snapshot.appLeft, root.scrollWidth - root.clientWidth);
    root.scrollTop = clampScrollOffset(snapshot.appTop, root.scrollHeight - root.clientHeight);
  }

  if (screenRoot) {
    screenRoot.scrollLeft = clampScrollOffset(snapshot.screenLeft, screenRoot.scrollWidth - screenRoot.clientWidth);
    screenRoot.scrollTop = clampScrollOffset(snapshot.screenTop, screenRoot.scrollHeight - screenRoot.clientHeight);
  }

  if (scrollingElement) {
    scrollingElement.scrollLeft = clampScrollOffset(snapshot.documentLeft, scrollingElement.scrollWidth - scrollingElement.clientWidth);
    scrollingElement.scrollTop = clampScrollOffset(snapshot.documentTop, scrollingElement.scrollHeight - scrollingElement.clientHeight);
  }

  if (window.scrollX !== snapshot.windowX || window.scrollY !== snapshot.windowY) {
    window.scrollTo(snapshot.windowX, snapshot.windowY);
  }

  return true;
}
