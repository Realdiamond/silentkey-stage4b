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
import { getMessages, getUserPublicKey, sendMessageFallback, ApiError } from "@/lib/api";
import { encryptMessageForRecipient, decryptMessagePayload } from "@/lib/crypto";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatComposer } from "@/components/ChatComposer";
import { MessageBubble } from "@/components/MessageBubble";
import { DecryptionNotice } from "@/components/DecryptionNotice";
import { Button } from "@/components/ui/Button";
import {
  isSameDay,
  formatDayLabel,
  type DecryptedMessage,
} from "@/lib/message-utils";
import type { Message } from "@/lib/types";

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-full border-2 border-primary border-t-transparent animate-spin ${className ?? "w-6 h-6"}`}
      aria-hidden="true"
    />
  );
}

// ─── Chat inner (needs Suspense for useSearchParams) ──────────────────────────

function ChatContent() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, accessToken, privateKey, isAuthenticated, isCryptoReady, isLoading, logout } =
    useAuth();

  const recipientUserId = params.userId ?? "";
  const displayName = searchParams.get("name") ?? "Unknown User";
  const username = searchParams.get("username") ?? "";

  // ── Component state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Guard: unauthenticated → /login ─────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  // ── Decrypt a single server Message into a DecryptedMessage ─────────────────
  const decryptOne = useCallback(
    async (msg: Message): Promise<DecryptedMessage> => {
      if (!privateKey || !user) {
        return {
          id: msg.id,
          fromUserId: msg.from_user_id,
          toUserId: msg.to_user_id,
          isOwnMessage: msg.from_user_id === user?.id,
          decrypted: null,
          decryptionFailed: true,
          createdAt: msg.created_at,
          delivered: msg.delivered,
        };
      }

      const isOwnMessage = msg.from_user_id === user.id;

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
          id: msg.id,
          fromUserId: msg.from_user_id,
          toUserId: msg.to_user_id,
          isOwnMessage,
          decrypted: plaintext,
          decryptionFailed: false,
          createdAt: msg.created_at,
          delivered: msg.delivered,
        };
      } catch {
        // Decryption failed — show safe fallback, never crash
        return {
          id: msg.id,
          fromUserId: msg.from_user_id,
          toUserId: msg.to_user_id,
          isOwnMessage,
          decrypted: null,
          decryptionFailed: true,
          createdAt: msg.created_at,
          delivered: msg.delivered,
        };
      }
    },
    [privateKey, user]
  );

  // ── Load recipient public key + message history ──────────────────────────────
  const loadChat = useCallback(async () => {
    if (!accessToken || !isCryptoReady || !recipientUserId) return;

    setLoadError(null);
    setIsLoadingKey(true);

    try {
      // Fetch recipient public key (needed for sending)
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
      // API returns newest first → reverse for oldest-first display
      const raw = await getMessages(accessToken, recipientUserId, { limit: 50 });
      const reversed = [...raw].reverse();

      // Decrypt all messages concurrently; individual failures are isolated
      const decrypted = await Promise.all(reversed.map(decryptOne));
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
    if (isCryptoReady && accessToken) {
      void loadChat();
    }
  }, [isCryptoReady, accessToken, loadChat]);

  // ── Auto-scroll to bottom when messages change ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send a new message ───────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (plaintext: string) => {
      if (!accessToken || !privateKey || !user || !recipientPublicKey) {
        throw new Error("Cannot send: session or recipient key not ready.");
      }

      setIsSending(true);

      try {
        // 1. Encrypt on-device — server never sees plaintext
        const encrypted = await encryptMessageForRecipient({
          plaintext,
          recipientPublicKeyBase64: recipientPublicKey,
          senderPublicKeyBase64: user.public_key,
        });

        // 2. Send encrypted payload to WhisperBox REST endpoint
        const sentMsg = await sendMessageFallback(accessToken, {
          to: recipientUserId,
          payload: encrypted,
        });

        // 3. Optimistically add the sent message — decrypt using encryptedKeyForSelf
        const decryptedSent = await decryptOne(sentMsg);
        setMessages((prev) => [...prev, decryptedSent]);
      } finally {
        setIsSending(false);
      }
    },
    [accessToken, privateKey, user, recipientPublicKey, recipientUserId, decryptOne]
  );

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  // ── Auth loading splash ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  // ── Locked: private key not in memory ───────────────────────────────────────
  if (!isCryptoReady) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 flex flex-col gap-5 shadow-xl shadow-black/30">
          <div className="w-12 h-12 rounded-xl bg-warning/10 border border-warning/25 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-warning" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-text">Private key not loaded</h1>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">
              For security, SilentKey does not store your private key.
              Please sign in again to decrypt this conversation.
            </p>
          </div>
          <div className="rounded-xl bg-surface-elevated border border-border px-4 py-3 text-xs text-text-muted leading-relaxed">
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

  // ── Full chat view ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ChatHeader
        displayName={displayName}
        username={username || undefined}
        isLoading={isLoadingKey}
      />

      {/* Message thread */}
      <main
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"
        aria-label="Message thread"
        role="list"
      >
        {/* Security banner */}
        <DecryptionNotice />

        {/* Loading key */}
        {isLoadingKey && (
          <div className="flex justify-center py-6">
            <div className="flex flex-col items-center gap-2">
              <Spinner className="w-5 h-5" />
              <p className="text-xs text-text-subtle">Loading recipient info…</p>
            </div>
          </div>
        )}

        {/* Loading messages */}
        {!isLoadingKey && isLoadingMessages && (
          <div className="flex justify-center py-6">
            <div className="flex flex-col items-center gap-2">
              <Spinner className="w-5 h-5" />
              <p className="text-xs text-text-subtle">Decrypting messages…</p>
            </div>
          </div>
        )}

        {/* Load error */}
        {loadError && !isLoadingKey && !isLoadingMessages && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-danger text-center">{loadError}</p>
            <Button variant="ghost" size="sm" onClick={loadChat}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoadingKey && !isLoadingMessages && !loadError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-primary" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text">No messages yet</p>
              <p className="text-xs text-text-muted mt-1">
                Send the first encrypted message to {displayName}
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const showDayLabel = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

          return (
            <div key={msg.id}>
              {showDayLabel && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] text-text-subtle bg-surface border border-border rounded-full px-3 py-1">
                    {formatDayLabel(msg.createdAt)}
                  </span>
                </div>
              )}
              <MessageBubble message={msg} />
            </div>
          );
        })}

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} aria-hidden="true" />
      </main>

      {/* Composer */}
      <ChatComposer
        onSend={handleSend}
        disabled={!recipientPublicKey || isLoadingKey}
        isSending={isSending}
      />
    </div>
  );
}

// ─── Page (Suspense required for useSearchParams) ─────────────────────────────

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
