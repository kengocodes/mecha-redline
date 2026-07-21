// Tiny WebAudio layer for the generated ElevenLabs assets (docs/audio.md).
// Three buses under a master: looping music with crossfade, fire-and-forget
// SFX with per-id throttling, and a single VO channel that ducks the music.
// The context unlocks on the first gesture; anything started before that
// begins once the browser lets it.
// Player mix (master / music / sfx / voice / mute) lives in settings.ts and
// is applied through applyAudioSettings().

import { audioSettings } from './settings';

// Bus mix: music beds under gameplay SFX; VO sits in the middle so
// radio/intercom reads clearly without burying the bed or piercing.
const MUSIC_VOL = 0.42;
const SFX_VOL = 0.68;
const VO_VOL = 0.68;
const DUCK = 0.32; // music multiplier while VO speaks

export type MusicId = 'title' | 'select' | 'battle' | 'boss' | 'clear' | 'failed';

export type SfxId =
  | 'ui-move'
  | 'ui-confirm'
  | 'ui-back'
  | 'ui-tick'
  | 'timer-beep'
  | 'timer-alarm'
  | 'wipe'
  | 'logo-slam'
  | 'coin'
  | 'shot-player'
  | 'shot-enemy'
  | 'expl-small'
  | 'expl-big'
  | 'expl-boss'
  | 'hit-armor'
  | 'burst'
  | 'launch'
  | 'warning'
  | 'thruster'
  | 'gear-arrive';

export type VoId = string; // 'op-*' | '<pilot>-{select,launch,burst,hit,clear}'

/** Per-id defaults — call-site `gain` still wins. Tuned for perceptual mix. */
const SFX_GAIN: Partial<Record<SfxId, number>> = {
  'ui-tick': 0.26, // rapid bar fills — stacks hard if left loud
  'ui-move': 0.42,
  'ui-confirm': 0.62,
  'ui-back': 0.48,
  'timer-beep': 0.42,
  'timer-alarm': 0.52,
  'wipe': 0.48,
  'logo-slam': 0.55,
  'coin': 0.85, // quiet source
  'shot-player': 0.48,
  'shot-enemy': 0.32,
  'expl-small': 0.68,
  'expl-big': 0.72,
  'expl-boss': 0.82,
  'hit-armor': 0.6,
  'burst': 0.52,
  'launch': 0.68,
  'warning': 0.48,
  'gear-arrive': 0.48,
  'thruster': 0.12,
};

/** Soften shouty / select lines; operator stays a hair higher for radio clarity. */
function voDefaultGain(id: VoId): number {
  if (id.startsWith('op-')) return 0.92;
  if (/-hit\d*$/.test(id)) return 0.78;
  if (id.endsWith('-burst')) return 0.82;
  if (id.endsWith('-select')) return 0.8;
  if (id.endsWith('-launch')) return 0.88;
  if (id.endsWith('-clear')) return 0.9;
  return 0.88;
}

/** Roster gear id → VO filename prefix (pilot first names). */
export const PILOT_VO: Record<string, string> = {
  valkyr: 'kira',
  raven: 'ren',
  ivory: 'sera',
  basalt: 'juno',
};

const SFX_ALL: SfxId[] = [
  'ui-move', 'ui-confirm', 'ui-back', 'ui-tick', 'timer-beep', 'timer-alarm',
  'wipe', 'logo-slam', 'coin', 'shot-player', 'shot-enemy', 'expl-small',
  'expl-big', 'expl-boss', 'hit-armor', 'burst', 'launch', 'warning',
  'thruster', 'gear-arrive',
];
const VO_ALL = [
  ...['select-gear', 'launch', 'mission-start', 'weapons-free', 'lancer',
    'stragglers', 'warning', 'boss-kill', 'complete', 'failed', 'timeout',
  ].map((s) => `op-${s}`),
  ...['kira', 'ren', 'sera', 'juno'].flatMap((p) =>
    ['select', 'launch', 'burst', 'hit', 'hit2', 'hit3', 'clear'].map((s) => `${p}-${s}`),
  ),
];

