"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

// ─── Inner content (reads searchParams via hook — must be in Suspense) ────────

function ChatContent() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isCryptoReady, isLoading, user, logout } = useAuth();

  const userId = params.userId ?? "";
  const displayName = searchParams.get("name") ?? "Unknown User";
  const username = searchParams.get("username") ?? "";

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Locked — no private key
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
            <p className="text-sm text-text-muted mt-1">
              Sign in again to restore your private key and decrypt messages.
            </p>
          </div>
          <Button fullWidth onClick={() => router.push("/login")}>Sign in again</Button>
          <Button variant="ghost" fullWidth onClick={handleSignOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dashboard
        </Link>
        <button
          onClick={handleSignOut}
          className="text-xs text-text-muted hover:text-text transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Chat placeholder */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-6 text-center">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-2xl">
          {displayName.charAt(0).toUpperCase()}
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-text">
            Secure chat with {displayName}
          </h1>
          {username && (
            <p className="text-sm text-text-muted">@{username}</p>
          )}
          <p className="text-xs text-text-subtle font-mono mt-1 bg-surface border border-border rounded-lg px-3 py-1.5 inline-block">
            ID: {userId}
          </p>
        </div>

        {/* Phase 6 notice */}
        <div className="max-w-sm w-full rounded-xl bg-surface border border-border px-5 py-4 text-left">
          <p className="text-sm font-medium text-text mb-1.5">🚧 Phase 6 — coming next</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Message encryption, decryption, and real-time WebSocket delivery
            will be implemented in Phase 6.
          </p>
          <p className="text-xs text-text-subtle mt-2 leading-relaxed">
            Private key is loaded and ready. Messages will be encrypted with
            AES-GCM-256 before leaving this device.
          </p>
        </div>

        {/* Current user info */}
        {user && (
          <p className="text-xs text-text-subtle">
            Chatting as <strong className="text-text-muted">@{user.username}</strong>
          </p>
        )}

        <Link href="/dashboard">
          <Button variant="outline" size="sm">← Back to Dashboard</Button>
        </Link>
      </main>
    </div>
  );
}

// ─── Page (Suspense boundary required for useSearchParams) ────────────────────

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
