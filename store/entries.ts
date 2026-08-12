import { create } from "zustand";
import type { StoredJournalEntry, EntryBlock, AnalysisResult } from "../lib/types";
import {
  getAllEntries,
  getEntry,
  saveEntry,
  markEntryDeleted,
  deleteEntryLocal,
} from "../lib/database";
import { toListItem, createParagraph, formatTodayISO } from "../lib/entry-utils";
import type { JournalEntryListItem } from "../lib/types";

const MAX_ENTRIES = 50;

interface EntriesState {
  entries: JournalEntryListItem[];
  currentEntry: StoredJournalEntry | null;
  loading: boolean;
  loadEntries: (userId: string) => Promise<void>;
  loadEntry: (id: string) => Promise<void>;
  createEntry: (userId: string) => Promise<StoredJournalEntry>;
  updateEntry: (entry: StoredJournalEntry, userId: string) => Promise<void>;
  deleteEntry: (entryId: string, userId: string, online: boolean) => Promise<void>;
  updateBlock: (
    entryId: string,
    blockId: string,
    updates: Partial<EntryBlock>,
    userId: string
  ) => Promise<void>;
  setParagraphAnalysis: (
    entryId: string,
    paragraphId: string,
    analysis: AnalysisResult,
    analyzedText: string,
    userId: string
  ) => Promise<void>;
  clearCurrentEntry: () => void;
}

export const useEntriesStore = create<EntriesState>((set, get) => ({
  entries: [],
  currentEntry: null,
  loading: false,

  loadEntries: async (userId) => {
    set({ loading: true });
    const all = await getAllEntries(userId);
    set({ entries: all.map(toListItem), loading: false });
  },

  loadEntry: async (id) => {
    const entry = await getEntry(id);
    set({ currentEntry: entry });
  },

  createEntry: async (userId) => {
    const { entries } = get();
    if (entries.length >= MAX_ENTRIES) {
      throw new Error(`Entry limit of ${MAX_ENTRIES} reached.`);
    }
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const now = new Date().toISOString();
    const entry: StoredJournalEntry = {
      id,
      title: "",
      date: formatTodayISO(),
      blocks: [createParagraph()],
      status: "draft",
      syncStatus: "pending_create",
      updatedAt: now,
    };
    await saveEntry(entry, userId);
    set((state) => ({ entries: [toListItem(entry), ...state.entries] }));
    return entry;
  },

  updateEntry: async (entry, userId) => {
    const updated: StoredJournalEntry = {
      ...entry,
      syncStatus: entry.syncStatus === "synced" ? "pending_update" : entry.syncStatus,
      updatedAt: new Date().toISOString(),
    };
    // Optimistic UI first so rapid edits don't all read the same stale entry.
    set((state) => ({
      currentEntry: updated,
      entries: state.entries.map((e) => (e.id === updated.id ? toListItem(updated) : e)),
    }));
    await saveEntry(updated, userId);
  },

  deleteEntry: async (entryId, userId, online) => {
    if (online) {
      await markEntryDeleted(entryId);
    } else {
      await deleteEntryLocal(entryId);
    }
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== entryId),
      currentEntry: state.currentEntry?.id === entryId ? null : state.currentEntry,
    }));
  },

  updateBlock: async (entryId, blockId, updates, userId) => {
    const { currentEntry } = get();
    if (!currentEntry || currentEntry.id !== entryId) return;

    const newBlocks = currentEntry.blocks.map((b) =>
      b.id === blockId ? ({ ...b, ...updates } as EntryBlock) : b
    );
    const updated: StoredJournalEntry = {
      ...currentEntry,
      blocks: newBlocks,
      syncStatus: currentEntry.syncStatus === "synced" ? "pending_update" : currentEntry.syncStatus,
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      currentEntry: updated,
      entries: state.entries.map((e) => (e.id === entryId ? toListItem(updated) : e)),
    }));
    await saveEntry(updated, userId);
  },

  setParagraphAnalysis: async (entryId, paragraphId, analysis, analyzedText, userId) => {
    const { currentEntry } = get();
    if (!currentEntry || currentEntry.id !== entryId) return;

    const newBlocks = currentEntry.blocks.map((b) => {
      if (b.id !== paragraphId || b.type !== "text") return b;
      return { ...b, analysis, analyzedText, discussion: undefined };
    });
    const updated: StoredJournalEntry = {
      ...currentEntry,
      blocks: newBlocks,
      syncStatus: currentEntry.syncStatus === "synced" ? "pending_update" : currentEntry.syncStatus,
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      currentEntry: updated,
      entries: state.entries.map((e) => (e.id === entryId ? toListItem(updated) : e)),
    }));
    await saveEntry(updated, userId);
  },

  clearCurrentEntry: () => set({ currentEntry: null }),
}));
