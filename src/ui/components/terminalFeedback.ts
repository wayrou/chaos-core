import { triggerFeedback } from "../../core/feedback";

type TerminalPromptMatch = {
  prompt: string;
  text: string;
};

export type TerminalPromptParser = (line: string) => TerminalPromptMatch | null;

export interface TerminalTypingOptions {
  promptParser?: TerminalPromptParser;
  initialDelayMs?: number;
  pauseAfterLineMs?: number;
  pauseAfterEmptyLineMs?: number;
  baseCharDelayMs?: number;
  minCharDelayMs?: number;
  accelerationPerCharMs?: number;
  maxLines?: number;
  loop?: boolean;
  showCursor?: boolean;
  cursorPrompt?: string;
  lineClassName?: string;
  promptClassName?: string;
  textClassName?: string;
  cursorLineClassName?: string;
  cursorClassName?: string;
  scrollBehavior?: ScrollBehavior;
  onLineCommitted?: (lineIndex: number, line: string) => void;
  onComplete?: () => void;
}

const DEFAULT_BUTTON_SELECTOR = "button";

function flashTerminalSurface(surface: HTMLElement | null): void {
  if (!surface) {
    return;
  }

  surface.classList.remove("terminal-state-flicker");
  void surface.offsetWidth;
  surface.classList.add("terminal-state-flicker");
  window.setTimeout(() => {
    surface.classList.remove("terminal-state-flicker");
  }, 140);
}

function addCursorLine(container: HTMLElement, prompt: string, options: TerminalTypingOptions): void {
  if (!container.isConnected || options.showCursor === false) {
    return;
  }

  container.querySelector(`.${options.cursorLineClassName ?? "terminal-cursor-line"}`)?.remove();

  const cursorLine = document.createElement("div");
  cursorLine.className = `${options.lineClassName ?? "terminal-line"} ${options.cursorLineClassName ?? "terminal-cursor-line"}`.trim();
  cursorLine.innerHTML = `
    <span class="${options.promptClassName ?? "terminal-prompt"}">${prompt}</span>
    <span class="${options.textClassName ?? "terminal-text"}"><span class="${options.cursorClassName ?? "terminal-cursor"}">_</span></span>
  `;
  container.appendChild(cursorLine);
}

function trimTerminalLines(container: HTMLElement, maxLines: number): void {
  const removableLines = Array.from(container.children).filter((child) => {
    return !(child as HTMLElement).classList.contains("terminal-cursor-line");
  });

  while (removableLines.length > maxLines) {
    const line = removableLines.shift();
    line?.remove();
  }
}

function typeText(
  element: HTMLElement,
  text: string,
  options: TerminalTypingOptions,
  schedule: (callback: () => void, delay: number) => void,
  onComplete: () => void,
): void {
  let index = 0;
  const baseDelay = options.baseCharDelayMs ?? 22;
  const minDelay = options.minCharDelayMs ?? 8;
  const acceleration = options.accelerationPerCharMs ?? 0.55;

  const typeNext = () => {
    if (!element.isConnected) {
      return;
    }

    if (index >= text.length) {
      onComplete();
      return;
    }

    element.textContent = text.slice(0, index + 1);
    index += 1;
    const nextDelay = Math.max(minDelay, baseDelay - ((index - 1) * acceleration));
    schedule(typeNext, nextDelay);
  };

  typeNext();
}

function defaultPromptParserFactory(promptPrefix: string): TerminalPromptParser {
  return (line: string) => {
    if (!line.startsWith(promptPrefix)) {
      return null;
    }

    const promptEnd = line.includes("::") ? line.indexOf("::") : promptPrefix.length;
    return {
      prompt: line.slice(0, promptEnd),
      text: promptEnd < line.length ? line.slice(promptEnd) : "",
    };
  };
}

