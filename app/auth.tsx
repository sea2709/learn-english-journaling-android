import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Redirect, useRootNavigationState } from "expo-router";
import { useAuthStore } from "../store/auth";
import { colors } from "../lib/theme";

type Mode = "login" | "register";
type Step = "choose" | "email";

export default function AuthScreen() {
  const { session, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuthStore();
  const rootNavigationState = useRootNavigationState();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Wait until the root navigator is mounted before Redirect.
  if (!rootNavigationState?.key) {
    return <View className="flex-1 items-center justify-center bg-paper" />;
  }

  if (session) return <Redirect href="/" />;

  const heading =
    step === "choose"
      ? "English Journal"
      : mode === "login"
        ? "Welcome back."
        : "Join English Journal.";
  const subheading =
    step === "choose"
      ? "Sign in or Sign up"
      : mode === "login"
        ? "Sign in to continue your writing practice."
        : "Create an account to save entries and sync across devices.";

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "login") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
        setMessage("Account created. Check your email to confirm, then sign in.");
      }
    } catch (e) {
      setError(mode === "login" ? "Invalid email or password." : e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in was cancelled or failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="grow justify-center p-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-7 items-center">
          <Text className="text-center font-display text-[30px] text-ink-900">{heading}</Text>
          {step === "choose" ? (
            <>
              <Text className="mt-4 text-center text-sm leading-[22px] text-ink-500">
                English Journal helps you learn English through daily writing. Craft entries
                paragraph by paragraph, get AI feedback on grammar, tone, and word choice, then
                save your progress across devices.
              </Text>
              <Text className="mt-6 text-center font-display text-xl text-ink-900">
                {subheading}
              </Text>
            </>
          ) : (
            <Text className="mt-2 text-center text-sm text-ink-500">{subheading}</Text>
          )}
        </View>

        {step === "choose" ? (
          <View className="gap-4">
            <TouchableOpacity
              className="items-center rounded-full border border-ink-200 bg-white py-3"
              onPress={handleGoogle}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.ink800} />
              ) : (
                <Text className="text-sm font-medium text-ink-800">Continue with Google</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-ink-200" />
              <Text className="text-[11px] font-semibold tracking-wide text-ink-400">OR</Text>
              <View className="h-px flex-1 bg-ink-200" />
            </View>

            <TouchableOpacity
              className="items-center rounded-full border border-ink-200 bg-white py-3"
              onPress={() => {
                setError(null);
                setStep("email");
              }}
            >
              <Text className="text-sm font-medium text-ink-800">
                Sign {mode === "login" ? "in" : "up"} with email
              </Text>
            </TouchableOpacity>

            <Text className="mt-1 text-center text-sm text-ink-500">
              {mode === "login" ? "No account? " : "Already have an account? "}
              <Text
                className="font-semibold text-sage-700 underline"
                onPress={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </Text>
            </Text>
          </View>
        ) : (
          <View
            className="rounded-2xl border border-ink-200 bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setError(null);
                setStep("choose");
              }}
              className="mb-4"
            >
              <Text className="text-sm text-ink-500">← Back</Text>
            </TouchableOpacity>

            <Text className="mb-1.5 mt-2 text-[11px] font-bold tracking-wide text-ink-500">
              EMAIL
            </Text>
            <TextInput
              className="mb-1 rounded-[10px] border border-ink-200 px-3 py-2.5 text-sm text-ink-900"
              style={{ backgroundColor: "rgba(247, 246, 243, 0.5)" }}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text className="mb-1.5 mt-2 text-[11px] font-bold tracking-wide text-ink-500">
              PASSWORD
            </Text>
            <View className="relative">
              <TextInput
                className="mb-1 rounded-[10px] border border-ink-200 py-2.5 pl-3 pr-14 text-sm text-ink-900"
                style={{ backgroundColor: "rgba(247, 246, 243, 0.5)" }}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-3"
              >
                <Text className="text-xs font-semibold text-sage-700">
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            {error && (
              <View className="mt-3 rounded-[10px] border border-coral-200 bg-coral-50 p-2.5">
                <Text className="text-[13px] text-coral-800">{error}</Text>
              </View>
            )}
            {message && (
              <View className="mt-3 rounded-[10px] border border-sage-200 bg-sage-50 p-2.5">
                <Text className="text-[13px] text-sage-800">{message}</Text>
              </View>
            )}

            <TouchableOpacity
              className="mt-4 items-center rounded-full bg-ink-900 py-3"
              style={loading ? { opacity: 0.6 } : undefined}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  {mode === "login" ? "Sign in" : "Create account"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
