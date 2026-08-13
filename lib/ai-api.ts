/**
 * Client for the web app AI routes (Next.js).
 * @see https://github.com/sea2709/learn-english-journaling
 */
import type {
  AnalysisPreferences,
  AnalysisResult,
  Suggestion,
  SuggestionMessage,
} from "./types";

const WEB_API_URL = (process.env.EXPO_PUBLIC_WEB_API_URL ?? "").replace(/\/$/, "");

export class AiApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiApiError";
  }
}

export function isWebApiConfigured(): boolean {
  return WEB_API_URL.length > 0;
}

export function getWebApiBaseUrl(): string {
  if (!WEB_API_URL) {
    throw new AiApiError(
      "Cloud AI is not configured. Set EXPO_PUBLIC_WEB_API_URL to your web app URL."
    );
  }
  return WEB_API_URL;
}

async function parseResponse<T>(response: Response): Promise<T> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AiApiError(
      response.ok ? "Invalid response from AI server." : "Request failed."
    );
  }

  if (!response.ok) {
    const error =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Request failed.";
    throw new AiApiError(error);
  }

  return data as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = getWebApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function analyzeText(
  text: string,
  preferences?: AnalysisPreferences
): Promise<{ analysis: AnalysisResult; mock: boolean }> {
  const result = await postJson<{ analysis: AnalysisResult; mock: boolean }>(
    "/api/analyze",
    { text, preferences }
  );
  if (result.mock) {
    console.warn("Web AI returned mock analysis (server has no AI key configured).");
  }
  return result;
}

export async function analyzeEntryReview(
  text: string,
  preferences?: AnalysisPreferences
): Promise<{ review: AnalysisResult; mock: boolean }> {
  const result = await postJson<{ review: AnalysisResult; mock: boolean }>(
    "/api/analyze/review",
    { text, preferences }
  );
  if (result.mock) {
    console.warn("Web AI returned mock review (server has no AI key configured).");
  }
  return result;
}

export async function askAboutSuggestion(params: {
  paragraphText: string;
  suggestion: Pick<
    Suggestion,
    "id" | "category" | "original" | "suggestion" | "explanation"
  >;
  messages: SuggestionMessage[];
  preferences?: AnalysisPreferences;
}): Promise<{ reply: string; mock: boolean }> {
  const result = await postJson<{ reply: string; mock: boolean }>(
    "/api/analyze/suggestion-chat",
    params
  );
  if (result.mock) {
    console.warn("Web AI returned mock suggestion reply.");
  }
  return result;
}

export async function askAboutParagraph(params: {
  paragraphText: string;
  analysis?: AnalysisResult | null;
  messages: SuggestionMessage[];
  preferences?: AnalysisPreferences;
}): Promise<{ reply: string; mock: boolean }> {
  const result = await postJson<{ reply: string; mock: boolean }>(
    "/api/analyze/paragraph-chat",
    params
  );
  if (result.mock) {
    console.warn("Web AI returned mock paragraph reply.");
  }
  return result;
}
