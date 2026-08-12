import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import type { Suggestion, SuggestionMessage, AnalysisPreferences } from "../../lib/types";
import {
  MAX_SUGGESTION_DISCUSSION_MESSAGES,
  MAX_SUGGESTION_MESSAGE_LENGTH,
} from "../../lib/suggestion-discussion";
import { discussSuggestion } from "../../lib/ai";
import { colors, cx } from "../../lib/theme";

interface Props {
  suggestion: Suggestion;
  paragraphText: string;
  preferences: AnalysisPreferences;
  onUpdate: (updated: Suggestion) => void;
}

export function SuggestionRow({ suggestion, paragraphText, preferences, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messages: SuggestionMessage[] = suggestion.discussion ?? [];
  const canSend =
    input.trim().length > 0 &&
    input.length <= MAX_SUGGESTION_MESSAGE_LENGTH &&
    messages.length < MAX_SUGGESTION_DISCUSSION_MESSAGES;

  async function handleSend() {
    if (!canSend) return;
    const userMsg: SuggestionMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    onUpdate({ ...suggestion, discussion: newMessages });
    setInput("");
    setLoading(true);
    try {
      const reply = await discussSuggestion({
        paragraphText,
        suggestion,
        messages: newMessages,
        preferences,
      });
      onUpdate({
        ...suggestion,
        discussion: [...newMessages, { role: "assistant", content: reply }],
      });
    } catch {
      onUpdate({ ...suggestion, discussion: newMessages });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="border-b border-paper-line py-3">
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View className="mb-1 flex-row items-center">
          <Text className="mr-auto text-[11px] font-bold uppercase tracking-wide text-pen">
            {suggestion.category}
          </Text>
          <Text className="text-xs text-ink-400">{expanded ? "▾" : "▸"}</Text>
        </View>
        <Text
          className="text-sm leading-5 text-ink-800"
          numberOfLines={expanded ? undefined : 2}
        >
          {suggestion.original}
        </Text>
        {expanded && (
          <>
            <Text className="mt-1.5 font-mono text-sm leading-5 text-sage-700">
              → {suggestion.suggestion}
            </Text>
            <Text className="mt-2 text-[13px] leading-[19px] text-ink-600">
              {suggestion.explanation}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {expanded && (
        <View className="mt-3 gap-2">
          {messages.map((m, i) => (
            <View
              key={i}
              className={cx(
                "rounded-xl p-2.5",
                m.role === "user"
                  ? "max-w-[92%] self-end bg-ink-100/70"
                  : "max-w-[92%] self-start bg-sage-50/90"
              )}
            >
              <Text className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                {m.role === "user" ? "You" : "Coach"}
              </Text>
              <Text className="text-[13px] leading-[19px] text-ink-800">{m.content}</Text>
            </View>
          ))}

          {loading && (
            <View className="max-w-[92%] self-start rounded-xl bg-sage-50/90 p-2.5">
              <ActivityIndicator size="small" color={colors.pen} />
            </View>
          )}

          {messages.length < MAX_SUGGESTION_DISCUSSION_MESSAGES && (
            <View className="flex-row items-end gap-2">
              <TextInput
                className="max-h-20 flex-1 rounded-xl border border-ink-200 bg-white px-2.5 py-2 text-[13px] text-ink-900"
                placeholder="Why is this better?"
                placeholderTextColor={colors.ink300}
                value={input}
                onChangeText={setInput}
                maxLength={MAX_SUGGESTION_MESSAGE_LENGTH}
                multiline
                editable={!loading}
              />
              <TouchableOpacity
                className={cx(
                  "h-9 w-9 items-center justify-center rounded-full bg-pen",
                  !canSend && "bg-ink-300"
                )}
                onPress={handleSend}
                disabled={!canSend || loading}
              >
                <Text className="text-base font-bold text-white">↑</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