let ctx: AudioContext | null = null;
let masterBus: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let voBus: GainNode;
let ducking = false;
/** Silence while privacy/terms are open — does not change the mute toggle. */
let legalSilent = false;

const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();
const lastPlay = new Map<string, number>();
const loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();

interface MusicHandle {
  id: MusicId;
  src: AudioBufferSourceNode;
  gain: GainNode;
}
let musicNow: MusicHandle | null = null;
let musicWant: MusicId | null = null;
let musicWantLoop = true;
let voNow: AudioBufferSourceNode | null = null;
let voPending: VoId | null = null;

function fadeOutMusic(handle: MusicHandle, fade: number): void {
  if (!ctx) return;
  try {
    handle.gain.gain.cancelScheduledValues(ctx.currentTime);
    handle.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
    handle.src.stop(ctx.currentTime + fade);
  } catch {
    /* already stopped / ended */
  }
}

/** Browser blocks audio until a gesture — resume and start any deferred track. */
function unlockAudio(): void {
  if (!ctx) return;
  const kick = (): void => {
    if (!ctx || ctx.state !== 'running' || !musicWant) return;
    if (musicNow?.id === musicWant) return;
    music(musicWant, { loop: musicWantLoop, fade: 0.35 });
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(kick).catch(() => {});
  } else {
    kick();
  }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  masterBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  voBus = ctx.createGain();
  for (const bus of [musicBus, sfxBus, voBus]) bus.connect(masterBus);
  masterBus.connect(ctx.destination);
  applyAudioSettings();
  window.addEventListener('pointerdown', unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });
  return ctx;
}

function masterLevel(): number {
  return audioSettings.muted || legalSilent ? 0 : audioSettings.master;
}

/** Push `audioSettings` onto the graph. Safe to call before/after init. */
export function applyAudioSettings(): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  masterBus.gain.cancelScheduledValues(t);
  masterBus.gain.setTargetAtTime(masterLevel(), t, 0.03);
  sfxBus.gain.cancelScheduledValues(t);
  sfxBus.gain.setTargetAtTime(SFX_VOL * audioSettings.sfx, t, 0.03);
  voBus.gain.cancelScheduledValues(t);
  voBus.gain.setTargetAtTime(VO_VOL * audioSettings.voice, t, 0.03);
  const music = MUSIC_VOL * audioSettings.music * (ducking ? DUCK : 1);
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(music, t, 0.03);
}

/** Silence all buses while legal pages are open (does not change mute toggle). */
export function setLegalSilent(on: boolean): void {
  legalSilent = on;
  applyAudioSettings();
}

function musicLevel(duck: boolean): number {
  return MUSIC_VOL * audioSettings.music * (duck ? DUCK : 1);
}

