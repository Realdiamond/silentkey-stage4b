"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/message-utils";

interface ChatComposerProps {
  onSend: (plaintext: string) => Promise<void>;
  disabled?: boolean;
  isSending?: boolean;
}

export function ChatComposer({ onSend, disabled, isSending }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = MAX_MESSAGE_LENGTH - text.length;
  const isOverLimit = remaining < 0;
  const isEmpty = text.trim().length === 0;
  const canSend = !disabled && !isSending && !isEmpty && !isOverLimit;

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (isEmpty) return;
    if (isOverLimit) {
      setError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }
    try {
      await onSend(text.trim());
      setText("");
      textareaRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  return (
    <div className="px-3 pt-2 pb-3 shrink-0">
      {/* Error banner */}
      {error && (
        <div role="alert" className="mb-2 px-3 py-2 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/25 text-xs text-[#ef4444]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Textarea wrapper */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            id="chat-composer-input"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={disabled || isSending}
            rows={1}
            aria-label="Message input"
            className="w-full resize-none bg-[#2A3942] border-none rounded-2xl px-4 py-2.5 text-sm text-[#E9EDEF] placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 disabled:opacity-50 leading-relaxed"
            style={{ minHeight: "42px", maxHeight: "160px" }}
          />

          {/* Character count near limit */}
          {text.length > MAX_MESSAGE_LENGTH * 0.8 && (
            <span
              className={`absolute bottom-2 right-3 text-[10px] ${
                isOverLimit ? "text-[#ef4444] font-semibold" : "text-[#8696A0]"
              }`}
            >
              {remaining}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          id="chat-send-button"
          type="submit"
          disabled={!canSend}
          aria-label="Send encrypted message"
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#25D366] text-[#111B21] transition-all hover:bg-[#128C7E] hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <span className="w-4 h-4 rounded-full border-2 border-[#111B21] border-t-transparent animate-spin" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>

      {/* Security note */}
      <p className="mt-1.5 text-[10px] text-[#546068] text-center flex items-center justify-center gap-1">
        <svg viewBox="0 0 16 16" fill="none" className="w-2.5 h-2.5 shrink-0" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Encrypted before sending · ↵ to send · ⇧↵ for new line
      </p>
    </div>
  );
}
