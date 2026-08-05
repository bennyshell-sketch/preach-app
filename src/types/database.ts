/**
 * Database types.
 *
 * Kept in step with supabase/migrations/*.sql. Regenerate against a live
 * project with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * and re-add the RPC argument types if the generator drops any.
 */

export type Testament = 'OT' | 'NT';
export type VersionSource = 'local' | 'api_bible';
export type OriginalLanguage = 'hebrew' | 'greek' | 'aramaic';
export type InsightKind = 'background' | 'scholar' | 'application';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type JournalKind = 'personal' | 'shared';
export type RoomRole = 'owner' | 'moderator' | 'member';

export type Profile = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  denomination: string | null;
  notes_public: boolean;
  discoverable: boolean;
  show_online: boolean;
  streak_days: number;
  last_active_on: string | null;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
}

export type Book = {
  id: string;
  name: string;
  short_name: string;
  testament: Testament;
  ordinal: number;
  chapter_count: number;
  genre: string | null;
}

export type BibleVersion = {
  code: string;
  name: string;
  abbreviation: string;
  language: string;
  source: VersionSource;
  api_bible_id: string | null;
  is_interlinear: boolean;
  licence_gated: boolean;
  copyright: string | null;
  sort_order: number;
  created_at: string;
}

export type Verse = {
  version_code: string;
  book_id: string;
  chapter: number;
  verse: number;
  text: string;
  ref: string;
}

export type StrongsLemma = {
  id: string;
  language: OriginalLanguage;
  lemma: string;
  transliteration: string | null;
  pronunciation: string | null;
  definition: string | null;
  kjv_usage: string | null;
  plain_note: string | null;
}

export type Word = {
  id: number;
  book_id: string;
  chapter: number;
  verse: number;
  position: number;
  ref: string;
  language: OriginalLanguage;
  surface: string;
  transliteration: string | null;
  gloss: string | null;
  strongs_id: string | null;
  morphology: string | null;
  lemma: string | null;
  plain_note: string | null;
}

export type Highlight = {
  id: string;
  user_id: string;
  verse_ref: string;
  book_id: string;
  chapter: number;
  color: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type Journal = {
  id: string;
  kind: JournalKind;
  title: string;
  created_by: string;
  created_at: string;
}

export type JournalEntry = {
  id: string;
  journal_id: string;
  author_id: string;
  title: string;
  body: string;
  linked_verses: string[];
  study_plan: string | null;
  created_at: string;
  updated_at: string;
}

export type JournalTask = {
  id: string;
  entry_id: string;
  user_id: string;
  label: string;
  done: boolean;
  due_at: string | null;
  remind_at: string | null;
  local_notification_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type Friendship = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendshipStatus;
  favourite_ref: string | null;
  created_at: string;
  updated_at: string;
}

export type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  conversation_key: string;
  body: string | null;
  voice_note_url: string | null;
  voice_note_ms: number | null;
  shared_verse_ref: string | null;
  read_at: string | null;
  created_at: string;
}

export type StudyRoom = {
  id: string;
  name: string;
  description: string | null;
  verse_ref: string | null;
  verse_ref_end: string | null;
  is_anonymous: boolean;
  is_private: boolean;
  created_by: string;
  daily_room: string | null;
  call_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export type StudyRoomMember = {
  room_id: string;
  user_id: string;
  role: RoomRole;
  joined_at: string;
}

export type StudyRoomNote = {
  id: string;
  room_id: string;
  user_id: string;
  is_shared: boolean;
  body: string;
  verse_ref: string | null;
  created_at: string;
  updated_at: string;
}

export type HealingCircle = {
  id: string;
  topic: string;
  description: string | null;
  icon: string;
  accent: string;
  is_anonymous: boolean;
  created_at: string;
}

export type CircleMember = {
  circle_id: string;
  user_id: string;
  anon_alias: string;
  avatar_seed: string;
  joined_at: string;
  last_seen_at: string;
}

export type CircleMessage = {
  id: string;
  circle_id: string;
  anon_alias: string;
  avatar_seed: string;
  body: string | null;
  shared_verse_ref: string | null;
  created_at: string;
}

// ─── RPC return shapes ─────────────────────────────────────────────────────

export type ChapterVerse = {
  verse: number;
  ref: string;
  text: string;
  highlight_color: string | null;
  highlight_note: string | null;
  has_commentary: boolean;
  cross_ref_count: number;
}

export type ChapterWord = {
  ref: string;
  verse: number;
  position: number;
  surface: string;
  transliteration: string | null;
  gloss: string | null;
  strongs_id: string | null;
  morphology: string | null;
  lemma: string | null;
  language: OriginalLanguage;
  plain_note: string | null;
  strongs_lemma: string | null;
  strongs_definition: string | null;
}

export type CrossRefRow = {
  ref: string;
  display_ref: string;
  text: string;
  votes: number;
}

export type TodayFeed = {
  verse: {
    ref: string;
    display_ref: string;
    text: string;
    original_text: string | null;
    transliteration: string | null;
    badge: string | null;
    version_code: string;
  } | null;
  blessing: { ref: string; text: string; note: string } | null;
  insights: { kind: InsightKind; body: string }[];
}

export type FriendRow = {
  friendship_id: string;
  friend_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  streak_days: number;
  show_online: boolean;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  verse_ref: string | null;
  verse_ref_end: string | null;
  is_anonymous: boolean;
  is_private: boolean;
  created_by: string;
  daily_room: string | null;
  call_started_at: string | null;
  member_count: number;
  is_member: boolean;
  unread_notes: number;
  created_at: string;
}

export type SemanticHit = {
  ref: string;
  display_ref: string;
  text: string;
  similarity: number;
}

export type CircleStat = {
  circle_id: string;
  member_count: number;
  online_count: number;
}

export type MyStats = {
  streak: number;
  highlights: number;
  journal: number;
  rooms: number;
  notes: number;
}

export type PersonSearchRow = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
}