async function load(path: string): Promise<AudioBuffer | null> {
  const c = ensure();
  if (!c) return null;
  const hit = buffers.get(path);
  if (hit) return hit;
  let p = loading.get(path);
  if (!p) {
    p = fetch(`/audio/${path}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
      .then((ab) => c.decodeAudioData(ab))
      .then((buf) => {
        buffers.set(path, buf);
        return buf;
      })
      .catch(() => null);
    loading.set(path, p);
  }
  return p;
}

/** Kick the context and warm the cache; call once from boot. */
export function initAudio(): void {
  if (!ensure()) return;
  for (const id of SFX_ALL) void load(`sfx/${id}`);
  for (const id of VO_ALL) void load(`vo/${id}`);
  void load('music/title'); // first track the player will hear
}

// ---- sfx -------------------------------------------------------------------

export function sfx(
  id: SfxId,
  opts: { gain?: number; jitter?: boolean; throttleMs?: number } = {},
): void {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const now = performance.now();
  const gap = opts.throttleMs ?? 30;
  const last = lastPlay.get(id) ?? -Infinity;
  if (now - last < gap) return;
  lastPlay.set(id, now);
  void load(`sfx/${id}`).then((buf) => {
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    if (opts.jitter) src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.08;
    const g = c.createGain();
    g.gain.value = opts.gain ?? SFX_GAIN[id] ?? 1;
    src.connect(g).connect(sfxBus);
    src.start();
  });
}

/** Start a looping sfx (thruster hum); no-op if already running. */
export function sfxLoopStart(id: SfxId, gain?: number): void {
  const c = ensure();
  if (!c || loops.has(id)) return;
  loops.set(id, null as never); // reserve before the async load lands
  void load(`sfx/${id}`).then((buf) => {
    if (!buf || !loops.has(id)) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.value = gain ?? SFX_GAIN[id] ?? 1;
    src.connect(g).connect(sfxBus);
    src.start();
    loops.set(id, { src, gain: g });
  });
}

export function sfxLoopStop(id: SfxId, fade = 0.3): void {
  const c = ctx;
  const loop = loops.get(id);
  loops.delete(id);
  if (!c || !loop) return;
  loop.gain.gain.setTargetAtTime(0, c.currentTime, fade / 3);
  loop.src.stop(c.currentTime + fade);
}

// ---- vo --------------------------------------------------------------------

/**
 * Play a voice line. Default interrupts whatever is speaking (pilot barks);
 * `queue: true` waits for the current line to finish instead (operator
 * narration — one pending slot, newest wins).
 */
export function vo(id: VoId, opts: { queue?: boolean; gain?: number } = {}): void {
  const c = ensure();
  if (!c) return;
  void load(`vo/${id}`).then((buf) => {
    if (!buf) return;
    if (voNow && opts.queue) {
      voPending = id;
      return;
    }
    voPending = null; // an interrupting line supersedes anything waiting
    if (voNow) {
      try {
        voNow.stop();
      } catch {
        /* already ended */
      }
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = opts.gain ?? voDefaultGain(id);
    src.connect(g).connect(voBus);
    // Duck the music under the line, ease it back after.
    ducking = true;
    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setTargetAtTime(musicLevel(true), c.currentTime, 0.06);
    src.onended = () => {
      if (voNow === src) voNow = null;
      if (voNow) return;
      if (voPending) {
        const next = voPending;
        voPending = null;
        vo(next);
      } else if (ctx) {
        ducking = false;
        musicBus.gain.setTargetAtTime(musicLevel(false), ctx.currentTime, 0.25);
      }
    };
    voNow = src;
    src.start();
  });
}

// ---- music -----------------------------------------------------------------

/** Crossfade to a track (loop for phase themes, one-shot for stingers). */
export function music(id: MusicId | null, opts: { loop?: boolean; fade?: number } = {}): void {
  const c = ensure();
  if (!c) return;
  musicWant = id;
  musicWantLoop = opts.loop ?? true;
  const fade = opts.fade ?? 0.8;
  if (musicNow && musicNow.id !== id) {
    const old = musicNow;
    musicNow = null;
    fadeOutMusic(old, fade);
  }
  if (!id || (musicNow && musicNow.id === id)) return;

  // Autoplay policy: don't start graph nodes while locked — unlockAudio()
  // will re-enter once the context is running (title bed waits on first click).
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
    void load(`music/${id}`); // warm decode so the first gesture is instant
    return;
  }

  void load(`music/${id}`).then((buf) => {
    if (!buf || musicWant !== id || musicNow?.id === id) return;
    if (c.state !== 'running') return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = opts.loop ?? true;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(1, c.currentTime, fade / 3);
    src.connect(g).connect(musicBus);
    src.onended = () => {
      if (musicNow?.src === src) musicNow = null;
    };
    src.start();
    musicNow = { id, src, gain: g };
  });
}
