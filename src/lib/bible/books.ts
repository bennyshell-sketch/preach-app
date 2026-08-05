/**
 * The canonical 66-book table.
 *
 * `id` is the USFM book code, which is also the shape API.Bible uses in its
 * verse identifiers. Keeping one code system across self-hosted versions
 * (KJV/YLT/Interlinear) and proxied ones (CJB/TPT) is what lets a single
 * `book.chapter.verse` reference address any version.
 */

export type Testament = 'OT' | 'NT';

export interface BookMeta {
  id: string;
  name: string;
  shortName: string;
  testament: Testament;
  ordinal: number;
  chapters: number;
  /** Subtitle under the chapter title in the Read header. */
  genre: string;
  /** Numeric id used by scrollmapper / bolls.life datasets. */
  legacyId: number;
  /** morphhb filename stem (OT only). */
  wlc?: string;
  /** morphgnt filename stem (NT only). */
  morphgnt?: string;
}

export const BOOKS: BookMeta[] = [
  { id: 'GEN', name: 'Genesis', shortName: 'Gen', testament: 'OT', ordinal: 1, chapters: 50, genre: 'Old Testament · Torah', legacyId: 1, wlc: 'Gen' },
  { id: 'EXO', name: 'Exodus', shortName: 'Exod', testament: 'OT', ordinal: 2, chapters: 40, genre: 'Old Testament · Torah', legacyId: 2, wlc: 'Exod' },
  { id: 'LEV', name: 'Leviticus', shortName: 'Lev', testament: 'OT', ordinal: 3, chapters: 27, genre: 'Old Testament · Torah', legacyId: 3, wlc: 'Lev' },
  { id: 'NUM', name: 'Numbers', shortName: 'Num', testament: 'OT', ordinal: 4, chapters: 36, genre: 'Old Testament · Torah', legacyId: 4, wlc: 'Num' },
  { id: 'DEU', name: 'Deuteronomy', shortName: 'Deut', testament: 'OT', ordinal: 5, chapters: 34, genre: 'Old Testament · Torah', legacyId: 5, wlc: 'Deut' },
  { id: 'JOS', name: 'Joshua', shortName: 'Josh', testament: 'OT', ordinal: 6, chapters: 24, genre: 'Old Testament · History', legacyId: 6, wlc: 'Josh' },
  { id: 'JDG', name: 'Judges', shortName: 'Judg', testament: 'OT', ordinal: 7, chapters: 21, genre: 'Old Testament · History', legacyId: 7, wlc: 'Judg' },
  { id: 'RUT', name: 'Ruth', shortName: 'Ruth', testament: 'OT', ordinal: 8, chapters: 4, genre: 'Old Testament · History', legacyId: 8, wlc: 'Ruth' },
  { id: '1SA', name: '1 Samuel', shortName: '1 Sam', testament: 'OT', ordinal: 9, chapters: 31, genre: 'Old Testament · History', legacyId: 9, wlc: '1Sam' },
  { id: '2SA', name: '2 Samuel', shortName: '2 Sam', testament: 'OT', ordinal: 10, chapters: 24, genre: 'Old Testament · History', legacyId: 10, wlc: '2Sam' },
  { id: '1KI', name: '1 Kings', shortName: '1 Kgs', testament: 'OT', ordinal: 11, chapters: 22, genre: 'Old Testament · History', legacyId: 11, wlc: '1Kgs' },
  { id: '2KI', name: '2 Kings', shortName: '2 Kgs', testament: 'OT', ordinal: 12, chapters: 25, genre: 'Old Testament · History', legacyId: 12, wlc: '2Kgs' },
  { id: '1CH', name: '1 Chronicles', shortName: '1 Chr', testament: 'OT', ordinal: 13, chapters: 29, genre: 'Old Testament · History', legacyId: 13, wlc: '1Chr' },
  { id: '2CH', name: '2 Chronicles', shortName: '2 Chr', testament: 'OT', ordinal: 14, chapters: 36, genre: 'Old Testament · History', legacyId: 14, wlc: '2Chr' },
  { id: 'EZR', name: 'Ezra', shortName: 'Ezra', testament: 'OT', ordinal: 15, chapters: 10, genre: 'Old Testament · History', legacyId: 15, wlc: 'Ezra' },
  { id: 'NEH', name: 'Nehemiah', shortName: 'Neh', testament: 'OT', ordinal: 16, chapters: 13, genre: 'Old Testament · History', legacyId: 16, wlc: 'Neh' },
  { id: 'EST', name: 'Esther', shortName: 'Esth', testament: 'OT', ordinal: 17, chapters: 10, genre: 'Old Testament · History', legacyId: 17, wlc: 'Esth' },
  { id: 'JOB', name: 'Job', shortName: 'Job', testament: 'OT', ordinal: 18, chapters: 42, genre: 'Old Testament · Wisdom', legacyId: 18, wlc: 'Job' },
  { id: 'PSA', name: 'Psalms', shortName: 'Ps', testament: 'OT', ordinal: 19, chapters: 150, genre: 'Old Testament · Wisdom', legacyId: 19, wlc: 'Ps' },
  { id: 'PRO', name: 'Proverbs', shortName: 'Prov', testament: 'OT', ordinal: 20, chapters: 31, genre: 'Old Testament · Wisdom', legacyId: 20, wlc: 'Prov' },
  { id: 'ECC', name: 'Ecclesiastes', shortName: 'Eccl', testament: 'OT', ordinal: 21, chapters: 12, genre: 'Old Testament · Wisdom', legacyId: 21, wlc: 'Eccl' },
  { id: 'SNG', name: 'Song of Solomon', shortName: 'Song', testament: 'OT', ordinal: 22, chapters: 8, genre: 'Old Testament · Wisdom', legacyId: 22, wlc: 'Song' },
  { id: 'ISA', name: 'Isaiah', shortName: 'Isa', testament: 'OT', ordinal: 23, chapters: 66, genre: 'Old Testament · Major Prophet', legacyId: 23, wlc: 'Isa' },
  { id: 'JER', name: 'Jeremiah', shortName: 'Jer', testament: 'OT', ordinal: 24, chapters: 52, genre: 'Old Testament · Major Prophet', legacyId: 24, wlc: 'Jer' },
  { id: 'LAM', name: 'Lamentations', shortName: 'Lam', testament: 'OT', ordinal: 25, chapters: 5, genre: 'Old Testament · Major Prophet', legacyId: 25, wlc: 'Lam' },
  { id: 'EZK', name: 'Ezekiel', shortName: 'Ezek', testament: 'OT', ordinal: 26, chapters: 48, genre: 'Old Testament · Major Prophet', legacyId: 26, wlc: 'Ezek' },
  { id: 'DAN', name: 'Daniel', shortName: 'Dan', testament: 'OT', ordinal: 27, chapters: 12, genre: 'Old Testament · Major Prophet', legacyId: 27, wlc: 'Dan' },
  { id: 'HOS', name: 'Hosea', shortName: 'Hos', testament: 'OT', ordinal: 28, chapters: 14, genre: 'Old Testament · Minor Prophet', legacyId: 28, wlc: 'Hos' },
  { id: 'JOL', name: 'Joel', shortName: 'Joel', testament: 'OT', ordinal: 29, chapters: 3, genre: 'Old Testament · Minor Prophet', legacyId: 29, wlc: 'Joel' },
  { id: 'AMO', name: 'Amos', shortName: 'Amos', testament: 'OT', ordinal: 30, chapters: 9, genre: 'Old Testament · Minor Prophet', legacyId: 30, wlc: 'Amos' },
  { id: 'OBA', name: 'Obadiah', shortName: 'Obad', testament: 'OT', ordinal: 31, chapters: 1, genre: 'Old Testament · Minor Prophet', legacyId: 31, wlc: 'Obad' },
  { id: 'JON', name: 'Jonah', shortName: 'Jonah', testament: 'OT', ordinal: 32, chapters: 4, genre: 'Old Testament · Minor Prophet', legacyId: 32, wlc: 'Jonah' },
  { id: 'MIC', name: 'Micah', shortName: 'Mic', testament: 'OT', ordinal: 33, chapters: 7, genre: 'Old Testament · Minor Prophet', legacyId: 33, wlc: 'Mic' },
  { id: 'NAM', name: 'Nahum', shortName: 'Nah', testament: 'OT', ordinal: 34, chapters: 3, genre: 'Old Testament · Minor Prophet', legacyId: 34, wlc: 'Nah' },
  { id: 'HAB', name: 'Habakkuk', shortName: 'Hab', testament: 'OT', ordinal: 35, chapters: 3, genre: 'Old Testament · Minor Prophet', legacyId: 35, wlc: 'Hab' },
  { id: 'ZEP', name: 'Zephaniah', shortName: 'Zeph', testament: 'OT', ordinal: 36, chapters: 3, genre: 'Old Testament · Minor Prophet', legacyId: 36, wlc: 'Zeph' },
  { id: 'HAG', name: 'Haggai', shortName: 'Hag', testament: 'OT', ordinal: 37, chapters: 2, genre: 'Old Testament · Minor Prophet', legacyId: 37, wlc: 'Hag' },
  { id: 'ZEC', name: 'Zechariah', shortName: 'Zech', testament: 'OT', ordinal: 38, chapters: 14, genre: 'Old Testament · Minor Prophet', legacyId: 38, wlc: 'Zech' },
  { id: 'MAL', name: 'Malachi', shortName: 'Mal', testament: 'OT', ordinal: 39, chapters: 4, genre: 'Old Testament · Minor Prophet', legacyId: 39, wlc: 'Mal' },

  { id: 'MAT', name: 'Matthew', shortName: 'Matt', testament: 'NT', ordinal: 40, chapters: 28, genre: 'New Testament · Gospel', legacyId: 40, morphgnt: '61-Mt' },
  { id: 'MRK', name: 'Mark', shortName: 'Mark', testament: 'NT', ordinal: 41, chapters: 16, genre: 'New Testament · Gospel', legacyId: 41, morphgnt: '62-Mk' },
  { id: 'LUK', name: 'Luke', shortName: 'Luke', testament: 'NT', ordinal: 42, chapters: 24, genre: 'New Testament · Gospel', legacyId: 42, morphgnt: '63-Lk' },
  { id: 'JHN', name: 'John', shortName: 'John', testament: 'NT', ordinal: 43, chapters: 21, genre: 'New Testament · Gospel', legacyId: 43, morphgnt: '64-Jn' },
  { id: 'ACT', name: 'Acts', shortName: 'Acts', testament: 'NT', ordinal: 44, chapters: 28, genre: 'New Testament · History', legacyId: 44, morphgnt: '65-Ac' },
  { id: 'ROM', name: 'Romans', shortName: 'Rom', testament: 'NT', ordinal: 45, chapters: 16, genre: 'New Testament · Pauline Epistle', legacyId: 45, morphgnt: '66-Ro' },
  { id: '1CO', name: '1 Corinthians', shortName: '1 Cor', testament: 'NT', ordinal: 46, chapters: 16, genre: 'New Testament · Pauline Epistle', legacyId: 46, morphgnt: '67-1Co' },
  { id: '2CO', name: '2 Corinthians', shortName: '2 Cor', testament: 'NT', ordinal: 47, chapters: 13, genre: 'New Testament · Pauline Epistle', legacyId: 47, morphgnt: '68-2Co' },
  { id: 'GAL', name: 'Galatians', shortName: 'Gal', testament: 'NT', ordinal: 48, chapters: 6, genre: 'New Testament · Pauline Epistle', legacyId: 48, morphgnt: '69-Ga' },
  { id: 'EPH', name: 'Ephesians', shortName: 'Eph', testament: 'NT', ordinal: 49, chapters: 6, genre: 'New Testament · Pauline Epistle', legacyId: 49, morphgnt: '70-Eph' },
  { id: 'PHP', name: 'Philippians', shortName: 'Phil', testament: 'NT', ordinal: 50, chapters: 4, genre: 'New Testament · Pauline Epistle', legacyId: 50, morphgnt: '71-Php' },
  { id: 'COL', name: 'Colossians', shortName: 'Col', testament: 'NT', ordinal: 51, chapters: 4, genre: 'New Testament · Pauline Epistle', legacyId: 51, morphgnt: '72-Col' },
  { id: '1TH', name: '1 Thessalonians', shortName: '1 Thess', testament: 'NT', ordinal: 52, chapters: 5, genre: 'New Testament · Pauline Epistle', legacyId: 52, morphgnt: '73-1Th' },
  { id: '2TH', name: '2 Thessalonians', shortName: '2 Thess', testament: 'NT', ordinal: 53, chapters: 3, genre: 'New Testament · Pauline Epistle', legacyId: 53, morphgnt: '74-2Th' },
  { id: '1TI', name: '1 Timothy', shortName: '1 Tim', testament: 'NT', ordinal: 54, chapters: 6, genre: 'New Testament · Pastoral Epistle', legacyId: 54, morphgnt: '75-1Ti' },
  { id: '2TI', name: '2 Timothy', shortName: '2 Tim', testament: 'NT', ordinal: 55, chapters: 4, genre: 'New Testament · Pastoral Epistle', legacyId: 55, morphgnt: '76-2Ti' },
  { id: 'TIT', name: 'Titus', shortName: 'Titus', testament: 'NT', ordinal: 56, chapters: 3, genre: 'New Testament · Pastoral Epistle', legacyId: 56, morphgnt: '77-Tit' },
  { id: 'PHM', name: 'Philemon', shortName: 'Phlm', testament: 'NT', ordinal: 57, chapters: 1, genre: 'New Testament · Pauline Epistle', legacyId: 57, morphgnt: '78-Phm' },
  { id: 'HEB', name: 'Hebrews', shortName: 'Heb', testament: 'NT', ordinal: 58, chapters: 13, genre: 'New Testament · General Epistle', legacyId: 58, morphgnt: '79-Heb' },
  { id: 'JAS', name: 'James', shortName: 'Jas', testament: 'NT', ordinal: 59, chapters: 5, genre: 'New Testament · General Epistle', legacyId: 59, morphgnt: '80-Jas' },
  { id: '1PE', name: '1 Peter', shortName: '1 Pet', testament: 'NT', ordinal: 60, chapters: 5, genre: 'New Testament · General Epistle', legacyId: 60, morphgnt: '81-1Pe' },
  { id: '2PE', name: '2 Peter', shortName: '2 Pet', testament: 'NT', ordinal: 61, chapters: 3, genre: 'New Testament · General Epistle', legacyId: 61, morphgnt: '82-2Pe' },
  { id: '1JN', name: '1 John', shortName: '1 John', testament: 'NT', ordinal: 62, chapters: 5, genre: 'New Testament · General Epistle', legacyId: 62, morphgnt: '83-1Jn' },
  { id: '2JN', name: '2 John', shortName: '2 John', testament: 'NT', ordinal: 63, chapters: 1, genre: 'New Testament · General Epistle', legacyId: 63, morphgnt: '84-2Jn' },
  { id: '3JN', name: '3 John', shortName: '3 John', testament: 'NT', ordinal: 64, chapters: 1, genre: 'New Testament · General Epistle', legacyId: 64, morphgnt: '85-3Jn' },
  { id: 'JUD', name: 'Jude', shortName: 'Jude', testament: 'NT', ordinal: 65, chapters: 1, genre: 'New Testament · General Epistle', legacyId: 65, morphgnt: '86-Jud' },
  { id: 'REV', name: 'Revelation', shortName: 'Rev', testament: 'NT', ordinal: 66, chapters: 22, genre: 'New Testament · Apocalyptic', legacyId: 66, morphgnt: '87-Re' },
];

