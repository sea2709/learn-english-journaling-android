/**
 * AI prompt logic ported from the web app's src/lib/ai.ts.
 * Adapted for local llama.cpp inference (no AI SDK dependencies).
 */
import { z } from "zod";
import {
  DEFAULT_ANALYSIS_PREFERENCES,
  formatFocusAreasSummary,
} from "./analysis-preferences";
import type {
  AnalysisPreferences,
  AnalysisResult,
  Suggestion,
  SuggestionMessage,
} from "./types";

const FOCUS_BULLETS: Record<AnalysisPreferences["focusAreas"][number], string> = {
  grammar: "Grammar errors and fixes",
  spelling: "Spelling — misspelled words, typos, and incorrect letter order",
  tone: "Tone (formal, casual, neutral, or mixed)",
  "word-choice": "Word choice — suggest more natural or precise alternatives",
  naturalness: "Naturalness — phrases that sound translated or awkward",
  punctuation: "Punctuation and sentence flow",
};

export const analysisSchema = z.object({
  correctedText: z.string(),
  tone: z.enum(["formal", "casual", "neutral", "mixed"]),
  grammarScore: z.number().min(0).max(100),
  summary: z.string(),
  suggestions: z.array(
    z.object({
      category: z.enum([
        "grammar",
        "spelling",
        "tone",
        "word-choice",
        "naturalness",
        "punctuation",
      ]),
      original: z.string(),
      suggestion: z.string(),
      explanation: z.string(),
    })
  ),
});

export type RawAnalysisResult = z.infer<typeof analysisSchema>;

export function buildAnalysisPrompt(
  preferences: AnalysisPreferences,
  mode: "paragraph" | "entry"
): string {
  const focusList = preferences.focusAreas
    .map((area, index) => `${index + 1}. ${FOCUS_BULLETS[area]}`)
    .join("\n");

  const cohesionNote =
    mode === "entry" && preferences.focusAreas.length >= 2
      ? "\n6. Flow and cohesion between paragraphs"
      : "";

  const customNote = preferences.customNote
    ? `\n\nThe learner's goal: ${preferences.customNote}`
    : "";

  const scope =
    mode === "entry"
      ? "Review the user's full journal entry (multiple paragraphs)"
      : "Analyze the user's paragraph";

  const suggestionRange =
    mode === "entry" ? "5-12 suggestions spanning the entry" : "3-8 suggestions";
  const minimumSuggestions = mode === "entry" ? 3 : 2;

  return `You are an expert English language coach helping non-native speakers improve their journal writing.

${scope} and return structured feedback focused on:
${focusList}${cohesionNote}

Only provide suggestions in these focus areas: ${formatFocusAreasSummary(preferences.focusAreas)}.
Do not include suggestions outside the selected focus areas.

Be encouraging but precise. Prioritize changes that make the writing sound more natural to native English speakers.

For each suggestion, "original" MUST be an exact contiguous substring copied from the user's text (same spelling, spacing, and punctuation). Do not paraphrase, summarize, or invent a label like "overall tone". If you cannot quote a specific span, omit that suggestion.

Include ${suggestionRange}. If the text is already excellent, still provide at least ${minimumSuggestions} minor polish suggestions.${customNote}

Respond ONLY with a valid JSON object matching this schema:
{
  "correctedText": string,
  "tone": "formal" | "casual" | "neutral" | "mixed",
  "grammarScore": number (0-100),
  "summary": string,
  "suggestions": [
    {
      "category": "grammar" | "spelling" | "tone" | "word-choice" | "naturalness" | "punctuation",
      "original": string,
      "suggestion": string,
      "explanation": string
    }
  ]
}`;
}

export function buildSuggestionDiscussionPrompt(
  paragraphText: string,
  suggestion: Pick<Suggestion, "category" | "original" | "suggestion" | "explanation">,
  preferences: AnalysisPreferences
): string {
  const customNote = preferences.customNote
    ? `\nThe learner's goal: ${preferences.customNote}`
    : "";

  return `You are an expert English language coach helping a non-native speaker understand one specific writing suggestion.

Stay focused on this single suggestion. Be concise (a few short paragraphs at most), encouraging, and precise. Explain why the change helps and when to use the suggested form. Do not invent unrelated corrections or rewrite the whole paragraph unless the learner asks.

Paragraph the learner wrote:
"""
${paragraphText}
"""

Suggestion category: ${suggestion.category}
Original: ${suggestion.original}
Suggested: ${suggestion.suggestion}
Explanation: ${suggestion.explanation}${customNote}`;
}

export function buildParagraphDiscussionPrompt(
  paragraphText: string,
  analysis: AnalysisResult | null | undefined,
  preferences: AnalysisPreferences
): string {
  const customNote = preferences.customNote
    ? `\nThe learner's goal: ${preferences.customNote}`
    : "";

  let analysisContext = "";
  if (analysis) {
    const suggestionLines = analysis.suggestions
      .slice(0, 8)
      .map(
        (item) =>
          `- [${item.category}] "${item.original}" → "${item.suggestion}": ${item.explanation}`
      )
      .join("\n");

    analysisContext = `

Optional Review notes for this paragraph (use when relevant; do not invent extras):
Tone: ${analysis.tone}
Grammar score: ${analysis.grammarScore}/100
Summary: ${analysis.summary}
Polished version:
"""
${analysis.correctedText}
"""
Suggestions:
${suggestionLines || "(none)"}`;
  }

  return `You are an expert English language coach helping a non-native speaker improve one journal paragraph.

Answer questions about the whole paragraph: meaning, clarity, tone, structure, vocabulary, or how to improve it. Be concise (a few short paragraphs at most), encouraging, and precise. Stay focused on this paragraph. Do not invent unrelated corrections unless the learner asks.

Paragraph the learner wrote:
"""
${paragraphText}
"""${analysisContext}${customNote}`;
}

export function filterSuggestions(
  result: RawAnalysisResult,
  preferences: AnalysisPreferences
): RawAnalysisResult {
  const allowed = new Set(preferences.focusAreas);
  return {
    ...result,
    suggestions: result.suggestions.filter((s) => allowed.has(s.category)),
  };
}

export function withSuggestionIds(result: RawAnalysisResult): AnalysisResult {
  return {
    ...result,
    suggestions: result.suggestions.map((s) => ({
      ...s,
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    })),
  };
}

export function extractFirstJsonValue(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.search(/[{[]/);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) {
        const candidate = trimmed.slice(start, i + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function repairStructuredOutputText(text: string): string | null {
  const withoutFences = text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```[\s\S]*$/, "")
    .trim();

  for (const candidate of [withoutFences, text.trim()]) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      const extracted = extractFirstJsonValue(candidate);
      if (extracted) return extracted;
    }
  }
  return null;
}

export function parseAnalysisOutput(
  raw: string,
  preferences: AnalysisPreferences = DEFAULT_ANALYSIS_PREFERENCES
): AnalysisResult {
  const repaired = repairStructuredOutputText(raw);
  if (!repaired) throw new Error("Could not parse model output as JSON");

  const parsed = JSON.parse(repaired);
  const validated = analysisSchema.parse(parsed);
  return withSuggestionIds(filterSuggestions(validated, preferences));
}

export function buildDiscussionMessages(
  systemPrompt: string,
  messages: SuggestionMessage[]
): Array<{ role: string; content: string }> {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}
