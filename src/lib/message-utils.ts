/**
 * message-utils.ts — Helpers for the chat view.
 *
 * Keeps the chat page and components free of date/formatting boilerplate.
 */

/**
 * Represents a message after client-side decryption has been attempted.
 * If `decrypted` is null, `decryptionFailed` will be true.
 */
export interface DecryptedMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  isOwnMessage: boolean;
  decrypted: string | null;
  decryptionFailed: boolean;
  createdAt: string;
  delivered: boolean;
  /** True while the message is optimistically added but not yet confirmed by REST. */
  pending?: boolean;
}

/**
 * Formats a message timestamp as a short time string (e.g. "14:32" or "Mon 14:32").
 * Uses the user's locale automatically.
 */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns true if two ISO timestamps are on the same calendar day. */
export function isSameDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Formats a date as a section divider label (e.g. "Today", "Yesterday", "Mon 4 May"). */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export const MAX_MESSAGE_LENGTH = 2000;
