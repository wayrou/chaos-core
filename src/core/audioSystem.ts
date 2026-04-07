import { getSettings, subscribeToSettings } from "./settings";

export type PlaceholderSfxId =
  | "ui-click"
  | "ui-back"
  | "ui-confirm"
  | "ui-move"
  | "system-info"
  | "system-success"
  | "system-error"
  | "battle-start"
  | "battle-victory"
  | "battle-defeat";

export type MusicCueId =
  | "splash"
  | "boot"
  | "main-menu"
  | "haven-field"
  | "haven-esc"
  | "atlas"
  | "theater"
  | "battle"
  | "quiet"
  | (string & {});

export interface MusicTrackDefinition {
  cue: MusicCueId;
  src?: string;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  title?: string;
}

type ToneStep = {
  at: number;
  duration: number;
  from: number;
  to?: number;
  gain: number;
  type?: OscillatorType;
};

type MusicCueOptions = {
  forceRestart?: boolean;
};

const DEFAULT_MUSIC_TRACKS: Record<string, MusicTrackDefinition> = {
  splash: { cue: "splash", title: "Splash", loop: true, volume: 0.7 },
  boot: { cue: "boot", title: "Boot", loop: true, volume: 0.65 },
  "main-menu": { cue: "main-menu", title: "Main Menu", loop: true, volume: 0.8 },
  "haven-field": { cue: "haven-field", title: "Haven Field", loop: true, volume: 0.75 },
  "haven-esc": { cue: "haven-esc", title: "Haven E.S.C.", loop: true, volume: 0.72 },
  atlas: { cue: "atlas", title: "A.T.L.A.S.", loop: true, volume: 0.75 },
  theater: { cue: "theater", title: "Theater Command", loop: true, volume: 0.8 },
  battle: { cue: "battle", title: "Battle", loop: true, volume: 0.85 },
  quiet: { cue: "quiet", title: "Quiet", loop: true, volume: 0 },
};

const SFX_PATTERNS: Record<PlaceholderSfxId, ToneStep[]> = {
  "ui-click": [
    { at: 0, duration: 0.04, from: 820, to: 740, gain: 0.11, type: "triangle" },
    { at: 0.045, duration: 0.03, from: 620, to: 560, gain: 0.06, type: "triangle" },
  ],
  "ui-back": [
    { at: 0, duration: 0.05, from: 420, to: 300, gain: 0.1, type: "sine" },
    { at: 0.04, duration: 0.04, from: 280, to: 220, gain: 0.045, type: "sine" },
  ],
  "ui-confirm": [
    { at: 0, duration: 0.05, from: 560, to: 620, gain: 0.09, type: "triangle" },
    { at: 0.055, duration: 0.06, from: 760, to: 920, gain: 0.12, type: "triangle" },
  ],
  "ui-move": [
    { at: 0, duration: 0.03, from: 510, to: 560, gain: 0.08, type: "square" },
    { at: 0.032, duration: 0.03, from: 650, to: 710, gain: 0.06, type: "triangle" },
  ],
  "system-info": [
    { at: 0, duration: 0.05, from: 720, to: 820, gain: 0.09, type: "sine" },
  ],
  "system-success": [
    { at: 0, duration: 0.045, from: 540, to: 620, gain: 0.08, type: "triangle" },
    { at: 0.05, duration: 0.05, from: 760, to: 900, gain: 0.09, type: "triangle" },
    { at: 0.105, duration: 0.07, from: 960, to: 1120, gain: 0.08, type: "triangle" },
  ],
  "system-error": [
    { at: 0, duration: 0.06, from: 260, to: 220, gain: 0.12, type: "sawtooth" },
    { at: 0.065, duration: 0.08, from: 210, to: 160, gain: 0.09, type: "sawtooth" },
  ],
  "battle-start": [
    { at: 0, duration: 0.08, from: 160, to: 180, gain: 0.12, type: "square" },
    { at: 0.09, duration: 0.07, from: 220, to: 260, gain: 0.09, type: "square" },
  ],
  "battle-victory": [
    { at: 0, duration: 0.08, from: 440, to: 520, gain: 0.08, type: "triangle" },
    { at: 0.085, duration: 0.08, from: 660, to: 760, gain: 0.085, type: "triangle" },
    { at: 0.17, duration: 0.12, from: 900, to: 1120, gain: 0.09, type: "triangle" },
  ],
  "battle-defeat": [
    { at: 0, duration: 0.09, from: 360, to: 300, gain: 0.08, type: "sawtooth" },
    { at: 0.1, duration: 0.1, from: 260, to: 190, gain: 0.08, type: "sawtooth" },
    { at: 0.21, duration: 0.14, from: 180, to: 120, gain: 0.06, type: "sine" },
  ],
};

