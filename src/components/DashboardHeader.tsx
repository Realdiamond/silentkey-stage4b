import { APP_NAME } from "@/lib/config";
import { SecureBadge } from "@/components/SecureBadge";

interface DashboardHeaderProps {
  onSignOut: () => void;
  /** Called when the hamburger icon is tapped on mobile. */
  onMenuClick?: () => void;
}

export function DashboardHeader({ onSignOut, onMenuClick }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-border bg-surface shrink-0">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors shrink-0"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
            <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Logo mark */}
        <svg viewBox="0 0 28 28" fill="none" className="w-7 h-7 shrink-0" aria-hidden="true">
          <rect width="28" height="28" rx="7" fill="url(#dh-grad)" />
          <path
            d="M14 5L7 9v5c0 4.2 2.8 8.05 7 9.2C18.2 22.05 21 18.2 21 14V9l-7-4z"
            fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.4" strokeLinejoin="round"
          />
          <path d="M10.5 14l2.2 2.2L17.5 11" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="dh-grad" x1="0" y1="0" x2="28" y2="28">
              <stop stopColor="#00d4aa" />
              <stop offset="1" stopColor="#7c6cf0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="flex flex-col">
          <span className="text-sm font-bold text-text leading-tight">{APP_NAME}</span>
          <span className="text-[10px] text-text-subtle leading-tight hidden sm:block">
            End-to-end encrypted workspace
          </span>
        </div>

        <SecureBadge size="sm" label="Encrypted" className="hidden sm:flex" />
      </div>

      <button
        onClick={onSignOut}
        className="text-xs text-text-muted hover:text-text transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-hover border border-transparent hover:border-border whitespace-nowrap"
        aria-label="Sign out"
      >
        Sign out
      </button>
    </header>
  );
}
