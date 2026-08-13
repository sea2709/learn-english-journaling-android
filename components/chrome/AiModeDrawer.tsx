import { Alert, View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedDrawer } from "./AnimatedShell";
import { useAiModeStore } from "../../store/ai-mode";
import { useModelStore } from "../../store/model";
import { isWebApiConfigured } from "../../lib/ai-api";
import type { AiMode } from "../../lib/types";
import { cx } from "../../lib/theme";

type AiModeDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

export function AiModeDrawer({ visible, onClose }: AiModeDrawerProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, setMode } = useAiModeStore();
  const { downloaded } = useModelStore();

  async function select(next: AiMode) {
    if (next === "api" && !isWebApiConfigured()) {
      Alert.alert(
        "Cloud AI unavailable",
        "Set EXPO_PUBLIC_WEB_API_URL to your web app URL, then restart the app."
      );
      return;
    }

    if (next === "local" && !downloaded) {
      await setMode("local");
      onClose();
      router.push("/model-download");
      return;
    }

    await setMode(next);
    onClose();
  }

  return (
    <AnimatedDrawer visible={visible} onClose={onClose} side="right" maxWidth={380}>
      <View
        className="flex-1"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row items-center justify-between border-b border-paper-line px-5 pb-3.5">
          <Text className="font-display text-lg text-ink-900">AI review</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text className="p-1 text-base text-ink-500">✕</Text>
          </TouchableOpacity>
        </View>

        <View className="gap-3 px-5 py-4">
          <Text className="mb-1 text-sm leading-[21px] text-ink-600">
            Choose how paragraph review and coaching chats run on this device.
          </Text>

          <OptionCard
            title="Cloud AI"
            description="Same API as the web app. No model download; needs internet for review."
            selected={mode === "api"}
            onPress={() => select("api")}
          />
          <OptionCard
            title="On-device model"
            description={
              downloaded
                ? "Gemma runs locally. Private and offline after download."
                : "Requires downloading Gemma (~810 MB) once."
            }
            selected={mode === "local"}
            onPress={() => select("local")}
          />
        </View>
      </View>
    </AnimatedDrawer>
  );
}

function OptionCard({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={cx(
        "rounded-[14px] border p-4",
        selected ? "border-pen bg-sage-50/80" : "border-paper-line bg-white/55"
      )}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="font-display text-[16px] text-ink-900">{title}</Text>
        {selected ? (
          <Text className="text-[11px] font-bold uppercase tracking-wide text-pen">Selected</Text>
        ) : null}
      </View>
      <Text className="text-sm leading-[21px] text-ink-600">{description}</Text>
    </TouchableOpacity>
  );
}
