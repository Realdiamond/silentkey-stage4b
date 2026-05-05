"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUnread } from "@/context/UnreadContext";
import { ConversationList } from "@/components/ConversationList";
import { UserSearch } from "@/components/UserSearch";
import { EmptyChatState } from "@/components/EmptyChatState";
import { Button } from "@/components/ui/Button";
import type { Conversation } from "@/lib/types";
import type { PublicUser } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    accessToken,
    isAuthenticated,
    isCryptoReady,
    isLoading,
    logout,
  } = useAuth();
  const { clear: clearUnread } = useUnread();

  // Guard: unauthenticated → login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const handleSelectUser = (u: PublicUser) => {
    const params = new URLSearchParams({
      name: u.display_name,
      username: u.username,
    });
    clearUnread(u.id, user?.id);
    router.push(`/chat/${encodeURIComponent(u.id)}?${params.toString()}`);
  };

  const handleSelectConversation = useCallback((c: Conversation) => {
    const params = new URLSearchParams({
      name: c.display_name,
      username: c.username,
    });
    clearUnread(c.user_id, user?.id);
    router.push(`/chat/${encodeURIComponent(c.user_id)}?${params.toString()}`);
  }, [router, clearUnread, user?.id]);

  // ── Loading splash ───────────────────────────────────────────────────────────
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B141A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" />
          <p className="text-sm text-[#8696A0]">Loading session…</p>
        </div>
      </div>
    );
  }

  // ── Locked state — session restored but no private key ───────────────────────
  if (!isCryptoReady) {
    return (
      <div className="min-h-screen bg-[#0B141A] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#111B21] border border-[#2A3942] rounded-2xl p-8 flex flex-col gap-5 shadow-xl">
          <div className="w-14 h-14 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/25 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-[#f59e0b]" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.5" fill="currentColor" />
            </svg>
          </div>

          <div>
            <h1 className="text-lg font-bold text-[#E9EDEF]">Private key not loaded</h1>
            <p className="text-sm text-[#8696A0] mt-1 leading-relaxed">
              Your session was restored from storage, but your private key is not available.
            </p>
          </div>

          <div className="rounded-xl bg-[#202C33] border border-[#2A3942] px-4 py-3 text-xs text-[#8696A0] leading-relaxed">
            🔒 <strong className="text-[#E9EDEF]">Security notice:</strong> For your protection, SilentKey
            never stores your private key. To decrypt messages, you must sign in again with your password.
          </div>

          <div className="flex flex-col gap-2">
            <Button id="locked-signin" fullWidth onClick={() => router.push("/login")}>
              Sign in again
            </Button>
            <Button id="locked-signout" variant="ghost" fullWidth onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Full authenticated dashboard ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#0B141A] overflow-hidden md:flex-row">
      {/* ── Sidebar (WhatsApp left panel style) ─────────────────────────── */}
      <aside
        className={[
          "relative",
          "w-full md:w-[380px] shrink-0",
          "h-full",
          "flex flex-col border-r border-[#2A3942] bg-[#111B21]",
          "z-30",
        ].join(" ")}
        aria-label="Conversations"
      >
        {/* Sidebar Header (User Profile Bar) */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#202C33] border-b border-[#2A3942] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2A3942] flex items-center justify-center text-[#E9EDEF] font-semibold text-base shrink-0 select-none">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#E9EDEF] truncate leading-tight">
                {user.display_name}
              </p>
              <div className="flex items-center gap-1.5 mt-px">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" aria-hidden="true" />
                <span className="text-[11px] text-[#25D366] font-medium truncate">Key ready</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        </div>

        {/* Search */}
        <div className="border-b border-[#2A3942] py-1 bg-[#111B21]">
          <UserSearch
            token={accessToken!}
            currentUserId={user.id}
            onSelectUser={handleSelectUser}
          />
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto bg-[#111B21]">
          <ConversationList
            token={accessToken!}
            currentUserId={user.id}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </aside>

      {/* ── Main panel (Empty state on dashboard) ────────────────────────── */}
      <main className="hidden md:flex flex-1 flex-col h-full overflow-hidden chat-bg" id="main-content">
        <EmptyChatState />
      </main>
    </div>
  );
}
