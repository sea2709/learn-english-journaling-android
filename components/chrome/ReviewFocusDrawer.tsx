import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth";
import { usePreferencesStore } from "../../store/preferences";
import {
  ALL_FOCUS_AREAS,
  FOCUS_AREA_LABELS,
  analysisPreferencesSchema,
} from "../../lib/analysis-preferences";
import type { AnalysisFocusArea } from "../../lib/types";
import { colors, cx } from "../../lib/theme";
import { PillButton } from "../common/ui";
import { AnimatedDrawer } from "./AnimatedShell";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ReviewFocusDrawer({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { preferences, load, update, loaded } = usePreferencesStore();
  const userId = user?.id ?? "";

  const [focusAreas, setFocusAreas] = useState<AnalysisFocusArea[]>([]);
  const [customNote, setCustomNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    if (!loaded) load(userId).catch(console.error);
  }, [visible, userId, loaded, load]);

  useEffect(() => {
    if (!visible) return;
    setFocusAreas(preferences.focusAreas);
    setCustomNote(preferences.customNote ?? "");
    setError(null);
    setSavedMsg(null);
  }, [visible, preferences]);

  function toggleArea(area: AnalysisFocusArea) {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
    setError(null);
    setSavedMsg(null);
  }

  async function handleSave() {
    const result = analysisPreferencesSchema.safeParse({ focusAreas, customNote });
    if (!result.success) {
      setError("Select at least one focus area.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await update(result.data, userId);
      setSavedMsg("Review focus updated.");
    } catch {
      setError("Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatedDrawer visible={visible} onClose={onClose} side="right" maxWidth={380}>
      <View
        className="flex-1"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row items-center justify-between border-b border-paper-line px-5 pb-3.5">
          <Text className="font-display text-lg text-ink-900">Review focus</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} className="p-1.5">
            <Text className="text-base text-ink-500">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerClassName="p-5 pb-6" keyboardShouldPersistTaps="handled">
          <Text className="mb-2 text-sm leading-[22px] text-ink-600">
            Choose what the AI emphasizes when you review a paragraph or your full entry.
          </Text>

          <Text className="mb-2.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            Focus areas
          </Text>
          <View className="gap-2">
            {ALL_FOCUS_AREAS.map((area) => {
              const active = focusAreas.includes(area);
              return (
                <TouchableOpacity
                  key={area}
                  className="min-h-11 flex-row items-center gap-3 rounded-lg border border-paper-line/80 bg-white/55 px-3 py-2.5"
                  onPress={() => toggleArea(area)}
                  activeOpacity={0.7}
                >
                  <View
                    className={cx(
                      "h-[18px] w-[18px] items-center justify-center rounded border-2 border-ink-300 bg-white",
                      active && "border-pen bg-pen"
                    )}
                  >
                    {active ? (
                      <Text className="text-[11px] font-bold leading-3 text-white">✓</Text>
                    ) : null}
                  </View>
                  <Text className="text-sm font-medium text-ink-800">
                    {FOCUS_AREA_LABELS[area]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="mb-2.5 mt-7 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            Learning goal (optional)
          </Text>
          <TextInput
            className="min-h-[88px] rounded-lg border border-paper-line bg-white/80 p-3 text-sm text-ink-800"
            placeholder='e.g. "Preparing for IELTS writing"'
            placeholderTextColor={colors.ink400}
            value={customNote}
            onChangeText={(t) => {
              setCustomNote(t);
              setSavedMsg(null);
            }}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text className="mt-1 text-right text-[11px] text-ink-400">
            {customNote.length}/300
          </Text>

          {error ? (
            <View className="mt-4 rounded-lg bg-coral-100/70 px-3 py-2.5">
              <Text className="text-[13px] text-coral-800">{error}</Text>
            </View>
          ) : null}
          {savedMsg ? (
            <View className="mt-4 rounded-lg bg-sage-100/70 px-3 py-2.5">
              <Text className="text-[13px] text-sage-800">{savedMsg}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="border-t border-paper-line p-4">
          <PillButton
            label={saving ? "Saving…" : "Save"}
            onPress={handleSave}
            loading={saving}
            fullWidth
            penAccent
          />
        </View>
      </View>
    </AnimatedDrawer>
  );
}
