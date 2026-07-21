// MECHA REDLINE audio pipeline — ElevenLabs generation + QC + PS1 finishing.
//
// Direction: 1998 arcade cabinet running PS1-class hardware. Music is
// late-90s Japanese console-game ambience with a bit more pulse (see
// MUSIC below); SFX are soft-edged and lo-fi (22.05 kHz mono); the
// operator lives on a band-passed cockpit radio, pilots on a cleaner
// intercom.
//
// Usage:
//   node tools/gen-audio.mjs all           # gen missing → QC/regen → post
//   node tools/gen-audio.mjs gen [--force] [--only <substr>]
//   node tools/gen-audio.mjs qc            # print high-band screech table
//   node tools/gen-audio.mjs post [--only <substr>]
//
// Raw takes land in tools/audio-raw/ (kept so finishing can be re-tuned
// without paying for regeneration); finals in public/audio/{music,sfx,vo}/.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'tools', 'audio-raw');
const OUT = join(ROOT, 'public', 'audio');

const KEY = (() => {
  const line = readFileSync(join(ROOT, '.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('ELEVENLABS_API_KEY='));
  if (!line) throw new Error('ELEVENLABS_API_KEY missing from .env');
  return line.slice('ELEVENLABS_API_KEY='.length).trim();
})();

const VOICES = {
  operator: 'wa4sQVgbDDzUDEzJwch3', // Alice — garrison operator on comms
  kira: 'WtA85syCrJwasGeHGH2p', // Kira Ash — VALKYR, steady professional
  ren: 'rPMkKgdwgIwqv4fXgR6N', // Ren Okada — RAVEN, cocky skirmisher
  sera: 'NDTYOmYEjbDIVCKB35i3', // Sera Vale — IVORY, quiet sniper
  juno: 'u38fdtX4yQwE9e1F0vPp', // Juno "Brick" Hale — BASALT, gruff warmth
};

// ---- manifest --------------------------------------------------------------

// Direction: late-90s Japanese console / arcade mecha score — still
// atmospheric and spacey, but with clearer pulse, melodic hooks, and
// sequenced groove. Not chill lounge, not modern EDM aggression.
// (Describe the sound, never name an IP or artist — the music API's ToS
// filter rejects style-of references.)
const MUSIC = [
  {
    id: 'title',
    ms: 90_000,
    prompt:
      'Late-90s Japanese console attract theme for a mecha arcade game: warm lo-fi digital synth pads, a memorable mid-tempo motif on slightly dusty sample-based lead, soft sequenced kick-and-snare groove with light hi-hats, subtle arpeggiated bass. Ambient cyberpunk hangar mood with forward motion — contemplative but awake, not sleepy. Instrumental, seamless loop.',
  },
  {
    id: 'select',
    ms: 75_000,
    prompt:
      'Late-90s console briefing / character-select groove: steady mid-tempo electronic pulse, punchy but soft kick, filtered synth stabs, glassy chimes, evolving pad bed, a short looping melodic hook. Tense anticipation before a sortie — atmospheric yet rhythmic, ready rather than meditative. Instrumental, seamless loop.',
  },
  {
    id: 'battle',
    ms: 120_000,
    prompt:
      'Late-90s Japanese console combat theme: driving mid-tempo sequenced drums, rolling synth-bass, ethereal pads behind a clear melodic lead, light breakbeat-flavored percussion without modern harshness. Moody sci-fi mecha tension with real kinetic energy and air in the mix — focused and propulsive, never idle ambient. Instrumental, seamless loop.',
  },
  {
    id: 'boss',
    ms: 100_000,
    prompt:
      'Late-90s console fortress-boss confrontation: darker industrial electronic pulse, heavy but measured kick pattern, ominous low drones, metallic percussion hits, a stark repeating synth motif. Dread with momentum — atmospheric and oppressive but clearly rhythmic, not a static drone bed. Instrumental, seamless loop.',
  },
  {
    id: 'clear',
    ms: 18_000,
    prompt:
      'Short late-90s console mission-complete fanfare: bright resolving synth motif over warm pads, a few triumphant drum hits, dignified arcade afterglow with gentle lift. Instrumental.',
  },
  {
    id: 'failed',
    ms: 15_000,
    prompt:
      'Short somber late-90s arcade game-over jingle: descending melancholy synth motif over a dark pad, sparse low drum hit, dignified defeat for a mecha shooter. Instrumental.',
  },
];

const SFX = [
  { id: 'ui-move', dur: 0.5, text: 'Extremely soft short digital click, muted low blip, subtle menu cursor tick, quiet and unobtrusive' },
  { id: 'ui-confirm', dur: 0.7, text: 'Bright rising two-tone digital chirp, retro arcade menu confirm, decisive' },
  { id: 'ui-back', dur: 0.6, text: 'Descending two-tone digital blip, retro arcade menu cancel' },
  // API floor: duration_seconds >= 0.5.
  { id: 'ui-tick', dur: 0.5, text: 'Tiny single high digital tick, one gauge segment filling on an arcade spec sheet, extremely short, dry' },
  { id: 'timer-beep', dur: 0.5, text: 'Single neutral electronic countdown beep, arcade timer, short, dry' },
  { id: 'timer-alarm', dur: 0.5, text: 'Single urgent high electronic countdown beep, arcade timer running out, sharp' },
  { id: 'wipe', dur: 0.8, text: 'Fast mechanical shutter sweep, checkerboard screen transition whoosh, retro arcade, quick' },
  { id: 'logo-slam', dur: 1.4, text: 'Heavy metallic logo slam impact with a short reverb tail, deep boom, arcade title screen hit' },
  { id: 'coin', dur: 0.8, text: 'Arcade coin insert followed by a bright credit chime, classic cabinet' },
  { id: 'shot-player', dur: 0.5, text: 'Punchy compact sci-fi laser shot, crisp mid-range energy pulse with body and a smooth rounded top end, satisfying and tight, no piercing high frequencies, short' },
  { id: 'shot-enemy', dur: 0.5, text: 'Dark mid-toned energy pulse shot, present but smooth, low menacing zap with a clean attack, no piercing highs, short' },
  { id: 'expl-small', dur: 1.0, text: 'Small robotic drone explosion, crunchy digital burst with metal debris, retro arcade' },
  { id: 'expl-big', dur: 2.2, text: 'Large mech explosion, deep punchy boom with metallic debris scatter, arcade shoot-em-up' },
  { id: 'expl-boss', dur: 4.5, text: 'Massive fortress destruction, chained explosions with a final deep rumbling detonation, epic arcade boss kill' },
  { id: 'hit-armor', dur: 0.6, text: 'Metallic armor impact with electric spark, mech taking damage, punchy' },
  { id: 'burst', dur: 1.8, text: 'Electromagnetic shockwave purge, deep bass drop with an expanding energy sweep, mech special weapon' },
  { id: 'launch', dur: 2.4, text: 'Mech catapult launch: hydraulic pistons clunk then a powerful rocket whoosh accelerating away, steam burst' },
  { id: 'warning', dur: 2.6, loop: true, text: 'Two-tone warning klaxon alarm siren, military base alert, urgent, loopable' },
  { id: 'thruster', dur: 2.5, loop: true, text: 'Steady sci-fi hover thruster hum, plasma jet loop, mid-frequency, smooth loopable' },
  { id: 'gear-arrive', dur: 1.3, text: 'Heavy mech servo whir with hydraulic clunk, robot settling into place on a metal pad' },
];

// [bracket] cues shape eleven_v3 delivery. kind selects the finishing chain:
// 'op' = band-passed comms radio, 'pilot' = cleaner cockpit intercom.
const VO = [
  { id: 'op-select-gear', v: 'operator', kind: 'op', text: 'All pilots, report to hangar bay three. Select your gear.' },
  { id: 'op-launch', v: 'operator', kind: 'op', text: 'Catapult connected. All systems green. Gear — launch!' },
  { id: 'op-mission-start', v: 'operator', kind: 'op', tempo: 1.1, text: 'Mission one. Sector Seven perimeter. Hostiles inbound. Destroy all enemy gears. Good hunting, pilot.' },
  { id: 'op-weapons-free', v: 'operator', kind: 'op', text: 'Hostile gears crossing the redline. Weapons free.' },
  { id: 'op-lancer', v: 'operator', kind: 'op', text: 'Lancer-type signature. Watch the flak rings.' },
  { id: 'op-stragglers', v: 'operator', kind: 'op', text: 'Sweep the stragglers. Something big is on your approach vector.' },
  { id: 'op-warning', v: 'operator', kind: 'op', text: '[alarmed] Warning, warning. Fortress-class contact. That is a Golgotha. [steady] Good luck, pilot.' },
  { id: 'op-boss-kill', v: 'operator', kind: 'op', text: 'Confirmed kill. [relieved] Sector Seven holds. Bring your gear home, pilot.' },
  { id: 'op-complete', v: 'operator', kind: 'op', text: 'Mission complete. [warm] Fine work out there. Cycle down and return to base.' },
  { id: 'op-failed', v: 'operator', kind: 'op', text: '[urgent] Gear down, gear down! [quiet] Signal lost. Recovery team, move out.' },
  { id: 'op-timeout', v: 'operator', kind: 'op', text: 'Decision window closing. Launch order goes automatic in five.' },

  { id: 'kira-select', v: 'kira', kind: 'pilot', tempo: 1.15, text: 'Checklist done. Launching.' },
  { id: 'kira-launch', v: 'kira', kind: 'pilot', tempo: 1.15, text: 'Valkyr, taking the rail. [exhales] Steady... go.' },
  { id: 'kira-burst', v: 'kira', kind: 'pilot', text: '[shouting] Purging! Clear the lane!' },
  { id: 'kira-hit', v: 'kira', kind: 'pilot', text: '[steady] Armor holding. I am still in this.' },
  { id: 'kira-hit2', v: 'kira', kind: 'pilot', text: '[clipped] Took one on the plate. Systems still green.' },
  { id: 'kira-hit3', v: 'kira', kind: 'pilot', text: '[firm] That one connected. Tightening up.' },
  { id: 'kira-clear', v: 'kira', kind: 'pilot', text: '[sighs] Sector clear. Valkyr, returning to base.' },

  { id: 'ren-select', v: 'ren', kind: 'pilot', tempo: 1.15, text: 'Shortest path is through.' },
  { id: 'ren-launch', v: 'ren', kind: 'pilot', tempo: 1.15, text: '[laughs] Raven, off the rail. Try to keep up.' },
  { id: 'ren-burst', v: 'ren', kind: 'pilot', text: '[shouting] Out of my way!' },
  { id: 'ren-hit', v: 'ren', kind: 'pilot', text: 'Tch — [annoyed] paint scratch. That is all you get.' },
  { id: 'ren-hit2', v: 'ren', kind: 'pilot', text: '[hisses] Okay. Now I am annoyed.' },
  { id: 'ren-hit3', v: 'ren', kind: 'pilot', text: '[grunts] Cute. My turn.' },
  { id: 'ren-clear', v: 'ren', kind: 'pilot', text: '[smug] Done already? I was just warming up.' },

  { id: 'sera-select', v: 'sera', kind: 'pilot', tempo: 1.15, text: 'One breath. One shot.' },
  { id: 'sera-launch', v: 'sera', kind: 'pilot', tempo: 1.15, text: '[calm] Ivory, launching. The wind is irrelevant.' },
  { id: 'sera-burst', v: 'sera', kind: 'pilot', text: 'Too close. [cold] Step back.' },
  { id: 'sera-hit', v: 'sera', kind: 'pilot', text: '[sharp inhale] Noted. It will not happen twice.' },
  { id: 'sera-hit2', v: 'sera', kind: 'pilot', text: '[controlled] Impact registered. Recalibrating.' },
  { id: 'sera-hit3', v: 'sera', kind: 'pilot', text: '[sharp exhale] Careless. Correcting.' },
  { id: 'sera-clear', v: 'sera', kind: 'pilot', text: '[softly] Target silence, confirmed.' },

  { id: 'juno-select', v: 'juno', kind: 'pilot', tempo: 1.15, text: 'Armor is a personality trait.' },
  { id: 'juno-launch', v: 'juno', kind: 'pilot', tempo: 1.15, text: '[chuckles] Basalt, rolling out. Mind the paint.' },
  { id: 'juno-burst', v: 'juno', kind: 'pilot', text: '[shouting] Clearing the board!' },
  { id: 'juno-hit', v: 'juno', kind: 'pilot', text: '[grunts] That all? My gear has had worse mornings.' },
  { id: 'juno-hit2', v: 'juno', kind: 'pilot', text: '[rough laugh] Felt that one. Good arm.' },
  { id: 'juno-hit3', v: 'juno', kind: 'pilot', text: '[grunts] Dent the paint, pay the bill.' },
  { id: 'juno-clear', v: 'juno', kind: 'pilot', text: '[laughs] Board is clean. Drinks are on the rookie.' },
];

const ALL = [
  ...MUSIC.map((a) => ({ ...a, cat: 'music' })),
  ...SFX.map((a) => ({ ...a, cat: 'sfx' })),
  ...VO.map((a) => ({ ...a, cat: 'vo' })),
];

// ---- generation ------------------------------------------------------------

async function api(path, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`https://api.elevenlabs.io${path}`, {
        method: 'POST',
        headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      const detail = await res.text();
      if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, attempt * 8000));
        continue;
      }
      throw new Error(`${path} → HTTP ${res.status}: ${detail.slice(0, 300)}`);
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, attempt * 8000));
    }
  }
}

