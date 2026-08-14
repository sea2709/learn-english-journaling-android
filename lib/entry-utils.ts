import type {
  EntryBlock,
  JournalEntryListItem,
  JournalImageBlock,
  JournalParagraph,
  StoredJournalEntry,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function randomUuidV4(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newEntityId(): string {
  return randomUuidV4();
}

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function createParagraph(text = ""): JournalParagraph {
  return {
    type: "text",
    id: newEntityId(),
    text,
    analysis: null,
    analyzedText: null,
  };
}

export function createImageBlock(path: string): JournalImageBlock {
  return {
    type: "image",
    id: newEntityId(),
    path,
  };
}

export function isTextBlock(block: EntryBlock): block is JournalParagraph {
  return block.type === "text";
}

export function isImageBlock(block: EntryBlock): block is JournalImageBlock {
  return block.type === "image";
}

export function getTextBlocks(blocks: EntryBlock[]): JournalParagraph[] {
  return blocks.filter(isTextBlock);
}

export function getImageBlocks(blocks: EntryBlock[]): JournalImageBlock[] {
  return blocks.filter(isImageBlock);
}

export function isParagraphStale(paragraph: JournalParagraph): boolean {
  if (!paragraph.analysis || !paragraph.analyzedText) return false;
  return paragraph.text.trim() !== paragraph.analyzedText;
}

export function getAnalyzedParagraphs(blocks: EntryBlock[]): JournalParagraph[] {
  return getTextBlocks(blocks).filter((p) => p.analysis !== null);
}

export function getAverageGrammarScore(blocks: EntryBlock[]): number | null {
  const analyzed = getAnalyzedParagraphs(blocks);
  if (analyzed.length === 0) return null;
  const total = analyzed.reduce((sum, p) => sum + (p.analysis?.grammarScore ?? 0), 0);
  return Math.round(total / analyzed.length);
}

export function getLatestTone(blocks: EntryBlock[]): string {
  const textBlocks = getTextBlocks(blocks);
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const tone = textBlocks[i].analysis?.tone;
    if (tone) return tone;
  }
  return "";
}

export function toListItem(entry: StoredJournalEntry): JournalEntryListItem {
  const textBlocks = getTextBlocks(entry.blocks);
  return {
    id: entry.id,
    title: entry.title,
    date: entry.date,
    grammarScore: getAverageGrammarScore(entry.blocks),
    tone: getLatestTone(entry.blocks),
    paragraphCount: textBlocks.length,
    status: entry.status,
    syncStatus: entry.syncStatus,
  };
}

export function hasAnalyzableContent(blocks: EntryBlock[]): boolean {
  return getTextBlocks(blocks).some((p) => p.text.trim().length > 0);
}

export function canSaveEntry(blocks: EntryBlock[]): boolean {
  return hasAnalyzableContent(blocks);
}

export function formatTodayDisplay(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function findTodaysEntry(
  entries: JournalEntryListItem[]
): JournalEntryListItem | null {
  const today = formatTodayISO();
  return entries.find((entry) => entry.date === today) ?? null;
}

export interface EntryMonthGroup {
  key: string;
  label: string;
  entries: JournalEntryListItem[];
}

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function monthKeyFromDate(dateStr: string): string {
  if (!dateStr) return "unknown";
  const key = dateStr.slice(0, 7);
  return MONTH_KEY_RE.test(key) ? key : "unknown";
}

function formatMonthLabel(key: string): string {
  if (key === "unknown") return "No date";
  const date = new Date(`${key}-01T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function groupEntriesByMonth(entries: JournalEntryListItem[]): EntryMonthGroup[] {
  const groups = new Map<string, JournalEntryListItem[]>();

  for (const entry of entries) {
    const key = monthKeyFromDate(entry.date);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  return [...groups.entries()]
    .map(([key, monthEntries]) => ({
      key,
      label: formatMonthLabel(key),
      entries: [...monthEntries].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    }))
    .sort((a, b) => {
      if (a.key === "unknown") return 1;
      if (b.key === "unknown") return -1;
      return b.key.localeCompare(a.key);
    });
}
