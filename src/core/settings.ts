// Persisted player preferences. Audio is the only knobs for now —
// three content buses under a master, plus a mute that preserves levels.

export type BusId = 'master' | 'music' | 'sfx' | 'voice';

export interface AudioSettings {
  master: number; // 0..1
  music: number;
  sfx: number;
  voice: number;
  muted: boolean;
}

export const AUDIO_KEY = 'mecha-redline-audio';

const DEFAULTS: AudioSettings = {
  master: 1,
  music: 1,
  sfx: 1,
  voice: 1,
  muted: false,
};

export const audioSettings: AudioSettings = { ...DEFAULTS };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Load from localStorage (call once at boot). Invalid/missing → defaults. */
export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    audioSettings.master = clamp01(Number(parsed.master ?? DEFAULTS.master));
    audioSettings.music = clamp01(Number(parsed.music ?? DEFAULTS.music));
    audioSettings.sfx = clamp01(Number(parsed.sfx ?? DEFAULTS.sfx));
    audioSettings.voice = clamp01(Number(parsed.voice ?? DEFAULTS.voice));
    audioSettings.muted = Boolean(parsed.muted);
  } catch {
    Object.assign(audioSettings, DEFAULTS);
  }
}

export function saveSettings(): void {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(audioSettings));
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Set a bus level (0..1) and persist. Does not apply to the audio graph. */
export function setBus(id: BusId, value: number): void {
  audioSettings[id] = clamp01(value);
  saveSettings();
}

export function setMuted(muted: boolean): void {
  audioSettings.muted = muted;
  saveSettings();
}

export function toggleMuted(): boolean {
  setMuted(!audioSettings.muted);
  return audioSettings.muted;
}
