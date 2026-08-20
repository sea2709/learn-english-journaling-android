import { Platform } from "react-native";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import type { Provider } from "@supabase/supabase-js";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type SocialAuthProvider = Extract<Provider, "google" | "facebook">;

const NATIVE_REDIRECT_TO = "learnenglishjournaling://auth/callback";

function getRedirectTo(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  return NATIVE_REDIRECT_TO;
}

async function createSessionFromUrl(url: string): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const code = params.code;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (!accessToken) {
    throw new Error("No session returned from sign-in.");
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken ?? "",
  });
  if (error) throw error;
}

/**
 * Supabase OAuth for Google / Facebook.
 * Web: browser redirect. Native: auth session + deep-link token/code exchange.
 */
export async function signInWithOAuthProvider(
  provider: SocialAuthProvider
): Promise<void> {
  const redirectTo = getRedirectTo();

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) {
    throw new Error("No OAuth URL returned.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    throw new Error("Sign in was cancelled or failed.");
  }

  await createSessionFromUrl(result.url);
}
