import { create } from "zustand";
import type { AnalysisPreferences } from "../lib/types";
import { DEFAULT_ANALYSIS_PREFERENCES } from "../lib/analysis-preferences";
import { loadPreferences, savePreferences } from "../lib/database";

interface PreferencesState {
  preferences: AnalysisPreferences;
  loaded: boolean;
  load: (userId: string) => Promise<void>;
  update: (prefs: AnalysisPreferences, userId: string) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  preferences: DEFAULT_ANALYSIS_PREFERENCES,
  loaded: false,

  load: async (userId) => {
    const prefs = await loadPreferences(userId);
    set({ preferences: prefs, loaded: true });
  },

  update: async (prefs, userId) => {
    await savePreferences(userId, prefs);
    set({ preferences: prefs });
  },
}));
