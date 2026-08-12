import { create } from "zustand";
import { Directory, File, Paths } from "expo-file-system";
import { loadModel, freeModel, isModelLoaded } from "../lib/ai";

// bartowski renamed the repo; the old path returns HTTP 401.
const MODEL_FILENAME = "google_gemma-3-1b-it-Q4_K_M.gguf";
const MODEL_URL =
  "https://huggingface.co/bartowski/google_gemma-3-1b-it-GGUF/resolve/main/google_gemma-3-1b-it-Q4_K_M.gguf";

function getModelFile(): File {
  return new File(Paths.document, "models", MODEL_FILENAME);
}

export function getModelPath(): string {
  return getModelFile().uri;
}

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

export const useModelStore = create<ModelState>((set, get) => ({
  downloaded: false,
  loaded: false,
  downloading: false,
  downloadProgress: 0,
  error: null,

  checkDownloaded: async () => {
    const downloaded = getModelFile().exists;
    const loaded = downloaded && (await isModelLoaded());
    set({ downloaded, loaded });
  },

  download: async () => {
    const modelsDir = new Directory(Paths.document, "models");
    if (!modelsDir.exists) {
      modelsDir.create({ intermediates: true, idempotent: true });
    }

    const destination = getModelFile();
    set({ downloading: true, error: null, downloadProgress: 0 });

    try {
      const task = File.createDownloadTask(MODEL_URL, destination, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          const pct = totalBytes > 0 ? bytesWritten / totalBytes : 0;
          set({ downloadProgress: pct });
        },
      });

      await task.downloadAsync();
      set({ downloaded: true, downloading: false, downloadProgress: 1 });
      await get().load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ downloading: false, error: msg });
      throw e;
    }
  },

  load: async () => {
    try {
      await loadModel(getModelPath());
      set({ loaded: true, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ loaded: false, error: msg });
      throw e;
    }
  },

  unload: async () => {
    await freeModel();
    set({ loaded: false });
  },
}));
