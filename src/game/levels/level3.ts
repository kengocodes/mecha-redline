// Mission 03 — Neo-Kyoto Nightfall. The song was a beacon; while the
// flight chased it into the wake, the answer came home. Blackout rain over
// the capital, seven waves of raiders, then the hound-class walker CERBERUS.

import { PLAY_X } from '../../core/const';
import type { LevelApi, LevelDef, LevelEvent } from './types';

const SIDE = PLAY_X + 9; // dart entry column, just off-screen

function build(): LevelEvent[] {
  const ev: LevelEvent[] = [];
  const add = (at: number, run: (g: LevelApi) => void) => ev.push({ at, run });

  add(0.8, (g) =>
    g.say(
      `OPERATOR // Blackout rain over the capital. ${g.callsign} — the city is behind you.`,
      'op3-entry',
    ),
  );

  // W1 — rebuilt husks: familiar silhouettes, wrong seams.
  add(3, (g) => g.wave(1));
  for (let i = 0; i < 4; i++) {
    add(3 + i * 0.45, (g) => g.spawn('ashhusk', -27 + i * 18, -36, i * 1.7));
  }
  add(5, (g) =>
    g.say('OPERATOR // Husk frames... rebuilt from the wake. They are salvaging our kills.', 'op3-rebuilt'),
  );

  // W2 — first shades with a husk screen.
  add(13, (g) => {
    g.wave(2);
    g.say('OPERATOR // Cloaked signatures. Shade-types — watch for the shimmer, then hit hard.', 'op3-shade');
  });
  add(13.5, (g) => {
    g.spawn('shade', -20, -34, 1);
    g.spawn('shade', 20, -34, 3);
    g.spawn('ashhusk', 0, -37, 2);
  });

  // W3 — pylons rise; darts thread the lanes.
  add(24, (g) => {
    g.wave(3);
    g.say('OPERATOR // Fixed emplacements rising. Do not stand in the projector lanes.', 'op3-pylon');
  });
  add(24.5, (g) => {
    g.spawn('pylon', -18, -12);
    g.spawn('pylon', 18, -12, 0.5);
  });
  for (let i = 0; i < 3; i++) {
    add(26 + i * 1.2, (g) => g.spawn('dart', (i % 2 === 0 ? -1 : 1) * SIDE, -10 + i * 3, i * 1.4));
  }

  // W4 — mines drift in while shades ambush.
  add(37, (g) => g.wave(4));
  for (let i = 0; i < 3; i++) {
    add(37.4 + i * 0.7, (g) => g.spawn('sentinel', -20 + i * 20, -36, i * 1.3));
  }
  add(39, (g) => {
    g.spawn('shade', -12, -33, 2.2);
    g.spawn('shade', 12, -33, 4.4);
  });

  // W5 — centre pylon holds the middle; darts stream the flanks.
  add(49, (g) => {
    g.wave(5);
    g.spawn('pylon', 0, -10);
    g.spawn('sentinel', -26, -36, 1);
    g.spawn('sentinel', 26, -36, 3);
  });
  for (let i = 0; i < 4; i++) {
    add(50.5 + i * 1.0, (g) => g.spawn('dart', (i % 2 === 0 ? 1 : -1) * SIDE, -14 + i * 2, i * 0.9));
  }

  // W6 — shade pack ambush behind a rebuilt-husk line.
  add(61, (g) => g.wave(6));
  add(61.5, (g) => {
    g.spawn('shade', -24, -34, 1.1);
    g.spawn('shade', 0, -36, 2.6);
    g.spawn('shade', 24, -34, 4.1);
  });
  for (let i = 0; i < 3; i++) {
    add(63 + i * 0.6, (g) => g.spawn('ashhusk', -14 + i * 14, -37, i * 0.8));
  }

  // W7 — final push: everything the blackout hides.
  add(73, (g) => {
    g.wave(7);
    g.spawn('pylon', -20, -11);
    g.spawn('pylon', 20, -11, 0.5);
    g.spawn('shade', 0, -35, 1.9);
  });
  for (let i = 0; i < 3; i++) {
    add(74.5 + i * 0.9, (g) => g.spawn('dart', (i % 2 === 0 ? -1 : 1) * SIDE, -12 + i * 2, i * 1.2));
  }
  add(76, (g) => {
    g.spawn('sentinel', -12, -36, 2);
    g.spawn('sentinel', 12, -36, 4);
  });

  add(88, (g) =>
    g.say('OPERATOR // Sweep the stragglers. ...Something big is moving under the smog. On all fours.', 'op3-stragglers'),
  );

  return ev.sort((a, b) => a.at - b.at);
}

export const LEVEL_3: LevelDef = {
  id: 'nightfall',
  missionNo: '03',
  title: 'NEO-KYOTO NIGHTFALL',
  titleJa: '首都夜襲',
  hudTag: 'NEO-KYOTO',
  objective: 'DEFEND THE CAPITAL',
  waveCount: 7,
  introVo: 'op3-mission-start',
  music: { battle: 'battle3', boss: 'boss3' },
  backdrop: 'city',
  events: build(),
  boss: {
    kind: 'cerberus',
    name: 'CERBERUS',
    tag: '三頭猟犬級敵性ギア', // "three-headed hound-class hostile gear"
    approachLine: 'HOUND-CLASS WALKER ON APPROACH',
    classLine: 'THREE-HEADED HOUND-CLASS WALKER',
    warnSay: 'OPERATOR // Ground contact. Hound-class walker — three heads. It hunts in kill order, pilot.',
    warnVo: 'op3-cerberus',
    warnSfx: 'hound-howl',
    killSay: (callsign) =>
      `OPERATOR // Confirmed kill. The pack is down. The capital holds — bring the ${callsign} home.`,
    killVo: 'op3-cerberus-kill',
  },
};
