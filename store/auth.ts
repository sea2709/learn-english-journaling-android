import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { signInWithOAuthProvider } from "../lib/oauth";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
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

  signUpWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  signInWithGoogle: async () => {
    await signInWithOAuthProvider("google");
  },

  signInWithFacebook: async () => {
    await signInWithOAuthProvider("facebook");
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
