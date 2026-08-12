import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Redirect, useRootNavigationState } from "expo-router";
import { useModelStore } from "../store/model";
import { useAuthStore } from "../store/auth";
import { colors } from "../lib/theme";

const MODEL_SIZE_MB = 810;

export default function ModelDownloadScreen() {
  const { session } = useAuthStore();
  const { downloaded, downloading, downloadProgress, error, download } = useModelStore();
  const rootNavigationState = useRootNavigationState();

  if (!rootNavigationState?.key) {
    return <View className="flex-1 items-center justify-center bg-paper" />;
  }

  if (!session) return <Redirect href="/auth" />;
  if (downloaded) return <Redirect href="/(tabs)" />;

  async function handleDownload() {
    try {
      await download();
    } catch {
      Alert.alert(
        "Download failed",
        error ?? "Please check your internet connection and try again."
      );
    }
  }

  const progressPct = Math.round(downloadProgress * 100);

  return (
    <View className="flex-1 justify-center bg-paper">
      <View className="items-center p-8">
        <Text className="mb-3 font-display text-base text-pen">English Journal</Text>
        <Text className="mb-3 text-center font-display text-[26px] text-ink-900">
          Download AI Model
        </Text>
        <Text className="mb-6 text-center text-sm leading-[22px] text-ink-500">
          Gemma 3 1B runs entirely on your device, so your writing stays private — just like the
          coaching feedback in the web app, offline.
        </Text>

        <View className="mb-6 w-full gap-2 rounded-[14px] border border-paper-line bg-white/55 p-4">
          <Text className="text-sm text-ink-700">Size: ~{MODEL_SIZE_MB} MB</Text>
          <Text className="text-sm text-ink-700">Runs offline after download</Text>
          <Text className="text-sm text-ink-700">One-time download</Text>
        </View>

        {error ? (
          <View className="mb-4 w-full rounded-[10px] border border-coral-200 bg-coral-50 p-3">
            <Text className="text-center text-sm text-coral-800">{error}</Text>
          </View>
        ) : null}

        {downloading ? (
          <View className="w-full items-center gap-3">
            <ActivityIndicator size="large" color={colors.pen} />
            <View className="h-2 w-full overflow-hidden rounded bg-paper-dark">
              <View
                className="h-full rounded bg-pen"
                style={{ width: `${progressPct}%` }}
              />
            </View>
            <Text className="text-[13px] text-ink-500">{progressPct}% — Do not close the app</Text>
          </View>
        ) : (
          <TouchableOpacity
            className="w-full items-center rounded-full bg-ink-900 px-10 py-3.5"
            onPress={handleDownload}
          >
            <Text className="text-[15px] font-semibold text-white">Download Model</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
