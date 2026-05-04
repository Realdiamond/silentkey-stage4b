"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  createRegistrationKeyBundle,
  restorePrivateKeyFromPassword,
} from "@/lib/crypto";
import { registerUser, loginUser, logoutUser, ApiError } from "@/lib/api";
import {
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
  type StoredAuthSession,
} from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** ⚠ Lives in memory only. Never serialised or stored. Null after page reload. */
  privateKey: CryptoKey | null;
  isAuthenticated: boolean;
  /** True only when privateKey is in memory (required to decrypt messages). */
  isCryptoReady: boolean;
  isLoading: boolean;
  authError: string | null;
  register(
    username: string,
    displayName: string,
    password: string
  ): Promise<boolean>;
  login(username: string, password: string): Promise<boolean>;
  logout(): Promise<void>;
  clearError(): void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Restore non-sensitive session on mount.
  // privateKey is NOT restored — user must re-enter password to decrypt.
  useEffect(() => {
    const session = loadAuthSession();
    if (session) {
      setUser(session.user);
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
    }
    setIsLoading(false);
  }, []);

  const toFriendlyError = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 409) return "That username is already taken.";
      if (err.status === 401) return "Invalid username or password.";
      if (err.status === 422) return "Please check your input and try again.";
      if (err.detail) return err.detail;
    }
    if (err instanceof Error) return err.message;
    return "An unexpected error occurred. Please try again.";
  };

  const persist = (session: StoredAuthSession) => {
    setUser(session.user);
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    saveAuthSession(session);
  };

  const register = useCallback(
    async (
      username: string,
      displayName: string,
      password: string
    ): Promise<boolean> => {
      setIsLoading(true);
      setAuthError(null);
      try {
        // Step 1: Generate RSA keypair + wrap private key — browser only
        const bundle = await createRegistrationKeyBundle(password);

        // Step 2: Register account with server
        const res = await registerUser({
          username,
          display_name: displayName,
          password,
          public_key: bundle.publicKey,
          wrapped_private_key: bundle.wrappedPrivateKey,
          pbkdf2_salt: bundle.pbkdf2Salt,
        });

        // Step 3: Store tokens + profile (never the private key)
        persist({
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
          user: res.user,
        });

        // Step 4: Keep private key in memory for this session
        setPrivateKey(bundle.privateKey);
        return true;
      } catch (err) {
        setAuthError(toFriendlyError(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setAuthError(null);
      try {
        // Step 1: Authenticate with server
        const res = await loginUser({ username, password });

        // Step 2: Re-derive AES-GCM key via PBKDF2, unwrap RSA private key
        // The wrapped_private_key and pbkdf2_salt come from the server.
        // Only the correct password produces the correct wrapping key.
        const key = await restorePrivateKeyFromPassword(
          password,
          res.user.wrapped_private_key,
          res.user.pbkdf2_salt
        );

        // Step 3: Persist safe session data
        persist({
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
          user: res.user,
        });

        // Step 4: Keep private key in memory only
        setPrivateKey(key);
        return true;
      } catch (err) {
        setAuthError(toFriendlyError(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    // Best-effort server logout — clear state regardless of outcome
    try {
      if (accessToken && refreshToken) {
        await logoutUser(accessToken, refreshToken);
      }
    } catch {
      // Silently ignored
    } finally {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setPrivateKey(null);
      setAuthError(null);
      clearAuthSession();
      setIsLoading(false);
    }
  }, [accessToken, refreshToken]);

  const clearError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        privateKey,
        isAuthenticated: user !== null && accessToken !== null,
        isCryptoReady: privateKey !== null,
        isLoading,
        authError,
        register,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be called inside <AuthProvider>");
  return ctx;
}
