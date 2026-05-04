export function EmptyChatState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center select-none">
      {/* Lock icon */}
      <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-float">
        <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-primary" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" />
        </svg>
      </div>

      <div className="flex flex-col gap-2 max-w-xs">
        <h2 className="text-lg font-semibold text-text">No conversation selected</h2>
        <p className="text-sm text-text-muted leading-relaxed">
          Search for a user or select a conversation from the sidebar to begin an
          encrypted thread.
        </p>
        <p className="text-xs text-text-subtle mt-1 leading-relaxed">
          Every message is encrypted before it leaves this device.
          The server stores only ciphertext — never plaintext.
        </p>
      </div>
    </div>
  );
}
