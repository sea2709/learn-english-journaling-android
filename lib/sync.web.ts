/**
 * Web has no local SQLite cache, so there is nothing to sync.
 * Journal reads/writes go straight to Supabase via database.web.ts.
 */
export async function syncAll(_userId: string): Promise<void> {}

export async function syncAllIfOnline(_userId: string): Promise<boolean> {
  return true;
}

export function isOnlineState(_state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }): boolean {
  return true;
}
