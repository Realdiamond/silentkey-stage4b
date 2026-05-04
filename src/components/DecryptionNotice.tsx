/**
 * DecryptionNotice — shown at the top of the chat thread once messages are loaded.
 * Reminds the user of the security model.
 */
export function DecryptionNotice() {
  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4">
      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
        <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-success shrink-0" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-[10px] text-text-subtle font-medium">
          Messages decrypted on this device · Server stores only ciphertext
        </span>
      </div>
    </div>
  );
}
