# MECHA REDLINE

A 2.5D bullet-hell mecha shooter for the browser. Pilot the **Valkyr** gear
over a plain enemy-base deck, sweep six waves of hostile gears crossing the
redline, then duel the fortress-class boss **GOLGOTHA**. Low-poly flat-shaded
models, a low internal render resolution stretched with nearest-neighbour
sampling, and a sharp-cornered katakana HUD.

This is the Level 1 MVP.

## Run it

```bash
npm install
npm run dev      # http://localhost:5199
```

```bash
npm run build    # type-check + production bundle into dist/
npm run preview  # serve the built bundle
```

## Deploy

Static host from `dist/` after `npm run build`. The app uses History API routes
(`/privacy`, `/terms`), so the host must serve `index.html` for those paths:

- **Vercel** — `vercel.json` rewrites (checked in)
- **Netlify / Cloudflare Pages** — `public/_redirects` (copied into `dist/`)

Share previews use `/og.png`, `/favicon.ico`, and `public/icons/`. Some
crawlers prefer absolute `og:image` URLs — point those at your live origin
once the site is deployed (e.g. `https://your.domain/og.png`).

## Controls

**Desktop + mouse required to play.** Combat uses keyboard + mouse. On
phones (portrait) the title runs as a full-bleed vertical attract screen
— Privacy, Terms, GitHub, and Follow on X stay available — with play
gated behind a “play on desktop” message. Settings still open on touch.

| Input         | Action                                     |
| ------------- | ------------------------------------------ |
| WASD / arrows | Move                                       |
| Mouse         | Aim                                        |
| Mouse / Space | Fire                                       |
| Shift         | Focus (slow, tight spread, hitbox shown)   |
| Z / X         | Burst (spend a charge to clear enemy fire) |
| P / Esc       | Pause                                      |

You have four armour segments and three **Burst** charges. Contact with an
enemy bullet or a gear costs one armour and grants brief invulnerability
(plus a small mercy bullet-clear). Press Z/X to spend a Burst: shatter enemy
fire outward in a purge wave, and buy a short invulnerability window.
Clear all six waves and destroy Golgotha to complete the mission.

## How it's built

Two stacked canvases inside a letterboxed 16:9 `#stage`:

- **three.js** (`src/render/`) renders the 3D world at a fixed 640×360 into a
  canvas the browser upscales with `image-rendering: pixelated`. An
  orthographic camera tilted 60° over the ground plane gives the 2.5D read.
  Gameplay lives on a 2D plane; arena `(x, y)` maps to world `(x, height, z=y)`.
- **Phaser 4** (`src/game/`) owns the game loop, the simulation (player,
  enemies, bullets, collisions, mission flow) and paints the entire HUD onto
  one transparent canvas above the 3D layer.

Battle content is generated at runtime. Mecha are built from flat-shaded boxes
and tapered "frustum" prisms by one parametric humanoid factory
(`src/render/gearFactory.ts`); the plain base deck, bullets and explosions are
procedural too. Bullets and effects render through `InstancedMesh` pools so a
screen full of bullet-hell fire stays cheap. The title screen hybrids the
rotating hangar gear with a chroma-keyed logo from `public/branding/`.

Fonts: [DotGothic16](https://fonts.google.com/specimen/DotGothic16) for the
pixel lettering (Latin + Japanese), loaded before first paint.

### Layout

```
src/
  main.ts                 stage sizing + Phaser bootstrap
  style.css               letterbox + pixelated canvas
  core/
    const.ts              tuning, coordinate conventions, bullet kinds
    input.ts              raw keyboard/pointer, UI-space pointer mapping
  render/
    stage3d.ts            camera, lights, plain base deck, arena border, aim raycast
    backdrops/            per-level environments (space.ts — layered starfield)
    gearFactory.ts        procedural low-poly mecha + unit palettes
    bullets3d.ts          instanced bullet pools
    fx3d.ts               instanced explosions + hit sparks
  game/
    scenes/
      BootScene.ts        font load + stage init
      TitleScene.ts       PS1 hangar attract + keyed logo
      GameScene.ts        the battle simulation
      HudScene.ts         composites the HUD canvas
    entities/
      enemies.ts          husk / lancer / boss definitions + AI
    systems/
      burst.ts            player BURST special (charges + clear)
      patterns.ts         bullet emission helpers (ring / fan / aimed)
    ui/
      state.ts            shared HUD state
      overlay.ts          all 2D HUD drawing
      titleArt.ts         chroma-keyed title logo
    levels/
      types.ts            LevelDef contract — script, boss card, mission copy
      index.ts            mission registry + current-level selection
      level1.ts           Mission 01 — Sector 7 Perimeter
```

Title art lives in `public/branding/` (galaxy plate + magenta-keyed logo).

### Debug URLs (dev only)

Available with `npm run dev`. Production builds ignore these.

- `?debug=battle` — skip the title, start Mission 01.
- `?debug=boss` — jump straight to the Golgotha fight.

## Not yet in this MVP

Additional levels, weapon/upgrade systems, and touch / gamepad combat controls.
