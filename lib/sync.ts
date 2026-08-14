/**
 * Sync engine: pull remote → compare updated_at → push/pull per entry.
 * Last-write-wins using updated_at timestamps.
 * Triggered on login / online / reconnect via useSyncWhenOnline.
 *
 * Remote schema matches the web app: journal_entries + journal_paragraphs
 * (no JSON `blocks` column) and user_preferences.analysis_preferences jsonb.
 */
import { Directory, File, Paths } from "expo-file-system";
import * as Network from "expo-network";
import { supabase } from "./supabase";
import {
  addPendingImageUpload,
  getEntriesForSync,
  markEntrySynced,
  deleteEntryLocal,
  upsertRemoteEntry,
  getPendingImageUploads,
  removePendingImageUpload,
  removePendingImageUploadsForEntry,
  getPreferencesRecord,
  upsertPreferencesSynced,
  markPreferencesSynced,
  saveEntry,
} from "./database";
import { DEFAULT_ANALYSIS_PREFERENCES, parseAnalysisPreferences } from "./analysis-preferences";
import { isUuid, newEntityId } from "./entry-utils";
import type {
  AnalysisPreferences,
  AnalysisResult,
  EntryBlock,
  StoredJournalEntry,
  SuggestionMessage,
} from "./types";

type RemoteParagraph = {
  id: string;
  entry_id: string;
  order: number;
  text: string;
  analyzed_text: string | null;
  analysis: AnalysisResult | null;
  discussion: SuggestionMessage[] | null;
  block_type: "text" | "image" | null;
  image_path: string | null;
};

type RemoteEntry = {
  id: string;
  title: string;
  date: string;
  status: string;
  updated_at: string;
  journal_paragraphs: RemoteParagraph[] | null;
};

function isLocalUri(path: string): boolean {
  return /^(file|content|ph|assets-library):/i.test(path);
}

function storageImagePath(userId: string, entryId: string, blockId: string): string {
  return `${userId}/${entryId}/${blockId}.jpg`;
}

function mapBlockFromRemote(paragraph: RemoteParagraph): EntryBlock {
  if (paragraph.block_type === "image" && paragraph.image_path) {
    return {
      type: "image",
      id: paragraph.id,
      path: paragraph.image_path,
    };
  }

  return {
    type: "text",
    id: paragraph.id,
    text: paragraph.text ?? "",
    analyzedText: paragraph.analyzed_text,
    analysis: paragraph.analysis,
    discussion: paragraph.discussion ?? undefined,
  };
}

