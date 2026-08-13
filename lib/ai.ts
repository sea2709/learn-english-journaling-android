/**
 * App-side AI layer.
 * Dispatches to on-device LlamaCpp (local) or the web app API (api).
 */
import {
  buildAnalysisPrompt,
  buildParagraphDiscussionPrompt,
  buildSuggestionDiscussionPrompt,
  filterSuggestions,
  parseAnalysisOutput,
  withSuggestionIds,
} from "./ai-prompts";
import {
  analyzeEntryReview as apiAnalyzeEntryReview,
  analyzeText as apiAnalyzeText,
  askAboutParagraph as apiAskAboutParagraph,
  askAboutSuggestion as apiAskAboutSuggestion,
  isWebApiConfigured,
} from "./ai-api";
import { DEFAULT_ANALYSIS_PREFERENCES } from "./analysis-preferences";
import { useAiModeStore } from "../store/ai-mode";
import type {
  AnalysisPreferences,
  AnalysisResult,
  Suggestion,
  SuggestionMessage,
} from "./types";

// Maximum input lengths (same as web app constraints for paragraphs)
export const MAX_PARAGRAPH_CHARS = 5000;
export const MAX_ENTRY_CHARS = 12000;

/**
 * Native LlamaCpp module interface.
 * Implemented in modules/llama-cpp/ as a custom Expo Module.
 */
let LlamaCpp: {
  loadModel: (modelPath: string) => Promise<void>;
  generate: (prompt: string, grammar?: string) => Promise<string>;
  freeModel: () => Promise<void>;
  isModelLoaded: () => Promise<boolean>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LlamaCpp = require("../modules/llama-cpp").default;
} catch {
  // Module not available (dev without native build)
}

export function isModelAvailable(): boolean {
  return LlamaCpp !== null;
}

function requireLocalMode(): void {
  const { mode } = useAiModeStore.getState();
  if (mode !== "local") {
    throw new Error("On-device model is only available when local AI is selected.");
  }
}

async function generateLocal(prompt: string): Promise<string> {
  if (!LlamaCpp) {
    throw new Error(
      "LlamaCpp native module not available. Run a native build (expo run:android)."
    );
  }
  const isLoaded = await LlamaCpp.isModelLoaded();
  if (!isLoaded) {
    throw new Error("Model not loaded. Please download the model first.");
  }
  return LlamaCpp.generate(prompt);
}

export async function loadModel(modelPath: string): Promise<void> {
  if (!LlamaCpp) throw new Error("LlamaCpp native module not available.");
  await LlamaCpp.loadModel(modelPath);
}

export async function freeModel(): Promise<void> {
  if (!LlamaCpp) return;
  await LlamaCpp.freeModel();
}

export async function isModelLoaded(): Promise<boolean> {
  if (!LlamaCpp) return false;
  return LlamaCpp.isModelLoaded();
}

/** True when the selected AI backend can run a real (non-mock) request. */
export async function isAiReady(): Promise<boolean> {
  const { mode, chosen } = useAiModeStore.getState();
  if (!chosen || !mode) return false;
  if (mode === "api") return isWebApiConfigured();
  return isModelLoaded();
}

export function getActiveAiMode() {
  return useAiModeStore.getState().mode;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function analyzeParagraph(
  text: string,
  preferences: AnalysisPreferences = DEFAULT_ANALYSIS_PREFERENCES
): Promise<AnalysisResult> {
  const capped = text.slice(0, MAX_PARAGRAPH_CHARS);
  const mode = useAiModeStore.getState().mode;

  if (mode === "api") {
    const { analysis } = await apiAnalyzeText(capped, preferences);
    return analysis;
  }

  requireLocalMode();
  const systemPrompt = buildAnalysisPrompt(preferences, "paragraph");
  const prompt = `${systemPrompt}\n\nPlease analyze this journal paragraph:\n\n${capped}`;
  const raw = await generateLocal(prompt);
  return parseAnalysisOutput(raw, preferences);
}

export async function reviewEntry(
  text: string,
  preferences: AnalysisPreferences = DEFAULT_ANALYSIS_PREFERENCES
): Promise<AnalysisResult> {
  const capped = text.slice(0, MAX_ENTRY_CHARS);
  const mode = useAiModeStore.getState().mode;

  if (mode === "api") {
    const { review } = await apiAnalyzeEntryReview(capped, preferences);
    return review;
  }

  requireLocalMode();
  const systemPrompt = buildAnalysisPrompt(preferences, "entry");
  const prompt = `${systemPrompt}\n\nPlease review this full journal entry:\n\n${capped}`;
  const raw = await generateLocal(prompt);
  return parseAnalysisOutput(raw, preferences);
}

export async function discussSuggestion(params: {
  paragraphText: string;
  suggestion: Pick<
    Suggestion,
    "id" | "category" | "original" | "suggestion" | "explanation"
  >;
  messages: SuggestionMessage[];
  preferences?: AnalysisPreferences;
}): Promise<string> {
  const preferences = params.preferences ?? DEFAULT_ANALYSIS_PREFERENCES;
  const mode = useAiModeStore.getState().mode;

  if (mode === "api") {
    const { reply } = await apiAskAboutSuggestion({
      paragraphText: params.paragraphText,
      suggestion: params.suggestion,
      messages: params.messages,
      preferences,
    });
    return reply;
  }

  requireLocalMode();
  const systemPrompt = buildSuggestionDiscussionPrompt(
    params.paragraphText,
    params.suggestion,
    preferences
  );
  const history = params.messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  const prompt = `${systemPrompt}\n\nConversation so far:\n${history}\n\nAssistant:`;
  return generateLocal(prompt);
}

export async function discussParagraph(params: {
  paragraphText: string;
  analysis?: AnalysisResult | null;
  messages: SuggestionMessage[];
  preferences?: AnalysisPreferences;
}): Promise<string> {
  const preferences = params.preferences ?? DEFAULT_ANALYSIS_PREFERENCES;
  const mode = useAiModeStore.getState().mode;

  if (mode === "api") {
    const { reply } = await apiAskAboutParagraph({
      paragraphText: params.paragraphText,
      analysis: params.analysis,
      messages: params.messages,
      preferences,
    });
    return reply;
  }

  requireLocalMode();
  const systemPrompt = buildParagraphDiscussionPrompt(
    params.paragraphText,
    params.analysis,
    preferences
  );
  const history = params.messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  const prompt = `${systemPrompt}\n\nConversation so far:\n${history}\n\nAssistant:`;
  return generateLocal(prompt);
}

// ── Mock helpers for UI development without model ────────────────────────────

export function getMockAnalysis(
  text: string,
  preferences: AnalysisPreferences = DEFAULT_ANALYSIS_PREFERENCES
): AnalysisResult {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const result = withSuggestionIds(
    filterSuggestions(
      {
        correctedText: text,
        tone: "neutral",
        grammarScore: 75,
        summary:
          "Demo analysis. Build with native module and download Gemma model to get real AI feedback.",
        suggestions: words.slice(0, Math.min(3, words.length)).map((w, i) => ({
          category: preferences.focusAreas[i % preferences.focusAreas.length] ?? "grammar",
          original: w,
          suggestion: `${w}…`,
          explanation: "Demo suggestion. Connect AI model for real feedback.",
        })),
      },
      preferences
    )
  );
  return result;
}
