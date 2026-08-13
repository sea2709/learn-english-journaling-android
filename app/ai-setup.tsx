import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Redirect, useRootNavigationState, useRouter } from "expo-router";
import { useAuthStore } from "../store/auth";
import { useAiModeStore } from "../store/ai-mode";
import { useModelStore } from "../store/model";
import { isWebApiConfigured } from "../lib/ai-api";
import { colors } from "../lib/theme";

export default function AiSetupScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { chosen, mode, loaded, setMode } = useAiModeStore();
  const { downloaded } = useModelStore();
  const rootNavigationState = useRootNavigationState();

  if (!rootNavigationState?.key || !loaded) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator size="large" color={colors.pen} />
      </View>
    );
  }

  if (!session) return <Redirect href="/auth" />;

  if (chosen) {
    if (mode === "local" && !downloaded) {
      return <Redirect href="/model-download" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  async function chooseApi() {
    if (!isWebApiConfigured()) {
      Alert.alert(
        "Cloud AI unavailable",
        "Set EXPO_PUBLIC_WEB_API_URL to your web app URL (see .env.example), then restart the app."
      );
      return;
    }
    await setMode("api");
    router.replace("/(tabs)");
  }

  async function chooseLocal() {
    await setMode("local");
    if (downloaded) {
      router.replace("/(tabs)");
    } else {
      router.replace("/model-download");
    }
  }

  return (
    <View className="flex-1 justify-center bg-paper">
      <View className="items-center p-8">
        <Text className="mb-3 font-display text-base text-pen">English Journal</Text>
        <Text className="mb-3 text-center font-display text-[26px] text-ink-900">
          Choose AI review
        </Text>
        <Text className="mb-8 text-center text-sm leading-[22px] text-ink-500">
          Pick how coaching feedback is generated. You can change this later in Account.
        </Text>

        <TouchableOpacity
          className="mb-3 w-full rounded-[14px] border border-paper-line bg-white/70 p-4"
          onPress={chooseApi}
          activeOpacity={0.8}
        >
          <Text className="mb-1.5 font-display text-[17px] text-ink-900">Use cloud AI</Text>
          <Text className="text-sm leading-[21px] text-ink-600">
            Uses the same review API as the web app. No large download — needs internet when you
            request feedback.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full rounded-[14px] border border-paper-line bg-white/70 p-4"
          onPress={chooseLocal}
          activeOpacity={0.8}
        >
          <Text className="mb-1.5 font-display text-[17px] text-ink-900">
            Download on-device model
          </Text>
          <Text className="text-sm leading-[21px] text-ink-600">
            Gemma 3 1B (~810 MB) runs on your phone. Writing stays private and works offline after
            download.
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
