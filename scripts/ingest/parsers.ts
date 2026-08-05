/**
 * Parsers for each upstream corpus format. Pure functions with no I/O, so the
 * ingest scripts and the seed generator share exactly the same interpretation
 * of the source data.
 */
import { BOOKS, bookFromName, type BookMeta } from '../../src/lib/bible/books';

export interface ParsedVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface ParsedWord {
  book: string;
  chapter: number;
  verse: number;
  position: number;
  language: 'hebrew' | 'greek' | 'aramaic';
  surface: string;
  transliteration: string | null;
  gloss: string | null;
  strongsId: string | null;
  morphology: string | null;
  lemma: string | null;
}

// ─── scrollmapper JSON (KJV, YLT) ──────────────────────────────────────────

interface ScrollmapperBible {
  translation: string;
  books: {
    name: string;
    chapters: { chapter: number; verses: { verse: number; text: string }[] }[];
  }[];
}

export function parseScrollmapper(raw: string): ParsedVerse[] {
  const data = JSON.parse(raw) as ScrollmapperBible;
  const out: ParsedVerse[] = [];

  for (const book of data.books) {
    const meta = bookFromName(book.name);
    if (!meta) {
      throw new Error(`unrecognised book name in source: "${book.name}"`);
    }
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        const text = normaliseWhitespace(verse.text);
        if (!text) continue;
        out.push({
          book: meta.id,
          chapter: Number(chapter.chapter),
          verse: Number(verse.verse),
          text,
        });
      }
    }
  }
  return out;
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// ─── MorphGNT (Greek NT) ───────────────────────────────────────────────────
//
// Whitespace-separated columns, one word per line:
//   bcv  pos  parse  text  word  normalized  lemma
// e.g. 640101 N- ----NSF- Βίβλος Βίβλος βίβλος βίβλος
//
// `bcv` is book(2) chapter(2) verse(2), where the book number is MorphGNT's
// own 1-based NT index (01 = Matthew).

export function parseMorphGnt(raw: string, book: BookMeta): ParsedWord[] {
  const out: ParsedWord[] = [];
  let currentRef = '';
  let position = 0;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cols = trimmed.split(/\s+/);
    if (cols.length < 7) continue;

    const [bcv, pos, parse, text, , normalized, lemma] = cols;
    const chapter = Number(bcv.slice(2, 4));
    const verse = Number(bcv.slice(4, 6));
    const ref = `${chapter}:${verse}`;

    if (ref !== currentRef) {
      currentRef = ref;
      position = 0;
    }
    position += 1;

    out.push({
      book: book.id,
      chapter,
      verse,
      position,
      language: 'greek',
      // `text` keeps the punctuation as it appears in the running text, which
      // is what the reader should render — minus SBL's editorial sigla, which
      // mark textual variants for scholars and are noise in a reading app.
      surface: stripSigla(text),
      transliteration: transliterateGreek(normalized),
      gloss: null, // filled in from the Strong's lexicon at load time
      // MorphGNT does not carry Strong's numbers; the lemma is matched against
      // the Strong's dictionary in ingest-interlinear.ts.
      strongsId: null,
      morphology: `${pos}${parse}`.replace(/-+$/, ''),
      lemma,
    });
  }
  return out;
}

/**
 * Remove SBLGNT's apparatus markers (⸀ ⸂ ⸃ ⟦ ⟧ …). They flag where the
 * editors chose between manuscript readings; a reader tapping a word should
 * see the word, not the footnote symbol glued to it.
 */
function stripSigla(text: string): string {
  return text.replace(/[⸀-⹿⟦⟧〈-】]/g, '').trim();
}

/**
 * Normalise a Greek lemma for matching against the Strong's dictionary.
 *
 * `strict` keeps the accents. That matters more than it looks: οὗ ("where",
 * G3757) and οὐ ("not", G3756) are distinguished *only* by their diacritics,
 * so an accent-blind match silently turns "and where the Spirit of the Lord
 * is" into "and not the Spirit of the Lord is". Callers should try the strict
 * form first and only fall back to the loose one.
 */
export function normaliseGreekLemma(word: string, strict: boolean): string {
  const base = word.normalize('NFC').toLowerCase().trim();
  if (strict) return base.replace(/ς$/, 'σ');
  return base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ς/g, 'σ')
    .trim();
}

