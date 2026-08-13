import { useEffect, useRef } from "react";
import * as Network from "expo-network";
import { isOnlineState, syncAll } from "./sync";
import { useEntriesStore } from "../store/entries";
import { usePreferencesStore } from "../store/preferences";

/**
 * Sync whenever the user is authenticated and the device is online:
 * login / session restore, cold start while online, and offline → online.
 * Should be called once near the app root.
 */
export function useSyncWhenOnline(userId: string | null) {
  const wasOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    wasOnlineRef.current = null;

    async function runSync() {
      try {
        await syncAll(userId!);
        if (cancelled) return;
        await useEntriesStore.getState().loadEntries(userId!);
        await usePreferencesStore.getState().load(userId!);
      } catch {
        // Sync errors are non-fatal; will retry on next online transition
      }
    }

    async function handleNetworkState(state: Network.NetworkState) {
      const isOnline = isOnlineState(state);
      // First online sighting (null → true) or reconnect (false → true)
      if (isOnline && wasOnlineRef.current !== true) {
        await runSync();
      }
      if (!cancelled) wasOnlineRef.current = isOnline;
    }

    Network.getNetworkStateAsync().then((state) => {
      if (!cancelled) handleNetworkState(state);
    });

    const subscription = Network.addNetworkStateListener((state) => {
      handleNetworkState(state);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [userId]);
}

/** @deprecated Use useSyncWhenOnline */
export const useSyncOnReconnect = useSyncWhenOnline;
