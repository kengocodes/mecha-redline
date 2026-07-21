import type { LegalDocument } from './types';

export const privacyPolicy: LegalDocument = {
  metaTitle: 'Privacy — MECHA REDLINE',
  title: 'Privacy policy',
  updated: 'Last updated: July 2026',
  intro: [
    'MECHA REDLINE is a free browser game and a personal open-source project run by an individual — not a company. This page explains what stays on your device, what third parties may see when you load the site, and what is not collected.',
    'The short version: there are no accounts, no ads, and no analytics trackers. Your data is never sold.',
  ],
  sections: [
    {
      heading: 'Who runs this',
      paragraphs: [
        'This site is operated by the author of MECHA REDLINE as an individual personal project. For privacy questions, open an issue on the GitHub repository.',
      ],
      links: [
        {
          text: 'GitHub repository',
          href: 'https://github.com/kengocodes/mecha-redline',
        },
      ],
    },
    {
      heading: 'What is stored on your device',
      paragraphs: ['The game may save the following in your browser’s local storage:'],
      bullets: [
        'High score — so the title screen can show your best run.',
        'Audio preferences — volume levels and mute, so the mixer remembers your settings.',
      ],
      after: [
        'This data stays in your browser. It is not uploaded to a game server, and playing does not require a login. Clearing this site’s data in your browser removes it.',
      ],
    },
    {
      heading: 'What is not collected',
      paragraphs: [
        'The game does not run accounts, analytics beacons, advertising trackers, or payment flows. It does not ask for a name, email, password, payment details, or precise location. There is no server-side player profile.',
      ],
    },
    {
      heading: 'Hosting and server logs',
      paragraphs: [
        'The site is hosted on Vercel. Like most hosts, Vercel may process technical request data — for example IP address, user agent, timestamps, and the pages or files requested — in order to serve the site, keep it secure, and operate the platform. That processing is subject to Vercel’s privacy policy. This project does not run a separate analytics product on top of that.',
      ],
      links: [
        {
          text: 'Vercel’s privacy policy',
          href: 'https://vercel.com/legal/privacy-policy',
        },
      ],
    },
    {
      heading: 'Third-party fonts',
      paragraphs: [
        'The game loads the DotGothic16 webfont from Google Fonts. Your browser requests font files from Google’s servers, which can involve technical data such as your IP address. That request is governed by Google’s privacy policy, not this one.',
      ],
      links: [
        {
          text: 'Google’s privacy policy',
          href: 'https://policies.google.com/privacy',
        },
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'MECHA REDLINE is a general-audience entertainment project and is not directed at children under 13. It does not knowingly collect personal information from children. If you believe a child has provided personal information through this site, contact the author via the GitHub repository and it will be addressed.',
      ],
      links: [
        {
          text: 'GitHub repository',
          href: 'https://github.com/kengocodes/mecha-redline',
        },
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        'You can clear this site’s data in your browser settings to remove the saved high score and audio preferences. You can mute or lower volumes in the title-screen Settings panel at any time. You can also stop using the site at any time.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If something meaningful changes — for example storing new data on your device, or adding a service that processes personal data — this page and the date at the top will be updated. Please check back after updates if you care about the details.',
      ],
    },
    {
      heading: 'Related',
      paragraphs: [
        'How the game may be used is described in the Terms of service.',
      ],
      links: [{ text: 'Terms of service', href: '/terms' }],
    },
  ],
};
