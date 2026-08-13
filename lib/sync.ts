/**
 * Sync engine: pull remote → compare updated_at → push/pull per entry.
 * Last-write-wins using updated_at timestamps.
 * Triggered on login / online / reconnect via useSyncWhenOnline.
 */
import * as Network from "expo-network";
import { supabase } from "./supabase";
import {
  getEntriesForSync,
  markEntrySynced,
  deleteEntryLocal,
  upsertRemoteEntry,
  getPendingImageUploads,
  removePendingImageUpload,
  getPreferencesRecord,
  upsertPreferencesSynced,
  markPreferencesSynced,
} from "./database";
import type { AnalysisPreferences, StoredJournalEntry } from "./types";

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
  // 1. Pull all remote entries for this user
  const { data: remoteEntries, error } = await supabase
    .from("journal_entries")
    .select("id, title, date, status, blocks, updated_at")
    .eq("user_id", userId);

  if (error) throw error;

  const remoteMap = new Map((remoteEntries ?? []).map((r) => [r.id, r]));

  // 2. Get all local entries (including pending_delete)
  const localEntries = await getEntriesForSync(userId);

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
          await pushEntry(local, userId);
        } else {
          await upsertRemoteEntry(fromRemoteRow(remote), userId);
        }
      } else if (remoteTime > localTime) {
        // Local marked synced but remote was updated elsewhere
        await upsertRemoteEntry(fromRemoteRow(remote), userId);
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
  const local = await getPreferencesRecord(userId);
  const { data: remote, error } = await supabase
    .from("user_preferences")
    .select("focus_areas, custom_note, updated_at")
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
      {
        focusAreas: remote.focus_areas as AnalysisPreferences["focusAreas"],
        customNote: remote.custom_note ?? undefined,
      },
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
        {
          focusAreas: remote!.focus_areas as AnalysisPreferences["focusAreas"],
          customNote: remote!.custom_note ?? undefined,
        },
        remote!.updated_at
      );
    }
  } else if (remoteTime > localTime) {
    await upsertPreferencesSynced(
      userId,
      {
        focusAreas: remote!.focus_areas as AnalysisPreferences["focusAreas"],
        customNote: remote!.custom_note ?? undefined,
      },
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
      focus_areas: prefs.focusAreas,
      custom_note: prefs.customNote ?? null,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  await markPreferencesSynced(userId);
}
