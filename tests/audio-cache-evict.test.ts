// Decoded music must not accumulate: an AudioBuffer is raw PCM (~40MB for a
// two-minute stereo track — the 2.5MB mp3 is misleading), and a campaign
// touches 10+ tracks, so caching every decode forever holds ~500MB by the
// ending. Policy under test: outgoing music is evicted from the buffer cache
// when it stops (fade-out, natural one-shot end, or abandoned mid-decode);
// the title/select menu beds stay cached for instant transitions; sfx/vo are
// untouched. Evicted tracks simply re-fetch on the next play.

import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeSource {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  playbackRate = { value: 1 };
  start(): void {}
  stop(): void {
    // Real WebAudio fires onended at the scheduled stop time.
    queueMicrotask(() => this.onended?.());
  }
  connect<T>(n: T): T {
    return n;
  }
}

class FakeCtx {
  static instances: FakeCtx[] = [];
  static initialState = 'running';
  state = FakeCtx.initialState;
  currentTime = 0;
  destination = {};
  sources: FakeSource[] = [];
  constructor() {
    FakeCtx.instances.push(this);
  }
  createGain(): unknown {
    return {
      gain: { value: 0, setTargetAtTime() {}, cancelScheduledValues() {} },
      connect<T>(n: T): T {
        return n;
      },
    };
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  decodeAudioData(): Promise<unknown> {
    return Promise.resolve({ duration: 120 });
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    return Promise.resolve();
  }
}

let fetches: string[] = [];

type AudioModule = typeof import('../src/core/audio');

async function boot(opts: { suspended?: boolean } = {}): Promise<AudioModule> {
  vi.resetModules();
  fetches = [];
  FakeCtx.instances = [];
  FakeCtx.initialState = opts.suspended ? 'suspended' : 'running';
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('AudioContext', FakeCtx);
  vi.stubGlobal('fetch', (url: string) => {
    fetches.push(String(url));
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  });
  return import('../src/core/audio');
}

/** Flush the fetch → decode → play promise chains. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('music buffer eviction', () => {
  it('evicts the outgoing mission track when the music switches', async () => {
    const a = await boot();
    a.music('battle');
    await settle();
    expect(a.audioCacheKeys()).toContain('music/battle');
    a.music('boss');
    await settle();
    expect(a.audioCacheKeys()).toContain('music/boss');
    expect(a.audioCacheKeys()).not.toContain('music/battle');
  });

  it('keeps the title/select menu beds cached across switches', async () => {
    const a = await boot();
    a.music('title');
    await settle();
    a.music('select');
    await settle();
    a.music('battle2');
    await settle();
    const keys = a.audioCacheKeys();
    expect(keys).toContain('music/title');
    expect(keys).toContain('music/select');
    expect(keys).toContain('music/battle2');
  });

  it('evicts on music(null) stop', async () => {
    const a = await boot();
    a.music('battle3');
    await settle();
    a.music(null);
    await settle();
    expect(a.audioCacheKeys()).not.toContain('music/battle3');
  });

  it('evicts a one-shot stinger when it ends naturally', async () => {
    const a = await boot();
    a.music('clear', { loop: false });
    await settle();
    expect(a.audioCacheKeys()).toContain('music/clear');
    const ctx = FakeCtx.instances[0];
    ctx.sources[ctx.sources.length - 1].onended?.();
    await settle();
    expect(a.audioCacheKeys()).not.toContain('music/clear');
  });

  it('evicts a track abandoned while still decoding (fast switch)', async () => {
    const a = await boot();
    a.music('battle');
    a.music('boss'); // supersedes before battle finishes decoding
    await settle();
    expect(a.audioCacheKeys()).toContain('music/boss');
    expect(a.audioCacheKeys()).not.toContain('music/battle');
  });

  it('re-fetches an evicted track on the next play', async () => {
    const a = await boot();
    a.music('battle');
    await settle();
    a.music('boss');
    await settle();
    a.music('battle');
    await settle();
    expect(a.audioCacheKeys()).toContain('music/battle');
    expect(fetches.filter((u) => u.includes('music/battle')).length).toBe(2);
  });

  // The autoplay-lock hole the first E2E run caught: before any gesture the
  // context is suspended, so music() only warm-loads and nothing ever plays
  // or stops. Debug jumps (and any pre-gesture scene flow) can switch tracks
  // in that state — the superseded warm buffer must still be evicted.
  it('evicts a warm-loaded track superseded while the context is locked', async () => {
    const a = await boot({ suspended: true });
    a.music('battle');
    await settle(); // decode completes behind the lock; still wanted → kept
    expect(a.audioCacheKeys()).toContain('music/battle');
    a.music('boss');
    await settle();
    expect(a.audioCacheKeys()).toContain('music/boss'); // wanted, plays on unlock
    expect(a.audioCacheKeys()).not.toContain('music/battle');
  });

  it('evicts a locked warm load superseded before its decode lands', async () => {
    const a = await boot({ suspended: true });
    a.music('battle');
    a.music('boss'); // supersedes while battle is still decoding
    await settle();
    expect(a.audioCacheKeys()).toContain('music/boss');
    expect(a.audioCacheKeys()).not.toContain('music/battle');
  });

  it('never evicts sfx buffers on music switches', async () => {
    const a = await boot();
    a.sfx('coin');
    await settle();
    expect(a.audioCacheKeys()).toContain('sfx/coin');
    a.music('battle');
    await settle();
    a.music('boss');
    await settle();
    expect(a.audioCacheKeys()).toContain('sfx/coin');
  });
});
