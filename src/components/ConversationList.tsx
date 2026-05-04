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

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationList({
  token,
  currentUserId,
  onSelectConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { counts } = useUnread();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getConversations(token);
      // Exclude current user from list (shouldn't appear, but guard anyway)
      setConversations(data.filter((c) => c.user_id !== currentUserId));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Failed to load conversations."
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, currentUserId]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // ── Auto-refresh on CustomEvent ──────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      load();
    };
    window.addEventListener("silentkey:conversation-updated", handler);
    return () => window.removeEventListener("silentkey:conversation-updated", handler);
  }, [load]);

  // ── Auto-refresh on tab focus / visibility change ─────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        load();
      }
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
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[10px] font-semibold text-text-subtle uppercase tracking-widest">
          Messages
        </span>
        <button
          onClick={load}
          disabled={isLoading}
          className="text-text-subtle hover:text-text transition-colors disabled:opacity-40"
          title="Refresh conversations"
          aria-label="Refresh conversations"
        >
          <svg viewBox="0 0 24 24" fill="none" className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}>
            <path
              d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* States */}
      {isLoading && (
        <p className="px-4 py-3 text-xs text-text-subtle">Loading…</p>
      )}

      {error && !isLoading && (
        <div className="px-4 py-3">
          <p className="text-xs text-danger mb-1.5">{error}</p>
          <button onClick={load} className="text-xs text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && conversations.length === 0 && (
        <p className="px-4 py-3 text-xs text-text-subtle leading-relaxed">
          No conversations yet. Search for a user above to start one.
        </p>
      )}

      {/* Conversation rows */}
      {conversations.map((c) => {
        const unread = counts[c.user_id] ?? 0;

        return (
          <button
            key={c.user_id}
            onClick={() => onSelectConversation(c)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left group"
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-semibold text-sm group-hover:border-primary/40 transition-colors">
                {c.display_name.charAt(0).toUpperCase()}
              </div>
              {/* Unread badge */}
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-background text-[10px] font-bold flex items-center justify-center px-1 shadow-md shadow-primary/30">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm truncate ${unread > 0 ? "font-bold text-text" : "font-medium text-text"}`}>
                  {c.display_name}
                </span>
                <span className="text-[10px] text-text-subtle shrink-0">
                  {formatRelativeTime(c.last_message_at)}
                </span>
              </div>
              <span className="text-xs text-text-muted flex items-center gap-1">
                <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 shrink-0" aria-hidden="true">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Encrypted thread
              </span>
            </div>

            {/* Unread indicator dot for subtle emphasis */}
            {unread > 0 && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
