// Mission 01 — Sector 7 Perimeter. A timed spawn script; once it runs dry
// and the field is clear, GameScene triggers the WARNING card and the boss.

import type { LevelApi, LevelDef, LevelEvent } from './types';

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
    add(3 + i * 0.4, (g) => g.spawn('husk', -27 + i * 18, -36, i * 1.7));
  }

  // W2 — staggered diagonal sweep.
  add(10, (g) => g.wave(2));
  for (let i = 0; i < 5; i++) {
    add(10 + i * 0.55, (g) => g.spawn('husk', -38 + i * 8, -36, i * 2.1));
  }

  // W3 — first lancer with escorts.
  add(16.5, (g) => g.say('OPERATOR // Lancer-type signature. Watch the flak rings.', 'op-lancer'));
  add(17.5, (g) => {
    g.wave(3);
    g.spawn('lancer', 0, -34);
    g.spawn('husk', -30, -36, 1);
    g.spawn('husk', 30, -36, 4);
  });

  // W4 — twin lancers on the flanks.
  add(29, (g) => {
    g.wave(4);
    g.spawn('lancer', -26, -34);
    g.spawn('lancer', 26, -34);
  });
  for (let i = 0; i < 4; i++) {
    add(30 + i * 0.5, (g) => g.spawn('husk', -12 + i * 8, -37, i * 1.3));
  }

  // W5 — husk swarm.
  add(42, (g) => g.wave(5));
  for (let i = 0; i < 8; i++) {
    add(42 + i * 0.65, (g) => g.spawn('husk', (i % 2 === 0 ? -1 : 1) * (14 + i * 3.4), -36, i));
  }

  // W6 — final push: lancer wall.
  add(53, (g) => {
    g.wave(6);
    g.spawn('lancer', 0, -36);
    g.spawn('lancer', -29, -33);
    g.spawn('lancer', 29, -33);
  });
  for (let i = 0; i < 4; i++) {
    add(54 + i * 0.6, (g) => g.spawn('husk', -21 + i * 14, -37, i * 0.9));
  }

  add(64, (g) =>
    g.say(
      'OPERATOR // Sweep the stragglers. Something big is on your approach vector.',
      'op-stragglers',
    ),
  );

  return ev.sort((a, b) => a.at - b.at);
}

export const LEVEL_1: LevelDef = {
  id: 'sector7',
  missionNo: '01',
  title: 'SECTOR 7 PERIMETER',
  titleJa: '第七区画防衛線',
  hudTag: 'SECTOR 7',
  objective: 'DESTROY ALL HOSTILE GEARS',
  waveCount: 6,
  introVo: 'op-mission-start',
  music: { battle: 'battle', boss: 'boss' },
  backdrop: 'space',
  events: build(),
  boss: {
    kind: 'boss',
    name: 'GOLGOTHA',
    tag: '要塞級敵性ギア', // "fortress-class hostile gear"
    approachLine: 'FORTRESS-CLASS GEAR ON APPROACH',
    classLine: 'FORTRESS-CLASS HOSTILE GEAR',
    warnSay: 'OPERATOR // Fortress-class contact. That is a Golgotha. Good luck, pilot.',
    warnVo: 'op-warning',
    killSay: (callsign) =>
      `OPERATOR // Confirmed kill. Sector 7 holds. Bring the ${callsign} home.`,
    killVo: 'op-boss-kill',
  },
};
