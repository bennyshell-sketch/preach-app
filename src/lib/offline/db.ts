/**
 * On-device cache, so a chapter you have already opened stays readable on a
 * plane, in a basement, or on a dead signal.
 *
 * Two things live here:
 *   1. Scripture the user has loaded — chapter text, interlinear words, cross
 *      references. Immutable once written; scripture does not change.
 *   2. An outbox of mutations made while offline (highlights, notes, journal
 *      edits), replayed in order when connectivity returns.
 */
import * as SQLite from 'expo-sqlite';

import type { ChapterVerse, ChapterWord, CrossRefRow } from '../../types/database';

const DB_NAME = 'preach.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      // WAL keeps reads from blocking the outbox flush.
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    create table if not exists cached_chapters (
      key         text primary key,   -- <version>:<book>:<chapter>
      version     text not null,
      book        text not null,
      chapter     integer not null,
      payload     text not null,      -- JSON ChapterVerse[]
      cached_at   integer not null
    );

    create table if not exists cached_words (
      key        text primary key,    -- <book>:<chapter>
      payload    text not null,       -- JSON ChapterWord[]
      cached_at  integer not null
    );

    create table if not exists cached_cross_refs (
      ref        text primary key,
      payload    text not null,       -- JSON CrossRefRow[]
      cached_at  integer not null
    );

    create table if not exists outbox (
      id          integer primary key autoincrement,
      kind        text not null,
      payload     text not null,
      created_at  integer not null,
      attempts    integer not null default 0,
      last_error  text
    );

    create index if not exists cached_chapters_recent
      on cached_chapters (cached_at desc);
  `);
}

// ─── Scripture cache ────────────────────────────────────────────────────────

const chapterKey = (version: string, book: string, chapter: number) =>
  `${version}:${book}:${chapter}`;

export async function cacheChapter(
  version: string,
  book: string,
  chapter: number,
  verses: ChapterVerse[],
): Promise<void> {
  const db = await open();
  await db.runAsync(
    `insert into cached_chapters (key, version, book, chapter, payload, cached_at)
     values (?, ?, ?, ?, ?, ?)
     on conflict(key) do update set payload = excluded.payload, cached_at = excluded.cached_at`,
    chapterKey(version, book, chapter),
    version,
    book,
    chapter,
    JSON.stringify(verses),
    Date.now(),
  );
}

export async function readCachedChapter(
  version: string,
  book: string,
  chapter: number,
): Promise<ChapterVerse[] | null> {
  const db = await open();
  const row = await db.getFirstAsync<{ payload: string }>(
    'select payload from cached_chapters where key = ?',
    chapterKey(version, book, chapter),
  );
  return row ? (JSON.parse(row.payload) as ChapterVerse[]) : null;
}

export async function cacheWords(
  book: string,
  chapter: number,
  words: ChapterWord[],
): Promise<void> {
  const db = await open();
  await db.runAsync(
    `insert into cached_words (key, payload, cached_at) values (?, ?, ?)
     on conflict(key) do update set payload = excluded.payload, cached_at = excluded.cached_at`,
    `${book}:${chapter}`,
    JSON.stringify(words),
    Date.now(),
  );
}

export async function readCachedWords(
  book: string,
  chapter: number,
): Promise<ChapterWord[] | null> {
  const db = await open();
  const row = await db.getFirstAsync<{ payload: string }>(
    'select payload from cached_words where key = ?',
    `${book}:${chapter}`,
  );
  return row ? (JSON.parse(row.payload) as ChapterWord[]) : null;
}

export async function cacheCrossRefs(ref: string, rows: CrossRefRow[]): Promise<void> {
  const db = await open();
  await db.runAsync(
    `insert into cached_cross_refs (ref, payload, cached_at) values (?, ?, ?)
     on conflict(ref) do update set payload = excluded.payload, cached_at = excluded.cached_at`,
    ref,
    JSON.stringify(rows),
    Date.now(),
  );
}

export async function readCachedCrossRefs(ref: string): Promise<CrossRefRow[] | null> {
  const db = await open();
  const row = await db.getFirstAsync<{ payload: string }>(
    'select payload from cached_cross_refs where ref = ?',
    ref,
  );
  return row ? (JSON.parse(row.payload) as CrossRefRow[]) : null;
}

export interface CachedChapterSummary {
  version: string;
  book: string;
  chapter: number;
  cachedAt: number;
}

export async function listCachedChapters(): Promise<CachedChapterSummary[]> {
  const db = await open();
  const rows = await db.getAllAsync<{
    version: string;
    book: string;
    chapter: number;
    cached_at: number;
  }>('select version, book, chapter, cached_at from cached_chapters order by cached_at desc');

  return rows.map((r) => ({
    version: r.version,
    book: r.book,
    chapter: r.chapter,
    cachedAt: r.cached_at,
  }));
}

export async function clearScriptureCache(): Promise<void> {
  const db = await open();
  await db.execAsync(
    'delete from cached_chapters; delete from cached_words; delete from cached_cross_refs;',
  );
}

// ─── Outbox ─────────────────────────────────────────────────────────────────

export type OutboxKind =
  | 'highlight.upsert'
  | 'highlight.delete'
  | 'journal.entry.upsert'
  | 'journal.task.upsert'
  | 'journal.task.toggle'
  | 'room.note.create'
  | 'message.send'
  | 'profile.update';

export interface OutboxItem {
  id: number;
  kind: OutboxKind;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

export async function enqueue(kind: OutboxKind, payload: unknown): Promise<number> {
  const db = await open();
  const result = await db.runAsync(
    'insert into outbox (kind, payload, created_at) values (?, ?, ?)',
    kind,
    JSON.stringify(payload),
    Date.now(),
  );
  return result.lastInsertRowId;
}

export async function pending(): Promise<OutboxItem[]> {
  const db = await open();
  const rows = await db.getAllAsync<{
    id: number;
    kind: string;
    payload: string;
    created_at: number;
    attempts: number;
    last_error: string | null;
  }>('select * from outbox order by id asc');

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as OutboxKind,
    payload: JSON.parse(r.payload),
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
  }));
}

export async function resolve(id: number): Promise<void> {
  const db = await open();
  await db.runAsync('delete from outbox where id = ?', id);
}

export async function recordFailure(id: number, error: string): Promise<void> {
  const db = await open();
  await db.runAsync(
    'update outbox set attempts = attempts + 1, last_error = ? where id = ?',
    error,
    id,
  );
}

export async function pendingCount(): Promise<number> {
  const db = await open();
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from outbox');
  return row?.n ?? 0;
}
