import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { AiMode } from "../lib/types";

const STORAGE_KEY = "aiMode";

interface AiModeState {
  mode: AiMode | null;
  chosen: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  setMode: (mode: AiMode) => Promise<void>;
}

export const useAiModeStore = create<AiModeState>((set) => ({
  mode: null,
  chosen: false,
  loaded: false,

  load: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw === "local" || raw === "api") {
        set({ mode: raw, chosen: true, loaded: true });
        return;
      }
      set({ mode: null, chosen: false, loaded: true });
    } catch (error) {
      console.error("Failed to load AI mode", error);
      set({ mode: null, chosen: false, loaded: true });
    }
  },

  setMode: async (mode) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, mode);
      set({ mode, chosen: true });
    } catch (error) {
      console.error("Failed to save AI mode", error);
      throw error;
    }
  },
}));
