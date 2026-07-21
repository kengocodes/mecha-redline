import type { LegalDocument } from './types';

export const privacyPolicy: LegalDocument = {
  metaTitle: 'Privacy — MECHA REDLINE',
  title: 'Privacy policy',
  updated: 'Last updated: July 2026',
  intro: [
    'MECHA REDLINE is a free browser game. This page explains what data stays on your device and what we do not collect.',
    'The short version: there are no accounts, no ads, and no analytics trackers. We never sell your data.',
  ],
  sections: [
    {
      heading: 'What we store on your device',
      paragraphs: ['The game may save the following in your browser’s local storage:'],
      bullets: [
        'High score — so the title screen can show your best run.',
        'Audio preferences — volume levels and mute, so the mixer remembers your settings.',
      ],
      after: [
        'This data never leaves your device unless you clear site data yourself. Playing does not require a login.',
      ],
    },
    {
      heading: 'What we don’t collect',
      paragraphs: [
        'We do not run accounts, analytics beacons, or advertising trackers. We do not ask for a name, email, password, payment details, or location.',
      ],
    },
    {
      heading: 'Third-party assets',
      paragraphs: [
        'The game may load a webfont from Google Fonts. That request is subject to Google’s own privacy policy.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        'You can clear this site’s data in your browser settings to remove the saved high score and audio preferences. You can also mute or lower volumes in the title-screen Settings panel at any time.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If we make meaningful changes — for example storing something new or adding a service that processes your data — we will update this page and the date at the top. Continuing to play after that means the updated policy applies.',
      ],
    },
    {
      heading: 'Related',
      paragraphs: [
        'How the game may be used is described in our Terms of service.',
      ],
      links: [{ text: 'Terms of service', href: '/terms' }],
    },
  ],
};
