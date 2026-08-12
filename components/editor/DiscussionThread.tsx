import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import type { AnalysisResult, SuggestionMessage, AnalysisPreferences } from "../../lib/types";
import {
  MAX_SUGGESTION_DISCUSSION_MESSAGES,
  MAX_SUGGESTION_MESSAGE_LENGTH,
} from "../../lib/suggestion-discussion";
import { discussParagraph } from "../../lib/ai";
import { colors, cx } from "../../lib/theme";

interface Props {
  paragraphText: string;
  analysis: AnalysisResult | null;
  messages: SuggestionMessage[];
  preferences: AnalysisPreferences;
  onMessagesChange: (msgs: SuggestionMessage[]) => void;
}

export function DiscussionThread({
  paragraphText,
  analysis,
  messages,
  preferences,
  onMessagesChange,
}: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend =
    input.trim().length > 0 &&
    input.length <= MAX_SUGGESTION_MESSAGE_LENGTH &&
    messages.length < MAX_SUGGESTION_DISCUSSION_MESSAGES;

  async function handleSend() {
    if (!canSend) return;
    const userMsg: SuggestionMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    onMessagesChange(newMessages);
    setInput("");
    setLoading(true);
    try {
      const reply = await discussParagraph({
        paragraphText,
        analysis,
        messages: newMessages,
        preferences,
      });
      onMessagesChange([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      onMessagesChange(newMessages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="mt-3">
      <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
        Ask questions
      </Text>

      {messages.map((m, i) => (
        <View
          key={i}
          className={cx(
            "mb-2 rounded-xl p-2.5",
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
        <View className="mb-2 max-w-[92%] self-start rounded-xl bg-sage-50/90 p-2.5">
          <ActivityIndicator size="small" color={colors.pen} />
        </View>
      )}

      {messages.length >= MAX_SUGGESTION_DISCUSSION_MESSAGES ? (
        <Text className="mt-1 text-center text-xs text-ink-400">
          Chat limit reached ({MAX_SUGGESTION_DISCUSSION_MESSAGES} messages).
        </Text>
      ) : (
        <View className="flex-row items-end gap-2">
          <TextInput
            className="max-h-20 flex-1 rounded-xl border border-ink-200 bg-white px-2.5 py-2 text-[13px] text-ink-900"
            placeholder="How can I make this clearer? Is the tone right?"
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
  );
}
