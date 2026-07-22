// Mission 01 — Sector 7 Perimeter. A timed spawn script; once it runs dry
// and the field is clear, GameScene triggers the WARNING card and the boss.

import { PLAY_X } from '../../core/const';
import type { LevelApi, LevelDef, LevelEvent } from './types';

const SIDE = PLAY_X + 8; // flank entry column, just off-screen

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
  for (let i = 0; i < 5; i++) {
    add(3 + i * 0.4, (g) => g.spawn('husk', -30 + i * 15, -36, i * 1.7));
  }

  // W2 — diagonal sweep, and the first flankers slip in from the left.
  add(9.5, (g) => {
    g.wave(2);
    g.say('OPERATOR // They are splitting up. Watch your flanks — arrows mark the blind sides.');
  });
  for (let i = 0; i < 5; i++) {
    add(9.5 + i * 0.5, (g) => g.spawn('husk', -38 + i * 8, -36, i * 2.1));
  }
  for (let i = 0; i < 2; i++) {
    add(11 + i * 0.9, (g) => g.spawn('husk', -SIDE, -12 + i * 9, 3 + i * 1.9));
  }

  // W3 — first lancer with escorts crossing from both sides.
  add(16, (g) => g.say('OPERATOR // Lancer-type signature. Watch the flak rings.', 'op-lancer'));
  add(17, (g) => {
    g.wave(3);
    g.spawn('lancer', 0, -34);
    g.spawn('husk', -SIDE, -8, 1);
    g.spawn('husk', SIDE, -8, 4);
  });
  add(19, (g) => {
    g.spawn('husk', -30, -36, 2.3);
    g.spawn('husk', 30, -36, 5.1);
  });

  // W4 — twin lancers ride the flanks; first contacts from behind.
  add(27, (g) => {
    g.wave(4);
    g.spawn('lancer', -SIDE - 3, -12);
    g.spawn('lancer', SIDE + 3, -12);
  });
  for (let i = 0; i < 4; i++) {
    add(28 + i * 0.5, (g) => g.spawn('husk', -12 + i * 8, -37, i * 1.3));
  }
  add(31, (g) => g.say('OPERATOR // Two signatures on your six. They are behind you, pilot!'));
  add(31.5, (g) => {
    g.spawn('husk', -28, 34, 1.4);
    g.spawn('husk', 28, 34, 3.7);
  });

  // W5 — pinwheel swarm: husks pour in from every edge. Intro-mission
  // density: a steady stream, not a wall — the lesson is reading the
  // chevrons, and W6 + the boss are still ahead on the same armor bar.
  add(39, (g) => g.wave(5));
  const swarm: [number, number][] = [
    [-20, -36],
    [SIDE, -10],
    [24, 34],
    [-SIDE, -14],
    [8, -36],
    [SIDE, 2],
    [-SIDE, 6],
    [20, -36],
  ];
  swarm.forEach(([x, y], i) => {
    add(39 + i * 0.7, (g) => g.spawn('husk', x, y, i * 1.1));
  });

  // W6 — final push: a lancer pair with a husk pincer.
  add(50, (g) => {
    g.wave(6);
    g.spawn('lancer', 0, -36);
    g.spawn('lancer', SIDE + 3, -14);
  });
  for (let i = 0; i < 3; i++) {
    add(51.5 + i * 0.5, (g) => g.spawn('husk', -18 + i * 18, -37, i * 0.9));
  }
  add(53, (g) => {
    g.spawn('husk', -26, 34, 2.2);
    g.spawn('husk', 26, 34, 4.6);
  });

  add(62, (g) =>
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
