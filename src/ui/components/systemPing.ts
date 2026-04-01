export type SystemPingType = "success" | "error" | "info";

export interface SystemPingOptions {
  type?: SystemPingType;
  title?: string;
  message: string;
  detail?: string;
  durationMs?: number;
  channel?: string;
  replaceChannel?: boolean;
}

const SYSTEM_PING_STACK_ID = "systemPingStack";

function ensureSystemPingStack(): HTMLElement {
  let stack = document.getElementById(SYSTEM_PING_STACK_ID);
  if (stack) {
    return stack;
  }

  stack = document.createElement("div");
  stack.id = SYSTEM_PING_STACK_ID;
  stack.className = "system-ping-stack";
  document.body.appendChild(stack);
  return stack;
}

function getPingGlyph(type: SystemPingType): string {
  switch (type) {
    case "success":
      return "OK";
    case "error":
      return "!!";
    default:
      return ">>";
  }
}

function removeSystemPing(ping: HTMLElement): void {
  ping.classList.remove("system-ping--visible");
  window.setTimeout(() => {
    ping.remove();
  }, 220);
}

export function showSystemPing(options: SystemPingOptions): void {
  const {
    type = "info",
    title,
    message,
    detail,
    durationMs = 2600,
    channel,
    replaceChannel = true,
  } = options;

  const stack = ensureSystemPingStack();

  if (channel && replaceChannel) {
    stack.querySelectorAll<HTMLElement>(`.system-ping[data-channel="${channel}"]`).forEach((existing) => {
      existing.remove();
    });
  }

  const ping = document.createElement("div");
  ping.className = `system-ping system-ping--${type}`;
  if (channel) {
    ping.dataset.channel = channel;
  }

  const glyph = document.createElement("div");
  glyph.className = "system-ping__glyph";
  glyph.textContent = getPingGlyph(type);
  ping.appendChild(glyph);

  const copy = document.createElement("div");
  copy.className = "system-ping__copy";

  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "system-ping__title";
    titleEl.textContent = title;
    copy.appendChild(titleEl);
  }

  const messageEl = document.createElement("div");
  messageEl.className = "system-ping__message";
  messageEl.textContent = message;
  copy.appendChild(messageEl);

  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "system-ping__detail";
    detailEl.textContent = detail;
    copy.appendChild(detailEl);
  }

  ping.appendChild(copy);
  stack.appendChild(ping);

  requestAnimationFrame(() => {
    ping.classList.add("system-ping--visible");
  });

  window.setTimeout(() => {
    removeSystemPing(ping);
  }, durationMs);
}
