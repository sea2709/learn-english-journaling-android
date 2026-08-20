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
  Linking,
  type FocusEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useRootNavigationState } from "expo-router";
import { PillButton } from "../components/common/ui";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import type { SocialAuthProvider } from "../lib/oauth";
import { useAuthStore } from "../store/auth";
import { colors } from "../lib/theme";

type Mode = "login" | "register";
type Step = "choose" | "email" | "forgot";

const KEYBOARD_BOTTOM_CUSHION = 24;
const RESET_SUCCESS_MESSAGE =
  "If an account exists for that email, we sent a reset link.";
const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_API_URL ?? "").replace(/\/$/, "");

const fieldClassName =
  "mb-1 rounded-lg border border-ink-200 bg-ink-50/50 px-3 py-2.5 text-sm text-ink-900";
const labelClassName =
  "mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500";

export default function AuthScreen() {
  const {
    session,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    resetPasswordForEmail,
  } = useAuthStore();
  const rootNavigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollFocusedInput = useRef<() => void>(() => {});

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<SocialAuthProvider | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
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

  const heading =
    step === "forgot"
      ? "Reset your password."
      : step === "choose"
        ? "English Journal"
        : mode === "login"
          ? "Welcome back."
          : "Join English Journal.";
  const subheading =
    step === "forgot"
      ? "Enter your email and we will send a reset link."
      : step === "choose"
        ? "Sign in or Sign up"
        : mode === "login"
          ? "Sign in to continue your writing practice."
          : "Create an account to save entries and sync across devices.";

  const keyboardOpen = keyboardHeight > 0;
  const oauthBusy = oauthProvider !== null;

  function resetMessages() {
    setError(null);
    setMessage(null);
  }

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
    setTimeout(scrollIntoView, Platform.OS === "ios" ? 50 : 100);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    resetMessages();
    setStep("choose");
  }

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setEmailLoading(true);
    resetMessages();
    try {
      if (mode === "register") {
        await signUpWithEmail(email.trim(), password, name);
        try {
          await signInWithEmail(email.trim(), password);
        } catch {
          setMessage(
            "Account created. Check your email to confirm your address, then sign in."
          );
        }
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (e) {
      setError(
        mode === "login"
          ? "Invalid email or password."
          : e instanceof Error
            ? e.message
            : "Something went wrong."
      );
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setEmailLoading(true);
    resetMessages();
    try {
      await resetPasswordForEmail(email.trim());
      setMessage(RESET_SUCCESS_MESSAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleOAuth(provider: SocialAuthProvider) {
    setOauthProvider(provider);
    setError(null);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithFacebook();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in was cancelled or failed.");
    } finally {
      setOauthProvider(null);
    }
  }

  function openWebPath(path: string) {
    if (!WEB_BASE_URL) return;
    void Linking.openURL(`${WEB_BASE_URL}${path}`);
  }

  const modeToggle = (
    <Text className="text-center text-sm text-ink-500">
      {mode === "login" ? "No account? " : "Already have an account? "}
      <Text
        className="font-medium text-sage-700"
        onPress={() => switchMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Create one" : "Sign in"}
      </Text>
    </Text>
  );

  const legalFooter = (
    <Text className="mt-8 text-center text-xs leading-relaxed text-ink-400">
      By continuing, you agree to our{" "}
      {WEB_BASE_URL ? (
        <Text
          className="font-medium text-ink-500"
          onPress={() => openWebPath("/terms")}
        >
          Terms of Service
        </Text>
      ) : (
        <Text className="font-medium text-ink-500">Terms of Service</Text>
      )}{" "}
      and acknowledge our{" "}
      {WEB_BASE_URL ? (
        <Text
          className="font-medium text-ink-500"
          onPress={() => openWebPath("/privacy")}
        >
          Privacy Policy
        </Text>
      ) : (
        <Text className="font-medium text-ink-500">Privacy Policy</Text>
      )}
      .
    </Text>
  );

  const backButton = (target: Step) => (
    <TouchableOpacity
      onPress={() => {
        resetMessages();
        setStep(target);
      }}
      className="mb-5 flex-row items-center gap-1 self-start"
      hitSlop={10}
    >
      <Text className="text-sm text-ink-500">← Back</Text>
    </TouchableOpacity>
  );

  const alertBanner =
    error || message ? (
      <View className="gap-3">
        {error ? (
          <View className="rounded-lg border border-coral-200 bg-coral-50 px-3 py-2">
            <Text className="text-sm text-coral-800">{error}</Text>
          </View>
        ) : null}
        {message ? (
          <View className="rounded-lg border border-sage-200 bg-sage-50 px-3 py-2">
            <Text className="text-sm text-sage-800">{message}</Text>
          </View>
        ) : null}
      </View>
    ) : null;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerClassName={`grow px-8 ${keyboardOpen ? "justify-start" : "justify-center"}`}
        contentContainerStyle={{
          paddingTop: insets.top + (keyboardOpen ? 24 : 48),
          paddingBottom: keyboardOpen
            ? (Platform.OS === "ios"
                ? KEYBOARD_BOTTOM_CUSHION
                : keyboardHeight + KEYBOARD_BOTTOM_CUSHION) + insets.bottom
            : insets.bottom + 48,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View className="mb-8 items-center">
          <Text className="text-center font-display text-3xl font-semibold text-ink-900">
            {heading}
          </Text>
          {step === "choose" ? (
            <>
              <Text className="mt-4 text-center text-sm leading-relaxed text-ink-500">
                English Journal helps you learn English through daily writing.
                Craft entries paragraph by paragraph, get AI feedback on grammar,
                tone, and word choice, then save your progress across devices.
              </Text>
              <Text className="mt-6 text-center font-display text-xl font-semibold text-ink-900">
                {subheading}
              </Text>
            </>
          ) : (
            <Text className="mt-2 text-center text-sm text-ink-500">{subheading}</Text>
          )}
        </View>

        {step === "choose" ? (
          <View className="w-full gap-6">
            <SocialAuthButtons
              loadingProvider={oauthProvider}
              disabled={emailLoading}
              onPress={handleOAuth}
            />

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-ink-200" />
              <Text className="text-xs font-medium uppercase tracking-wide text-ink-400">
                or
              </Text>
              <View className="h-px flex-1 bg-ink-200" />
            </View>

            <PillButton
              label={mode === "login" ? "Sign in with email" : "Sign up with email"}
              onPress={() => {
                resetMessages();
                setStep("email");
              }}
              disabled={oauthBusy}
              fullWidth
            />

            {error ? (
              <View className="rounded-lg border border-coral-200 bg-coral-50 px-3 py-2">
                <Text className="text-sm text-coral-800">{error}</Text>
              </View>
            ) : null}

            {modeToggle}
            {legalFooter}
          </View>
        ) : step === "forgot" ? (
          <View className="w-full rounded-2xl border border-ink-200/60 bg-white p-6">
            {backButton("email")}

            <View className="gap-4">
              <View>
                <Text className={labelClassName}>Email</Text>
                <TextInput
                  className={fieldClassName}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={handleInputFocus}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!emailLoading}
                  placeholderTextColor={colors.ink400}
                />
              </View>

              {alertBanner}

              <PillButton
                label={emailLoading ? "Sending link…" : "Send reset link"}
                onPress={handleForgotPassword}
                disabled={emailLoading}
                loading={emailLoading}
                fullWidth
                variant="primary"
              />
            </View>
          </View>
        ) : (
          <View className="w-full">
            <View className="rounded-2xl border border-ink-200/60 bg-white p-6">
              {backButton("choose")}

              <View className="gap-4">
                {mode === "register" ? (
                  <View>
                    <Text className={labelClassName}>Name (optional)</Text>
                    <TextInput
                      className={fieldClassName}
                      value={name}
                      onChangeText={setName}
                      onFocus={handleInputFocus}
                      autoCapitalize="words"
                      autoComplete="name"
                      editable={!emailLoading}
                      placeholderTextColor={colors.ink400}
                    />
                  </View>
                ) : null}

                <View>
                  <Text className={labelClassName}>Email</Text>
                  <TextInput
                    className={fieldClassName}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={handleInputFocus}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!emailLoading}
                    placeholderTextColor={colors.ink400}
                  />
                </View>

                <View>
                  <View className="mb-1.5 flex-row items-center justify-between gap-2">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Password
                    </Text>
                    {mode === "login" ? (
                      <TouchableOpacity
                        onPress={() => {
                          resetMessages();
                          setStep("forgot");
                        }}
                        hitSlop={8}
                        disabled={emailLoading}
                      >
                        <Text className="text-xs font-medium text-sage-700">
                          Forgot password?
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View className="relative">
                    <TextInput
                      className={`${fieldClassName} pr-14`}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={handleInputFocus}
                      secureTextEntry={!showPassword}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      editable={!emailLoading}
                      placeholderTextColor={colors.ink400}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((visible) => !visible)}
                      className="absolute bottom-0 right-0 top-0 justify-center px-3"
                      hitSlop={8}
                      disabled={emailLoading}
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    >
                      <Text className="text-xs font-medium text-ink-400">
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {mode === "register" ? (
                    <Text className="mt-1 text-xs text-ink-400">
                      At least 8 characters.
                    </Text>
                  ) : null}
                </View>

                {alertBanner}

                <PillButton
                  label={
                    emailLoading
                      ? mode === "login"
                        ? "Signing in…"
                        : "Creating account…"
                      : mode === "login"
                        ? "Sign in"
                        : "Create account"
                  }
                  onPress={handleSubmit}
                  disabled={emailLoading}
                  loading={emailLoading}
                  fullWidth
                  variant="primary"
                />
              </View>

              <View className="mt-4">{modeToggle}</View>
            </View>

            {legalFooter}
          </View>
        )}

        {step === "forgot" ? legalFooter : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
