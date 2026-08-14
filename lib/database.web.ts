/**
 * Web journal storage: Supabase only. No SQLite / offline cache.
 */
import { supabase } from "./supabase";
import { DEFAULT_ANALYSIS_PREFERENCES, parseAnalysisPreferences } from "./analysis-preferences";
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

let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function storageImagePath(userId: string, entryId: string, blockId: string): string {
  return `${userId}/${entryId}/${blockId}.jpg`;
}

function isEphemeralUri(path: string): boolean {
  return /^(blob|data|file|content|ph|assets-library):/i.test(path);
}

function storagePathFromDisplay(
  path: string,
  userId: string,
  entryId: string,
  blockId: string
): string {
  const fallback = storageImagePath(userId, entryId, blockId);
  if (isEphemeralUri(path)) return fallback;
  try {
    const url = new URL(path, "https://placeholder.local");
    const marker = "/entry-images/";
    const idx = url.pathname.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length));
    }
  } catch {
    // not a URL
  }
  if (!/^https?:/i.test(path)) return path;
  return fallback;
}

function mapBlockFromRemote(paragraph: RemoteParagraph): EntryBlock {
  if (paragraph.block_type === "image" && paragraph.image_path) {
    return { type: "image", id: paragraph.id, path: paragraph.image_path };
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

async function signedImagePath(path: string): Promise<string> {
  if (/^(https?|blob|data):/i.test(path)) return path;
  const { data, error } = await supabase.storage.from("entry-images").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return path;
  return data.signedUrl;
}

async function withDisplayImages(entry: StoredJournalEntry): Promise<StoredJournalEntry> {
  const blocks = await Promise.all(
    entry.blocks.map(async (block) => {
      if (block.type !== "image") return block;
      return { ...block, path: await signedImagePath(block.path) };
    })
  );
  return { ...entry, blocks };
}

async function uploadIfNeeded(
  userId: string,
  entryId: string,
  block: EntryBlock
): Promise<EntryBlock> {
  if (block.type !== "image") return block;
  if (!isEphemeralUri(block.path)) return block;

  const remotePath = storageImagePath(userId, entryId, block.id);
  const response = await fetch(block.path);
  if (!response.ok) {
    throw new Error("Could not read the selected image.");
  }
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from("entry-images")
    .upload(remotePath, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
  if (error) throw error;

  return { ...block, path: await signedImagePath(remotePath) };
}

function mapBlockToRemote(
  userId: string,
  entryId: string,
  block: EntryBlock,
  order: number
) {
  if (block.type === "image") {
    return {
      id: block.id,
      entry_id: entryId,
      order,
      text: "",
      analyzed_text: null,
      analysis: null,
      discussion: null,
      block_type: "image" as const,
      image_path: storagePathFromDisplay(block.path, userId, entryId, block.id),
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

const ENTRY_SELECT = "id, title, date, status, updated_at, journal_paragraphs(*)";

export async function initDatabase(): Promise<unknown> {
  return null;
}

export async function closeDatabase(): Promise<void> {}

export async function getAllEntries(userId: string): Promise<StoredJournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select(ENTRY_SELECT)
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const entries = ((data ?? []) as RemoteEntry[]).map(fromRemoteRow);
  return Promise.all(entries.map(withDisplayImages));
}

export async function getEntry(id: string): Promise<StoredJournalEntry | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select(ENTRY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return withDisplayImages(fromRemoteRow(data as RemoteEntry));
}

export async function saveEntry(entry: StoredJournalEntry, userId: string): Promise<void> {
  return enqueueWrite(async () => {
    const blocks = await Promise.all(
      entry.blocks.map((block) => uploadIfNeeded(userId, entry.id, block))
    );
    const updatedAt = entry.updatedAt || new Date().toISOString();

    const { error: entryError } = await supabase.from("journal_entries").upsert(
      {
        id: entry.id,
        user_id: userId,
        title: entry.title,
        date: entry.date,
        status: entry.status,
        updated_at: updatedAt,
      },
      { onConflict: "id" }
    );
    if (entryError) throw entryError;

    const blockIds = blocks.map((block) => block.id);
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

      const { error: upsertError } = await supabase.from("journal_paragraphs").upsert(
        blocks.map((block, index) => mapBlockToRemote(userId, entry.id, block, index)),
        { onConflict: "id" }
      );
      if (upsertError) throw upsertError;
    }
  });
}

async function deleteRemoteEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function markEntryDeleted(entryId: string): Promise<void> {
  return enqueueWrite(() => deleteRemoteEntry(entryId));
}

export async function deleteEntryLocal(entryId: string): Promise<void> {
  return enqueueWrite(() => deleteRemoteEntry(entryId));
}

export async function loadPreferences(userId: string): Promise<AnalysisPreferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("analysis_preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_ANALYSIS_PREFERENCES;
  try {
    return parseAnalysisPreferences(data.analysis_preferences);
  } catch {
    return DEFAULT_ANALYSIS_PREFERENCES;
  }
}

export async function savePreferences(
  userId: string,
  prefs: AnalysisPreferences
): Promise<void> {
  return enqueueWrite(async () => {
    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: userId,
        analysis_preferences: prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
  });
}
