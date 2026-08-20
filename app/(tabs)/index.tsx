import { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../store/auth";
import { useEntriesStore } from "../../store/entries";
import { usePreferencesStore } from "../../store/preferences";
import { useModelStore } from "../../store/model";
import { ParagraphBlock } from "../../components/editor/ParagraphBlock";
import { TopBar, ChangePasswordModal } from "../../components/chrome/TopBar";
import { EntriesDrawer } from "../../components/chrome/EntriesDrawer";
import { FeedbackForm } from "../../components/chrome/FeedbackForm";
import { ReviewFocusDrawer } from "../../components/chrome/ReviewFocusDrawer";
import { AiModeDrawer } from "../../components/chrome/AiModeDrawer";
import { analyzeParagraph, getMockAnalysis, getActiveAiMode, isAiReady } from "../../lib/ai";
import {
  createParagraph,
  createImageBlock,
  findTodaysEntry,
  formatTodayDisplay,
  getTextBlocks,
} from "../../lib/entry-utils";
import type { JournalParagraph, Suggestion } from "../../lib/types";
import { colors } from "../../lib/theme";
import { syncAllIfOnline } from "../../lib/sync";
import { PaperLoading } from "../../components/common/ui";

export default function JournalHomeScreen() {
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
    clearCurrentEntry,
  } = useEntriesStore();
  const { preferences, load: loadPrefs } = usePreferencesStore();

  const userId = user?.id ?? "";
  const [booting, setBooting] = useState(true);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewFocusOpen, setReviewFocusOpen] = useState(false);
  const [aiModeOpen, setAiModeOpen] = useState(false);

  const ensureJournalReady = useCallback(async () => {
    if (!userId) return;
    // Pull remote first when online so we don't create a duplicate "today" entry
    try {
      await syncAllIfOnline(userId);
    } catch (e) {
      console.error("Initial sync failed", e);
    }
    await loadPrefs(userId);
    await loadEntries(userId);
    const list = useEntriesStore.getState().entries;
    const today = findTodaysEntry(list);
    if (today) {
      await loadEntry(today.id);
    } else {
      const created = await createEntry(userId);
      await updateEntry(
        { ...created, title: formatTodayDisplay() },
        userId
      );
      await loadEntry(created.id);
    }
    setBooting(false);
  }, [userId, loadPrefs, loadEntries, loadEntry, createEntry, updateEntry]);

  useEffect(() => {
    ensureJournalReady().catch((e) => {
      console.error(e);
      setBooting(false);
    });
  }, [userId]);

  const entry = currentEntry;

  async function handleNewEntry() {
    try {
      const created = await createEntry(userId);
      await updateEntry({ ...created, title: formatTodayDisplay() }, userId);
      await loadEntry(created.id);
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
          clearCurrentEntry();
          await unload();
          await signOut();
          router.replace("/auth");
        },
      },
    ]);
  }

  function topBarProps(entryId: string | null, reviewDisabled: boolean) {
    return {
      email: user?.email,
      canChangePassword: canChangePassword(),
      reviewDisabled,
      onEntries: () => setEntriesOpen(true),
      onNewEntry: handleNewEntry,
      onReview: () => {
        if (entryId) router.push(`/entries/${entryId}/review`);
      },
      onReviewFocus: () => setReviewFocusOpen(true),
      onAiMode: () => setAiModeOpen(true),
      onAppFeedback: () => setFeedbackOpen(true),
      onChangePassword: () => setPasswordOpen(true),
      onSignOut: handleSignOut,
    };
  }

  async function handleTitleChange(text: string) {
    if (!entry || !userId) return;
    await updateEntry({ ...entry, title: text }, userId);
  }

  async function handleTextChange(blockId: string, text: string) {
    if (!entry || !userId) return;
    await updateBlock(entry.id, blockId, { text }, userId);
  }

  async function handleAnalyze(paragraphId: string) {
    if (!entry || !userId) return;
    const block = entry.blocks.find((b) => b.id === paragraphId);
    if (!block || block.type !== "text") return;
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
    await setParagraphAnalysis(entry.id, paragraphId, analysis, block.text.trim(), userId);
  }

  async function handleSuggestionUpdate(paragraphId: string, updated: Suggestion) {
    if (!entry || !userId) return;
    const block = entry.blocks.find((b) => b.id === paragraphId);
    if (!block || block.type !== "text" || !block.analysis) return;
    await updateBlock(
      entry.id,
      paragraphId,
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
  }

  async function handleDiscussionChange(
    paragraphId: string,
    messages: JournalParagraph["discussion"]
  ) {
    if (!entry || !userId) return;
    await updateBlock(entry.id, paragraphId, { discussion: messages }, userId);
  }

  async function handleAddParagraph() {
    if (!entry || !userId) return;
    await updateEntry({ ...entry, blocks: [...entry.blocks, createParagraph()] }, userId);
  }

  async function handleDeleteBlock(blockId: string) {
    if (!entry || !userId) return;
    const remaining = entry.blocks.filter((b) => b.id !== blockId);
    if (remaining.length === 0) {
      Alert.alert("Cannot delete", "An entry must have at least one paragraph.");
      return;
    }
    await updateEntry({ ...entry, blocks: remaining }, userId);
  }

  async function handleAddImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !entry || !userId) return;
    await updateEntry(
      { ...entry, blocks: [...entry.blocks, createImageBlock(result.assets[0].uri)] },
      userId
    );
  }

  if (booting || loading && !entry) {
    return <PaperLoading label="Opening your journal…" />;
  }

  if (!entry) {
    return (
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
        <TopBar {...topBarProps(null, true)} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-2 font-display text-xl text-ink-900">Start writing</Text>
          <Text className="text-center text-sm text-ink-500">
            Open the menu and tap New entry to begin.
          </Text>
        </View>
        <EntriesDrawer
          visible={entriesOpen}
          entries={entries}
          loading={loading}
          selectedId={null}
          onClose={() => setEntriesOpen(false)}
          onRefresh={() => loadEntries(userId)}
          onNewEntry={handleNewEntry}
          onSelect={(item) => loadEntry(item.id)}
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

  const canReview = getTextBlocks(entry.blocks).some((b) => b.text.trim().length > 0);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <TopBar {...topBarProps(entry.id, !canReview)} />

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
            onChangeText={handleTitleChange}
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
                    onPress={() => handleDeleteBlock(block.id)}
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
                onTextChange={(text) => handleTextChange(block.id, text)}
                onAnalyze={() => handleAnalyze(block.id)}
                onSuggestionUpdate={(s) => handleSuggestionUpdate(block.id, s)}
                onDiscussionChange={(msgs) => handleDiscussionChange(block.id, msgs)}
                onDelete={() => handleDeleteBlock(block.id)}
              />
            );
          })}

          <View className="mt-2 flex-row justify-between">
            <TouchableOpacity onPress={handleAddParagraph}>
              <Text className="text-sm font-medium text-sage-700">+ Add paragraph</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddImage}>
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
        onSelect={(item) => loadEntry(item.id)}
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