// ─── OpenScriptures morphhb / WLC (Hebrew OT) ──────────────────────────────
//
// OSIS XML. Words are <w> elements whose `lemma` attribute holds the Strong's
// number (sometimes prefixed with a conjunction code and a slash, e.g.
// "c/7225") and whose `morph` attribute holds the WLC morphology code.

export function parseWlc(raw: string, book: BookMeta): ParsedWord[] {
  const out: ParsedWord[] = [];

  // <chapter osisID="Gen.1"> … <verse osisID="Gen.1.1"> … </verse> …
  const verseBlocks = raw.matchAll(
    /<verse\s+osisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/g,
  );

  for (const [, osisId, body] of verseBlocks) {
    const parts = osisId.split('.');
    if (parts.length !== 3) continue;
    const chapter = Number(parts[1]);
    const verse = Number(parts[2]);

    let position = 0;
    for (const [, attrs, inner] of body.matchAll(/<w\s+([^>]*?)>([\s\S]*?)<\/w>/g)) {
      const lemmaAttr = attr(attrs, 'lemma');
      const morph = attr(attrs, 'morph');
      // Strip the maqqef-joined segmentation markers morphhb uses inside <w>.
      const surface = inner.replace(/<[^>]+>/g, '').replace(/\//g, '').trim();
      if (!surface) continue;

      position += 1;
      out.push({
        book: book.id,
        chapter,
        verse,
        position,
        // Aramaic sections (Dan 2–7, Ezra 4–7) are tagged in the morph code
        // with a leading "A" rather than "H".
        language: morph?.startsWith('A') ? 'aramaic' : 'hebrew',
        surface,
        transliteration: transliterateHebrew(surface),
        gloss: null,
        strongsId: normaliseHebrewStrongs(lemmaAttr),
        morphology: morph ?? null,
        lemma: null,
      });
    }
  }
  return out;
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/**
 * morphhb lemmas look like `7225`, `b/7225`, `9001` or `1254 a`. Keep the
 * numeric Strong's portion, drop prefix particles (codes ≥ 9000 are WLC's own
 * grammatical markers with no Strong's entry) and the homonym letter.
 */
function normaliseHebrewStrongs(lemma: string | null): string | null {
  if (!lemma) return null;
  const segments = lemma.split('/');
  for (const segment of segments) {
    const m = segment.match(/(\d+)/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 9000) continue; // WLC particle marker, not a Strong's number
    return `H${String(n).padStart(4, '0')}`;
  }
  return null;
}

// ─── Strong's dictionaries ─────────────────────────────────────────────────
//
// OpenScriptures ships them as a JS file assigning one big object literal.
// Extract the object and parse it as JSON.

export interface StrongsEntry {
  id: string;
  language: 'hebrew' | 'greek';
  lemma: string;
  transliteration: string | null;
  pronunciation: string | null;
  definition: string | null;
  kjvUsage: string | null;
}

export function parseStrongs(
  raw: string,
  language: 'hebrew' | 'greek',
): StrongsEntry[] {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`could not locate the object literal in the ${language} dictionary`);
  }

  const dict = JSON.parse(raw.slice(start, end + 1)) as Record<
    string,
    {
      lemma?: string;
      xlit?: string;
      translit?: string;
      pron?: string;
      strongs_def?: string;
      kjv_def?: string;
      derivation?: string;
    }
  >;

  return Object.entries(dict).map(([id, e]) => ({
    id: normaliseStrongsId(id, language),
    language,
    lemma: e.lemma ?? '',
    transliteration: e.xlit ?? e.translit ?? null,
    pronunciation: e.pron ?? null,
    definition: [e.strongs_def, e.derivation].filter(Boolean).join(' ').trim() || null,
    kjvUsage: e.kjv_def ?? null,
  }));
}

/** `G2962` / `g2962` / `2962` → `G2962`, zero-padded to 4 digits. */
export function normaliseStrongsId(
  id: string,
  language: 'hebrew' | 'greek',
): string {
  const prefix = language === 'greek' ? 'G' : 'H';
  const digits = id.replace(/[^0-9]/g, '');
  return `${prefix}${digits.padStart(4, '0')}`;
}

// ─── Transliteration ───────────────────────────────────────────────────────
//
// Reader-facing approximations, not a scholarly romanisation standard. They
// exist so someone who cannot read the script can still say the word out loud,
// which is exactly what the interlinear popover is for.

