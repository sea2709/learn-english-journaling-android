import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { signInWithOAuthProvider } from "../lib/oauth";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  canChangePassword: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name?.trim() || null,
        },
      },
    });
    if (error) throw error;
  },

  signInWithGoogle: async () => {
    await signInWithOAuthProvider("google");
  },

  signInWithFacebook: async () => {
    await signInWithOAuthProvider("facebook");
  },

  resetPasswordForEmail: async (email) => {
    const webBase = (process.env.EXPO_PUBLIC_WEB_API_URL ?? "").replace(/\/$/, "");
    if (!webBase) {
      throw new Error(
        "Password reset is not configured. Set EXPO_PUBLIC_WEB_API_URL to your web app URL."
      );
    }
    // Complete the reset on the web app (same flow as desktop).
    const redirectTo = `${webBase}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  },

  changePassword: async (currentPassword, newPassword) => {
    const email = useAuthStore.getState().user?.email;
    if (!email) throw new Error("Account email is required to change password.");

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) throw new Error("Current password is incorrect.");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  canChangePassword: () => {
    const user = useAuthStore.getState().user;
    if (!user?.email) return false;
    return (user.identities ?? []).some((identity) => identity.provider === "email");
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
