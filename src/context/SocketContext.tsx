"use client";

/**
 * SocketContext — Global WebSocket connection for the entire authenticated app.
 *
 * This context is mounted once at app level (inside <Providers>).
 * It ensures the WebSocket is alive whenever the user is authenticated,
 * regardless of which route they are on (dashboard OR chat).
 *
 * Responsibilities:
 * - Open one WebSocket connection when auth + crypto are ready.
 * - On message.receive:
 *   1. Always dispatch "silentkey:conversation-updated" so ConversationList refreshes.
 *   2. If the user is NOT currently inside /chat/<from_user_id>:
 *      increment unread count for that sender.
 *   3. Dispatch "silentkey:message-received" so the active chat page can
 *      decrypt and render the message.
 * - On presence events: dispatch "silentkey:user-online/offline" for the chat page.
 * - Handle close codes 4001 (refresh) and 4003 (logout).
 * - Expose status, isOpen, sendJson, reconnect to consumers.
 *
 * Security: no tokens, keys, or plaintext are logged.
 */

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUnread, dispatchConversationUpdated } from "@/context/UnreadContext";
import { useWhisperSocket, type SocketStatus } from "@/hooks/useWhisperSocket";
import type { MessageReceiveEvent } from "@/lib/websocket";

// ─── Context shape ────────────────────────────────────────────────────────────

interface SocketContextValue {
  status: SocketStatus;
  isOpen: boolean;
  sendJson: (payload: unknown) => boolean;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SocketProvider({ children }: { children: ReactNode }) {
  const {
    accessToken,
    privateKey,
    user,
    isAuthenticated,
    isCryptoReady,
    refreshSession,
    logout,
  } = useAuth();

  const { increment: incrementUnread } = useUnread();
  const pathname = usePathname();
  const router = useRouter();

  // Keep pathname + user.id in refs so callbacks always have the latest values
  // without needing to be recreated on every render.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const incrementUnreadRef = useRef(incrementUnread);
  incrementUnreadRef.current = incrementUnread;

  // ── Incoming message ────────────────────────────────────────────────────────

  const handleMessageReceive = useCallback(
    (event: MessageReceiveEvent) => {
      const currentUserId = userIdRef.current;
      const currentPathname = pathnameRef.current;

      console.log("[SilentKey unread] message received", {
        from: event.from_user_id,
        to: event.to_user_id,
        currentUserId,
        currentPathname,
      });

      // 1. Ignore echoes of own outgoing messages
      if (event.from_user_id === currentUserId) {
        // Still refresh the list so the sender's own row shows "just now"
        dispatchConversationUpdated();
        return;
      }

      // 2. Only process messages addressed to the current user
      if (event.to_user_id !== currentUserId) {
        return;
      }

      // 3. Check whether the user is currently viewing this sender's chat
      const senderChatPath = `/chat/${event.from_user_id}`;
      const isViewingThatChat =
        currentPathname === senderChatPath ||
        currentPathname?.startsWith(`${senderChatPath}?`) ||
        currentPathname?.startsWith(`${senderChatPath}/`);

      // 4. Increment BEFORE dispatching conversation-updated so that when
      //    ConversationList re-renders after the list refresh, the count is
      //    already non-zero and the badge renders immediately.
      if (!isViewingThatChat) {
        incrementUnreadRef.current(event.from_user_id);
      }

      // 5. Refresh conversation list (moves row to top, updates timestamp)
      dispatchConversationUpdated();

      // 6. Dispatch raw event for the active chat page to decrypt & render
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("silentkey:message-received", { detail: event })
        );
      }
    },
    [] // stable — uses refs for all dynamic values
  );

  // ── Presence events ─────────────────────────────────────────────────────────

  const handleUserOnline = useCallback((userId: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("silentkey:user-online", { detail: { userId } })
      );
    }
  }, []);

  const handleUserOffline = useCallback((userId: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("silentkey:user-offline", { detail: { userId } })
      );
    }
  }, []);

  // ── Token lifecycle ─────────────────────────────────────────────────────────

  const handleTokenExpired = useCallback(async (): Promise<string | null> => {
    return refreshSession();
  }, [refreshSession]);

  const handleTokenInvalid = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  // ── Enabled condition ───────────────────────────────────────────────────────
  // Only open the socket when all auth + crypto prerequisites are satisfied.

  const wsEnabled = Boolean(
    isAuthenticated && isCryptoReady && accessToken && privateKey && user
  );

  // ── Socket ──────────────────────────────────────────────────────────────────

  const { status, isOpen, sendJson, reconnect } = useWhisperSocket({
    accessToken,
    enabled: wsEnabled,
    onMessageReceive: handleMessageReceive,
    onUserOnline: handleUserOnline,
    onUserOffline: handleUserOffline,
    onTokenExpired: handleTokenExpired,
    onTokenInvalid: handleTokenInvalid,
  });

  return (
    <SocketContext.Provider value={{ status, isOpen, sendJson, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be called inside <SocketProvider>");
  return ctx;
}