const GREEK_LETTERS: Record<string, string> = {
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'ē', θ: 'th',
  ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p',
  ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'ph', χ: 'ch', ψ: 'ps',
  ω: 'ō',
};

/**
 * Digraphs, applied before single letters. Without these, υ inside a diphthong
 * comes out as "y" and πνεῦμα reads "pneyma" instead of "pneuma"; and the
 * nasal gamma (γγ → "ng") is lost entirely.
 */
const GREEK_DIGRAPHS: Record<string, string> = {
  αυ: 'au', ευ: 'eu', ου: 'ou', ηυ: 'ēu', ωυ: 'ōu',
  γγ: 'ng', γκ: 'nk', γχ: 'nch', γξ: 'nx',
};

const ROUGH_BREATHING = '̔';

export function transliterateGreek(word: string): string {
  const decomposed = word.normalize('NFD');
  const rough = decomposed.includes(ROUGH_BREATHING);

  // Drop combining marks (accents, breathings, iota subscript) and anything
  // that is not a Greek letter — punctuation should not be transliterated.
  const base = decomposed
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^α-ω]/g, '');

  if (!base) return '';

  let out = '';
  for (let i = 0; i < base.length; i += 1) {
    const pair = base.slice(i, i + 2);
    if (GREEK_DIGRAPHS[pair]) {
      out += GREEK_DIGRAPHS[pair];
      i += 1;
      continue;
    }
    out += GREEK_LETTERS[base[i]] ?? '';
  }

  if (rough) {
    // Rough breathing on an initial rho is written "rh"; on a vowel it prefixes
    // an "h" to the whole word.
    out = base[0] === 'ρ' ? `rh${out.slice(1)}` : `h${out}`;
  }
  return out;
}

// ─── Hebrew ────────────────────────────────────────────────────────────────
// The WLC is fully pointed, so the vowels are available and a consonants-only
// romanisation would be throwing away the half a reader most needs in order to
// pronounce the word.

const HEBREW_CONSONANTS: Record<string, string> = {
  א: 'ʾ', ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'ch', ט: 't',
  י: 'y', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', ע: 'ʿ',
  ץ: 'ts', צ: 'ts', ק: 'q', ר: 'r', ת: 't', ף: 'f', ך: 'kh',
};

/** Letters whose sound depends on whether they carry a dagesh. */
const BEGADKEFAT: Record<string, [hard: string, soft: string]> = {
  ב: ['b', 'v'],
  כ: ['k', 'kh'],
  פ: ['p', 'f'],
};

const HEBREW_VOWELS: Record<string, string> = {
  'ְ': 'ĕ', // sheva
  'ֱ': 'e', // hataf segol
  'ֲ': 'a', // hataf patach
  'ֳ': 'o', // hataf qamats
  'ִ': 'i', // hiriq
  'ֵ': 'e', // tsere
  'ֶ': 'e', // segol
  'ַ': 'a', // patach
  'ָ': 'a', // qamats
  'ֹ': 'o', // holam
  'ֺ': 'o', // holam haser
  'ֻ': 'u', // qubuts
};

const DAGESH = 'ּ';
const SHIN_DOT = 'ׁ';
const SIN_DOT = 'ׂ';

const SHEVA = 'ְ';
const HOLAM = 'ֹ';
const HIRIQ = 'ִ';

interface HebrewCluster {
  letter: string;
  marks: string[];
}

/**
 * Group a pointed Hebrew word into consonant clusters, each carrying whatever
 * marks attach to it.
 *
 * This grouping is not cosmetic. NFD orders combining marks by canonical
 * combining class, and the dagesh (ccc 21) sorts *after* the vowel points
 * (ccc 10-18) — so in the sequence bet+sheva+dagesh a naive "is the next
 * character a dagesh?" test always answers no, and every begadkefat letter
 * comes out soft. Reading the whole cluster is what makes בְּרֵאשִׁית
 * transliterate as "bereshit" rather than "vĕreʾshiyt".
 */
function hebrewClusters(word: string): HebrewCluster[] {
  // Drop cantillation marks (te'amim) and the meteg: they govern chanting and
  // stress, not pronunciation.
  const chars = [...word.normalize('NFD').replace(/[֑-ֽֿ֯]/g, '')];
  const clusters: HebrewCluster[] = [];

  for (const ch of chars) {
    if (/[֑-ׇ]/.test(ch) && clusters.length) {
      clusters[clusters.length - 1].marks.push(ch);
    } else {
      clusters.push({ letter: ch, marks: [] });
    }
  }
  return clusters;
}

