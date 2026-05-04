import Link from "next/link";
import type { SocketStatus } from "@/hooks/useWhisperSocket";

interface ChatHeaderProps {
  displayName: string;
  username?: string;
  isLoading?: boolean;
  socketStatus?: SocketStatus;
  recipientOnline?: boolean | null;
  onReload?: () => void;
}

function WsStatusBadge({ status }: { status: SocketStatus }) {
  switch (status) {
    case "open":
      return (
        <span className="flex items-center gap-1 text-[10px] text-success font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" aria-hidden="true" />
          Real-time connected
        </span>
      );
    case "connecting":
      return (
        <span className="flex items-center gap-1 text-[10px] text-warning font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 animate-pulse" aria-hidden="true" />
          Connecting…
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-[10px] text-danger font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" aria-hidden="true" />
          Connection error — REST fallback active
        </span>
      );
    case "closed":
      return (
        <span className="flex items-center gap-1 text-[10px] text-text-subtle font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-text-subtle shrink-0" aria-hidden="true" />
          Offline — using REST fallback
        </span>
      );
    default: // idle
      return (
        <span className="flex items-center gap-1 text-[10px] text-text-subtle">
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 shrink-0" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          End-to-end encrypted
        </span>
      );
  }
}

export function ChatHeader({
  displayName,
  username,
  isLoading,
  socketStatus = "idle",
  recipientOnline,
  onReload,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
      {/* Back */}
      <Link
        href="/dashboard"
        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-hover transition-colors text-text-muted hover:text-text shrink-0"
        aria-label="Back to dashboard"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
          <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* Avatar with presence dot */}
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-sm">
          {isLoading ? (
            <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        {recipientOnline === true && (
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-surface"
            aria-label="Online"
          />
        )}
      </div>

      {/* Name + connection status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{displayName}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {username && (
            <>
              <span className="text-xs text-text-muted truncate">@{username}</span>
              <span className="text-text-subtle text-xs" aria-hidden="true">·</span>
            </>
          )}
          <WsStatusBadge status={socketStatus} />
        </div>
      </div>

      {/* Reload history button */}
      {onReload && (
        <button
          id="chat-reload-history"
          onClick={onReload}
          disabled={isLoading}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-hover transition-colors text-text-muted hover:text-text disabled:opacity-40 shrink-0"
          aria-label="Reload message history"
          title="Reload history"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
            <path d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </header>
  );
}
