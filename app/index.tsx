import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, useRootNavigationState } from "expo-router";
import { useAuthStore } from "../store/auth";
import { useModelStore } from "../store/model";
import { useAiModeStore } from "../store/ai-mode";
import { initDatabase } from "../lib/database";
import { colors } from "../lib/theme";

export default function IndexScreen() {
  const { session, loading } = useAuthStore();
  const { downloaded } = useModelStore();
  const { chosen, mode, loaded: aiModeLoaded } = useAiModeStore();
  const rootNavigationState = useRootNavigationState();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then(() => {
        if (!cancelled) setDbReady(true);
      })
      .catch((error) => {
        console.error("Failed to initialize database", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !rootNavigationState?.key || !aiModeLoaded || !dbReady) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator size="large" color={colors.pen} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  if (!chosen) {
    return <Redirect href="/ai-setup" />;
  }

  if (mode === "local" && !downloaded) {
    return <Redirect href="/model-download" />;
  }

  return <Redirect href="/(tabs)" />;
}
