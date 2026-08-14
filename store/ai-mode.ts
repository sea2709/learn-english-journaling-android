import { Platform } from "react-native";
import { create } from "zustand";
import { secureStorage } from "../lib/secure-storage";
import type { AiMode } from "../lib/types";

const STORAGE_KEY = "aiMode";

function isWeb(): boolean {
  return Platform.OS === "web";
}

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
    if (isWeb()) {
      set({ mode: "api", chosen: true, loaded: true });
      return;
    }

    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
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
    const next = isWeb() ? "api" : mode;
    try {
      if (!isWeb()) {
        await secureStorage.setItem(STORAGE_KEY, next);
      }
      set({ mode: next, chosen: true });
    } catch (error) {
      console.error("Failed to save AI mode", error);
      throw error;
    }
  },
}));
