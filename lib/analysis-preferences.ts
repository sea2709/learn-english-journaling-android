import { z } from "zod";
import type { AnalysisFocusArea, AnalysisPreferences, SuggestionCategory } from "./types";

export const ALL_FOCUS_AREAS: AnalysisFocusArea[] = [
  "grammar",
  "spelling",
  "tone",
  "word-choice",
  "naturalness",
  "punctuation",
];

export const DEFAULT_ANALYSIS_PREFERENCES: AnalysisPreferences = {
  focusAreas: [...ALL_FOCUS_AREAS],
};

export const FOCUS_AREA_LABELS: Record<SuggestionCategory, string> = {
  grammar: "Grammar",
  spelling: "Spelling",
  tone: "Tone",
  "word-choice": "Word choice",
  naturalness: "Naturalness",
  punctuation: "Punctuation",
};

const focusAreaSchema = z.enum([
  "grammar",
  "spelling",
  "tone",
  "word-choice",
  "naturalness",
  "punctuation",
]);

export const analysisPreferencesSchema = z.object({
  focusAreas: z
    .array(focusAreaSchema)
    .min(1, "Select at least one focus area.")
    .transform((areas) => [...new Set(areas)]),
  customNote: z
    .string()
    .trim()
    .max(300, "Learning goal must be 300 characters or fewer.")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export function parseAnalysisPreferences(value: unknown): AnalysisPreferences {
  return analysisPreferencesSchema.parse(value);
}

export function formatFocusAreasSummary(focusAreas: AnalysisFocusArea[]): string {
  return focusAreas.map((area) => FOCUS_AREA_LABELS[area]).join(", ");
}
