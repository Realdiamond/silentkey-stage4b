export function EmptyChatState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center select-none chat-bg">
      {/* Lock icon */}
      <div className="w-20 h-20 rounded-full bg-[#202C33] border border-[#2A3942] flex items-center justify-center animate-float shadow-lg">
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-[#25D366]" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" />
        </svg>
      </div>

      <div className="flex flex-col gap-2 max-w-xs">
        <h2 className="text-[17px] font-semibold text-[#E9EDEF]">
          SilentKey
        </h2>
        <p className="text-sm text-[#8696A0] leading-relaxed">
          Select a conversation or search for a user to start chatting.
        </p>
        <p className="text-xs text-[#546068] mt-1 leading-relaxed flex items-center justify-center gap-1.5">
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 shrink-0" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          End-to-end encrypted
        </p>
      </div>
    </div>
  );
}
