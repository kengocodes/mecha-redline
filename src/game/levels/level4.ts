// Mission 04 — Evensong. The song led off the map: first to an orbital
// garden where seraph-frames are grown, then to the listener itself — a
// cathedral-class mothership beyond the redline. One long final sortie in
// two acts (backdrop and music shift mid-mission), ending in the campaign's
// only multi-form boss and, after it, silence.

import { PLAY_X } from '../../core/const';
import type { LevelApi, LevelDef, LevelEvent } from './types';

const SIDE = PLAY_X + 9; // dart entry column, just off-screen

function build(): LevelEvent[] {
  const ev: LevelEvent[] = [];
  const add = (at: number, run: (g: LevelApi) => void) => ev.push({ at, run });

  // ---- ACT A — THE WHITE CHOIR (garden) ----

  add(0.8, (g) =>
    g.say(
      'OPERATOR // Contact... it is a garden. Those gantries are growing seraph frames.',
      'op4-garden',
    ),
  );

  // W1 — first cherub swarm: five wings off one gantry row.
  add(3, (g) => g.wave(1));
  for (let i = 0; i < 5; i++) {
    add(3 + i * 0.35, (g) => g.spawn('cherub', -24 + i * 12, -36, i * 1.3));
  }
  add(5, (g) =>
    g.say('OPERATOR // Small wings, in swarms. Cherub-types — they dive in turns. Watch your spacing.', 'op4-cherub'),
  );

  // W2 — the first psalm corridor, cherubs threading it.
  add(15, (g) => {
    g.wave(2);
    g.say('OPERATOR // Singing pillars. The curtains weave — walk the corridors, do not fight them.', 'op4-psalm');
  });
  add(15.5, (g) => {
    g.spawn('psalm', -16, -32, 0.2);
    g.spawn('psalm', 16, -32, 2.5);
  });
  for (let i = 0; i < 3; i++) {
    add(17 + i * 0.5, (g) => g.spawn('cherub', -10 + i * 10, -37, i * 1.7));
  }

  // W3 — kai pair escorts a centre pillar; wings pour off the flanks.
  add(28, (g) => g.wave(3));
  add(28.5, (g) => {
    g.spawn('kai', -20, -35, 1);
    g.spawn('kai', 20, -35, 4);
    g.spawn('psalm', 0, -30, 1.2);
  });
  add(30.5, (g) => {
    g.spawn('cherub', -SIDE, -8, 0.8);
    g.spawn('cherub', SIDE, -8, 2.9);
    g.spawn('cherub', -SIDE, 2, 4.6);
  });

  // W4 — shades ambush through the fog while mortars mark the deck.
  add(41, (g) => g.wave(4));
  add(41.5, (g) => {
    g.spawn('shade', -14, -34, 1.4);
    g.spawn('shade', 14, -34, 3.6);
    g.spawn('mortar', 0, -37, 2);
  });
  add(43.5, (g) => {
    g.spawn('cherub', -22, 34, 1.1);
    g.spawn('cherub', 22, 34, 3.2);
  });

  // W5 — GRIGORI: the grey seraph that never finished growing. A rematch
  // the player now wins easily — the measure of how far they've come.
  add(54, (g) => {
    g.wave(5);
    g.say('OPERATOR // A grey seraph frame... half-grown. It fights like the one over the wake.', 'op4-grigori');
  });
  add(54.8, (g) => g.spawn('grigori', 0, -38, 1));
  add(56.5, (g) => {
    g.spawn('cherub', -18, -36, 2.1);
    g.spawn('cherub', 18, -36, 4.3);
  });

  // W6 — OPHANIM: the halo made literal. Ring-class pair, linked fate,
  // a real bar — the sortie continues after they fall.
  add(70, (g) => {
    g.wave(6);
    g.music('ophanim');
    g.say('OPERATOR // Two ring-class contacts — wheels of blades, singing to each other. Break the harmony.', 'op4-ophanim');
  });
  add(70.8, (g) => {
    g.spawn('ophanim', -26, -38, 0);
    g.spawn('ophanim', 26, -38, 2);
  });

  // ---- ACT B — THE LISTENER (the void beyond the redline) ----

  // The garden burns gold and falls away; the organ wall rises.
  add(106, (g) => {
    g.backdrop('voidhall');
    g.music('magnificat');
    g.say('OPERATOR // Reading one contact ahead. Pilot... that is not a ship. That is a cathedral.', 'op4-cathedral');
  });

  // W7 — remix pressure: darts thread the dark, shades hunt through it.
  add(110, (g) => g.wave(7));
  for (let i = 0; i < 4; i++) {
    add(110.5 + i * 0.9, (g) =>
      g.spawn('dart', (i % 2 === 0 ? -1 : 1) * SIDE, i === 3 ? 10 : -14 + i * 4, i * 1.1),
    );
  }
  add(112.5, (g) => {
    g.spawn('shade', -12, -34, 1.8);
    g.spawn('shade', 12, -34, 4.0);
  });

  // W8 — the approach lanes: pylons own the columns, mines pinch, the last
  // wings pour out to meet you.
  add(122, (g) => g.wave(8));
  add(122.5, (g) => {
    g.spawn('pylon', -18, -12);
    g.spawn('pylon', 18, -12, 0.5);
    g.spawn('mortar', 0, -37, 1.4);
  });
  add(124.5, (g) => {
    g.spawn('sentinel', -SIDE, -4, 1);
    g.spawn('sentinel', SIDE, -4, 3);
    g.spawn('sentinel', 0, 36, 5);
  });
  add(127, (g) => {
    g.spawn('kai', -20, -35, 2.2);
    g.spawn('kai', 20, -35, 5.1);
  });
  for (let i = 0; i < 4; i++) {
    add(129 + i * 0.6, (g) => g.spawn('cherub', -18 + i * 12, -37, i * 0.9));
  }

  return ev.sort((a, b) => a.at - b.at);
}

