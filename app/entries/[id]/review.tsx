import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useEntriesStore } from "../../../store/entries";
import { usePreferencesStore } from "../../../store/preferences";
import { reviewEntry, getMockAnalysis, getActiveAiMode, isAiReady } from "../../../lib/ai";
import { getTextBlocks } from "../../../lib/entry-utils";
import { formatFocusAreasSummary } from "../../../lib/analysis-preferences";
import type { AnalysisResult, Suggestion } from "../../../lib/types";
import { SuggestionRow } from "../../../components/editor/SuggestionRow";
import { colors } from "../../../lib/theme";
import { PaperLoading, PillButton, ScoreRing } from "../../../components/common/ui";

export default function EntryReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentEntry, loadEntry } = useEntriesStore();
  const { preferences } = usePreferencesStore();

  const [review, setReview] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [started, setStarted] = useState(false);

  const entry = currentEntry?.id === id ? currentEntry : null;
  const focusSummary = formatFocusAreasSummary(preferences.focusAreas);

  useEffect(() => {
    if (id && !entry) loadEntry(id);
  }, [id]);

  useEffect(() => {
    if (entry && !started) {
      setStarted(true);
      runReview();
    }
  }, [entry]);

  async function runReview() {
    if (!entry) return;
    const textBlocks = getTextBlocks(entry.blocks);
    const fullText = textBlocks.map((b) => b.text).join("\n\n");
    if (!fullText.trim()) return;

    setLoading(true);
    try {
      const ready = await isAiReady();
      if (!ready && getActiveAiMode() === "api") {
        Alert.alert(
          "Cloud AI unavailable",
          "Set EXPO_PUBLIC_WEB_API_URL to your web app URL, then restart the app."
        );
        return;
      }
      const result = ready
        ? await reviewEntry(fullText, preferences)
        : getMockAnalysis(fullText, preferences);
      setReview(result);
      setSuggestions(result.suggestions);
    } catch (e) {
      Alert.alert("Review failed", e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (!entry) return <PaperLoading />;

  const combinedText = getTextBlocks(entry.blocks)
    .map((b) => b.text)
    .join("\n\n");

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="p-5 pb-12">
      {loading ? (
        <View className="min-h-[200px] items-center gap-2.5 pt-12">
          <ActivityIndicator size="large" color={colors.pen} />
          <Text className="font-display text-[15px] font-semibold text-ink-700">
            Reviewing your entry…
          </Text>
          <Text className="text-center text-xs text-ink-500">
            Focusing on {focusSummary.toLowerCase()}
          </Text>
        </View>
      ) : !review ? (
        <View className="items-center px-3 pt-14">
          <Text className="mb-2 font-display text-lg text-ink-800">Full-entry review</Text>
          <Text className="mb-5 max-w-[320px] text-center text-sm leading-[21px] text-ink-500">
            Get AI feedback on your entire journal entry, focused on {focusSummary.toLowerCase()}.
          </Text>
          <PillButton label="Review entry" onPress={runReview} penAccent />
        </View>
      ) : (
        <>
          <View className="mb-6 flex-row items-start gap-4">
            <ScoreRing score={review.grammarScore} size="sm" />
            <View className="flex-1 pt-1">
              <View className="mb-2 self-start rounded bg-paper-dark px-2 py-0.5">
                <Text className="text-[11px] font-semibold capitalize text-ink-600">
                  {review.tone} tone
                </Text>
              </View>
              <Text className="text-sm leading-[21px] text-ink-600">{review.summary}</Text>
            </View>
          </View>

          <View className="mb-6">
            <Text className="mb-2 font-display text-[15px] text-ink-800">Polished version</Text>
            <Text className="font-mono text-sm leading-[22px] text-ink-700">
              {review.correctedText}
            </Text>
          </View>

          {suggestions.length > 0 && (
            <View className="mb-6">
              <Text className="mb-2 font-display text-[15px] text-ink-800">
                Suggestions ({suggestions.length})
              </Text>
              {suggestions.map((s) => (
                <SuggestionRow
                  key={s.id}
                  suggestion={s}
                  paragraphText={combinedText}
                  preferences={preferences}
                  onUpdate={(updated) =>
                    setSuggestions((prev) =>
                      prev.map((item) => (item.id === updated.id ? updated : item))
                    )
                  }
                />
              ))}
            </View>
          )}

          <PillButton label="Re-run review" onPress={runReview} fullWidth penAccent />
        </>
      )}
    </ScrollView>
  );
}