function fromRemoteRow(row: RemoteEntry): StoredJournalEntry {
  const blocks = (row.journal_paragraphs ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(mapBlockFromRemote);

  return {
    id: row.id,
    title: row.title,
    date: row.date,
    status: row.status,
    blocks,
    syncStatus: "synced",
    updatedAt: row.updated_at,
  };
}

function mapBlockToRemote(
  userId: string,
  entryId: string,
  block: EntryBlock,
  order: number
) {
  if (block.type === "image") {
    const imagePath = isLocalUri(block.path)
      ? storageImagePath(userId, entryId, block.id)
      : block.path;
    return {
      id: block.id,
      entry_id: entryId,
      order,
      text: "",
      analyzed_text: null,
      analysis: null,
      discussion: null,
      block_type: "image" as const,
      image_path: imagePath,
    };
  }

  return {
    id: block.id,
    entry_id: entryId,
    order,
    text: block.text,
    analyzed_text: block.analyzedText,
    analysis: block.analysis,
    discussion: block.discussion ?? null,
    block_type: "text" as const,
    image_path: null,
  };
}

async function downloadEntryImage(
  userId: string,
  entryId: string,
  blockId: string,
  remotePath: string
): Promise<string> {
  const dir = new Directory(Paths.document, "entry-images");
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  const file = new File(dir, `${entryId}-${blockId}.jpg`);
  if (file.exists) return file.uri;

  const path = remotePath.includes("/")
    ? remotePath
    : storageImagePath(userId, entryId, blockId);
  const { data, error } = await supabase.storage.from("entry-images").download(path);
  if (error || !data) return remotePath;

  const bytes = new Uint8Array(await data.arrayBuffer());
  file.write(bytes);
  return file.uri;
}

async function hydrateRemoteImages(
  entry: StoredJournalEntry,
  userId: string
): Promise<StoredJournalEntry> {
  const blocks = await Promise.all(
    entry.blocks.map(async (block) => {
      if (block.type !== "image" || isLocalUri(block.path)) return block;
      try {
        const path = await downloadEntryImage(userId, entry.id, block.id, block.path);
        return { ...block, path };
      } catch {
        return block;
      }
    })
  );
  return { ...entry, blocks };
}

async function applyRemoteEntry(row: RemoteEntry, userId: string): Promise<void> {
  const hydrated = await hydrateRemoteImages(fromRemoteRow(row), userId);
  await upsertRemoteEntry(hydrated, userId);
}

function isOnlineState(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

// ── Orchestration (dedupe concurrent runs) ───────────────────────────────────

let inFlight: Promise<void> | null = null;
let inFlightUserId: string | null = null;

export async function syncAll(userId: string): Promise<void> {
  if (inFlight && inFlightUserId === userId) return inFlight;

  inFlightUserId = userId;
  inFlight = (async () => {
    await syncEntries(userId);
    await syncPreferences(userId);
  })().finally(() => {
    if (inFlightUserId === userId) {
      inFlight = null;
      inFlightUserId = null;
    }
  });

  return inFlight;
}

/** Sync when reachable; returns false if offline (no throw). */
export async function syncAllIfOnline(userId: string): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  if (!isOnlineState(state)) return false;
  await syncAll(userId);
  return true;
}

export { isOnlineState };

// ── Main sync function ───────────────────────────────────────────────────────

export async function syncEntries(userId: string): Promise<void> {
  const { data: remoteEntries, error } = await supabase
    .from("journal_entries")
    .select("id, title, date, status, updated_at, journal_paragraphs(*)")
    .eq("user_id", userId);

  if (error) throw error;

  const remoteMap = new Map(
    ((remoteEntries ?? []) as RemoteEntry[]).map((r) => [r.id, r])
  );

  const localEntries = await getEntriesForSync(userId);

  const pendingDeletes = localEntries.filter((e) => e.syncStatus === "pending_delete");
  for (const entry of pendingDeletes) {
    // Legacy local IDs were never valid Postgres UUIDs, so they cannot exist remotely.
    if (isUuid(entry.id)) {
      await supabase.from("journal_entries").delete().eq("id", entry.id).eq("user_id", userId);
    }
    await deleteEntryLocal(entry.id);
  }

  const nonDeleted = localEntries.filter((e) => e.syncStatus !== "pending_delete");
  for (const local of nonDeleted) {
    const migrated = await migrateLocalIdsToUuids(local, userId);
    const remote = remoteMap.get(migrated.id);

    if (!remote) {
      if (migrated.syncStatus !== "synced") {
        await pushEntry(migrated, userId);
      }
    } else {
      const localTime = new Date(migrated.updatedAt).getTime();
      const remoteTime = new Date(remote.updated_at).getTime();

      if (migrated.syncStatus !== "synced") {
        if (localTime >= remoteTime) {
          await pushEntry(migrated, userId);
        } else {
          await applyRemoteEntry(remote, userId);
        }
      } else if (remoteTime > localTime) {
        await applyRemoteEntry(remote, userId);
      }
      remoteMap.delete(migrated.id);
    }
  }

  for (const [, remote] of remoteMap) {
    await applyRemoteEntry(remote, userId);
  }

  await drainImageQueue(userId);
}

function needsUuidMigration(entry: StoredJournalEntry): boolean {
  return !isUuid(entry.id) || entry.blocks.some((block) => !isUuid(block.id));
}

/** Rewrite pre-UUID local IDs so they can be stored in remote uuid columns. */
async function migrateLocalIdsToUuids(
  entry: StoredJournalEntry,
  userId: string
): Promise<StoredJournalEntry> {
  if (!needsUuidMigration(entry)) return entry;

  const previousId = entry.id;
  const next: StoredJournalEntry = {
    ...entry,
    id: isUuid(entry.id) ? entry.id : newEntityId(),
    blocks: entry.blocks.map((block) => ({
      ...block,
      id: isUuid(block.id) ? block.id : newEntityId(),
    })),
    syncStatus: "pending_create",
  };

  await saveEntry(next, userId);
  await removePendingImageUploadsForEntry(previousId);
  if (previousId !== next.id) {
    await deleteEntryLocal(previousId);
  }
  return next;
}

async function pushEntry(entry: StoredJournalEntry, userId: string): Promise<void> {
  const { error: entryError } = await supabase.from("journal_entries").upsert(
    {
      id: entry.id,
      user_id: userId,
      title: entry.title,
      date: entry.date,
      status: entry.status,
    },
    { onConflict: "id" }
  );
  if (entryError) throw entryError;

  const blockIds = entry.blocks.map((block) => block.id);
  if (blockIds.length === 0) {
    const { error } = await supabase.from("journal_paragraphs").delete().eq("entry_id", entry.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("journal_paragraphs")
      .delete()
      .eq("entry_id", entry.id)
      .not("id", "in", `(${blockIds.join(",")})`);
    if (error) throw error;
  }

  for (const block of entry.blocks) {
    if (block.type === "image" && isLocalUri(block.path)) {
      await addPendingImageUpload({
        id: block.id,
        entryId: entry.id,
        paragraphId: block.id,
        localPath: block.path,
      });
    }
  }

  if (entry.blocks.length > 0) {
    const { error } = await supabase.from("journal_paragraphs").upsert(
      entry.blocks.map((block, index) => mapBlockToRemote(userId, entry.id, block, index)),
      { onConflict: "id" }
    );
    if (error) throw error;
  }

  await markEntrySynced(entry.id);
}

// ── Image upload queue ───────────────────────────────────────────────────────

async function drainImageQueue(userId: string): Promise<void> {
  const queue = await getPendingImageUploads();
  for (const item of queue) {
    try {
      const file = new File(item.localPath);
      if (!file.exists) continue;
      const bytes = await file.bytes();
      const remotePath = storageImagePath(userId, item.entryId, item.id);

      const { error } = await supabase.storage
        .from("entry-images")
        .upload(remotePath, bytes, { upsert: true, contentType: "image/jpeg" });

      if (!error) {
        await removePendingImageUpload(item.id);
      }
    } catch {
      // Leave in queue; retry on next sync
    }
  }
}

function prefsFromRemote(value: unknown): AnalysisPreferences {
  try {
    return parseAnalysisPreferences(value);
  } catch {
    return DEFAULT_ANALYSIS_PREFERENCES;
  }
}

// ── Sync preferences ─────────────────────────────────────────────────────────

export async function syncPreferences(userId: string): Promise<void> {
  const local = await getPreferencesRecord(userId);
  const { data: remote, error } = await supabase
    .from("user_preferences")
    .select("analysis_preferences, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!remote && !local) return;

  if (!remote && local) {
    await pushPreferences(userId, local.preferences, local.updatedAt);
    return;
  }

  if (remote && !local) {
    await upsertPreferencesSynced(
      userId,
      prefsFromRemote(remote.analysis_preferences),
      remote.updated_at
    );
    return;
  }

  const localTime = new Date(local!.updatedAt).getTime();
  const remoteTime = new Date(remote!.updated_at).getTime();

  if (local!.syncStatus !== "synced") {
    if (localTime >= remoteTime) {
      await pushPreferences(userId, local!.preferences, local!.updatedAt);
    } else {
      await upsertPreferencesSynced(
        userId,
        prefsFromRemote(remote!.analysis_preferences),
        remote!.updated_at
      );
    }
  } else if (remoteTime > localTime) {
    await upsertPreferencesSynced(
      userId,
      prefsFromRemote(remote!.analysis_preferences),
      remote!.updated_at
    );
  }
}

async function pushPreferences(
  userId: string,
  prefs: AnalysisPreferences,
  updatedAt: string
): Promise<void> {
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      analysis_preferences: prefs,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  await markPreferencesSynced(userId);
}
