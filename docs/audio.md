# MECHA REDLINE — audio direction & asset manifest

## Look & feel read (what the audio answers to)

The game presents as a **1998 Japanese arcade cabinet running PS1-class
hardware**. Every layer commits to the fiction:

- **Cabinet chrome** — HI-SCORE / FREE PLAY header, INSERT CREDIT ticker,
  © 1998 plate, PRESS START blink, coin-op select countdown.
- **PS1 render** — fixed 640×360 upscaled with nearest-neighbour, Bayer
  dither + 15-bit colour crush, vertex snap wobble, interlaced scanlines,
  checkerboard scene wipes, a fake NOW LOADING beat.
- **Palette / mood** — void navy under cyan (#7ffbff) tech UI, redline red
  (#ff3b53) threat, amber (#ffb54a) score heat. Sharp corners, 1px
  hairlines, DotGothic16 with katakana accents.
- **Fiction** — Neo-Kyoto garrison, Sector 7 perimeter defence. Terse
  military-anime sortie framing: briefing → catapult launch → waves → WARNING
  → fortress-class boss (Golgotha). Operator text comms prefixed `OPERATOR //`.

**Audio direction that follows:** late-90s Japanese console / arcade mecha
score — still ambient and spacey, but with clearer pulse, melodic hooks,
and sequenced groove (not chill lounge, not modern EDM). Combat is moody
and propulsive; the boss is dread with a measured industrial pulse. Music
uses `music_v2`. SFX are soft-edged and lo-fi (finished at 22.05 kHz mono,
low-passed — period-correct and it also removes ElevenLabs' occasional
high-pitch screech artifacts). The operator lives on a **band-passed
cockpit radio** (300 Hz–3.6 kHz); pilots are on a cleaner intercom. Voices
use `eleven_v3` with `[bracket]` delivery cues.

## Pipeline

```
node tools/gen-audio.mjs all            # gen missing → screech QC/regen → finishing
node tools/gen-audio.mjs gen --only id  # regenerate one asset (then qc/post)
node tools/gen-audio.mjs qc             # print the high-band screech table
node tools/gen-audio.mjs post           # re-run finishing only (cheap, no API)
```

Raw takes are kept in `tools/audio-raw/` so finishing can be re-tuned without
re-paying for generation. Finals land in `public/audio/{music,sfx,vo}/`.
Requires `ELEVENLABS_API_KEY` in `.env` and ffmpeg on PATH.

**Screech QC:** every raw take is scanned for sustained >8.5 kHz energy
(windowed RMS, per-category thresholds). Flagged takes are regenerated up to
twice, keeping the cleanest; the finishing low-pass then removes anything
residual above the category's ceiling.

## Assets & intended trigger points

### Music (`public/audio/music/`)

| file | where | notes |
|---|---|---|
| title.mp3 | title attract | 90s ambient hangar loop with soft groove |
| select.mp3 | character select | 75s tense briefing pulse |
| battle.mp3 | waves | 120s mid-tempo console combat loop |
| boss.mp3 | warning → boss | 100s dark industrial pulse loop |
| clear.mp3 | mission complete card | 18s fanfare, no loop |
| failed.mp3 | mission failed card | 15s somber jingle, no loop |

### SFX (`public/audio/sfx/`)

ui-move / ui-confirm / ui-back (roster + menus), ui-tick (stat-bar block
lands), timer-beep + timer-alarm (select countdown, alarm ≤5s), wipe
(checkerboard transition), logo-slam (title logo hit), coin (future credit
ritual), shot-player, shot-enemy, expl-small, expl-big, expl-boss, hit-armor,
burst (purge), launch (catapult cut-in), warning (klaxon, loopable),
thruster (hover loop), gear-arrive (pad swap thunk).

### Voice (`public/audio/vo/`)

Voices: operator = Alice `wa4sQVgbDDzUDEzJwch3`, Kira Ash
`WtA85syCrJwasGeHGH2p`, Ren Okada `rPMkKgdwgIwqv4fXgR6N`, Sera Vale
`NDTYOmYEjbDIVCKB35i3`, Juno "Brick" Hale `u38fdtX4yQwE9e1F0vPp`.

**Operator** (radio-processed): op-select-gear (select entry), op-launch
(confirm cut-in), op-mission-start (intro), op-weapons-free / op-lancer /
op-stragglers (level script `say()` beats), op-warning (WARNING banner),
op-boss-kill, op-complete, op-failed, op-timeout (countdown ≤ ~6s).

**Pilots** (7 lines each, intercom-processed): `<name>-select` (their roster
quote, on pick), `-launch` (cut-in), `-burst` (BURST fire), `-hit`/`-hit2`/
`-hit3` (armor damage — the game rotates them, never repeating one
back-to-back), `-clear` (mission complete). Names: kira, ren, sera, juno.

Wired via `src/core/audio.ts` (music crossfade bus, throttled SFX bus, VO
channel that ducks music). Bus levels, per-SFX defaults (`SFX_GAIN`), and
per-line VO defaults (`voDefaultGain`) live there; call sites only override
when a beat needs a one-off push/pull.
