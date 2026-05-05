"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUnread, dispatchConversationUpdated } from "@/context/UnreadContext";
import { getMessages, getUserPublicKey, sendMessageFallback, ApiError } from "@/lib/api";
import { encryptMessageForRecipient, decryptMessagePayload } from "@/lib/crypto";
import { useSocket } from "@/context/SocketContext";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatComposer } from "@/components/ChatComposer";
import { MessageBubble } from "@/components/MessageBubble";
import { DecryptionNotice } from "@/components/DecryptionNotice";
import { Button } from "@/components/ui/Button";
import { ConversationList } from "@/components/ConversationList";
import { UserSearch } from "@/components/UserSearch";
import {
  isSameDay,
  formatDayLabel,
  type DecryptedMessage,
} from "@/lib/message-utils";
import type { Message, Conversation, PublicUser } from "@/lib/types";
import type { MessageReceiveEvent, OutgoingMessageSendEvent } from "@/lib/websocket";

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-full border-2 border-[#25D366] border-t-transparent animate-spin ${className ?? "w-6 h-6"}`}
      aria-hidden="true"
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OPTIMISTIC_PREFIX = "optimistic-ws-";

// ─── Chat inner ───────────────────────────────────────────────────────────────

function ChatContent() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    user,
    accessToken,
    privateKey,
    isAuthenticated,
    isCryptoReady,
    isLoading,
    logout,
  } = useAuth();
  const { clear: clearUnread } = useUnread();
  const { status: socketStatus, isOpen: wsIsOpen, sendJson, reconnect } = useSocket();

  const recipientUserId = params.userId ?? "";
  const displayName = searchParams.get("name") ?? "Unknown User";
  const username = searchParams.get("username") ?? "";

  // State
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recipientOnline, setRecipientOnline] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  // Clear unread
  useEffect(() => {
    if (recipientUserId && user?.id) {
      clearUnread(recipientUserId, user.id);
    }
  }, [recipientUserId, user?.id, clearUnread]);

  // Decrypt
  const decryptOne = useCallback(
    async (msg: Message, pending = false): Promise<DecryptedMessage> => {
      const isOwnMessage = msg.from_user_id === user?.id;
      if (!privateKey || !user) {
        return {
          id: msg.id, fromUserId: msg.from_user_id, toUserId: msg.to_user_id,
          isOwnMessage, decrypted: null, decryptionFailed: true,
          createdAt: msg.created_at, delivered: msg.delivered, pending,
        };
      }
      try {
        const plaintext = await decryptMessagePayload({
          ciphertext: msg.payload.ciphertext,
          iv: msg.payload.iv,
          encryptedKey: msg.payload.encryptedKey,
          encryptedKeyForSelf: msg.payload.encryptedKeyForSelf,
          privateKey,
          isOwnMessage,
        });
        return {
          id: msg.id, fromUserId: msg.from_user_id, toUserId: msg.to_user_id,
          isOwnMessage, decrypted: plaintext, decryptionFailed: false,
          createdAt: msg.created_at, delivered: msg.delivered, pending,
        };
      } catch {
        return {
          id: msg.id, fromUserId: msg.from_user_id, toUserId: msg.to_user_id,
          isOwnMessage, decrypted: null, decryptionFailed: true,
          createdAt: msg.created_at, delivered: msg.delivered, pending,
        };
      }
    },
    [privateKey, user]
  );

  const appendIfNew = useCallback((msg: DecryptedMessage) => {
    setMessages((prev) => {
      if (!msg.id.startsWith(OPTIMISTIC_PREFIX) && prev.some((m) => m.id === msg.id)) {
        return prev;
      }
      return [...prev, msg];
    });
  }, []);

  // WS incoming
  useEffect(() => {
    const handler = async (e: Event) => {
      const event = (e as CustomEvent<MessageReceiveEvent>).detail;
      if (event.from_user_id === user?.id) return;
      if (
        event.from_user_id !== recipientUserId &&
        event.to_user_id !== recipientUserId
      ) return;

      const msgShape: Message = {
        id: event.id,
        from_user_id: event.from_user_id,
        to_user_id: event.to_user_id,
        payload: event.payload,
        delivered: event.delivered ?? false,
        created_at: event.created_at,
      };
      const decrypted = await decryptOne(msgShape);
      appendIfNew(decrypted);
    };

    window.addEventListener("silentkey:message-received", handler);
    return () => window.removeEventListener("silentkey:message-received", handler);
  }, [user?.id, recipientUserId, decryptOne, appendIfNew]);

  // Presence
  useEffect(() => {
    const onOnline = (e: Event) => {
      const { userId } = (e as CustomEvent<{ userId: string }>).detail;
      if (userId === recipientUserId) setRecipientOnline(true);
    };
    const onOffline = (e: Event) => {
      const { userId } = (e as CustomEvent<{ userId: string }>).detail;
      if (userId === recipientUserId) setRecipientOnline(false);
    };
    window.addEventListener("silentkey:user-online", onOnline);
    window.addEventListener("silentkey:user-offline", onOffline);
    return () => {
      window.removeEventListener("silentkey:user-online", onOnline);
      window.removeEventListener("silentkey:user-offline", onOffline);
    };
  }, [recipientUserId]);

  // Load history
  const loadChat = useCallback(async () => {
    if (!accessToken || !isCryptoReady || !recipientUserId) return;

    setLoadError(null);
    setIsLoadingKey(true);

    try {
      const { public_key } = await getUserPublicKey(accessToken, recipientUserId);
      setRecipientPublicKey(public_key);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? `Failed to load recipient info: ${err.detail}`
          : "Failed to load recipient info."
      );
      setIsLoadingKey(false);
      return;
    }

    setIsLoadingKey(false);
    setIsLoadingMessages(true);

    try {
      const raw = await getMessages(accessToken, recipientUserId, { limit: 50 });
      const reversed = [...raw].reverse();
      const decrypted = await Promise.all(reversed.map((m) => decryptOne(m)));
      setMessages(decrypted);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? `Failed to load messages: ${err.detail}`
          : "Failed to load message history."
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }, [accessToken, isCryptoReady, recipientUserId, decryptOne]);

  useEffect(() => {
    if (isCryptoReady && accessToken) void loadChat();
  }, [isCryptoReady, accessToken, loadChat]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSend = useCallback(
    async (plaintext: string) => {
      if (!accessToken || !privateKey || !user || !recipientPublicKey) {
        throw new Error("Cannot send: session or recipient key not ready.");
      }

      setIsSending(true);

      try {
        const encrypted = await encryptMessageForRecipient({
          plaintext,
          recipientPublicKeyBase64: recipientPublicKey,
          senderPublicKeyBase64: user.public_key,
        });

        if (wsIsOpen && socketStatus === "open") {
          const wsPayload: OutgoingMessageSendEvent = {
            event: "message.send",
            to: recipientUserId,
            payload: encrypted,
          };
          const sent = sendJson(wsPayload);

          if (sent) {
            const optimisticMsg: Message = {
              id: `${OPTIMISTIC_PREFIX}${Date.now()}`,
              from_user_id: user.id,
              to_user_id: recipientUserId,
              payload: encrypted,
              delivered: false,
              created_at: new Date().toISOString(),
            };
            const decryptedOptimistic = await decryptOne(optimisticMsg, true);
            appendIfNew(decryptedOptimistic);
            dispatchConversationUpdated();
            return;
          }
        }

        const sentMsg = await sendMessageFallback(accessToken, {
          to: recipientUserId,
          payload: encrypted,
        });

        const decryptedSent = await decryptOne(sentMsg);
        appendIfNew(decryptedSent);
        dispatchConversationUpdated();
      } finally {
        setIsSending(false);
      }
    },
    [
      accessToken, privateKey, user, recipientPublicKey,
      recipientUserId, wsIsOpen, socketStatus, sendJson,
      decryptOne, appendIfNew,
    ]
  );

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const handleSelectUser = (u: PublicUser) => {
    const params = new URLSearchParams({
      name: u.display_name,
      username: u.username,
    });
    router.push(`/chat/${encodeURIComponent(u.id)}?${params.toString()}`);
  };

  const handleSelectConversation = useCallback((c: Conversation) => {
    const params = new URLSearchParams({
      name: c.display_name,
      username: c.username,
    });
    router.push(`/chat/${encodeURIComponent(c.user_id)}?${params.toString()}`);
  }, [router]);

  // ── Loading splash ───────────────────────────────────────────────────────────
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B141A]">
        <Spinner />
      </div>
    );
  }

  // ── Locked: no private key ───────────────────────────────────────────────────
  if (!isCryptoReady) {
    return (
      <div className="min-h-screen bg-[#0B141A] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#111B21] border border-[#2A3942] rounded-2xl p-8 flex flex-col gap-5 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/25 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#f59e0b]" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#E9EDEF]">Private key not loaded</h1>
            <p className="text-sm text-[#8696A0] mt-1 leading-relaxed">
              For security, SilentKey does not store your private key.
              Please sign in again to decrypt this conversation.
            </p>
          </div>
          <div className="rounded-xl bg-[#202C33] border border-[#2A3942] px-4 py-3 text-xs text-[#8696A0] leading-relaxed">
            🔒 Your private key exists in memory only while you are signed in.
            It is cleared when you close the tab or refresh.
          </div>
          <Button id="locked-chat-signin" fullWidth onClick={() => router.push("/login")}>
            Sign in again
          </Button>
          <Button id="locked-chat-dashboard" variant="ghost" fullWidth onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Full chat layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#0B141A] overflow-hidden">
      
      {/* ── Sidebar (Hidden on mobile, visible on desktop) ───── */}
      <aside
        className={[
          "relative hidden md:flex",
          "w-[380px] shrink-0",
          "h-full",
          "flex-col border-r border-[#2A3942] bg-[#111B21]",
          "z-30",
        ].join(" ")}
        aria-label="Conversations"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#202C33] border-b border-[#2A3942] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2A3942] flex items-center justify-center text-[#E9EDEF] font-semibold text-base shrink-0 select-none">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#E9EDEF] truncate leading-tight">
                {user.display_name}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#2A3942]/50 rounded-full transition-colors"
            title="Sign out"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="border-b border-[#2A3942] py-1 bg-[#111B21]">
          <UserSearch
            token={accessToken!}
            currentUserId={user.id}
            onSelectUser={handleSelectUser}
          />
        </div>
        <div className="flex-1 overflow-y-auto bg-[#111B21]">
          <ConversationList
            token={accessToken!}
            currentUserId={user.id}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </aside>

      {/* ── Main Chat Area ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden chat-bg relative" id="main-content">
        <ChatHeader
          displayName={displayName}
          username={username || undefined}
          isLoading={isLoadingKey || isLoadingMessages}
          socketStatus={socketStatus}
          recipientOnline={recipientOnline}
          onReload={loadChat}
        />

        {/* Reconnect bar */}
        {(socketStatus === "closed" || socketStatus === "error") && (
          <div className="flex items-center justify-between px-4 py-2 bg-[#f59e0b]/10 border-b border-[#f59e0b]/20 text-xs text-[#f59e0b] shrink-0">
            <span>
              {socketStatus === "error"
                ? "WebSocket connection error — messages are using REST fallback."
                : "Real-time disconnected — messages are using REST fallback."}
            </span>
            <button
              onClick={reconnect}
              className="ml-4 font-semibold underline hover:opacity-80 transition-opacity"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* Thread */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5"
          aria-label="Message thread"
          role="list"
        >
          <DecryptionNotice />

          {isLoadingKey && (
            <div className="flex justify-center py-6">
              <div className="flex flex-col items-center gap-2 bg-[#202C33] px-4 py-2 rounded-xl shadow-sm">
                <Spinner className="w-5 h-5" />
                <p className="text-[11px] text-[#8696A0]">Loading contact…</p>
              </div>
            </div>
          )}

          {!isLoadingKey && isLoadingMessages && (
            <div className="flex justify-center py-6">
              <div className="flex flex-col items-center gap-2 bg-[#202C33] px-4 py-2 rounded-xl shadow-sm">
                <Spinner className="w-5 h-5" />
                <p className="text-[11px] text-[#8696A0]">Decrypting messages…</p>
              </div>
            </div>
          )}

          {loadError && !isLoadingKey && !isLoadingMessages && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="bg-[#202C33] px-6 py-4 rounded-xl shadow-sm flex flex-col items-center border border-[#2A3942]">
                <p className="text-sm text-[#ef4444] text-center mb-3">{loadError}</p>
                <Button variant="ghost" size="sm" onClick={loadChat}>Retry</Button>
              </div>
            </div>
          )}

          {!isLoadingKey && !isLoadingMessages && !loadError && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16 text-center">
              <div className="bg-[#202C33] px-6 py-5 rounded-2xl shadow-sm border border-[#2A3942] max-w-sm">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#25D366]/10 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#25D366]" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#E9EDEF]">No messages yet</p>
                <p className="text-xs text-[#8696A0] mt-1.5 leading-relaxed">
                  Send a message to start an end-to-end encrypted chat with {displayName}.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => {
            const prevMsg = messages[idx - 1];
            const showDayLabel = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
            
            // Add a little extra margin top if the sender changes (optional, but looks better)
            const showTail = !prevMsg || prevMsg.fromUserId !== msg.fromUserId || showDayLabel;

            return (
              <div key={msg.id} className={showTail ? "mt-1.5" : "mt-0.5"}>
                {showDayLabel && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-[#8696A0] font-medium bg-[#111B21]/80 backdrop-blur-sm border border-[#2A3942]/50 rounded-lg px-3 py-1.5 shadow-sm">
                      {formatDayLabel(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble message={msg} />
              </div>
            );
          })}

          <div ref={bottomRef} aria-hidden="true" className="h-2" />
        </div>

        <ChatComposer
          onSend={handleSend}
          disabled={!recipientPublicKey || isLoadingKey}
          isSending={isSending}
        />
      </main>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0B141A]">
          <Spinner />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
