// Mission 01 — Sector 7 Perimeter. A timed spawn script; once it runs dry
// and the field is clear, GameScene triggers the WARNING card and the boss.

export interface LevelApi {
  husk(x: number, y?: number, seed?: number): void;
  lancer(x: number, y?: number): void;
  say(text: string, voId?: string): void;
  wave(n: number): void;
  /** Selected gear's display name, for operator chatter. */
  callsign: string;
}

export interface LevelEvent {
  at: number;
  run: (g: LevelApi) => void;
}

function build(): LevelEvent[] {
  const ev: LevelEvent[] = [];
  const add = (at: number, run: (g: LevelApi) => void) => ev.push({ at, run });

  add(0.8, (g) =>
    g.say(
      `OPERATOR // Hostile gears crossing the redline. ${g.callsign}, weapons free.`,
      'op-weapons-free',
    ),
  );

  // W1 — first contact: a line of husks.
  add(3, (g) => g.wave(1));
  for (let i = 0; i < 4; i++) {
    add(3 + i * 0.4, (g) => g.husk(-27 + i * 18, -36, i * 1.7));
  }

  // W2 — staggered diagonal sweep.
  add(10, (g) => g.wave(2));
  for (let i = 0; i < 5; i++) {
    add(10 + i * 0.55, (g) => g.husk(-38 + i * 8, -36, i * 2.1));
  }

  // W3 — first lancer with escorts.
  add(16.5, (g) => g.say('OPERATOR // Lancer-type signature. Watch the flak rings.', 'op-lancer'));
  add(17.5, (g) => {
    g.wave(3);
    g.lancer(0, -34);
    g.husk(-30, -36, 1);
    g.husk(30, -36, 4);
  });

  // W4 — twin lancers on the flanks.
  add(29, (g) => {
    g.wave(4);
    g.lancer(-26, -34);
    g.lancer(26, -34);
  });
  for (let i = 0; i < 4; i++) {
    add(30 + i * 0.5, (g) => g.husk(-12 + i * 8, -37, i * 1.3));
  }

  // W5 — husk swarm.
  add(42, (g) => g.wave(5));
  for (let i = 0; i < 8; i++) {
    add(42 + i * 0.65, (g) => g.husk((i % 2 === 0 ? -1 : 1) * (14 + i * 3.4), -36, i));
  }

  // W6 — final push: lancer wall.
  add(53, (g) => {
    g.wave(6);
    g.lancer(0, -36);
    g.lancer(-29, -33);
    g.lancer(29, -33);
  });
  for (let i = 0; i < 4; i++) {
    add(54 + i * 0.6, (g) => g.husk(-21 + i * 14, -37, i * 0.9));
  }

  add(64, (g) =>
    g.say(
      'OPERATOR // Sweep the stragglers. Something big is on your approach vector.',
      'op-stragglers',
    ),
  );

  return ev.sort((a, b) => a.at - b.at);
}

export const LEVEL1 = build();

export const BOSS_NAME = 'GOLGOTHA';
export const BOSS_TAG = '要塞級敵性ギア'; // "fortress-class hostile gear"
