import { getSettings, subscribeToSettings } from "./settings";
const DEFAULT_MUSIC_TRACKS = {
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
const SFX_PATTERNS = {
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
        // Keep footsteps tucked under the mix: softer, lower, and less clicky than menu UI motion.
        { at: 0, duration: 0.045, from: 240, to: 210, gain: 0.032, type: "sine" },
        { at: 0.01, duration: 0.05, from: 320, to: 260, gain: 0.018, type: "triangle" },
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
const NAMED_AUDIO_HOOK_PATTERNS = {
    attack_hit: [
        { at: 0, duration: 0.024, from: 160, to: 122, gain: 0.14, type: "square" },
        { at: 0.008, duration: 0.06, from: 760, to: 420, gain: 0.075, type: "triangle" },
    ],
    attack_crit: [
        { at: 0, duration: 0.028, from: 150, to: 110, gain: 0.17, type: "square" },
        { at: 0.018, duration: 0.08, from: 680, to: 980, gain: 0.1, type: "triangle" },
        { at: 0.105, duration: 0.07, from: 1040, to: 1360, gain: 0.085, type: "triangle" },
    ],
    resource_pickup: [
        { at: 0, duration: 0.03, from: 600, to: 760, gain: 0.075, type: "triangle" },
        { at: 0.028, duration: 0.05, from: 840, to: 1180, gain: 0.09, type: "triangle" },
    ],
    sable_attack: [
        // Keep Sable's attack tucked under battle/weapon impacts so it reads like a quick snap, not a loud effect.
        { at: 0, duration: 0.026, from: 210, to: 176, gain: 0.055, type: "square" },
        { at: 0.014, duration: 0.05, from: 360, to: 280, gain: 0.04, type: "triangle" },
    ],
    sable_bark: [
        { at: 0, duration: 0.04, from: 470, to: 390, gain: 0.05, type: "sawtooth" },
        { at: 0.022, duration: 0.055, from: 330, to: 250, gain: 0.038, type: "square" },
    ],
    ui_click: [
        { at: 0, duration: 0.03, from: 820, to: 720, gain: 0.1, type: "triangle" },
        { at: 0.035, duration: 0.024, from: 610, to: 560, gain: 0.05, type: "triangle" },
    ],
    weapon_overheat: [
        { at: 0, duration: 0.06, from: 220, to: 180, gain: 0.12, type: "sawtooth" },
        { at: 0.055, duration: 0.08, from: 340, to: 120, gain: 0.1, type: "square" },
        { at: 0.14, duration: 0.12, from: 720, to: 180, gain: 0.08, type: "triangle" },
    ],
    node_damage: [
        { at: 0, duration: 0.024, from: 210, to: 170, gain: 0.11, type: "square" },
        { at: 0.02, duration: 0.05, from: 460, to: 300, gain: 0.06, type: "sawtooth" },
    ],
};
let audioInitialized = false;
let audioContext = null;
let masterGainNode = null;
let musicGainNode = null;
let sfxGainNode = null;
let audioUnlocked = false;
let currentMusicCue = null;
let pendingMusicCue = null;
let currentMusicTrack = null;
let settingsCleanup = null;
let globalUiHooksAttached = false;
const musicTracks = new Map(Object.values(DEFAULT_MUSIC_TRACKS).map((track) => [track.cue, track]));
const loggedSilentMusicCues = new Set();
function getAudioContextCtor() {
    const audioWindow = window;
    if (typeof AudioContext !== "undefined") {
        return AudioContext;
    }
    return audioWindow.webkitAudioContext ?? null;
}
function clampVolume(value) {
    return Math.max(0, Math.min(1, value));
}
function getEffectiveChannelVolume(channelVolumePercent) {
    const settings = getSettings();
    return clampVolume((settings.masterVolume / 100) * (channelVolumePercent / 100));
}
function syncGainLevels() {
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
function ensureAudioGraph() {
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
async function unlockAudio() {
    const ctx = ensureAudioGraph();
    if (!ctx) {
        audioUnlocked = true;
        return;
    }
    if (ctx.state !== "running") {
        try {
            await ctx.resume();
        }
        catch (error) {
            console.warn("[AUDIO] Failed to resume audio context", error);
        }
    }
    audioUnlocked = ctx.state === "running";
    if (audioUnlocked && pendingMusicCue) {
        void applyMusicCue(pendingMusicCue, { forceRestart: true });
    }
}
function stopCurrentMusicTrack() {
    if (!currentMusicTrack) {
        return;
    }
    currentMusicTrack.pause();
    currentMusicTrack.currentTime = 0;
    currentMusicTrack.src = "";
    currentMusicTrack = null;
}
async function applyMusicCue(cue, options) {
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
    }
    catch (error) {
        console.warn(`[AUDIO] Failed to start music cue "${cue}"`, error);
    }
}
function scheduleTone(ctx, destination, startAt, step, volumeScalar) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = step.type ?? "triangle";
    oscillator.frequency.setValueAtTime(step.from, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, step.to ?? step.from), startAt + step.duration);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, step.gain * volumeScalar), startAt + Math.min(step.duration * 0.2, 0.015));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + step.duration);
    oscillator.connect(gainNode);
    gainNode.connect(destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + step.duration + 0.02);
}
function inferUiSound(target) {
    const explicitSound = target.getAttribute("data-audio-sfx");
    if (explicitSound && SFX_PATTERNS[explicitSound]) {
        return explicitSound;
    }
    const label = `${target.getAttribute("aria-label") ?? ""} ${target.textContent ?? ""}`.toLowerCase();
    if (label.includes("cancel")
        || label.includes("close")
        || label.includes("return")
        || label.includes("back")
        || label === "x") {
        return "ui-back";
    }
    if (label.includes("deploy")
        || label.includes("proceed")
        || label.includes("confirm")
        || label.includes("execute")
        || label.includes("start battle")) {
        return "ui-confirm";
    }
    return "ui-click";
}
function attachGlobalUiAudioHooks() {
    if (globalUiHooksAttached) {
        return;
    }
    document.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const control = target.closest('button, [role="button"], [data-action], a[href], input[type="range"], summary');
        if (!control || control.dataset.audioIgnore === "true") {
            return;
        }
        void unlockAudio().then(() => {
            if (control.matches('input[type="range"]')) {
                return;
            }
            if (control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") {
                return;
            }
            playPlaceholderSfx(inferUiSound(control));
        });
    }, true);
    document.addEventListener("keydown", (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }
        const key = event.key;
        if (key.length !== 1 && key !== "Enter" && key !== " ") {
            return;
        }
        const target = event.target;
        const control = target instanceof Element
            ? target.closest('button, [role="button"], [data-action], a[href], summary')
            : null;
        if (control?.dataset.audioIgnore === "true") {
            return;
        }
        void unlockAudio().then(() => {
            if (!control || (key !== "Enter" && key !== " ")) {
                return;
            }
            if (control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") {
                return;
            }
            playPlaceholderSfx(inferUiSound(control));
        });
    }, true);
    globalUiHooksAttached = true;
}
function scheduleTonePatternPlayback(ctx, destination, steps) {
    const now = ctx.currentTime + 0.002;
    steps.forEach((step) => {
        scheduleTone(ctx, destination, now + step.at, step, 1);
    });
}
function playTonePattern(steps) {
    initializeAudioSystem();
    if (getEffectiveChannelVolume(getSettings().sfxVolume) <= 0) {
        return;
    }
    const ctx = ensureAudioGraph();
    const destination = sfxGainNode;
    if (!ctx || !destination) {
        return;
    }
    if (ctx.state !== "running" || !audioUnlocked) {
        void unlockAudio().then(() => {
            const resumedCtx = ensureAudioGraph();
            const resumedDestination = sfxGainNode;
            if (!resumedCtx || !resumedDestination || resumedCtx.state !== "running") {
                return;
            }
            scheduleTonePatternPlayback(resumedCtx, resumedDestination, steps);
        });
        return;
    }
    scheduleTonePatternPlayback(ctx, destination, steps);
}
export function initializeAudioSystem() {
    if (audioInitialized) {
        return;
    }
    ensureAudioGraph();
    attachGlobalUiAudioHooks();
    settingsCleanup = subscribeToSettings(() => {
        syncGainLevels();
    });
    const audioWindow = window;
    audioWindow.__CHAOSCORE_AUDIO__ = {
        registerMusicTrack,
        setMusicCue,
        playPlaceholderSfx,
        stopMusic,
        getCurrentMusicCue,
    };
    audioInitialized = true;
}
export function disposeAudioSystem() {
    settingsCleanup?.();
    settingsCleanup = null;
    stopCurrentMusicTrack();
    audioInitialized = false;
}
export function registerMusicTrack(track) {
    musicTracks.set(track.cue, track);
    if (track.cue === currentMusicCue) {
        void applyMusicCue(track.cue, { forceRestart: true });
    }
}
export function setMusicCue(cue, options) {
    initializeAudioSystem();
    void applyMusicCue(cue, options);
}
export function stopMusic() {
    currentMusicCue = null;
    pendingMusicCue = null;
    stopCurrentMusicTrack();
}
export function getCurrentMusicCue() {
    return currentMusicCue;
}
export function playPlaceholderSfx(id) {
    const steps = SFX_PATTERNS[id];
    if (!steps) {
        return;
    }
    playTonePattern(steps);
}
export function playNamedAudioHook(id) {
    const steps = NAMED_AUDIO_HOOK_PATTERNS[id];
    if (!steps) {
        return;
    }
    playTonePattern(steps);
}
export function playSystemPingSfx(type) {
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
