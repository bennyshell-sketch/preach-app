/**
 * Service-role Supabase client for the ingestion pipeline.
 *
 * These scripts run on a workstation or in CI, never in the app. The
 * service-role key bypasses RLS, which is exactly what bulk-loading scripture
 * needs and exactly why the key must never reach the client bundle.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

export function serviceClient(): SupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — copy .env.example to .env',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Insert in chunks. PostgREST will happily accept a 30,000-row array and then
 * time out; 1,000 rows per statement keeps each request comfortably inside the
 * default statement timeout.
 */
export async function upsertChunked<T extends Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  rows: T[],
  options: { chunk?: number; onConflict?: string; label?: string } = {},
): Promise<void> {
  const chunk = options.chunk ?? 1000;
  const label = options.label ?? table;

  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await db
      .from(table)
      .upsert(slice as never, { onConflict: options.onConflict, ignoreDuplicates: false });

    if (error) {
      throw new Error(`${label}: upsert failed at row ${i} — ${error.message}`);
    }
    process.stdout.write(
      `\r  ${label}: ${Math.min(i + chunk, rows.length)}/${rows.length}`,
    );
  }
  process.stdout.write('\n');
}
