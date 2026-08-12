import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  LayoutAnimation,
} from "react-native";
import type { JournalParagraph, Suggestion, AnalysisPreferences } from "../../lib/types";
import { isParagraphStale } from "../../lib/entry-utils";
import { MAX_PARAGRAPH_CHARS } from "../../lib/ai";
import { formatFocusAreasSummary } from "../../lib/analysis-preferences";
import { SuggestionRow } from "./SuggestionRow";
import { DiscussionThread } from "./DiscussionThread";
import { colors } from "../../lib/theme";
import { PillButton, scoreToDisplay } from "../common/ui";

interface Props {
  paragraph: JournalParagraph;
  preferences: AnalysisPreferences;
  onTextChange: (text: string) => void;
  onAnalyze: () => Promise<void>;
  onSuggestionUpdate: (suggestion: Suggestion) => void;
  onDiscussionChange: (messages: JournalParagraph["discussion"]) => void;
  onDelete: () => void;
}

export function ParagraphBlock({
  paragraph,
  preferences,
  onTextChange,
  onAnalyze,
  onSuggestionUpdate,
  onDiscussionChange,
  onDelete,
}: Props) {
  const [analyzing, setAnalyzing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const isStale = isParagraphStale(paragraph);
  const hasAnalysis = paragraph.analysis !== null;
  const noteCount = paragraph.analysis?.suggestions.length ?? 0;
  const hasText = paragraph.text.trim().length > 0;

  async function handleAnalyze() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAnalyzing(true);
    try {
      await onAnalyze();
      setNotesOpen(true);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <View className="relative mb-6 pl-3.5">
      <View className="absolute left-0 top-3.5 h-[18px] w-1 rounded-sm bg-pen/45" />
      <TextInput
        className="min-h-[88px] p-0 font-mono text-base leading-7 text-ink-900"
        value={paragraph.text}
        onChangeText={onTextChange}
        placeholder="Start writing… Enter for a new paragraph."
        placeholderTextColor={colors.ink300}
        multiline
        maxLength={MAX_PARAGRAPH_CHARS}
        textAlignVertical="top"
      />

      {hasText && (
        <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
          {isStale ? (
            <Text className="text-[11px] font-semibold text-pen-muted">edited</Text>
          ) : (
            <View />
          )}
          <View className="flex-row flex-wrap items-center gap-2">
            <TouchableOpacity onPress={onDelete} hitSlop={8}>
              <Text className="px-1 text-[13px] text-coral-700">Delete</Text>
            </TouchableOpacity>
            {hasAnalysis && (
              <PillButton
                label="Ask questions"
                onPress={() => setShowDiscussion((v) => !v)}
              />
            )}
            <PillButton
              label={analyzing ? "Reviewing" : hasAnalysis ? "Re-review" : "Review"}
              onPress={handleAnalyze}
              loading={analyzing}
              penAccent
            />
          </View>
        </View>
      )}

      {hasText && (
        <Text className="mt-2 text-xs text-ink-400">
          Review focus: {formatFocusAreasSummary(preferences.focusAreas)}
        </Text>
      )}

      {showDiscussion && (
        <DiscussionThread
          paragraphText={paragraph.text}
          analysis={paragraph.analysis}
          messages={paragraph.discussion ?? []}
          preferences={preferences}
          onMessagesChange={(msgs) => onDiscussionChange(msgs)}
        />
      )}

      {hasAnalysis && paragraph.analysis && (
        <View className="mt-3.5 border-l-2 border-pen/30 pl-3">
          <TouchableOpacity
            className="mb-2 flex-row items-center"
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setNotesOpen((v) => !v);
            }}
          >
            <Text className="mr-auto text-[11px] font-bold uppercase tracking-wide text-pen">
              {noteCount} note{noteCount !== 1 ? "s" : ""}
            </Text>
            <Text className="text-xs text-ink-400">{notesOpen ? "▾" : "▸"}</Text>
          </TouchableOpacity>

          {notesOpen && (
            <View>
              <View className="mb-2 flex-row items-center gap-2.5">
                <Text className="text-xs font-semibold text-ink-700">
                  Score {scoreToDisplay(paragraph.analysis.grammarScore)}/10
                </Text>
                <Text className="overflow-hidden rounded bg-paper-dark px-2 py-0.5 text-[11px] capitalize text-ink-600">
                  {paragraph.analysis.tone}
                </Text>
              </View>

              {paragraph.analysis.summary ? (
                <Text className="mb-2.5 text-[13px] leading-5 text-ink-700">
                  {paragraph.analysis.summary}
                </Text>
              ) : null}

              {paragraph.analysis.correctedText ? (
                <View className="mb-3">
                  <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
                    Polished version
                  </Text>
                  <Text className="font-mono text-[13px] leading-5 text-ink-700">
                    {paragraph.analysis.correctedText}
                  </Text>
                </View>
              ) : null}

              {paragraph.analysis.suggestions.map((s) => (
                <SuggestionRow
                  key={s.id}
                  suggestion={s}
                  paragraphText={paragraph.text}
                  preferences={preferences}
                  onUpdate={onSuggestionUpdate}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
