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

function WsStatusLine({ status }: { status: SocketStatus }) {
  switch (status) {
    case "open":
      return (
        <span className="flex items-center gap-1 text-[11px] text-[#25D366]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" aria-hidden="true" />
          Real-time connected
        </span>
      );
    case "connecting":
      return (
        <span className="flex items-center gap-1 text-[11px] text-[#f59e0b]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0 animate-pulse" aria-hidden="true" />
          Connecting…
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-[11px] text-[#ef4444]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" aria-hidden="true" />
          Connection error — REST fallback active
        </span>
      );
    case "closed":
      return (
        <span className="flex items-center gap-1 text-[11px] text-[#8696A0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8696A0] shrink-0" aria-hidden="true" />
          Offline — using REST fallback
        </span>
      );
    default: // idle
      return (
        <span className="flex items-center gap-1 text-[11px] text-[#8696A0]">
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
    <header className="flex items-center gap-3 px-3 py-2.5 bg-[#202C33] border-b border-[#2A3942] shrink-0">
      {/* Back — mobile-first (always visible, links to dashboard) */}
      <Link
        href="/dashboard"
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#2A3942] transition-colors text-[#8696A0] hover:text-[#E9EDEF] shrink-0"
        aria-label="Back to dashboard"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
          <path
            d="M19 12H5M12 5l-7 7 7 7"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </Link>

      {/* Avatar with presence dot */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#2A3942] flex items-center justify-center text-[#E9EDEF] font-semibold text-base select-none">
          {isLoading ? (
            <span className="w-4 h-4 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        {recipientOnline === true && (
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#202C33]"
            aria-label="Online"
          />
        )}
      </div>

      {/* Name block */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[#E9EDEF] truncate leading-tight">
          {displayName}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-px">
          {username && (
            <>
              <span className="text-[11px] text-[#8696A0] truncate">@{username}</span>
              <span className="text-[#2A3942] text-xs" aria-hidden="true">·</span>
            </>
          )}
          <WsStatusLine status={socketStatus} />
        </div>
      </div>

      {/* Reload history button */}
      {onReload && (
        <button
          id="chat-reload-history"
          onClick={onReload}
          disabled={isLoading}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#2A3942] transition-colors text-[#8696A0] hover:text-[#E9EDEF] disabled:opacity-40 shrink-0"
          aria-label="Reload message history"
          title="Reload history"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5" aria-hidden="true">
            <path
              d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </header>
  );
}
