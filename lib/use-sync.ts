import { useEffect, useRef } from "react";
import * as Network from "expo-network";
import { syncEntries } from "./sync";

/**
 * Hook that triggers a background sync whenever the device goes from offline → online.
 * Should be called once near the app root after the user is authenticated.
 */
export function useSyncOnReconnect(userId: string | null) {
  const wasOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function checkAndSync() {
      const state = await Network.getNetworkStateAsync();
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;

      if (wasOnlineRef.current === false && isOnline) {
        // Just came back online
        try {
          await syncEntries(userId!);
        } catch {
          // Sync errors are non-fatal; will retry on next reconnect
        }
      }

      if (!cancelled) wasOnlineRef.current = isOnline;
    }

    // Check immediately on mount
    checkAndSync();

    // Poll every 15 seconds
    const interval = setInterval(() => {
      if (!cancelled) checkAndSync();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);
}
