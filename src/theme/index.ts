/**
 * Design tokens that Tailwind classes cannot express — gradients, glows, and
 * the highlight palette. Every value is lifted verbatim from the prototype.
 *
 * Flat colours, spacing and typography live in tailwind.config.js instead;
 * this file is only for what has to be passed as a prop.
 */

export const colors = {
  screen: '#07090f',
  nav: '#060810',
  surface: '#0b1422',
  sheet: '#0c1726',
  inset: '#08111e',
  chip: '#0d1525',
  bubble: '#0d1828',
  mic: '#152638',

  lineHair: '#0a0f1c',
  lineRule: '#0e1828',
  lineEdge: '#162035',
  lineSheet: '#1e2c45',
  lineVerse: '#07101a',

  gold: '#c9a86c',
  goldDeep: '#a87c3a',
  violet: '#8b6fd0',
  violetDeep: '#6b4fb8',
  teal: '#4aab9e',
  tealDeep: '#2a8a80',
  rose: '#e07070',
  roseDeep: '#c05050',
  danger: '#b93328',

  ink: '#eeeae3',
  inkSecondary: '#d8dce8',
  inkTertiary: '#d0d4e4',
  inkBody: '#c0cad8',
  inkAlt: '#c8cedd',
  inkNote: '#b0bccc',
  cream: '#ede8df',
  blueSoft: '#a8c4e0',

  muted50: '#6a7a90',
  muted100: '#7a8a9e',
  muted200: '#4a5a72',
  muted300: '#3d4d68',
  muted400: '#2d3d56',
  muted500: '#2a3850',
  muted600: '#1e2d40',
} as const;

/** `[from, to]` pairs for expo-linear-gradient. */
export const gradients = {
  /** Verse-of-the-day card. 150° in CSS ≈ start/end below. */
  verseCard: ['#0d1a2e', '#080f1e', '#0a0d18'] as const,
  blessingCard: ['#130e06', '#0f0a04'] as const,
  insightBackground: ['#1a1000', '#100a00'] as const,
  insightScholar: ['#0d0820', '#080412'] as const,
  insightApplication: ['#001815', '#000f0c'] as const,
  keyVerse: ['#0c1828', '#080e1c'] as const,
  goldButton: ['#c9a86c', '#a87c3a'] as const,
  violetButton: ['#8b6fd0', '#6b4fb8'] as const,
  tealButton: ['#4aab9e', '#2a8a80'] as const,
  roseAvatar: ['#e07070', '#c05050'] as const,
  goldAvatar: ['#c9a86c', '#a87c3a'] as const,
  violetAvatar: ['#8b6fd0', '#6b4fb8'] as const,
  tealAvatar: ['#4aab9e', '#2a8a80'] as const,
  /** Profile avatar — gold into violet, as on the Today header and Me tab. */
  profileAvatar: ['#c9a86c', '#8b6fd0'] as const,
  sharedJournal: ['#080e20', '#060b18'] as const,
} as const;

/** 135° diagonal, matching the prototype's `linear-gradient(135deg, …)`. */
export const DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
/** 150° — used by the verse and blessing cards. */
export const STEEP = { start: { x: 0.25, y: 0 }, end: { x: 0.75, y: 1 } };

/**
 * Highlight colours. `display` is the swatch in the picker; `value` is the
 * translucent wash actually painted behind the verse text, and is what gets
 * persisted, so a highlight always renders exactly as it was chosen.
 */
export const HIGHLIGHT_COLORS = [
  { name: 'amber', display: '#ffc832', value: 'rgba(255,200,50,0.32)' },
  { name: 'sky', display: '#50b4ff', value: 'rgba(80,180,255,0.22)' },
  { name: 'mint', display: '#50c88c', value: 'rgba(80,200,140,0.22)' },
  { name: 'rose', display: '#ff648c', value: 'rgba(255,100,140,0.22)' },
  { name: 'iris', display: '#b478ff', value: 'rgba(180,120,255,0.22)' },
] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export function highlightDisplayColor(value: string): string {
  return HIGHLIGHT_COLORS.find((c) => c.value === value)?.display ?? '#ffc832';
}

/**
 * Avatar gradient chosen deterministically from a user id, so the same person
 * is always the same colour everywhere in the app without storing anything.
 */
const AVATAR_GRADIENTS = [
  gradients.goldAvatar,
  gradients.violetAvatar,
  gradients.tealAvatar,
  gradients.roseAvatar,
  gradients.profileAvatar,
] as const;

export function avatarGradient(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

/** Insight card styling, keyed by the kind stored in verse_insights. */
export const INSIGHT_STYLES = {
  background: {
    label: 'Background',
    gradient: gradients.insightBackground,
    accent: '#c9a86c',
    border: 'rgba(201,168,76,0.18)',
    body: '#b09060',
  },
  scholar: {
    label: 'A Scholar Weighs In',
    gradient: gradients.insightScholar,
    accent: '#8b6fd0',
    border: 'rgba(139,111,208,0.18)',
    body: '#8070a0',
  },
  application: {
    label: 'What It Means for You',
    gradient: gradients.insightApplication,
    accent: '#4aab9e',
    border: 'rgba(74,171,158,0.18)',
    body: '#407068',
  },
} as const;

export const shadows = {
  goldGlow: {
    shadowColor: '#c9a86c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  goldSoft: {
    shadowColor: '#c9a86c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  livePulse: {
    shadowColor: '#4aab9e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 7,
    elevation: 3,
  },
} as const;