function rawPath(a) {
  return join(RAW, `${a.id}.mp3`);
}

async function generate(a) {
  let buf;
  if (a.cat === 'music') {
    buf = await api('/v1/music?output_format=mp3_44100_128', {
      prompt: a.prompt,
      music_length_ms: a.ms,
      model_id: 'music_v2',
    });
  } else if (a.cat === 'sfx') {
    buf = await api('/v1/sound-generation?output_format=mp3_44100_128', {
      text: a.text,
      duration_seconds: a.dur,
      ...(a.loop ? { loop: true } : {}),
    });
  } else {
    buf = await api(`/v1/text-to-speech/${VOICES[a.v]}?output_format=mp3_44100_128`, {
      text: a.text,
      model_id: 'eleven_v3',
    });
  }
  writeFileSync(rawPath(a), buf);
  console.log(`  gen ${a.cat}/${a.id} (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function genAll({ force = false, only = null } = {}) {
  mkdirSync(RAW, { recursive: true });
  const todo = ALL.filter(
    (a) => (only ? only.has(a.id) : true) && (force || !existsSync(rawPath(a))),
  );
  console.log(`generating ${todo.length} assets…`);
  // Music serially (heavy renders); sfx/vo through a small pool.
  for (const a of todo.filter((a) => a.cat === 'music')) await generate(a);
  const rest = todo.filter((a) => a.cat !== 'music');
  const POOL = 4;
  let ix = 0;
  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (ix < rest.length) await generate(rest[ix++]);
    }),
  );
}

// ---- screech QC ------------------------------------------------------------
// ElevenLabs occasionally lands a piercing high tone. Detector: RMS of the
// >8.5 kHz band (24 dB/oct) in ~0.65 s windows; a run of hot windows flags
// the file. Thresholds differ per category — lasers are legitimately bright.

const QC_RULES = {
  music: { db: -28, run: 3 },
  sfx: { db: -17, run: 2 },
  vo: { db: -30, run: 2 },
};

function highBandWindows(file) {
  const csv = execFileSync(
    'ffprobe',
    [
      '-f', 'lavfi',
      '-i', `amovie=${file},highpass=f=8500,highpass=f=8500,astats=metadata=1:reset=25`,
      '-show_entries', 'frame_tags=lavfi.astats.Overall.RMS_level',
      '-of', 'csv=p=0',
      '-v', 'quiet',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const vals = csv.split('\n').filter(Boolean).map(Number);
  // Keep each completed window's final running value.
  const win = [];
  for (let i = 24; i < vals.length; i += 25) win.push(vals[i]);
  if (vals.length && (vals.length - 1) % 25 !== 24) win.push(vals[vals.length - 1]);
  return win.filter((v) => Number.isFinite(v));
}

/** Worst sustained high-band level: max over runs of `run` consecutive windows. */
function screechScore(file, run) {
  const win = highBandWindows(file);
  if (win.length < run) return win.length ? Math.max(...win) : -Infinity;
  let worst = -Infinity;
  for (let i = 0; i + run <= win.length; i++) {
    worst = Math.max(worst, Math.min(...win.slice(i, i + run)));
  }
  return worst;
}

async function qcAll({ regen = false } = {}) {
  console.log('screech scan (sustained >8.5 kHz RMS, dB):');
  const flagged = [];
  for (const a of ALL) {
    const f = rawPath(a);
    if (!existsSync(f)) continue;
    const rule = QC_RULES[a.cat];
    let score = screechScore(f, rule.run);
    let note = score > rule.db ? 'FLAG' : 'ok';
    if (score > rule.db && regen) {
      for (let retry = 1; retry <= 2 && score > rule.db; retry++) {
        console.log(`  regen ${a.id} (take ${retry + 1}, ${score.toFixed(1)} dB)…`);
        const keep = readFileSync(f);
        await generate(a);
        const next = screechScore(f, rule.run);
        if (next < score) score = next;
        else writeFileSync(f, keep); // new take worse — keep the old one
      }
      note = score > rule.db ? 'STILL HOT (post lowpass will tame it)' : 'fixed';
      if (score > rule.db) flagged.push(a.id);
    } else if (score > rule.db) {
      flagged.push(a.id);
    }
    console.log(`  ${a.cat.padEnd(5)} ${a.id.padEnd(16)} ${score.toFixed(1).padStart(7)}  ${note}`);
  }
  return flagged;
}

// ---- PS1 finishing ---------------------------------------------------------

const CHAINS = {
  music: {
    af: 'lowpass=f=15000,loudnorm=I=-14:TP=-1:LRA=11',
    args: ['-ar', '44100', '-q:a', '3'],
    dir: 'music',
  },
  sfx: {
    af: 'lowpass=f=9500,loudnorm=I=-16:TP=-1:LRA=11',
    args: ['-ar', '22050', '-ac', '1', '-q:a', '4'],
    dir: 'sfx',
  },
  op: {
    af: 'highpass=f=300,lowpass=f=3600,acompressor=threshold=-18dB:ratio=4:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7',
    args: ['-ar', '22050', '-ac', '1', '-q:a', '4'],
    dir: 'vo',
  },
  pilot: {
    af: 'highpass=f=120,lowpass=f=7000,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-1.5:LRA=9',
    args: ['-ar', '22050', '-ac', '1', '-q:a', '4'],
    dir: 'vo',
  },
};

// VO gets its dead air clipped at both ends (eleven_v3 pads generously) and
// an optional per-line atempo — pitch-preserving speed-up that keeps the
// take but tightens delivery. Set `tempo` on a VO manifest entry.
const VO_TRIM =
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,' +
  'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse';

function post({ only = null } = {}) {
  for (const a of ALL) {
    if (only && !only.has(a.id)) continue;
    const src = rawPath(a);
    if (!existsSync(src)) continue;
    const chain = CHAINS[a.cat === 'vo' ? a.kind : a.cat];
    const af =
      a.cat === 'vo'
        ? [VO_TRIM, a.tempo ? `atempo=${a.tempo}` : null, chain.af].filter(Boolean).join(',')
        : chain.af;
    const outDir = join(OUT, chain.dir);
    mkdirSync(outDir, { recursive: true });
    const dst = join(outDir, `${a.id}.mp3`);
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', src, '-af', af, ...chain.args, '-codec:a', 'libmp3lame', dst],
      { stdio: 'inherit' },
    );
    console.log(`  post ${chain.dir}/${a.id}.mp3`);
  }
}

// ---- cli -------------------------------------------------------------------

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith('--')) ?? 'all';
// --only takes a comma-separated list of EXACT asset ids.
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const only = onlyArg ? new Set(onlyArg.split(',')) : null;
const force = args.includes('--force');

if (cmd === 'gen') await genAll({ force, only });
else if (cmd === 'qc') await qcAll({ regen: false });
else if (cmd === 'post') post({ only });
else if (cmd === 'all') {
  await genAll({ force, only });
  const flagged = await qcAll({ regen: true });
  post({ only });
  if (flagged.length) console.log(`\nstill-hot after retries: ${flagged.join(', ')}`);
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}
console.log('done.');
