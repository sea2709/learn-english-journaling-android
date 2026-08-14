import { create } from "zustand";

interface ModelState {
  downloaded: boolean;
  loaded: boolean;
  downloading: boolean;
  downloadProgress: number;
  error: string | null;
  checkDownloaded: () => Promise<void>;
  download: () => Promise<void>;
  load: () => Promise<void>;
  unload: () => Promise<void>;
}

export function getModelPath(): string {
  return "";
}

export const useModelStore = create<ModelState>((set) => ({
  downloaded: false,
  loaded: false,
  downloading: false,
  downloadProgress: 0,
  error: null,

  checkDownloaded: async () => {
    set({ downloaded: false, loaded: false });
  },

  download: async () => {
    throw new Error("On-device model download is not available on web. Use Cloud AI.");
  },

  load: async () => {
    set({ loaded: false });
  },

  unload: async () => {
    set({ loaded: false });
  },
}));
