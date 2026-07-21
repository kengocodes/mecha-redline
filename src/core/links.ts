// Title-screen link row labels + external social URLs.
// Privacy / Terms open the in-app legal overlay (TitleScene → openLegal).

export type LinkId = 'privacy' | 'terms' | 'github' | 'x';

export interface SiteLink {
  id: LinkId;
  label: string;
}

export const SITE_LINKS: readonly SiteLink[] = [
  { id: 'privacy', label: 'PRIVACY' },
  { id: 'terms', label: 'TERMS' },
  { id: 'github', label: 'GITHUB' },
  { id: 'x', label: 'FOLLOW ON X' },
];

export const SOCIAL_LINKS = {
  github: 'https://github.com/mecha-redline/mecha-redline',
  x: 'https://x.com/mecha_redline',
} as const;