// ─── Schema map ────────────────────────────────────────────────────────────

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Row<T, R extends Relationship[] = []> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: R;
};

/**
 * Foreign keys have to be declared for PostgREST's embedded selects
 * (`select('*, profiles(display_name)')`) to typecheck — without them the
 * embedded column resolves to a SelectQueryError. Only the relationships the
 * app actually embeds through are listed.
 */
type FkToProfiles<Name extends string, Column extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: 'profiles';
  referencedColumns: ['id'];
};

export type Database = {
  public: {
    Tables: {
      profiles: Row<Profile>;
      books: Row<Book>;
      bible_versions: Row<BibleVersion>;
      verses: Row<Verse>;
      strongs_lemmas: Row<StrongsLemma>;
      words: Row<Word>;
      cross_refs: Row<{
        id: number;
        from_ref: string;
        to_ref: string;
        to_ref_end: string | null;
        votes: number;
      }>;
      verse_commentary: Row<{ ref: string; note: string; created_at: string }>;
      verse_search_embeddings: Row<{
        ref: string;
        version_code: string;
        content: string;
        embedding: string;
        created_at: string;
      }>;
      daily_verses: Row<{
        seq: number;
        ref: string;
        original_text: string | null;
        transliteration: string | null;
        badge: string | null;
      }>;
      blessings: Row<{ seq: number; ref: string; text: string; note: string }>;
      verse_insights: Row<{ id: number; ref: string; kind: InsightKind; body: string }>;
      highlights: Row<Highlight>;
      journals: Row<Journal>;
      journal_members: Row<{ journal_id: string; user_id: string; joined_at: string }>;
      journal_entries: Row<
        JournalEntry,
        [FkToProfiles<'journal_entries_author_id_fkey', 'author_id'>]
      >;
      journal_tasks: Row<JournalTask>;
      friendships: Row<
        Friendship,
        [
          FkToProfiles<'friendships_requester_id_fkey', 'requester_id'>,
          FkToProfiles<'friendships_recipient_id_fkey', 'recipient_id'>,
        ]
      >;
      direct_messages: Row<DirectMessage>;
      study_rooms: Row<StudyRoom>;
      study_room_members: Row<
        StudyRoomMember,
        [FkToProfiles<'study_room_members_user_id_fkey', 'user_id'>]
      >;
      study_room_notes: Row<
        StudyRoomNote,
        [FkToProfiles<'study_room_notes_user_id_fkey', 'user_id'>]
      >;
      healing_circles: Row<HealingCircle>;
      circle_members: Row<CircleMember>;
      circle_messages: Row<CircleMessage>;
      circle_message_authors: Row<{
        message_id: string;
        user_id: string;
        circle_id: string;
      }>;
    };
    // `{ [_ in never]: never }` rather than `Record<string, never>`: the latter
    // claims every string key maps to `never`, which fails postgrest-js's
    // `Record<string, GenericView>` constraint and silently collapses the whole
    // schema to `never` — every .from() and .rpc() then rejects its arguments.
    Views: { [_ in never]: never };
    Functions: {
      get_chapter: {
        Args: { p_version: string; p_book: string; p_chapter: number };
        Returns: ChapterVerse[];
      };
      get_chapter_words: {
        Args: { p_book: string; p_chapter: number };
        Returns: ChapterWord[];
      };
      get_cross_refs: {
        Args: { p_ref: string; p_version?: string };
        Returns: CrossRefRow[];
      };
      search_verses_semantic: {
        Args: {
          query_embedding: string;
          match_count?: number;
          min_similarity?: number;
          p_version?: string;
        };
        Returns: SemanticHit[];
      };
      get_today: { Args: { p_date?: string; p_version?: string }; Returns: TodayFeed };
      get_friends: { Args: Record<string, never>; Returns: FriendRow[] };
      respond_to_friend_request: {
        Args: { p_friendship_id: string; p_accept: boolean };
        Returns: Friendship;
      };
      mark_conversation_read: { Args: { p_friend_id: string }; Returns: number };
      search_people: {
        Args: { p_query: string; p_limit?: number };
        Returns: PersonSearchRow[];
      };
      get_or_create_shared_journal: { Args: { p_friend_id: string }; Returns: Journal };
      touch_streak: { Args: Record<string, never>; Returns: Profile };
      get_my_stats: { Args: Record<string, never>; Returns: MyStats };
      create_study_room: {
        Args: {
          p_name: string;
          p_description?: string | null;
          p_verse_ref?: string | null;
          p_verse_ref_end?: string | null;
          p_is_anonymous?: boolean;
          p_is_private?: boolean;
        };
        Returns: StudyRoom;
      };
      invite_to_room: {
        Args: { p_room_id: string; p_user_id: string };
        Returns: StudyRoomMember;
      };
      list_study_rooms: { Args: Record<string, never>; Returns: RoomRow[] };
      join_healing_circle: { Args: { p_circle_id: string }; Returns: CircleMember };
      post_circle_message: {
        Args: {
          p_circle_id: string;
          p_body?: string | null;
          p_shared_verse_ref?: string | null;
        };
        Returns: CircleMessage;
      };
      circle_stats: { Args: Record<string, never>; Returns: CircleStat[] };
    };
    Enums: {
      testament: Testament;
      version_source: VersionSource;
      original_language: OriginalLanguage;
      insight_kind: InsightKind;
      friendship_status: FriendshipStatus;
      journal_kind: JournalKind;
      room_role: RoomRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