export const BOOKS_BY_ID: Record<string, BookMeta> = Object.fromEntries(
  BOOKS.map((b) => [b.id, b]),
);

const BY_NAME: Record<string, BookMeta> = Object.fromEntries(
  BOOKS.flatMap((b) => [
    [b.name.toLowerCase(), b],
    [b.shortName.toLowerCase(), b],
    [b.id.toLowerCase(), b],
  ]),
);

/** Extra spellings seen in third-party datasets and in user-typed references. */
const NAME_ALIASES: Record<string, string> = {
  psalm: 'PSA',
  psalms: 'PSA',
  'song of songs': 'SNG',
  canticles: 'SNG',
  ecclesiastes: 'ECC',
  revelations: 'REV',
  'the revelation': 'REV',
  'revelation of john': 'REV',
  'the revelation of john': 'REV',
  'acts of the apostles': 'ACT',
  'the acts': 'ACT',
  'the acts of the apostles': 'ACT',
  'i samuel': '1SA',
  'ii samuel': '2SA',
  'i kings': '1KI',
  'ii kings': '2KI',
  'i chronicles': '1CH',
  'ii chronicles': '2CH',
  'i corinthians': '1CO',
  'ii corinthians': '2CO',
  'i thessalonians': '1TH',
  'ii thessalonians': '2TH',
  'i timothy': '1TI',
  'ii timothy': '2TI',
  'i peter': '1PE',
  'ii peter': '2PE',
  'i john': '1JN',
  'ii john': '2JN',
  'iii john': '3JN',
};

