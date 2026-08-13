import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, cx } from "../../lib/theme";
import { AnimatedDrawer, AnimatedMenu } from "./AnimatedShell";
import { AppFeedbackIcon, HamburgerIcon, KeyIcon, SettingsIcon, SignOutIcon } from "./icons";

type TopBarProps = {
  onEntries: () => void;
  onNewEntry: () => void;
  onReview: () => void;
  onReviewFocus: () => void;
  onAiMode: () => void;
  onAppFeedback: () => void;
  onChangePassword?: () => void;
  onSignOut: () => void;
  email?: string | null;
  canChangePassword?: boolean;
  reviewDisabled?: boolean;
};

type MenuAnchor = {
  top: number;
  right: number;
};

export function TopBar({
  onEntries,
  onNewEntry,
  onReview,
  onReviewFocus,
  onAiMode,
  onAppFeedback,
  onChangePassword,
  onSignOut,
  email,
  canChangePassword = false,
  reviewDisabled = false,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const hamburgerRef = useRef<View>(null);

  function closeMenu() {
    setMenuOpen(false);
  }

  function openMenu() {
    hamburgerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      setAnchor({
        top: y + height + 6,
        right: Math.max(8, screenWidth - (x + width)),
      });
      setMenuOpen(true);
    });
  }

  function run(action: () => void) {
    closeMenu();
    action();
  }

  return (
    <View className="flex-row items-center justify-between gap-2.5 border-b border-paper-line bg-paper px-3 pb-2.5 pt-2">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Text className="shrink font-display text-[17px] text-ink-900" numberOfLines={1}>
          English Journal
        </Text>
        <TouchableOpacity
          className="shrink-0 flex-row items-center gap-1 rounded-full border border-paper-line/80 bg-white/55 px-2.5 py-1.5"
          onPress={onEntries}
          activeOpacity={0.75}
        >
          <Text className="w-4 text-center text-[13px] font-semibold leading-4 text-pen">▤</Text>
          <Text className="text-xs font-medium text-ink-800">Entries</Text>
        </TouchableOpacity>
      </View>

      <View className="shrink-0">
        <View ref={hamburgerRef} collapsable={false}>
          <TouchableOpacity
            className="h-11 min-w-11 items-center justify-center rounded-full border border-paper-line/80 bg-white/55"
            onPress={() => (menuOpen ? closeMenu() : openMenu())}
            accessibilityLabel="More actions"
            activeOpacity={0.75}
          >
            <HamburgerIcon size={16} />
          </TouchableOpacity>
        </View>
      </View>

      <AnimatedMenu visible={menuOpen} onClose={closeMenu} anchor={anchor}>
        <MenuItem
          label="New entry"
          icon={<Text className="w-4 text-center text-[13px] font-semibold leading-4 text-pen">+</Text>}
          onPress={() => run(onNewEntry)}
        />

        <Text className="mb-0.5 mt-2 px-3.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
          Account
        </Text>
        {email ? (
          <Text className="px-3.5 pb-2 text-xs text-ink-500" numberOfLines={1}>
            {email}
          </Text>
        ) : null}
        <MenuItem
          label="Review focus"
          icon={<SettingsIcon />}
          onPress={() => run(onReviewFocus)}
        />
        <MenuItem
          label="AI review"
          icon={<Text className="w-4 text-center text-[13px] font-semibold leading-4 text-pen">◎</Text>}
          onPress={() => run(onAiMode)}
        />
        {canChangePassword && onChangePassword ? (
          <MenuItem
            label="Change password"
            icon={<KeyIcon />}
            onPress={() => run(onChangePassword)}
          />
        ) : null}
        <MenuItem
          label="App feedback"
          icon={<AppFeedbackIcon />}
          onPress={() => run(onAppFeedback)}
        />
        <View className="mx-2.5 my-1 h-px bg-paper-line" />
        <MenuItem label="Sign out" icon={<SignOutIcon />} onPress={() => run(onSignOut)} />

        <View className="mx-2.5 my-1 h-px bg-paper-line" />
        <MenuItem
          label="Review"
          icon={<Text className="w-4 text-center text-[13px] font-semibold leading-4 text-pen">✎</Text>}
          disabled={reviewDisabled}
          onPress={() => {
            if (!reviewDisabled) run(onReview);
          }}
        />
      </AnimatedMenu>
    </View>
  );
}

function MenuItem({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      className={cx(
        "flex-row items-center gap-2.5 px-3.5 py-3",
        disabled && "opacity-40"
      )}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View className="w-4 items-center justify-center">{icon}</View>
      <Text className="text-sm font-medium text-ink-800">{label}</Text>
    </TouchableOpacity>
  );
}

type ChangePasswordModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
};

export function ChangePasswordModal({ visible, onClose, onSubmit }: ChangePasswordModalProps) {
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCurrentPassword("");
    setNewPassword("");
    setSubmitting(false);
    setError(null);
    setSuccess(null);
  }, [visible]);

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(currentPassword, newPassword);
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatedDrawer visible={visible} onClose={onClose} side="right" maxWidth={380}>
      <KeyboardAvoidingView
        className="flex-1"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center justify-between border-b border-paper-line px-5 pb-3.5">
          <Text className="font-display text-lg text-ink-900">Change password</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text className="p-1 text-base text-ink-500">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerClassName="px-5 py-4 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {success ? (
            <View className="rounded-lg bg-sage-100/60 px-4 py-3.5">
              <Text className="text-sm text-sage-800">{success}</Text>
            </View>
          ) : (
            <>
              <Text className="mb-2 text-sm leading-[21px] text-ink-600">
                Enter your current password, then choose a new one. At least 6 characters.
              </Text>

              <Text className="mb-1.5 mt-3 text-[11px] font-bold tracking-wide text-ink-500">
                CURRENT PASSWORD
              </Text>
              <TextInput
                className="rounded-lg border border-paper-line bg-white/80 px-3 py-2.5 text-sm text-ink-900"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!submitting}
              />

              <Text className="mb-1.5 mt-3 text-[11px] font-bold tracking-wide text-ink-500">
                NEW PASSWORD
              </Text>
              <TextInput
                className="rounded-lg border border-paper-line bg-white/80 px-3 py-2.5 text-sm text-ink-900"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!submitting}
              />

              {error ? (
                <View className="mt-4 rounded-lg bg-coral-200/60 px-3 py-2.5">
                  <Text className="text-[13px] text-coral-800">{error}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        <View className="border-t border-paper-line px-5 pt-3.5">
          {success ? (
            <TouchableOpacity
              className="min-h-11 items-center justify-center rounded-full border border-paper-line/80 bg-white/55 py-3"
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-semibold text-ink-800">Close</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={cx(
                "min-h-11 items-center justify-center rounded-full border border-paper-line/80 bg-white/55 py-3",
                submitting && "opacity-[0.55]"
              )}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.ink800} />
              ) : (
                <Text className="text-sm font-semibold text-ink-800">Update password</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </AnimatedDrawer>
  );
}