export const LEVEL_4: LevelDef = {
  id: 'evensong',
  missionNo: '04',
  title: 'EVENSONG',
  titleJa: '終焉の聖歌',
  hudTag: 'BEYOND REDLINE',
  objective: 'FOLLOW THE SONG TO ITS SOURCE',
  waveCount: 8,
  introVo: 'op4-mission-start',
  music: { battle: 'battle4', boss: 'magnificat' },
  backdrop: 'garden',
  events: build(),
  duet: {
    killSay: 'OPERATOR // Rings down. The garden is dying, pilot... the petals are burning gold.',
    killVo: 'op4-ophanim-kill',
  },
  boss: {
    kind: 'magnificat',
    name: 'MAGNIFICAT',
    tag: '大聖堂級敵性ギア', // "cathedral-class hostile gear"
    approachLine: 'CATHEDRAL-CLASS MASS ON APPROACH',
    classLine: 'CATHEDRAL-CLASS HOSTILE VESSEL',
    warnSay: 'OPERATOR // Cathedral-class hostile. Its launch bays are still growing wings — burn the bays first.',
    warnVo: 'op4-magnificat',
    warnSfx: 'seraph-choir',
    // Only reached if the fake-out is ever disabled — form2 owns the real end.
    killSay: (callsign) => `OPERATOR // Confirmed kill. Bring the ${callsign} home.`,
    killVo: 'op4-fakeout',
    form2: {
      kind: 'kyrie',
      name: 'KYRIE',
      tag: '原初の声', // "the first voice"
      classLine: 'THE FIRST VOICE ── IT TAUGHT THEM TO SING',
      fakeKillSay: 'OPERATOR // Confirmed kill. Cathedral down. The song is— pilot. The song is getting LOUDER—',
      fakeKillVo: 'op4-fakeout',
      revealSay: 'OPERATOR // The wreck is opening. That light... that is the listener. End the song, pilot.',
      revealVo: 'op4-kyrie',
      music: 'kyrie',
      killSay: (callsign) =>
        `OPERATOR // ...Silence. Confirmed. The song has ended. Come home, ${callsign}. Come home.`,
      killVo: 'op4-kyrie-kill',
    },
  },
  finale: true,
};
