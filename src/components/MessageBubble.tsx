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
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} px-2`}
      role="listitem"
    >
      <div
        className={[
          "relative max-w-[72%] md:max-w-[60%] rounded-xl px-3 pt-2 pb-1.5 shadow-md",
          decryptionFailed
            ? "bg-[#2d1f1f] border border-[#ef4444]/30 text-[#ef4444]"
            : isOwnMessage
            ? "bg-[#005C4B] text-[#E9EDEF] rounded-tr-sm"
            : "bg-[#202C33] text-[#E9EDEF] rounded-tl-sm",
        ].join(" ")}
      >
        {/* Message text */}
        {decryptionFailed ? (
          <span className="flex items-center gap-1.5 text-sm">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Unable to decrypt this message
          </span>
        ) : (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
            {decrypted}
          </p>
        )}

        {/* Meta row: time + tick */}
        {showTime && (
          <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
            <span className="text-[10px] text-[#8696A0] select-none">
              {formatMessageTime(createdAt)}
            </span>

            {isOwnMessage && !decryptionFailed && (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className={`w-[14px] h-[14px] shrink-0 ${delivered ? "text-[#53bdeb]" : "text-[#8696A0]"}`}
                aria-label={delivered ? "Delivered" : "Sent"}
              >
                {delivered ? (
                  <>
                    <path d="M2 8l3.5 3.5L10 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 8l3.5 3.5L14 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : (
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            )}

            {!isOwnMessage && !decryptionFailed && (
              <svg viewBox="0 0 16 16" fill="none" className="w-[11px] h-[11px] text-[#8696A0] opacity-70" aria-hidden="true">
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
