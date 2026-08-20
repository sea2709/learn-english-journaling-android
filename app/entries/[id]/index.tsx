import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../../store/auth";
import { useEntriesStore } from "../../../store/entries";
import { usePreferencesStore } from "../../../store/preferences";
import { useModelStore } from "../../../store/model";
import { ParagraphBlock } from "../../../components/editor/ParagraphBlock";
import { TopBar, ChangePasswordModal } from "../../../components/chrome/TopBar";
import { EntriesDrawer } from "../../../components/chrome/EntriesDrawer";
import { FeedbackForm } from "../../../components/chrome/FeedbackForm";
import { ReviewFocusDrawer } from "../../../components/chrome/ReviewFocusDrawer";
import { AiModeDrawer } from "../../../components/chrome/AiModeDrawer";
import { analyzeParagraph, getMockAnalysis, getActiveAiMode, isAiReady } from "../../../lib/ai";
import {
  createParagraph,
  createImageBlock,
  formatTodayDisplay,
  getTextBlocks,
} from "../../../lib/entry-utils";
import type { JournalParagraph, Suggestion } from "../../../lib/types";
import { colors } from "../../../lib/theme";
import { PaperLoading } from "../../../components/common/ui";

export default function EntryEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, changePassword, canChangePassword } = useAuthStore();
  const { unload } = useModelStore();
  const {
    entries,
    currentEntry,
    loading,
    loadEntries,
    loadEntry,
    createEntry,
    updateEntry,
    updateBlock,
    setParagraphAnalysis,
    deleteEntry,
  } = useEntriesStore();
  const { preferences, load: loadPrefs, loaded: prefsLoaded } = usePreferencesStore();

  const userId = user?.id ?? "";
  const [entriesOpen, setEntriesOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewFocusOpen, setReviewFocusOpen] = useState(false);
  const [aiModeOpen, setAiModeOpen] = useState(false);

  useEffect(() => {
    if (id) loadEntry(id);
    if (userId) {
      loadEntries(userId);
      if (!prefsLoaded) loadPrefs(userId);
    }
  }, [id, userId]);

  const entry = currentEntry?.id === id ? currentEntry : null;

  async function handleNewEntry() {
    try {
      const created = await createEntry(userId);
      await updateEntry({ ...created, title: formatTodayDisplay() }, userId);
      router.replace(`/entries/${created.id}`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not create entry.");
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign out?", "You will need to sign in again to continue writing.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await unload();
          await signOut();
          router.replace("/auth");
        },
      },
    ]);
  }

  if (!entry) return <PaperLoading />;

  const canReview = getTextBlocks(entry.blocks).some((b) => b.text.trim().length > 0);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <TopBar
        email={user?.email}
        canChangePassword={canChangePassword()}
        reviewDisabled={!canReview}
        onEntries={() => setEntriesOpen(true)}
        onNewEntry={handleNewEntry}
        onReview={() => router.push(`/entries/${entry.id}/review`)}
        onReviewFocus={() => setReviewFocusOpen(true)}
        onAiMode={() => setAiModeOpen(true)}
        onAppFeedback={() => setFeedbackOpen(true)}
        onChangePassword={() => setPasswordOpen(true)}
        onSignOut={handleSignOut}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerClassName="p-5 pb-12" keyboardShouldPersistTaps="handled">
          <TextInput
            className="py-1 text-center font-display text-[28px] text-ink-900"
            style={{ backgroundColor: colors.paper }}
            placeholder="Title"
            placeholderTextColor={colors.ink300}
            selectionColor={colors.penMuted}
            cursorColor={colors.pen}
            underlineColorAndroid="transparent"
            value={entry.title}
            onChangeText={async (text) => {
              await updateEntry({ ...entry, title: text }, userId);
            }}
            maxLength={120}
          />
          <View className="mb-7 mt-1 h-[3px] w-12 self-center rounded-sm bg-pen opacity-70" />

          {entry.blocks.map((block) => {
            if (block.type === "image") {
              return (
                <View key={block.id} className="relative mb-4 overflow-hidden rounded-xl">
                  <Image
                    source={{ uri: block.path }}
                    className="h-[200px] w-full rounded-xl"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-xl bg-ink-950/55"
                    onPress={async () => {
                      const remaining = entry.blocks.filter((b) => b.id !== block.id);
                      if (remaining.length === 0) {
                        Alert.alert("Cannot delete", "An entry must have at least one paragraph.");
                        return;
                      }
                      await updateEntry({ ...entry, blocks: remaining }, userId);
                    }}
                  >
                    <Text className="text-xs text-white">✕</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <ParagraphBlock
                key={block.id}
                paragraph={block}
                preferences={preferences}
                onTextChange={(text) => updateBlock(entry.id, block.id, { text }, userId)}
                onAnalyze={async () => {
                  const ready = await isAiReady();
                  if (!ready && getActiveAiMode() === "api") {
                    Alert.alert(
                      "Cloud AI unavailable",
                      "Set EXPO_PUBLIC_WEB_API_URL to your web app URL, then restart the app."
                    );
                    return;
                  }
                  const analysis = ready
                    ? await analyzeParagraph(block.text, preferences)
                    : getMockAnalysis(block.text, preferences);
                  await setParagraphAnalysis(
                    entry.id,
                    block.id,
                    analysis,
                    block.text.trim(),
                    userId
                  );
                }}
                onSuggestionUpdate={async (updated: Suggestion) => {
                  if (!block.analysis) return;
                  await updateBlock(
                    entry.id,
                    block.id,
                    {
                      analysis: {
                        ...block.analysis,
                        suggestions: block.analysis.suggestions.map((s) =>
                          s.id === updated.id ? updated : s
                        ),
                      },
                    },
                    userId
                  );
                }}
                onDiscussionChange={(msgs: JournalParagraph["discussion"]) =>
                  updateBlock(entry.id, block.id, { discussion: msgs }, userId)
                }
                onDelete={async () => {
                  const remaining = entry.blocks.filter((b) => b.id !== block.id);
                  if (remaining.length === 0) {
                    Alert.alert("Cannot delete", "An entry must have at least one paragraph.");
                    return;
                  }
                  await updateEntry({ ...entry, blocks: remaining }, userId);
                }}
              />
            );
          })}

          <View className="mt-2 flex-row justify-between">
            <TouchableOpacity
              onPress={() =>
                updateEntry({ ...entry, blocks: [...entry.blocks, createParagraph()] }, userId)
              }
            >
              <Text className="text-sm font-medium text-sage-700">+ Add paragraph</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  quality: 0.8,
                });
                if (result.canceled) return;
                await updateEntry(
                  {
                    ...entry,
                    blocks: [...entry.blocks, createImageBlock(result.assets[0].uri)],
                  },
                  userId
                );
              }}
            >
              <Text className="text-sm font-medium text-sage-700">Add image</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <EntriesDrawer
        visible={entriesOpen}
        entries={entries}
        loading={loading}
        selectedId={entry.id}
        onClose={() => setEntriesOpen(false)}
        onRefresh={() => loadEntries(userId)}
        onNewEntry={handleNewEntry}
        onSelect={(item) => router.replace(`/entries/${item.id}`)}
        onDelete={(item) => deleteEntry(item.id, userId, true)}
      />

      <ChangePasswordModal
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onSubmit={changePassword}
      />
      <FeedbackForm visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ReviewFocusDrawer visible={reviewFocusOpen} onClose={() => setReviewFocusOpen(false)} />
      <AiModeDrawer visible={aiModeOpen} onClose={() => setAiModeOpen(false)} />
    </View>
  );
}
