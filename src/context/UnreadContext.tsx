"use client";

/**
 * UnreadContext — Tracks per-conversation unread message counts.
 *
 * Architecture (hybrid):
 *  - In-memory `counts` (React state) holds exact real-time counts during a
 *    live session. These are incremented by SocketContext on every incoming WS
 *    message and cleared when the user opens that chat.
 *
 *  - localStorage stores `lastReadAt` — a map of { [peerId]: isoTimestamp }.
 *    This is written whenever a chat is opened (clear) and read on every page
 *    load to reconstruct baseline "has unread" state from the backend
 *    conversation list without storing any message content.
 *
 * Security:
 *  - localStorage key: "sk_last_read_v1_<currentUserId>"
 *  - Value stored: Record<peerId, ISO-8601 string> — timestamps only.
 *  - No plaintext messages, no private keys, no tokens, no ciphertext.
 *
 * Persistence guarantee:
 *  - On page reload: `hydrateFromConversations` compares each
 *    conversation.last_message_at vs lastReadAt[peerId].
 *    If the conversation has a newer message, count is set to 1 (minimum).
 *  - During live session: WS increments give exact counts (1, 2, … 9+).
 *  - On chat open: count cleared + lastReadAt updated in localStorage.
 *  - On logout: in-memory counts cleared (localStorage retained for next login).
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Conversation } from "@/lib/types";

// ─── localStorage helpers ────────────────────────────────────────────────────

const STORAGE_PREFIX = "sk_last_read_v1_";

/** Read the lastReadAt map for a given user from localStorage. */
function loadLastReadMap(currentUserId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${currentUserId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Malformed entry — ignore and start fresh
  }
  return {};
}

/** Persist the lastReadAt map for a given user to localStorage. */
function saveLastReadMap(
  currentUserId: string,
  map: Record<string, string>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${currentUserId}`,
      JSON.stringify(map)
    );
  } catch {
    // localStorage unavailable (private mode, quota exceeded) — silently skip
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnreadContextValue {
  /** Live unread counts map — used directly by ConversationList for rendering. */
  counts: Record<string, number>;
  /** Get the unread count for a given peer. */
  getCount: (peerId: string) => number;
  /**
   * Increment the in-memory unread count for a peer by 1.
   * Called by SocketContext on every incoming WS message.
   */
  increment: (peerId: string) => void;
  /**
   * Clear the unread count for a peer and record the current time as lastReadAt.
   * Called when the user opens a chat (mount of chat page, or click in dashboard).
   * `currentUserId` is required to scope the localStorage write correctly.
   */
  clear: (peerId: string, currentUserId?: string) => void;
  /** Clear all in-memory counts (e.g. on logout). Does not wipe localStorage. */
  clearAll: () => void;
  /**
   * Hydrate in-memory counts from a freshly fetched conversation list.
   * For each conversation whose last_message_at is newer than the stored
   * lastReadAt for that peer, the count is set to at least 1.
   * This runs after every getConversations() call in ConversationList.
   */
  hydrateFromConversations: (
    conversations: Conversation[],
    currentUserId: string
  ) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UnreadContext = createContext<UnreadContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  // ── getCount ────────────────────────────────────────────────────────────────

  const getCount = useCallback(
    (peerId: string): number => counts[peerId] ?? 0,
    [counts]
  );

  // ── increment ───────────────────────────────────────────────────────────────

  const increment = useCallback((peerId: string) => {
    setCounts((prev) => ({
      ...prev,
      [peerId]: (prev[peerId] ?? 0) + 1,
    }));
  }, []);

  // ── clear ───────────────────────────────────────────────────────────────────

  const clear = useCallback((peerId: string, currentUserId?: string) => {
    // 1. Zero the in-memory count
    setCounts((prev) => {
      if (!prev[peerId]) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });

    // 2. Write lastReadAt = now to localStorage (if we have a userId to scope it)
    if (currentUserId) {
      const map = loadLastReadMap(currentUserId);
      map[peerId] = new Date().toISOString();
      saveLastReadMap(currentUserId, map);
    }
  }, []);

  // ── clearAll ────────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setCounts({});
    // Note: we deliberately do NOT wipe localStorage here.
    // Keeping lastReadAt means the next login can still compute correct
    // baseline unread state from the backend conversation list.
  }, []);

  // ── hydrateFromConversations ─────────────────────────────────────────────────

  const hydrateFromConversations = useCallback(
    (conversations: Conversation[], currentUserId: string) => {
      if (!currentUserId || conversations.length === 0) return;

      const lastReadMap = loadLastReadMap(currentUserId);

      setCounts((prev) => {
        const next = { ...prev };

        for (const conv of conversations) {
          const peerId = conv.user_id;

          // Skip if there is already a live WS-incremented count for this peer
          // (trust the exact real-time count over the baseline estimate).
          if ((next[peerId] ?? 0) > 0) continue;

          const lastReadAt = lastReadMap[peerId];

          if (!lastReadAt) {
            // Never opened this chat — mark as unread if there's any activity
            // We use a sentinel of 1 to indicate "at least one unread".
            // We don't know the exact count from the conversation list alone.
            if (conv.last_message_at) {
              next[peerId] = 1;
            }
            continue;
          }

          // Compare timestamps: if the conversation has a message newer than
          // when we last read it, mark as unread with a minimum count of 1.
          const lastMessageTime = new Date(conv.last_message_at).getTime();
          const lastReadTime = new Date(lastReadAt).getTime();

          if (lastMessageTime > lastReadTime) {
            next[peerId] = 1;
          } else {
            // Conversation is fully read — ensure no stale count
            delete next[peerId];
          }
        }

        return next;
      });
    },
    []
  );

  return (
    <UnreadContext.Provider
      value={{ counts, getCount, increment, clear, clearAll, hydrateFromConversations }}
    >
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

// ─── CustomEvent helper ───────────────────────────────────────────────────────

/**
 * Dispatch a conversation-updated event so ConversationList auto-refreshes
 * without requiring navigation or a manual reload.
 */
export function dispatchConversationUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silentkey:conversation-updated"));
  }
}