export function transliterateHebrew(word: string): string {
  const clusters = hebrewClusters(word);
  let out = '';
  let seenVowel = false;

  for (let i = 0; i < clusters.length; i += 1) {
    const { letter, marks } = clusters[i];
    const hasDagesh = marks.includes(DAGESH);
    const vowels = marks.filter((m) => HEBREW_VOWELS[m] && m !== SHEVA);

    // ── consonant ─────────────────────────────────────────────────────────
    if (letter === 'א') {
      // Aleph is a glottal stop with no English equivalent. Marking it makes
      // the word harder to say aloud, not easier, so it is dropped — which is
      // also what every popular romanisation does ("Elohim", not "ʾElohim").
    } else if (letter === 'ש') {
      out += marks.includes(SIN_DOT) ? 's' : 'sh';
    } else if (BEGADKEFAT[letter]) {
      const [hard, soft] = BEGADKEFAT[letter];
      out += hasDagesh ? hard : soft;
    } else if (letter === 'ו') {
      // Vav is a vowel letter when it carries a shuruq dot or a holam, and a
      // consonant otherwise.
      if (hasDagesh && !vowels.length) {
        out += 'u';
        seenVowel = true;
        continue;
      }
      if (marks.includes(HOLAM)) {
        out += 'o';
        seenVowel = true;
        continue;
      }
      out += 'v';
    } else if (letter === 'י' && !marks.length && out.endsWith('i')) {
      // Mater lectionis: an unpointed yod after a hiriq only lengthens it.
      continue;
    } else if (HEBREW_CONSONANTS[letter]) {
      out += HEBREW_CONSONANTS[letter];
    } else if (letter === '־') {
      out += '-'; // maqqef, the Hebrew hyphen
      continue;
    } else {
      continue;
    }

    // ── vowel ─────────────────────────────────────────────────────────────
    for (const mark of marks) {
      if (mark === SHEVA) {
        // Sheva is mobile (pronounced) when it opens a syllable and silent
        // when it closes one. Approximated by position: the first vowel in a
        // word is mobile, later shevas are treated as silent. This is the
        // usual reading-aid convention, not a full syllabification.
        if (!seenVowel) {
          out += 'e';
          seenVowel = true;
        }
        continue;
      }
      const sound = HEBREW_VOWELS[mark];
      if (!sound || mark === SHEVA) continue;
      out += sound;
      seenVowel = true;
    }
  }

  return out;
}

// ─── Cross references ──────────────────────────────────────────────────────
//
// OpenBible.info TSV: `From Verse\tTo Verse\tVotes`, references in OSIS-ish
// form such as `Gen.1.1` or a range `Exod.34.33-Exod.34.35`.

export interface ParsedCrossRef {
  fromRef: string;
  toRef: string;
  toRefEnd: string | null;
  votes: number;
}

const OSIS_TO_USFM: Record<string, string> = Object.fromEntries(
  BOOKS.flatMap((b) => {
    const osis = b.wlc ?? b.morphgnt?.replace(/^\d+-/, '') ?? b.id;
    return [
      [osis, b.id],
      [b.id, b.id],
    ];
  }),
);

export function parseCrossRefs(raw: string): ParsedCrossRef[] {
  const out: ParsedCrossRef[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('From Verse')) continue;

    const [from, to, votesRaw] = trimmed.split('\t');
    if (!from || !to) continue;

    const fromRef = osisToUsfm(from);
    if (!fromRef) continue;

    // A range is "Exod.34.33-Exod.34.35"; keep the start and the end.
    const [toStart, toEnd] = to.split('-');
    const toRef = osisToUsfm(toStart);
    if (!toRef) continue;

    out.push({
      fromRef,
      toRef,
      toRefEnd: toEnd ? osisToUsfm(toEnd) : null,
      votes: Number(votesRaw ?? 0) || 0,
    });
  }
  return out;
}

function osisToUsfm(ref: string): string | null {
  const parts = ref.trim().split('.');
  if (parts.length < 3) return null;
  const book = OSIS_TO_USFM[parts[0]];
  if (!book) return null;
  return `${book}.${Number(parts[1])}.${Number(parts[2])}`;
}
