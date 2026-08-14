import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Fraunces_400Regular, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  CourierPrime_400Regular,
  CourierPrime_700Bold,
} from "@expo-google-fonts/courier-prime";
import { supabase } from "../lib/supabase";
import { initDatabase } from "../lib/database";
import { useAuthStore } from "../store/auth";
import { useModelStore } from "../store/model";
import { useAiModeStore } from "../store/ai-mode";
import { useSyncWhenOnline } from "../lib/use-sync";
import { colors } from "../lib/theme";

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const checkDownloaded = useModelStore((s) => s.checkDownloaded);
  const loadAiMode = useAiModeStore((s) => s.load);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useSyncWhenOnline(userId);

  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    CourierPrime_400Regular,
    CourierPrime_700Bold,
  });
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    if (Platform.OS !== "web") {
      checkDownloaded().catch(console.error);
    }
    loadAiMode().catch(console.error);

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const aiModeLoaded = useAiModeStore((s) => s.loaded);
  const ready = fontsLoaded && dbReady && aiModeLoaded;

  // Always mount <Stack> so Redirect / navigation have a NavigationContainer.
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.pen,
          headerTitleStyle: { fontFamily: "Fraunces_600SemiBold", color: colors.ink900 },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="ai-setup" />
        <Stack.Screen name="model-download" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entries/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen
          name="entries/[id]/review"
          options={{ headerShown: true, title: "Review", headerBackTitle: "Back" }}
        />
      </Stack>
      {!ready && (
        <View style={styles.bootOverlay} className="items-center justify-center bg-paper">
          <ActivityIndicator color={colors.pen} />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
