import * as SecureStore from "expo-secure-store";

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

export const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(sanitizeKey(key)),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(sanitizeKey(key), value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(sanitizeKey(key)),
};
