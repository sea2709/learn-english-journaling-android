export type SuggestionCategory =
  | "grammar"
  | "spelling"
  | "tone"
  | "word-choice"
  | "naturalness"
  | "punctuation";

export type AnalysisFocusArea = SuggestionCategory;

export interface AnalysisPreferences {
  focusAreas: AnalysisFocusArea[];
  customNote?: string;
}

export interface SuggestionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Suggestion {
  /** Assigned by the app after analysis; not produced by the model. */
  id: string;
  category: SuggestionCategory;
  original: string;
  suggestion: string;
  explanation: string;
  /** Per-suggestion follow-up chat; cleared when the paragraph is re-Reviewed. */
  discussion?: SuggestionMessage[];
}

export interface AnalysisResult {
  correctedText: string;
  tone: "formal" | "casual" | "neutral" | "mixed";
  grammarScore: number;
  summary: string;
  suggestions: Suggestion[];
}

export type EntryReviewResult = AnalysisResult;

export interface JournalParagraph {
  type: "text";
  id: string;
  text: string;
  analysis: AnalysisResult | null;
  analyzedText: string | null;
  /** Paragraph-level follow-up chat; persists across re-Review. */
  discussion?: SuggestionMessage[];
}

export interface JournalImageBlock {
  type: "image";
  id: string;
  path: string;
}

export type EntryBlock = JournalParagraph | JournalImageBlock;

export type SyncStatus = "synced" | "pending_create" | "pending_update" | "pending_delete";

export interface StoredJournalEntry {
  id: string;
  title: string;
  date: string;
  blocks: EntryBlock[];
  status: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}

export interface JournalEntryListItem {
  id: string;
  title: string;
  date: string;
  grammarScore: number | null;
  tone: string;
  paragraphCount: number;
  status: string;
  syncStatus: SyncStatus;
}

export type FeedbackCategory = "bug" | "idea" | "other";

export interface UserFeedbackSubmission {
  category: FeedbackCategory;
  message: string;
  contactNote?: string;
}
