function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

function webStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export const secureStorage = {
  getItem: async (key: string) => webStorage()?.getItem(sanitizeKey(key)) ?? null,
  setItem: async (key: string, value: string) => {
    webStorage()?.setItem(sanitizeKey(key), value);
  },
  removeItem: async (key: string) => {
    webStorage()?.removeItem(sanitizeKey(key));
  },
};
