import { Stack } from "expo-router";
import { colors, fonts } from "../../lib/theme";

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="preferences"
        options={{
          headerShown: true,
          title: "Review focus",
          presentation: "modal",
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          headerTintColor: colors.pen,
          headerTitleStyle: {
            fontFamily: fonts.display,
            color: colors.ink900,
          },
        }}
      />
    </Stack>
  );
}