export function startTerminalTyping(
  body: HTMLElement,
  output: HTMLElement,
  lines: string[],
  options: TerminalTypingOptions = {},
): () => void {
  // Use an accelerating type cadence so terminals feel alive without becoming sluggish.
  const promptParser = options.promptParser ?? defaultPromptParserFactory(options.cursorPrompt ?? "S/COM&gt;");
  const timers = new Set<number>();
  let active = true;
  let lineIndex = 0;

  const schedule = (callback: () => void, delay: number) => {
    const timerId = window.setTimeout(() => {
      timers.delete(timerId);
      if (!active) {
        return;
      }
      callback();
    }, delay);
    timers.add(timerId);
  };

  const cleanup = () => {
    active = false;
    timers.forEach((timerId) => window.clearTimeout(timerId));
    timers.clear();
  };

  const commitLine = () => {
    if (!active || !body.isConnected || !output.isConnected || lines.length === 0) {
      return;
    }

    if (lineIndex >= lines.length) {
      if (options.loop === false) {
        options.onComplete?.();
        addCursorLine(output, options.cursorPrompt ?? "S/COM&gt;", options);
        return;
      }
      lineIndex = 0;
    }

    output.querySelector(`.${options.cursorLineClassName ?? "terminal-cursor-line"}`)?.remove();

    const line = lines[lineIndex] ?? "";
    const currentIndex = lineIndex;
    const lineEl = document.createElement("div");
    lineEl.className = options.lineClassName ?? "terminal-line";
    output.appendChild(lineEl);

    const finishLine = () => {
      options.onLineCommitted?.(currentIndex, line);
      flashTerminalSurface(body);
      if (typeof options.maxLines === "number" && options.maxLines > 0) {
        trimTerminalLines(output, options.maxLines);
      }
      body.scrollTo({
        top: body.scrollHeight,
        behavior: options.scrollBehavior ?? "auto",
      });

      lineIndex = currentIndex + 1;
      const pauseMs = line === ""
        ? (options.pauseAfterEmptyLineMs ?? 140)
        : (options.pauseAfterLineMs ?? 260);
      schedule(commitLine, pauseMs);
    };

    if (line === "") {
      lineEl.innerHTML = "<br>";
      finishLine();
      return;
    }

    const promptMatch = promptParser(line);
    if (promptMatch) {
      const promptEl = document.createElement("span");
      promptEl.className = options.promptClassName ?? "terminal-prompt";
      const textEl = document.createElement("span");
      textEl.className = options.textClassName ?? "terminal-text";
      lineEl.append(promptEl, textEl);
      typeText(promptEl, promptMatch.prompt, options, schedule, () => {
        typeText(textEl, promptMatch.text, options, schedule, finishLine);
      });
      return;
    }

    const textEl = document.createElement("span");
    textEl.className = options.textClassName ?? "terminal-text";
    lineEl.appendChild(textEl);
    typeText(textEl, line, options, schedule, finishLine);
  };

  schedule(commitLine, options.initialDelayMs ?? 0);
  return cleanup;
}

export function startTerminalTypingByIds(
  bodyId: string,
  outputId: string,
  lines: string[],
  options: TerminalTypingOptions = {},
): () => void {
  const body = document.getElementById(bodyId) as HTMLElement | null;
  const output = document.getElementById(outputId) as HTMLElement | null;
  if (!body || !output) {
    return () => {};
  }

  return startTerminalTyping(body, output, lines, options);
}

export function enhanceTerminalUiButtons(
  root: HTMLElement,
  selector = DEFAULT_BUTTON_SELECTOR,
): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.classList.add("terminal-ui-button");
  });

  if (root.dataset.terminalUiFeedbackBound === "true") {
    return;
  }

  root.dataset.terminalUiFeedbackBound = "true";
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLElement>(selector);
    if (!button || !root.contains(button) || button.hasAttribute("disabled")) {
      return;
    }

    triggerFeedback({
      type: "ui_confirm",
      source: "ui",
      intensity: 1,
      haptic: null,
      meta: {
        label: button.textContent?.trim() ?? "",
      },
    });

    button.classList.remove("terminal-ui-button--press-flash");
    void button.offsetWidth;
    button.classList.add("terminal-ui-button--press-flash");
    window.setTimeout(() => {
      button.classList.remove("terminal-ui-button--press-flash");
    }, 140);
  });
}
