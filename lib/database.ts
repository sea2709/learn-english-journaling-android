import * as SQLite from "expo-sqlite";
import type { StoredJournalEntry, AnalysisPreferences, SyncStatus } from "./types";
import { DEFAULT_ANALYSIS_PREFERENCES } from "./analysis-preferences";

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Serialize every SQLite call on the shared connection.
 * Overlapping prepare/run/finalize races expo-sqlite SharedObjects on Android
 * (`NativeStatement.runAsync` then fails with an invalid native id).
 * Do not nest enqueueDb — helpers used from queued functions must call SQLite directly.
 */
let dbChain: Promise<unknown> = Promise.resolve();

function enqueueDb<T>(fn: () => Promise<T>): Promise<T> {
  const run = dbChain.then(fn, fn);
  dbChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

/** Open + migrate once; safe to call concurrently from multiple places. */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = await SQLite.openDatabaseAsync("journal.db");

    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        sync_status TEXT NOT NULL DEFAULT 'pending_create',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journal_paragraphs (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        text TEXT,
        image_path TEXT,
        analysis_json TEXT,
        analyzed_text TEXT,
        discussion_json TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending_create',
        updated_at TEXT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY DEFAULT 'local',
        user_id TEXT NOT NULL,
        focus_areas_json TEXT NOT NULL,
        custom_note TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending_create',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pending_image_uploads (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        paragraph_id TEXT NOT NULL,
        local_path TEXT NOT NULL,
        remote_path TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON journal_entries(user_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_journal_paragraphs_entry ON journal_paragraphs(entry_id, position ASC);
    `);

    db = database;
    return database;
  })().catch((error) => {
    initPromise = null;
    db = null;
    throw error;
  });

  return initPromise;
}

export async function closeDatabase(): Promise<void> {
  return enqueueDb(async () => {
    if (db) {
      await db.closeAsync();
      db = null;
      initPromise = null;
    }
  });
}

// ── Entry CRUD ──────────────────────────────────────────────────────────────

export async function getAllEntries(userId: string): Promise<StoredJournalEntry[]> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const rows = await database.getAllAsync<{
      id: string;
      title: string;
      date: string;
      status: string;
      sync_status: string;
      updated_at: string;
    }>(
      `SELECT id, title, date, status, sync_status, updated_at
       FROM journal_entries
       WHERE user_id = ? AND sync_status != 'pending_delete'
       ORDER BY date DESC, updated_at DESC`,
      [userId]
    );

    const entries: StoredJournalEntry[] = [];
    for (const row of rows) {
      const blocks = await getBlocksForEntry(row.id);
      entries.push({
        id: row.id,
        title: row.title,
        date: row.date,
        status: row.status,
        syncStatus: row.sync_status as SyncStatus,
        updatedAt: row.updated_at,
        blocks,
      });
    }
    return entries;
  });
}

/** Includes pending_delete tombstones for the sync engine. */
export async function getEntriesForSync(userId: string): Promise<StoredJournalEntry[]> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const rows = await database.getAllAsync<{
      id: string;
      title: string;
      date: string;
      status: string;
      sync_status: string;
      updated_at: string;
    }>(
      `SELECT id, title, date, status, sync_status, updated_at
       FROM journal_entries
       WHERE user_id = ?
       ORDER BY date DESC, updated_at DESC`,
      [userId]
    );

    const entries: StoredJournalEntry[] = [];
    for (const row of rows) {
      const blocks = await getBlocksForEntry(row.id);
      entries.push({
        id: row.id,
        title: row.title,
        date: row.date,
        status: row.status,
        syncStatus: row.sync_status as SyncStatus,
        updatedAt: row.updated_at,
        blocks,
      });
    }
    return entries;
  });
}

export async function getEntry(id: string): Promise<StoredJournalEntry | null> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const row = await database.getFirstAsync<{
      id: string;
      title: string;
      date: string;
      status: string;
      sync_status: string;
      updated_at: string;
    }>(
      `SELECT id, title, date, status, sync_status, updated_at FROM journal_entries WHERE id = ?`,
      [id]
    );
    if (!row) return null;

    const blocks = await getBlocksForEntry(id);
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      status: row.status,
      syncStatus: row.sync_status as SyncStatus,
      updatedAt: row.updated_at,
      blocks,
    };
  });
}

async function getBlocksForEntry(entryId: string) {
  const database = getDb();
  const rows = await database.getAllAsync<{
    id: string;
    type: string;
    text: string | null;
    image_path: string | null;
    analysis_json: string | null;
    analyzed_text: string | null;
    discussion_json: string | null;
  }>(
    `SELECT id, type, text, image_path, analysis_json, analyzed_text, discussion_json
     FROM journal_paragraphs WHERE entry_id = ? ORDER BY position ASC`,
    [entryId]
  );

  return rows.map((r) => {
    if (r.type === "image") {
      return { type: "image" as const, id: r.id, path: r.image_path ?? "" };
    }
    return {
      type: "text" as const,
      id: r.id,
      text: r.text ?? "",
      analysis: r.analysis_json ? JSON.parse(r.analysis_json) : null,
      analyzedText: r.analyzed_text,
      discussion: r.discussion_json ? JSON.parse(r.discussion_json) : undefined,
    };
  });
}

export async function saveEntry(entry: StoredJournalEntry, userId: string): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const now = new Date().toISOString();
    const updatedAt = entry.updatedAt || now;

    await database.withTransactionAsync(async () => {
      await database.runAsync(
        `INSERT INTO journal_entries
         (id, user_id, title, date, status, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           title = excluded.title,
           date = excluded.date,
           status = excluded.status,
           sync_status = excluded.sync_status,
           updated_at = excluded.updated_at`,
        [
          entry.id,
          userId,
          entry.title,
          entry.date,
          entry.status,
          entry.syncStatus,
          now,
          updatedAt,
        ]
      );

      await database.runAsync(`DELETE FROM journal_paragraphs WHERE entry_id = ?`, [entry.id]);

      for (let i = 0; i < entry.blocks.length; i++) {
        const block = entry.blocks[i];
        if (block.type === "text") {
          await database.runAsync(
            `INSERT INTO journal_paragraphs
             (id, entry_id, position, type, text, analysis_json, analyzed_text, discussion_json, sync_status, updated_at)
             VALUES (?, ?, ?, 'text', ?, ?, ?, ?, 'pending_create', ?)`,
            [
              block.id,
              entry.id,
              i,
              block.text,
              block.analysis ? JSON.stringify(block.analysis) : null,
              block.analyzedText ?? null,
              block.discussion ? JSON.stringify(block.discussion) : null,
              updatedAt,
            ]
          );
        } else {
          await database.runAsync(
            `INSERT INTO journal_paragraphs
             (id, entry_id, position, type, image_path, sync_status, updated_at)
             VALUES (?, ?, ?, 'image', ?, 'pending_create', ?)`,
            [block.id, entry.id, i, block.path, updatedAt]
          );
        }
      }
    });
  });
}

export async function markEntryDeleted(entryId: string): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(
      `UPDATE journal_entries SET sync_status = 'pending_delete', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), entryId]
    );
  });
}

