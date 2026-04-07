import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type SquadTransportRole = "idle" | "host" | "client";

export interface SquadTransportStatus {
  active: boolean;
  role: SquadTransportRole;
  port: number | null;
  joinAddress: string | null;
  hostAddress: string | null;
  peerId: string | null;
  connectedPeerIds: string[];
}

export interface SquadTransportEvent {
  type: "host_started" | "client_connected" | "peer_connected" | "peer_disconnected" | "message" | "stopped" | "error";
  role: SquadTransportRole;
  sourcePeerId: string | null;
  messageKind: string | null;
  payload: string | null;
  detail: string | null;
  status: SquadTransportStatus;
}

const DEFAULT_SQUAD_TRANSPORT_STATUS: SquadTransportStatus = {
  active: false,
  role: "idle",
  port: null,
  joinAddress: null,
  hostAddress: null,
  peerId: null,
  connectedPeerIds: [],
};

type SquadTransportSubscriber = (event: SquadTransportEvent) => void | Promise<void>;

let currentTransportStatus: SquadTransportStatus = { ...DEFAULT_SQUAD_TRANSPORT_STATUS };
let eventListenerPromise: Promise<UnlistenFn> | null = null;
const subscribers = new Set<SquadTransportSubscriber>();

function isBrowserWindowAvailable(): boolean {
  return typeof window !== "undefined";
}

export function isTauriSquadTransportAvailable(): boolean {
  if (!isBrowserWindowAvailable()) {
    return false;
  }
  const anyWindow = window as any;
  return Boolean(anyWindow.__TAURI__ || anyWindow.__TAURI_INTERNALS__);
}

function normalizeTransportStatus(status: Partial<SquadTransportStatus> | null | undefined): SquadTransportStatus {
  return {
    active: Boolean(status?.active),
    role: (status?.role === "host" || status?.role === "client" || status?.role === "idle")
      ? status.role
      : "idle",
    port: typeof status?.port === "number" ? status.port : null,
    joinAddress: status?.joinAddress ?? null,
    hostAddress: status?.hostAddress ?? null,
    peerId: status?.peerId ?? null,
    connectedPeerIds: Array.isArray(status?.connectedPeerIds) ? [...status!.connectedPeerIds] : [],
  };
}

async function ensureSquadTransportEventListener(): Promise<void> {
  if (!isTauriSquadTransportAvailable() || eventListenerPromise) {
    return;
  }

  eventListenerPromise = listen<SquadTransportEvent>("squad-transport-event", async (event) => {
    const payload = {
      ...event.payload,
      status: normalizeTransportStatus(event.payload?.status),
    };
    currentTransportStatus = payload.status;
    for (const subscriber of Array.from(subscribers)) {
      await subscriber(payload);
    }
  });
}

async function invokeSquadTransport<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  await ensureSquadTransportEventListener();
  return invoke<T>(command, args);
}

export async function subscribeToSquadTransportEvents(
  subscriber: SquadTransportSubscriber,
): Promise<() => void> {
  subscribers.add(subscriber);
  await ensureSquadTransportEventListener();
  return () => {
    subscribers.delete(subscriber);
  };
}

export function getCachedSquadTransportStatus(): SquadTransportStatus {
  return { ...currentTransportStatus, connectedPeerIds: [...currentTransportStatus.connectedPeerIds] };
}

export async function getSquadTransportStatus(): Promise<SquadTransportStatus> {
  if (!isTauriSquadTransportAvailable()) {
    return getCachedSquadTransportStatus();
  }
  const status = normalizeTransportStatus(await invokeSquadTransport<Partial<SquadTransportStatus>>("get_squad_transport_status"));
  currentTransportStatus = status;
  return status;
}

export async function startSquadTransportHost(preferredPort?: number): Promise<SquadTransportStatus> {
  const status = normalizeTransportStatus(await invokeSquadTransport<Partial<SquadTransportStatus>>("start_squad_transport_host", {
    preferredPort: typeof preferredPort === "number" ? preferredPort : null,
  }));
  currentTransportStatus = status;
  return status;
}

export async function startSquadTransportJoin(hostAddress: string): Promise<SquadTransportStatus> {
  const status = normalizeTransportStatus(await invokeSquadTransport<Partial<SquadTransportStatus>>("start_squad_transport_join", {
    hostAddress,
  }));
  currentTransportStatus = status;
  return status;
}

export async function stopSquadTransport(): Promise<SquadTransportStatus> {
  const status = normalizeTransportStatus(await invokeSquadTransport<Partial<SquadTransportStatus>>("stop_squad_transport"));
  currentTransportStatus = status;
  return status;
}

export async function sendSquadTransportMessage(
  messageKind: string,
  payload: string,
  targetPeerId?: string | null,
): Promise<SquadTransportStatus> {
  const status = normalizeTransportStatus(await invokeSquadTransport<Partial<SquadTransportStatus>>("send_squad_transport_message", {
    messageKind,
    payload,
    targetPeerId: targetPeerId ?? null,
  }));
  currentTransportStatus = status;
  return status;
}
