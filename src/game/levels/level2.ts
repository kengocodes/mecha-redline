// Mission 02 — Golgotha's Wake. The fortress is dead; you fly into its
// debris ring to cut off the retreat. Seven waves over the burning field,
// then the duel-class SERAPH answers on the open channel.

import { PLAY_X } from '../../core/const';
import type { LevelApi, LevelDef, LevelEvent } from './types';

const SIDE = PLAY_X + 9; // dart entry column, just off-screen

function build(): LevelEvent[] {
  const ev: LevelEvent[] = [];
  const add = (at: number, run: (g: LevelApi) => void) => ev.push({ at, run });

  add(0.8, (g) =>
    g.say(
      `OPERATOR // Entering the debris ring. ${g.callsign}, this wreckage is still hot.`,
      'op2-entry',
    ),
  );

  // W1 — fast movers: darts crossing from alternating flanks.
  add(3, (g) => {
    g.wave(1);
    g.say('OPERATOR // Fast movers on the flanks. Dart-types — lead your shots.', 'op2-dart');
  });
  for (let i = 0; i < 5; i++) {
    add(3.4 + i * 1.0, (g) => g.spawn('dart', (i % 2 === 0 ? -1 : 1) * SIDE, -10 + i * 3, i * 1.7));
  }

  // W2 — mines drift in from ahead AND astern, with dart cover.
  add(12, (g) => {
    g.wave(2);
    g.say('OPERATOR // Autonomous mines drifting in — some from your six. Do not hug them.', 'op2-sentinel');
  });
  add(12.5, (g) => {
    g.spawn('sentinel', -18, -34, 1);
    g.spawn('sentinel', 0, -37, 2.4);
    g.spawn('sentinel', 18, -34, 3.8);
  });
  add(14, (g) => {
    g.spawn('sentinel', -26, 34, 1.9);
    g.spawn('sentinel', 26, 34, 4.4);
  });
  for (let i = 0; i < 2; i++) {
    add(15 + i * 1.2, (g) => g.spawn('dart', (i % 2 === 0 ? 1 : -1) * SIDE, -6, i * 2.2));
  }

  // W3 — first mortar behind a husk screen; a dart slashes the rear lane.
  add(22, (g) => {
    g.wave(3);
    g.say('OPERATOR // Mortar signature. Watch the deck markers — do not stand on the X.', 'op2-mortar');
  });
  add(22.5, (g) => {
    g.spawn('mortar', 0, -36);
    g.spawn('husk', -SIDE, -6, 1);
    g.spawn('husk', SIDE, -6, 4);
  });
  add(25, (g) => g.spawn('dart', -SIDE, 12, 2.8));

  // W4 — mine field closing from every edge + crossing darts.
  add(33, (g) => g.wave(4));
  const mines: [number, number][] = [
    [-24, -36],
    [SIDE - 4, 34],
    [24, -36],
    [-SIDE + 4, 34],
    [0, -37],
  ];
  mines.forEach(([x, y], i) => {
    add(33.4 + i * 0.7, (g) => g.spawn('sentinel', x, y, i * 1.3));
  });
  for (let i = 0; i < 4; i++) {
    add(35 + i * 0.9, (g) => g.spawn('dart', (i % 2 === 0 ? -1 : 1) * SIDE, -12 + (i % 2) * 18, i));
  }

  // W5 — twin mortars walking fire while darts stream both lanes.
  add(44, (g) => {
    g.wave(5);
    g.spawn('mortar', -24, -36);
    g.spawn('mortar', 24, -36, 2);
  });
  for (let i = 0; i < 6; i++) {
    add(45.5 + i * 0.8, (g) =>
      g.spawn('dart', (i % 2 === 0 ? 1 : -1) * SIDE, i < 4 ? -14 + i * 3 : 8 + (i - 4) * 5, i * 0.9),
    );
  }

  // W6 — the elite beat: LANCER-KAI pair sweeping in off both flanks.
  add(55, (g) =>
    g.say('OPERATOR // Two elite signatures. Lancer frames — rebuilt. Watch the spirals.', 'op2-kai'),
  );
  add(56, (g) => {
    g.wave(6);
    g.spawn('kai', -SIDE - 3, -16);
    g.spawn('kai', SIDE + 3, -16, 2.6);
  });
  add(58, (g) => {
    g.spawn('husk', -8, -37, 1.2);
    g.spawn('husk', 8, -37, 3.1);
    g.spawn('husk', 0, 34, 2.2);
  });

  // W7 — final push: everything the wake has left, from everywhere.
  add(69, (g) => {
    g.wave(7);
    g.spawn('kai', 0, -35, 1.4);
    g.spawn('mortar', -26, -36);
  });
  add(70, (g) => {
    g.spawn('sentinel', SIDE - 4, 34, 2.1);
    g.spawn('sentinel', 12, 36, 4.2);
    g.spawn('sentinel', -SIDE + 4, 34, 0.8);
  });
  for (let i = 0; i < 5; i++) {
    add(71.5 + i * 0.8, (g) =>
      g.spawn('dart', (i % 2 === 0 ? -1 : 1) * SIDE, i === 4 ? 12 : -13 + i * 3, i * 1.1),
    );
  }

  add(84, (g) =>
    g.say('OPERATOR // Sweep the stragglers. ...Do you hear that? Something on the open channel.', 'op2-stragglers'),
  );

  return ev.sort((a, b) => a.at - b.at);
}

export const LEVEL_2: LevelDef = {
  id: 'wake',
  missionNo: '02',
  title: "GOLGOTHA'S WAKE",
  titleJa: 'ゴルゴタの航跡',
  hudTag: 'THE WAKE',
  objective: 'CUT OFF THE RETREAT',
  waveCount: 7,
  introVo: 'op2-mission-start',
  music: { battle: 'battle2', boss: 'boss2' },
  backdrop: 'wake',
  events: build(),
  boss: {
    kind: 'seraph',
    name: 'SERAPH',
    tag: '決闘級敵性ギア', // "duel-class hostile gear"
    approachLine: 'DUEL-CLASS GEAR ON APPROACH',
    classLine: 'DUEL-CLASS HOSTILE GEAR',
    warnSay: 'OPERATOR // White contact. Duel-class. It is... singing. Weapons free, pilot.',
    warnVo: 'op2-seraph',
    warnSfx: 'seraph-choir',
    killSay: (callsign) =>
      `OPERATOR // Confirmed kill. The song's gone thin... but it hasn't stopped. Bring the ${callsign} home.`,
    killVo: 'op2-seraph-kill',
  },
};
