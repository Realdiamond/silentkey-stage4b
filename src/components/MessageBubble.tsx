import { formatMessageTime } from "@/lib/message-utils";
import type { DecryptedMessage } from "@/lib/message-utils";

interface MessageBubbleProps {
  message: DecryptedMessage;
  showTime?: boolean;
}

export function MessageBubble({ message, showTime = true }: MessageBubbleProps) {
  const { isOwnMessage, decrypted, decryptionFailed, createdAt, delivered } = message;

  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
      role="listitem"
    >
      <div className={`max-w-[75%] flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            decryptionFailed
              ? "bg-danger/10 border border-danger/25 text-danger"
              : isOwnMessage
              ? "bg-primary text-background rounded-br-sm"
              : "bg-surface border border-border text-text rounded-bl-sm"
          }`}
        >
          {decryptionFailed ? (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Unable to decrypt this message
            </span>
          ) : (
            <span className="whitespace-pre-wrap break-words">{decrypted}</span>
          )}
        </div>

        {/* Meta row */}
        {showTime && (
          <div className={`flex items-center gap-1 mt-1 px-1 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-[10px] text-text-subtle">{formatMessageTime(createdAt)}</span>

            {/* Sent/delivered indicator for own messages */}
            {isOwnMessage && !decryptionFailed && (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className={`w-3 h-3 ${delivered ? "text-success" : "text-text-subtle"}`}
                aria-label={delivered ? "Delivered" : "Sent"}
              >
                {delivered ? (
                  // Double check
                  <>
                    <path d="M2 8l3.5 3.5L10 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 8l3.5 3.5L14 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : (
                  // Single check
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            )}

            {/* Lock for received messages */}
            {!isOwnMessage && !decryptionFailed && (
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-text-subtle" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