let audioInitialized = false;
let audioContext: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let musicGainNode: GainNode | null = null;
let sfxGainNode: GainNode | null = null;
let audioUnlocked = false;
let currentMusicCue: MusicCueId | null = null;
let pendingMusicCue: MusicCueId | null = null;
let currentMusicTrack: HTMLAudioElement | null = null;
let settingsCleanup: (() => void) | null = null;
let globalUiHooksAttached = false;
const musicTracks = new Map<MusicCueId, MusicTrackDefinition>(
  Object.values(DEFAULT_MUSIC_TRACKS).map((track) => [track.cue, track]),
);
const loggedSilentMusicCues = new Set<MusicCueId>();

function getAudioContextCtor():
  | (new () => AudioContext)
  | null {
  const audioWindow = window as Window & {
    webkitAudioContext?: new () => AudioContext;
  };
  if (typeof AudioContext !== "undefined") {
    return AudioContext;
  }
  return audioWindow.webkitAudioContext ?? null;
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getEffectiveChannelVolume(channelVolumePercent: number): number {
  const settings = getSettings();
  return clampVolume((settings.masterVolume / 100) * (channelVolumePercent / 100));
}

function syncGainLevels(): void {
  if (!masterGainNode || !musicGainNode || !sfxGainNode || !audioContext) {
    return;
  }

  const settings = getSettings();
  masterGainNode.gain.setValueAtTime(clampVolume(settings.masterVolume / 100), audioContext.currentTime);
  musicGainNode.gain.setValueAtTime(clampVolume(settings.musicVolume / 100), audioContext.currentTime);
  sfxGainNode.gain.setValueAtTime(clampVolume(settings.sfxVolume / 100), audioContext.currentTime);

  if (currentMusicTrack && currentMusicCue) {
    const track = musicTracks.get(currentMusicCue);
    const trackVolume = clampVolume(track?.volume ?? 1);
    currentMusicTrack.volume = clampVolume(getEffectiveChannelVolume(settings.musicVolume) * trackVolume);
  }
}

function ensureAudioGraph(): AudioContext | null {
  if (audioContext && masterGainNode && musicGainNode && sfxGainNode) {
    return audioContext;
  }

  const AudioCtor = getAudioContextCtor();
  if (!AudioCtor) {
    return null;
  }

  audioContext = new AudioCtor();
  masterGainNode = audioContext.createGain();
  musicGainNode = audioContext.createGain();
  sfxGainNode = audioContext.createGain();

  musicGainNode.connect(masterGainNode);
  sfxGainNode.connect(masterGainNode);
  masterGainNode.connect(audioContext.destination);

  syncGainLevels();
  audioUnlocked = audioContext.state === "running";
  return audioContext;
}

async function unlockAudio(): Promise<void> {
  const ctx = ensureAudioGraph();
  if (!ctx) {
    audioUnlocked = true;
    return;
  }

  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch (error) {
      console.warn("[AUDIO] Failed to resume audio context", error);
    }
  }

  audioUnlocked = ctx.state === "running";
  if (audioUnlocked && pendingMusicCue) {
    void applyMusicCue(pendingMusicCue, { forceRestart: true });
  }
}

function stopCurrentMusicTrack(): void {
  if (!currentMusicTrack) {
    return;
  }

  currentMusicTrack.pause();
  currentMusicTrack.currentTime = 0;
  currentMusicTrack.src = "";
  currentMusicTrack = null;
}

async function applyMusicCue(cue: MusicCueId | null, options?: MusicCueOptions): Promise<void> {
  if (!cue) {
    currentMusicCue = null;
    pendingMusicCue = null;
    stopCurrentMusicTrack();
    return;
  }

  if (!options?.forceRestart && currentMusicCue === cue) {
    return;
  }

  currentMusicCue = cue;
  pendingMusicCue = cue;

  const track = musicTracks.get(cue);
  stopCurrentMusicTrack();

  if (!track?.src) {
    if (!loggedSilentMusicCues.has(cue)) {
      console.info(`[AUDIO] Music cue "${cue}" is active but has no source assigned yet.`);
      loggedSilentMusicCues.add(cue);
    }
    return;
  }

  if (!audioUnlocked) {
    return;
  }

  const audio = new Audio(track.src);
  audio.loop = track.loop ?? true;
  audio.preload = "auto";
  audio.playbackRate = track.playbackRate ?? 1;
  audio.volume = clampVolume(getEffectiveChannelVolume(getSettings().musicVolume) * (track.volume ?? 1));

  currentMusicTrack = audio;

  try {
    await audio.play();
    pendingMusicCue = null;
  } catch (error) {
    console.warn(`[AUDIO] Failed to start music cue "${cue}"`, error);
  }
}

