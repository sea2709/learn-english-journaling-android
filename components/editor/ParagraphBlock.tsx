import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  LayoutAnimation,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
} from "react-native";
import type { JournalParagraph, Suggestion, AnalysisPreferences } from "../../lib/types";
import { isParagraphStale } from "../../lib/entry-utils";
import { MAX_PARAGRAPH_CHARS } from "../../lib/ai";
import { formatFocusAreasSummary } from "../../lib/analysis-preferences";
import { SuggestionRow } from "./SuggestionRow";
import { DiscussionThread } from "./DiscussionThread";
import { colors, fonts } from "../../lib/theme";
import { PillButton, scoreToDisplay } from "../common/ui";

const PARAGRAPH_FONT_SIZE = 16;
const PARAGRAPH_LINE_HEIGHT = 28;
/** Match web `py-1`. */
const PARAGRAPH_VERTICAL_PADDING = 4;
/** Empty / short paragraphs start at two lines of writing space. */
const PARAGRAPH_MIN_HEIGHT =
  PARAGRAPH_LINE_HEIGHT * 2 + PARAGRAPH_VERTICAL_PADDING * 2;

interface Props {
  paragraph: JournalParagraph;
  index: number;
  preferences: AnalysisPreferences;
  autoFocus?: boolean;
  onTextChange: (text: string) => void;
  onAnalyze: () => Promise<void>;
  onSuggestionUpdate: (suggestion: Suggestion) => void;
  onDiscussionChange: (messages: JournalParagraph["discussion"]) => void;
  onSplit: (cursorPos: number) => void;
  onRemoveEmpty: () => void;
  onFocusBlock: () => void;
}

/** Detect a single inserted newline (Return), not a multi-line paste. */
function findSingleInsertedNewline(prev: string, next: string): number | null {
  if (next.length !== prev.length + 1) return null;
  let i = 0;
  while (i < prev.length && prev[i] === next[i]) i += 1;
  if (next[i] !== "\n") return null;
  if (next.slice(0, i) + next.slice(i + 1) !== prev) return null;
  return i;
}

export function ParagraphBlock({
  paragraph,
  index,
  preferences,
  autoFocus = false,
  onTextChange,
  onAnalyze,
  onSuggestionUpdate,
  onDiscussionChange,
  onSplit,
  onRemoveEmpty,
  onFocusBlock,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const splitAtRef = useRef(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const isStale = isParagraphStale(paragraph);
  const hasAnalysis = paragraph.analysis !== null;
  const noteCount = paragraph.analysis?.suggestions.length ?? 0;
  const hasText = paragraph.text.trim().length > 0;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus, paragraph.id]);

  function splitAt(cursorPos: number) {
    const now = Date.now();
    if (now - splitAtRef.current < 300) return;
    splitAtRef.current = now;
    onSplit(cursorPos);
  }

  function handleTextChange(text: string) {
    const insertedAt = findSingleInsertedNewline(paragraph.text, text);
    if (insertedAt !== null) {
      splitAt(insertedAt);
      return;
    }
    // Drop the IME's leftover "\n" update after Enter already split the block.
    if (Date.now() - splitAtRef.current < 300 && text.includes("\n")) return;
    onTextChange(text);
  }

  function handleSubmitEditing() {
    splitAt(selectionRef.current.start);
  }

  function handleSelectionChange(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) {
    selectionRef.current = e.nativeEvent.selection;
  }

  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (
      e.nativeEvent.key === "Backspace" &&
      paragraph.text === "" &&
      selectionRef.current.start === 0 &&
      selectionRef.current.end === 0
    ) {
      onRemoveEmpty();
    }
  }

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
      <View
        className="absolute left-0 h-[18px] w-1 rounded-sm bg-pen/45"
        style={{ top: 14 + PARAGRAPH_VERTICAL_PADDING }}
      />
      <TextInput
        ref={inputRef}
        className="text-ink-900"
        style={{
          backgroundColor: colors.paper,
          fontFamily: fonts.mono,
          fontSize: PARAGRAPH_FONT_SIZE,
          lineHeight: PARAGRAPH_LINE_HEIGHT,
          minHeight: PARAGRAPH_MIN_HEIGHT,
          paddingHorizontal: 0,
          paddingTop: PARAGRAPH_VERTICAL_PADDING,
          paddingBottom: PARAGRAPH_VERTICAL_PADDING,
        }}
        value={paragraph.text}
        onChangeText={handleTextChange}
        onFocus={onFocusBlock}
        onSubmitEditing={handleSubmitEditing}
        onSelectionChange={handleSelectionChange}
        onKeyPress={handleKeyPress}
        autoFocus={autoFocus}
        blurOnSubmit={false}
        submitBehavior="submit"
        placeholder={
          index === 0
            ? "Start writing… Enter for a new paragraph."
            : "Continue writing…"
        }
        placeholderTextColor={colors.ink300}
        selectionColor={colors.penMuted}
        cursorColor={colors.pen}
        underlineColorAndroid="transparent"
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
            <PillButton
              label="Ask questions"
              onPress={() => setShowDiscussion((v) => !v)}
            />
            <PillButton
              label={analyzing ? "Reviewing" : hasAnalysis ? "Re-review" : "Review"}
              onPress={handleAnalyze}
              loading={analyzing}
              penAccent
            />
          </View>
        </View>
      )}

      {hasText && showDiscussion && (
        <DiscussionThread
          paragraphText={paragraph.text}
          analysis={paragraph.analysis}
          messages={paragraph.discussion ?? []}
          preferences={preferences}
          onMessagesChange={(msgs) => onDiscussionChange(msgs)}
        />
      )}

      {hasText && (
        <Text className="mt-2 text-xs text-ink-400">
          Review focus: {formatFocusAreasSummary(preferences.focusAreas)}
        </Text>
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
