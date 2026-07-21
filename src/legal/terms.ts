import type { LegalDocument } from './types';

export const termsOfService: LegalDocument = {
  metaTitle: 'Terms — MECHA REDLINE',
  title: 'Terms of service',
  updated: 'Last updated: July 2026',
  intro: [
    'By playing MECHA REDLINE you agree to these terms. The game is provided as-is for entertainment. They are short and in plain language.',
  ],
  sections: [
    {
      heading: 'License to play',
      paragraphs: [
        'You may play the game in a web browser for personal, non-commercial use. You may not redistribute the game client, assets, or audio as your own product without permission.',
      ],
    },
    {
      heading: 'No warranty',
      paragraphs: [
        'The game is offered without warranties of any kind. To the extent the law allows, we are not liable for any loss arising from use of the game, including saved progress stored in your browser.',
      ],
    },
    {
      heading: 'Conduct',
      paragraphs: [
        'Do not attempt to disrupt hosting, scrape assets at abusive volume, or misrepresent the project.',
      ],
    },
    {
      heading: 'Privacy',
      paragraphs: [
        'What little data stays on your device is explained in our Privacy policy.',
      ],
      links: [{ text: 'Privacy policy', href: '/privacy' }],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'These terms may be updated as the project evolves. Continued play after an update constitutes acceptance of the revised terms.',
      ],
    },
  ],
};
