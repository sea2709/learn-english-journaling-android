/**
 * Sync engine: pull remote → compare updated_at → push/pull per entry.
 * Last-write-wins using updated_at timestamps.
 * Triggered on network reconnect.
 */
import { supabase } from "./supabase";
import {
  getAllEntries,
  getEntry,
  getPendingEntries,
  markEntrySynced,
  deleteEntryLocal,
  upsertRemoteEntry,
  getPendingImageUploads,
  removePendingImageUpload,
} from "./database";
import type { StoredJournalEntry, SyncStatus } from "./types";

// ── Remote schema mapping ────────────────────────────────────────────────────

function toRemoteRow(entry: StoredJournalEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    title: entry.title,
    date: entry.date,
    status: entry.status,
    blocks: entry.blocks,
    updated_at: entry.updatedAt,
  };
}

function fromRemoteRow(row: {
  id: string;
  title: string;
  date: string;
  status: string;
  blocks: unknown;
  updated_at: string;
}): StoredJournalEntry {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    status: row.status,
    blocks: row.blocks as StoredJournalEntry["blocks"],
    syncStatus: "synced",
    updatedAt: row.updated_at,
  };
}

// ── Main sync function ───────────────────────────────────────────────────────

export async function syncEntries(userId: string): Promise<void> {
  // 1. Pull all remote entries for this user
  const { data: remoteEntries, error } = await supabase
    .from("journal_entries")
    .select("id, title, date, status, blocks, updated_at")
    .eq("user_id", userId);

  if (error) throw error;

  const remoteMap = new Map(
    (remoteEntries ?? []).map((r) => [r.id, r])
  );

  // 2. Get all local entries (including pending_delete)
  const localEntries = await getAllEntries(userId);

  // 3. Process pending deletes first
  const pendingDeletes = localEntries.filter((e) => e.syncStatus === "pending_delete");
  for (const entry of pendingDeletes) {
    await supabase.from("journal_entries").delete().eq("id", entry.id).eq("user_id", userId);
    await deleteEntryLocal(entry.id);
  }

  // 4. For each local non-deleted entry, compare with remote
  const nonDeleted = localEntries.filter((e) => e.syncStatus !== "pending_delete");
  for (const local of nonDeleted) {
    const remote = remoteMap.get(local.id);

    if (!remote) {
      // Not on remote yet — push it
      if (local.syncStatus !== "synced") {
        await pushEntry(local, userId);
      }
    } else {
      const localTime = new Date(local.updatedAt).getTime();
      const remoteTime = new Date(remote.updated_at).getTime();

      if (local.syncStatus !== "synced") {
        if (localTime >= remoteTime) {
          // Local is newer or equal — push
          await pushEntry(local, userId);
        } else {
          // Remote is newer — pull
          await upsertRemoteEntry(fromRemoteRow(remote), userId);
        }
      }
      remoteMap.delete(local.id);
    }
  }

  // 5. Pull any remote entries not in local DB
  for (const [, remote] of remoteMap) {
    await upsertRemoteEntry(fromRemoteRow(remote), userId);
  }

  // 6. Drain image upload queue
  await drainImageQueue(userId);
}

async function pushEntry(entry: StoredJournalEntry, userId: string): Promise<void> {
  const { error } = await supabase
    .from("journal_entries")
    .upsert(toRemoteRow(entry, userId), { onConflict: "id" });
  if (error) throw error;
  await markEntrySynced(entry.id);
}

// ── Image upload queue ───────────────────────────────────────────────────────

async function drainImageQueue(userId: string): Promise<void> {
  const queue = await getPendingImageUploads();
  for (const item of queue) {
    try {
      const response = await fetch(item.localPath);
      const blob = await response.blob();
      const remotePath = `${userId}/${item.entryId}/${item.id}.jpg`;

      const { error } = await supabase.storage
        .from("entry-images")
        .upload(remotePath, blob, { upsert: true, contentType: "image/jpeg" });

      if (!error) {
        await removePendingImageUpload(item.id);
      }
    } catch {
      // Leave in queue; retry on next sync
    }
  }
}

// ── Sync preferences ─────────────────────────────────────────────────────────

export async function syncPreferences(userId: string): Promise<void> {
  const { data: remote } = await supabase
    .from("user_preferences")
    .select("focus_areas, custom_note, updated_at")
    .eq("user_id", userId)
    .single();

  if (!remote) {
    // Push local preferences
    const { loadPreferences } = await import("./database");
    const prefs = await loadPreferences(userId);
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      focus_areas: prefs.focusAreas,
      custom_note: prefs.customNote ?? null,
      updated_at: new Date().toISOString(),
    });
  }
}