function scheduleTone(
  ctx: AudioContext,
  destination: GainNode,
  startAt: number,
  step: ToneStep,
  volumeScalar: number,
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = step.type ?? "triangle";
  oscillator.frequency.setValueAtTime(step.from, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(1, step.to ?? step.from),
    startAt + step.duration,
  );

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, step.gain * volumeScalar),
    startAt + Math.min(step.duration * 0.2, 0.015),
  );
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + step.duration);

  oscillator.connect(gainNode);
  gainNode.connect(destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + step.duration + 0.02);
}

function inferUiSound(target: HTMLElement): PlaceholderSfxId {
  const explicitSound = target.getAttribute("data-audio-sfx") as PlaceholderSfxId | null;
  if (explicitSound && SFX_PATTERNS[explicitSound]) {
    return explicitSound;
  }

  const label = `${target.getAttribute("aria-label") ?? ""} ${target.textContent ?? ""}`.toLowerCase();
  if (
    label.includes("cancel")
    || label.includes("close")
    || label.includes("return")
    || label.includes("back")
    || label === "x"
  ) {
    return "ui-back";
  }

  if (
    label.includes("deploy")
    || label.includes("proceed")
    || label.includes("confirm")
    || label.includes("execute")
    || label.includes("start battle")
  ) {
    return "ui-confirm";
  }

  return "ui-click";
}

function attachGlobalUiAudioHooks(): void {
  if (globalUiHooksAttached) {
    return;
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const control = target.closest<HTMLElement>(
        'button, [role="button"], [data-action], a[href], input[type="range"], summary',
      );
      if (!control || control.dataset.audioIgnore === "true") {
        return;
      }

      void unlockAudio();
      playPlaceholderSfx(inferUiSound(control));
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        void unlockAudio();
      }
    },
    true,
  );

  globalUiHooksAttached = true;
}

export function initializeAudioSystem(): void {
  if (audioInitialized) {
    return;
  }

  ensureAudioGraph();
  attachGlobalUiAudioHooks();
  settingsCleanup = subscribeToSettings(() => {
    syncGainLevels();
  });

  const audioWindow = window as Window & {
    __CHAOSCORE_AUDIO__?: {
      registerMusicTrack: typeof registerMusicTrack;
      setMusicCue: typeof setMusicCue;
      playPlaceholderSfx: typeof playPlaceholderSfx;
      stopMusic: typeof stopMusic;
      getCurrentMusicCue: typeof getCurrentMusicCue;
    };
  };
  audioWindow.__CHAOSCORE_AUDIO__ = {
    registerMusicTrack,
    setMusicCue,
    playPlaceholderSfx,
    stopMusic,
    getCurrentMusicCue,
  };

  audioInitialized = true;
}

export function disposeAudioSystem(): void {
  settingsCleanup?.();
  settingsCleanup = null;
  stopCurrentMusicTrack();
  audioInitialized = false;
}

export function registerMusicTrack(track: MusicTrackDefinition): void {
  musicTracks.set(track.cue, track);
  if (track.cue === currentMusicCue) {
    void applyMusicCue(track.cue, { forceRestart: true });
  }
}

export function setMusicCue(cue: MusicCueId | null, options?: MusicCueOptions): void {
  initializeAudioSystem();
  void applyMusicCue(cue, options);
}

export function stopMusic(): void {
  currentMusicCue = null;
  pendingMusicCue = null;
  stopCurrentMusicTrack();
}

export function getCurrentMusicCue(): MusicCueId | null {
  return currentMusicCue;
}

export function playPlaceholderSfx(id: PlaceholderSfxId): void {
  initializeAudioSystem();

  if (getEffectiveChannelVolume(getSettings().sfxVolume) <= 0) {
    return;
  }

  const ctx = ensureAudioGraph();
  const destination = sfxGainNode;
  if (!ctx || !destination) {
    return;
  }

  const steps = SFX_PATTERNS[id];
  if (!steps) {
    return;
  }

  const now = ctx.currentTime + 0.002;
  const volumeScalar = 1;

  steps.forEach((step) => {
    scheduleTone(ctx, destination, now + step.at, step, volumeScalar);
  });
}

export function playSystemPingSfx(type: "info" | "success" | "error"): void {
  if (type === "success") {
    playPlaceholderSfx("system-success");
    return;
  }
  if (type === "error") {
    playPlaceholderSfx("system-error");
    return;
  }
  playPlaceholderSfx("system-info");
}
