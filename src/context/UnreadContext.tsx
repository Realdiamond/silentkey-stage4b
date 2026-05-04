"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnreadContextValue {
  /** Get the unread count for a given user. */
  getCount: (userId: string) => number;
  /** Increment unread count for a user by 1. */
  increment: (userId: string) => void;
  /** Clear unread count for a user (e.g. when opening their chat). */
  clear: (userId: string) => void;
  /** Clear all unread counts (e.g. on logout). */
  clearAll: () => void;
  /** Raw counts map for rendering badges. */
  counts: Record<string, number>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UnreadContext = createContext<UnreadContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const getCount = useCallback(
    (userId: string): number => counts[userId] ?? 0,
    [counts]
  );

  const increment = useCallback((userId: string) => {
    setCounts((prev) => ({
      ...prev,
      [userId]: (prev[userId] ?? 0) + 1,
    }));
  }, []);

  const clear = useCallback((userId: string) => {
    setCounts((prev) => {
      if (!prev[userId]) return prev; // nothing to clear
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCounts({});
  }, []);

  return (
    <UnreadContext.Provider value={{ getCount, increment, clear, clearAll, counts }}>
      {children}
    </UnreadContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUnread(): UnreadContextValue {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error("useUnread must be called inside <UnreadProvider>");
  return ctx;
}

// ─── CustomEvent helpers ──────────────────────────────────────────────────────

/**
 * Dispatch a conversation-updated event. ConversationList listens for this
 * to auto-refresh its list without requiring navigation or manual reload.
 */
export function dispatchConversationUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silentkey:conversation-updated"));
  }
}

/**
 * Dispatch when a chat is opened, so other components can react
 * (e.g. clear unread for that user).
 */
export function dispatchConversationOpened(userId: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("silentkey:conversation-opened", { detail: { userId } })
    );
  }
}
