/**
 * auth.ts — Session persistence helpers and input validators.
 *
 * Security model:
 *  - Only accessToken, refreshToken, and UserProfile are persisted.
 *  - privateKey (CryptoKey) is NEVER stored — lives in React memory only.
 *  - On page reload, tokens are restored but the user must re-enter their
 *    password to restore the private key before they can decrypt messages.
 *
 * sessionStorage is used over localStorage so the session clears when
 * the browser tab is closed.
 */

import type { UserProfile } from "@/lib/types";

const SESSION_KEY = "silentkey-auth-session";

export interface StoredAuthSession {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export function saveAuthSession(session: StoredAuthSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage may be unavailable (SSR, restrictive browser policy)
  }
}

export function loadAuthSession(): StoredAuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "accessToken" in parsed &&
      "refreshToken" in parsed &&
      "user" in parsed
    ) {
      return parsed as StoredAuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// ─── Input validators ─────────────────────────────────────────────────────────

export function validateUsername(username: string): string | null {
  const t = username.trim();
  if (!t) return "Username is required.";
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(t))
    return "3–32 characters: letters, digits, _ or - only.";
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  if (!displayName.trim()) return "Display name is required.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  return null;
}
