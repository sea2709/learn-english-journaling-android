/** Web reads and writes Supabase directly; no offline SQLite sync loop. */
export function useSyncWhenOnline(_userId: string | null) {}

/** @deprecated Use useSyncWhenOnline */
export const useSyncOnReconnect = useSyncWhenOnline;
