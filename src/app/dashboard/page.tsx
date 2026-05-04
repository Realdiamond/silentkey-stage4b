"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ConversationList } from "@/components/ConversationList";
import { UserSearch } from "@/components/UserSearch";
import { DashboardHeader } from "@/components/DashboardHeader";
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
    router.push(`/chat/${encodeURIComponent(u.id)}?${params.toString()}`);
  };

  const handleSelectConversation = (c: Conversation) => {
    const params = new URLSearchParams({
      name: c.display_name,
      username: c.username,
    });
    router.push(`/chat/${encodeURIComponent(c.user_id)}?${params.toString()}`);
  };

  // ── Loading splash ───────────────────────────────────────────────────────────
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-text-muted">Loading session…</p>
        </div>
      </div>
    );
  }

  // ── Locked state — session restored but no private key ───────────────────────
  if (!isCryptoReady) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 flex flex-col gap-5 shadow-xl shadow-black/30">
          {/* Icon */}
          <div className="w-14 h-14 rounded-xl bg-warning/10 border border-warning/25 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-warning" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.5" fill="currentColor" />
            </svg>
          </div>

          <div>
            <h1 className="text-lg font-bold text-text">Private key not loaded</h1>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">
              Your session was restored from storage, but your private key is not available.
            </p>
          </div>

          <div className="rounded-xl bg-surface-elevated border border-border px-4 py-3 text-xs text-text-muted leading-relaxed">
            🔒 <strong className="text-text">Security notice:</strong> For your protection, SilentKey
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
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <DashboardHeader onSignOut={handleSignOut} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside
          className="w-72 shrink-0 flex flex-col border-r border-border bg-surface overflow-y-auto"
          aria-label="Conversations"
        >
          {/* User identity */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text truncate">{user.display_name}</p>
              <p className="text-xs text-text-muted truncate">@{user.username}</p>
            </div>
          </div>

          {/* Private key status */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <span className="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden="true" />
            <span className="text-xs text-success font-medium">Private key ready to decrypt</span>
          </div>

          {/* User search */}
          <div className="border-b border-border py-1">
            <UserSearch
              token={accessToken!}
              currentUserId={user.id}
              onSelectUser={handleSelectUser}
            />
          </div>

          {/* Conversations */}
          <div className="flex-1">
            <ConversationList
              token={accessToken!}
              currentUserId={user.id}
              onSelectConversation={handleSelectConversation}
            />
          </div>
        </aside>

        {/* ── Main panel ─────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden" id="main-content">
          <EmptyChatState />
        </main>
      </div>
    </div>
  );
}
