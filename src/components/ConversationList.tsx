"use client";

import { useState, useEffect, useCallback } from "react";
import { getConversations, ApiError } from "@/lib/api";
import { useUnread } from "@/context/UnreadContext";
import type { Conversation } from "@/lib/types";

interface ConversationListProps {
  token: string;
  currentUserId: string;
  onSelectConversation: (conversation: Conversation) => void;
}

/** Format timestamp exactly like WhatsApp Web (time today, weekday yesterday-7d, date otherwise) */
function formatConvoTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  // Same calendar day → HH:MM
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Within last 7 days → weekday name
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  // Older → DD/MM/YY
  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function ConversationList({
  token,
  currentUserId,
  onSelectConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { counts, hydrateFromConversations } = useUnread();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getConversations(token);
      const filtered = data.filter((c) => c.user_id !== currentUserId);
      setConversations(filtered);
      hydrateFromConversations(filtered, currentUserId);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Failed to load conversations."
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, currentUserId, hydrateFromConversations]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh on CustomEvent
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("silentkey:conversation-updated", handler);
    return () => window.removeEventListener("silentkey:conversation-updated", handler);
  }, [load]);

  // Auto-refresh on tab focus / visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, [load]);

  return (
    <div className="flex flex-col">
      {/* Section label */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <span className="text-[11px] font-semibold text-[#8696A0] uppercase tracking-widest">
          Chats
        </span>
        <button
          onClick={load}
          disabled={isLoading}
          className="text-[#8696A0] hover:text-[#E9EDEF] transition-colors disabled:opacity-40"
          title="Refresh conversations"
          aria-label="Refresh conversations"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          >
            <path
              d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="px-4 py-4 text-xs text-[#8696A0]">Loading…</p>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="px-4 py-3">
          <p className="text-xs text-[#ef4444] mb-1.5">{error}</p>
          <button
            onClick={load}
            className="text-xs text-[#25D366] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && conversations.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-10 h-10 text-[#2A3942]"
            aria-hidden="true"
          >
            <path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-xs text-[#8696A0] leading-relaxed">
            No conversations yet.
            <br />
            Search for a user above to start one.
          </p>
        </div>
      )}

      {/* ── Conversation rows ─────────────────────────────────────────────── */}
      {conversations.map((c) => {
        const unread = counts[c.user_id] ?? 0;
        const hasUnread = unread > 0;
        const initial = c.display_name.charAt(0).toUpperCase();

        return (
          <button
            key={c.user_id}
            onClick={() => onSelectConversation(c)}
            className={[
              "flex items-center gap-3 px-3 py-2.5 text-left w-full transition-colors",
              hasUnread
                ? "bg-[#202C33]/60 hover:bg-[#2A3942]/80"
                : "hover:bg-[#202C33]/60",
            ].join(" ")}
          >
            {/* ── Avatar ───────────────────────────────────────────────── */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-[#2A3942] flex items-center justify-center text-[#E9EDEF] font-semibold text-lg select-none">
                {initial}
              </div>
            </div>

            {/* ── Middle: name + subtitle ───────────────────────────────── */}
            <div className="flex-1 min-w-0 border-b border-[#2A3942]/60 pb-2.5 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                {/* Display name */}
                <p
                  className={`text-sm truncate leading-tight ${
                    hasUnread
                      ? "font-bold text-[#E9EDEF]"
                      : "font-medium text-[#E9EDEF]"
                  }`}
                >
                  {c.display_name}
                </p>

                {/* Timestamp */}
                <span
                  className={`text-[11px] shrink-0 ${
                    hasUnread
                      ? "text-[#25D366] font-medium"
                      : "text-[#8696A0]"
                  }`}
                >
                  {formatConvoTime(c.last_message_at)}
                </span>
              </div>

              <div className="flex items-center justify-between mt-0.5 gap-2">
                {/* Subtitle */}
                <span className="text-xs text-[#8696A0] truncate flex items-center gap-1">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="w-3 h-3 shrink-0 opacity-60"
                    aria-hidden="true"
                  >
                    <rect
                      x="3" y="7" width="10" height="7" rx="1.5"
                      stroke="currentColor" strokeWidth="1.2"
                    />
                    <path
                      d="M5.5 7V5a2.5 2.5 0 015 0v2"
                      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                    />
                  </svg>
                  {hasUnread ? "New encrypted message" : `@${c.username}`}
                </span>

                {/* Unread badge */}
                {hasUnread ? (
                  <span
                    className="min-w-[20px] h-5 rounded-full bg-[#25D366] text-[#111B21] text-[11px] font-bold flex items-center justify-center px-1.5 shrink-0"
                    aria-label={`${unread} unread messages`}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : (
                  /* Spacer keeps row height consistent */
                  <span className="h-5 w-5 shrink-0" aria-hidden="true" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