export async function deleteEntryLocal(entryId: string): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(`DELETE FROM journal_entries WHERE id = ?`, [entryId]);
  });
}

// ── Preferences ─────────────────────────────────────────────────────────────

export async function loadPreferences(userId: string): Promise<AnalysisPreferences> {
  const record = await getPreferencesRecord(userId);
  return record?.preferences ?? DEFAULT_ANALYSIS_PREFERENCES;
}

export async function getPreferencesRecord(userId: string): Promise<{
  preferences: AnalysisPreferences;
  syncStatus: SyncStatus;
  updatedAt: string;
} | null> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const row = await database.getFirstAsync<{
      focus_areas_json: string;
      custom_note: string | null;
      sync_status: string;
      updated_at: string;
    }>(
      `SELECT focus_areas_json, custom_note, sync_status, updated_at
       FROM user_preferences WHERE user_id = ?`,
      [userId]
    );

    if (!row) return null;

    return {
      preferences: {
        focusAreas: JSON.parse(row.focus_areas_json),
        customNote: row.custom_note ?? undefined,
      },
      syncStatus: row.sync_status as SyncStatus,
      updatedAt: row.updated_at,
    };
  });
}

export async function savePreferences(
  userId: string,
  prefs: AnalysisPreferences
): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const now = new Date().toISOString();
    await database.runAsync(
      `INSERT OR REPLACE INTO user_preferences
       (id, user_id, focus_areas_json, custom_note, sync_status, updated_at)
       VALUES ('local', ?, ?, ?, 'pending_update', ?)`,
      [userId, JSON.stringify(prefs.focusAreas), prefs.customNote ?? null, now]
    );
  });
}

