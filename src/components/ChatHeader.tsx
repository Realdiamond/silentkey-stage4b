import Link from "next/link";

interface ChatHeaderProps {
  displayName: string;
  username?: string;
  isLoading?: boolean;
}

export function ChatHeader({ displayName, username, isLoading }: ChatHeaderProps) {
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

      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-sm shrink-0">
        {isLoading ? (
          <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{displayName}</p>
        <div className="flex items-center gap-1.5">
          {username && (
            <span className="text-xs text-text-muted truncate">@{username}</span>
          )}
          {username && <span className="text-text-subtle text-xs">·</span>}
          <span className="flex items-center gap-1 text-[10px] text-success font-medium">
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 shrink-0" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            End-to-end encrypted
          </span>
        </div>
      </div>
    </header>
  );
}
