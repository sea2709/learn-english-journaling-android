import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ALL_FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  submitFeedback,
} from "../../lib/feedback";
import type { FeedbackCategory } from "../../lib/types";
import { colors, cx } from "../../lib/theme";
import { AnimatedDrawer } from "./AnimatedShell";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function FeedbackForm({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCategory("idea");
    setMessage("");
    setContactNote("");
    setSubmitting(false);
    setError(null);
    setSuccess(null);
  }, [visible]);

  async function handleSubmit() {
    const trimmedMessage = message.trim();
    const trimmedContact = contactNote.trim();

    if (!trimmedMessage) {
      setError("Message is required.");
      return;
    }
    if (trimmedMessage.length > 2000) {
      setError("Message must be 2000 characters or fewer.");
      return;
    }
    if (trimmedContact.length > 300) {
      setError("Contact note must be 300 characters or fewer.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await submitFeedback({
        category,
        message: trimmedMessage,
        contactNote: trimmedContact || undefined,
      });
      setSuccess("Feedback sent — thank you!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatedDrawer visible={visible} onClose={onClose} side="right" maxWidth={380}>
      <KeyboardAvoidingView
        className="flex-1"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center justify-between border-b border-paper-line px-5 pb-3.5">
          <Text className="font-display text-lg text-ink-900">App feedback</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} className="p-1.5">
            <Text className="text-base text-ink-500">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-4 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {success ? (
            <View className="rounded-lg bg-sage-100/60 px-4 py-3.5">
              <Text className="text-sm text-sage-800">{success}</Text>
            </View>
          ) : (
            <>
              <Text className="mb-2 text-sm leading-[21px] text-ink-600">
                Tell us about a bug, share an idea, or let us know how the app is working for you.
              </Text>

              <Text className="mb-2 mt-[18px] text-[11px] font-bold tracking-wide text-ink-500">
                CATEGORY
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {ALL_FEEDBACK_CATEGORIES.map((value) => {
                  const selected = category === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      className={cx(
                        "rounded-full border border-paper-line bg-transparent px-3 py-1.5",
                        selected && "border-pen bg-pen/10"
                      )}
                      onPress={() => setCategory(value)}
                      activeOpacity={0.75}
                    >
                      <Text
                        className={cx(
                          "text-[13px] font-medium text-ink-700",
                          selected && "text-ink-900"
                        )}
                      >
                        {FEEDBACK_CATEGORY_LABELS[value]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="mb-2 mt-[18px] text-[11px] font-bold tracking-wide text-ink-500">
                MESSAGE
              </Text>
              <TextInput
                className="min-h-[140px] rounded-lg border border-paper-line bg-white/80 px-3 py-2.5 text-sm text-ink-800"
                value={message}
                onChangeText={(text) => {
                  setMessage(text);
                  setError(null);
                }}
                placeholder="Describe your feedback…"
                placeholderTextColor={colors.ink400}
                multiline
                maxLength={2000}
                editable={!submitting}
                textAlignVertical="top"
              />
              <Text className="mt-1 text-right text-[11px] text-ink-400">
                {message.length}/2000
              </Text>

              <Text className="mb-2 mt-[18px] text-[11px] font-bold tracking-wide text-ink-500">
                CONTACT NOTE (OPTIONAL)
              </Text>
              <TextInput
                className="min-h-16 rounded-lg border border-paper-line bg-white/80 px-3 py-2.5 text-sm text-ink-800"
                value={contactNote}
                onChangeText={(text) => {
                  setContactNote(text);
                  setError(null);
                }}
                placeholder="Optional — add an email or extra context if you would like a reply"
                placeholderTextColor={colors.ink400}
                multiline
                maxLength={300}
                editable={!submitting}
                textAlignVertical="top"
              />
              <Text className="mt-1 text-right text-[11px] text-ink-400">
                {contactNote.length}/300
              </Text>

              {error ? (
                <View className="mt-4 rounded-lg bg-coral-200/60 px-3 py-2.5">
                  <Text className="text-[13px] text-coral-800">{error}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        <View className="border-t border-paper-line px-5 pt-3.5">
          {success ? (
            <TouchableOpacity
              className="min-h-11 items-center justify-center rounded-full border border-paper-line/80 bg-white/55 py-3"
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-semibold text-ink-800">Close</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={cx(
                "min-h-11 items-center justify-center rounded-full border border-paper-line/80 bg-white/55 py-3",
                submitting && "opacity-[0.55]"
              )}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.ink800} />
              ) : (
                <Text className="text-sm font-semibold text-ink-800">Send app feedback</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </AnimatedDrawer>
  );
}