export async function upsertPreferencesSynced(
  userId: string,
  prefs: AnalysisPreferences,
  updatedAt: string
): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO user_preferences
       (id, user_id, focus_areas_json, custom_note, sync_status, updated_at)
       VALUES ('local', ?, ?, ?, 'synced', ?)`,
      [userId, JSON.stringify(prefs.focusAreas), prefs.customNote ?? null, updatedAt]
    );
  });
}

export async function markPreferencesSynced(userId: string): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(
      `UPDATE user_preferences SET sync_status = 'synced' WHERE user_id = ?`,
      [userId]
    );
  });
}

// ── Pending image uploads ────────────────────────────────────────────────────

export async function addPendingImageUpload(params: {
  id: string;
  entryId: string;
  paragraphId: string;
  localPath: string;
}): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(
      `INSERT OR IGNORE INTO pending_image_uploads
       (id, entry_id, paragraph_id, local_path, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [params.id, params.entryId, params.paragraphId, params.localPath, new Date().toISOString()]
    );
  });
}

export async function getPendingImageUploads(): Promise<
  Array<{ id: string; entryId: string; paragraphId: string; localPath: string }>
> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const rows = await database.getAllAsync<{
      id: string;
      entry_id: string;
      paragraph_id: string;
      local_path: string;
    }>(`SELECT id, entry_id, paragraph_id, local_path FROM pending_image_uploads`);
    return rows.map((r) => ({
      id: r.id,
      entryId: r.entry_id,
      paragraphId: r.paragraph_id,
      localPath: r.local_path,
    }));
  });
}

export async function removePendingImageUpload(id: string): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(`DELETE FROM pending_image_uploads WHERE id = ?`, [id]);
  });
}

export async function removePendingImageUploadsForEntry(entryId: string): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(`DELETE FROM pending_image_uploads WHERE entry_id = ?`, [entryId]);
  });
}

// ── Sync helpers ─────────────────────────────────────────────────────────────

export async function getPendingEntries(userId: string): Promise<
  Array<{ id: string; syncStatus: SyncStatus; updatedAt: string }>
> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    const rows = await database.getAllAsync<{
      id: string;
      sync_status: string;
      updated_at: string;
    }>(
      `SELECT id, sync_status, updated_at FROM journal_entries
       WHERE user_id = ? AND sync_status != 'synced'`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      syncStatus: r.sync_status as SyncStatus,
      updatedAt: r.updated_at,
    }));
  });
}

export async function markEntrySynced(entryId: string): Promise<void> {
  return enqueueDb(async () => {
    const database = await initDatabase();
    await database.runAsync(
      `UPDATE journal_entries SET sync_status = 'synced' WHERE id = ?`,
      [entryId]
    );
  });
}

export async function upsertRemoteEntry(
  entry: StoredJournalEntry,
  userId: string
): Promise<void> {
  await saveEntry({ ...entry, syncStatus: "synced" }, userId);
}
