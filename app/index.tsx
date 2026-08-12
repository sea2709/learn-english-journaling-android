import { View, ActivityIndicator } from "react-native";
import { Redirect, useRootNavigationState } from "expo-router";
import { useAuthStore } from "../store/auth";
import { useModelStore } from "../store/model";
import { colors } from "../lib/theme";

export default function IndexScreen() {
  const { session, loading } = useAuthStore();
  const { downloaded } = useModelStore();
  const rootNavigationState = useRootNavigationState();

  if (loading || !rootNavigationState?.key) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator size="large" color={colors.pen} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  if (!downloaded) {
    return <Redirect href="/model-download" />;
  }

  return <Redirect href="/(tabs)" />;
}
