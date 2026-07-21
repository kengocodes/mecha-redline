/** Structured legal copy — one renderer keeps typography consistent. */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  after?: string[];
  /** Substrings to turn into links; first match per paragraph/bullet. */
  links?: Array<{ text: string; href: string }>;
}

export interface LegalDocument {
  metaTitle: string;
  title: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

export type LegalPageId = "privacy" | "terms";
