import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  type FocusEvent,
} from "react-native";
import { Redirect, useRootNavigationState } from "expo-router";
import { PillButton } from "../components/common/ui";
import { useAuthStore } from "../store/auth";
import { colors } from "../lib/theme";

type Mode = "login" | "register";
type Step = "choose" | "email";

const KEYBOARD_BOTTOM_CUSHION = 24;

export default function AuthScreen() {
  const { session, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuthStore();
  const rootNavigationState = useRootNavigationState();
  const scrollRef = useRef<ScrollView>(null);
  const scrollFocusedInput = useRef<() => void>(() => {});

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      // After layout updates for the keyboard, keep the focused field visible.
      requestAnimationFrame(() => scrollFocusedInput.current());
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Wait until the root navigator is mounted before Redirect.
  if (!rootNavigationState?.key) {
    return <View className="flex-1 items-center justify-center bg-paper" />;
  }

  if (session) return <Redirect href="/" />;

  const heading = mode === "login" ? "Sign in" : "Create account";
  const subheading =
    step === "choose"
      ? mode === "login"
        ? "Continue your writing practice."
        : "Save entries and sync across devices."
      : mode === "login"
        ? "Sign in to continue your writing practice."
        : "Create an account to save entries and sync across devices.";

  const keyboardOpen = keyboardHeight > 0;

  function handleInputFocus(event: FocusEvent) {
    const target = event.target;
    const scrollIntoView = () => {
      const responder = scrollRef.current as
        | (ScrollView & {
            getScrollResponder?: () => {
              scrollResponderScrollNativeHandleToKeyboard?: (
                nodeHandle: number | null,
                additionalOffset?: number,
                preventNegativeScrollOffset?: boolean
              ) => void;
            };
          })
        | null;
      const scrollResponder = responder?.getScrollResponder?.();
      scrollResponder?.scrollResponderScrollNativeHandleToKeyboard?.(
        target,
        KEYBOARD_BOTTOM_CUSHION + 48,
        true
      );
    };

    scrollFocusedInput.current = scrollIntoView;
    // Delay so the keyboard height / content inset can apply first.
    setTimeout(scrollIntoView, Platform.OS === "ios" ? 50 : 100);
  }

  function toggleMode() {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setError(null);
    setMessage(null);
  }

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

  const modeToggle = (
    <Text className="mt-1 text-center text-sm text-ink-500">
      {mode === "login" ? "No account? " : "Already have an account? "}
      <Text className="font-semibold text-sage-700 underline" onPress={toggleMode}>
        {mode === "login" ? "Create one" : "Sign in"}
      </Text>
    </Text>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerClassName={`grow p-8 ${keyboardOpen ? "justify-start py-6" : "justify-center py-12"}`}
        contentContainerStyle={{
          // iOS: KeyboardAvoidingView + automaticallyAdjustKeyboardInsets handle inset.
          // Android: add keyboard height so fields can scroll above an overlapping keyboard.
          paddingBottom: keyboardOpen
            ? Platform.OS === "ios"
              ? KEYBOARD_BOTTOM_CUSHION
              : keyboardHeight + KEYBOARD_BOTTOM_CUSHION
            : 48,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View className="mb-8 items-center">
          <Text className="mb-3 font-display text-base text-pen">English Journal</Text>
          <Text className="mb-3 text-center font-display text-[26px] text-ink-900">{heading}</Text>
          <Text className="text-center text-sm leading-[22px] text-ink-500">{subheading}</Text>
        </View>

        {step === "choose" ? (
          <View className="w-full gap-4">
            <PillButton
              label="Continue with Google"
              onPress={handleGoogle}
              disabled={loading}
              loading={loading}
              fullWidth
            />

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-paper-line" />
              <Text className="text-[11px] font-semibold tracking-wide text-ink-400">OR</Text>
              <View className="h-px flex-1 bg-paper-line" />
            </View>

            <PillButton
              label={mode === "login" ? "Sign in with email" : "Sign up with email"}
              onPress={() => {
                setError(null);
                setMessage(null);
                setStep("email");
              }}
              disabled={loading}
              fullWidth
            />

            {error ? (
              <View className="rounded-lg bg-coral-200/60 px-3 py-2.5">
                <Text className="text-[13px] text-coral-800">{error}</Text>
              </View>
            ) : null}

            {modeToggle}
          </View>
        ) : (
          <View className="w-full">
            <TouchableOpacity
              onPress={() => {
                setError(null);
                setMessage(null);
                setStep("choose");
              }}
              className="mb-4 self-start"
              hitSlop={10}
            >
              <Text className="text-sm text-ink-500">← Back</Text>
            </TouchableOpacity>

            <Text className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-500">EMAIL</Text>
            <TextInput
              className="mb-1 rounded-lg border border-paper-line bg-white/80 px-3 py-2.5 text-sm text-ink-900"
              value={email}
              onChangeText={setEmail}
              onFocus={handleInputFocus}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              placeholder="you@example.com"
              placeholderTextColor={colors.ink400}
            />

            <Text className="mb-1.5 mt-3 text-[11px] font-bold tracking-wide text-ink-500">
              PASSWORD
            </Text>
            <View className="relative">
              <TextInput
                className="mb-1 rounded-lg border border-paper-line bg-white/80 py-2.5 pl-3 pr-14 text-sm text-ink-900"
                value={password}
                onChangeText={setPassword}
                onFocus={handleInputFocus}
                secureTextEntry={!showPassword}
                editable={!loading}
                placeholder="Your password"
                placeholderTextColor={colors.ink400}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-3"
                hitSlop={8}
              >
                <Text className="text-xs font-semibold text-sage-700">
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View className="mt-4 rounded-lg bg-coral-200/60 px-3 py-2.5">
                <Text className="text-[13px] text-coral-800">{error}</Text>
              </View>
            ) : null}
            {message ? (
              <View className="mt-4 rounded-lg bg-sage-100/60 px-4 py-3.5">
                <Text className="text-sm text-sage-800">{message}</Text>
              </View>
            ) : null}

            <View className="mt-4 gap-4">
              <PillButton
                label={mode === "login" ? "Sign in" : "Create account"}
                onPress={handleSubmit}
                disabled={loading}
                loading={loading}
                fullWidth
                variant="primary"
              />
              {modeToggle}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