export function bookFromName(name: string): BookMeta | undefined {
  const key = name.trim().toLowerCase().replace(/\.$/, '');
  const alias = NAME_ALIASES[key];
  if (alias) return BOOKS_BY_ID[alias];
  return BY_NAME[key];
}

// ─── Reference parsing / formatting ────────────────────────────────────────

export interface VerseRef {
  book: string;
  chapter: number;
  verse: number;
}

/** `2CO.3.17` → `{ book: '2CO', chapter: 3, verse: 17 }` */
export function parseRef(ref: string): VerseRef | null {
  const parts = ref.split('.');
  if (parts.length !== 3) return null;
  const [book, c, v] = parts;
  const chapter = Number(c);
  const verse = Number(v);
  if (!BOOKS_BY_ID[book] || !Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return null;
  }
  return { book, chapter, verse };
}

export function makeRef(book: string, chapter: number, verse: number): string {
  return `${book}.${chapter}.${verse}`;
}

/** `2CO.3.17` → `2 Cor 3:17` */
export function formatRef(ref: string, style: 'short' | 'long' = 'short'): string {
  const parsed = parseRef(ref);
  if (!parsed) return ref;
  const meta = BOOKS_BY_ID[parsed.book];
  const name = style === 'long' ? meta.name : meta.shortName;
  return `${name} ${parsed.chapter}:${parsed.verse}`;
}

/** `2 Corinthians 3:17` (and many looser spellings) → `2CO.3.17` */
export function refFromHuman(input: string): string | null {
  const m = input
    .trim()
    .match(/^((?:[123]\s*)?[A-Za-z][A-Za-z\s.]*?)\s*(\d+)\s*[:.\s]\s*(\d+)/);
  if (!m) return null;
  const book = bookFromName(m[1].replace(/\s+/g, ' ').trim());
  if (!book) return null;
  return makeRef(book.id, Number(m[2]), Number(m[3]));
}
