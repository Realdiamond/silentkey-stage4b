/**
 * websocket.ts — WhisperBox WebSocket types and factory.
 *
 * Security: only encrypted payloads are ever sent through the socket.
 * Plaintext, private keys, and passwords never pass through here.
 */

import { WS_BASE_URL } from "@/lib/config";
import type { EncryptedPayload } from "@/lib/types";

// ─── Incoming event types ─────────────────────────────────────────────────────

export interface MessageReceiveEvent {
  event: "message.receive";
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: EncryptedPayload;
  created_at: string;
  delivered?: boolean;
}

export interface UserOnlineEvent {
  event: "user.online";
  user_id: string;
}

export interface UserOfflineEvent {
  event: "user.offline";
  user_id: string;
}

export interface PresenceEvent {
  event: "user.online" | "user.offline";
  user_id: string;
}

export interface WebSocketErrorEvent {
  event: "error";
  detail: string;
}

export type IncomingWebSocketEvent =
  | MessageReceiveEvent
  | PresenceEvent
  | WebSocketErrorEvent;

// ─── Outgoing event types ─────────────────────────────────────────────────────

export interface OutgoingMessageSendEvent {
  event: "message.send";
  to: string;
  payload: EncryptedPayload;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isMessageReceiveEvent(e: unknown): e is MessageReceiveEvent {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as Record<string, unknown>)["event"] === "message.receive" &&
    typeof (e as Record<string, unknown>)["id"] === "string" &&
    typeof (e as Record<string, unknown>)["from_user_id"] === "string"
  );
}

export function isPresenceEvent(e: unknown): e is PresenceEvent {
  const ev = (e as Record<string, unknown>)?.["event"];
  return ev === "user.online" || ev === "user.offline";
}

export function isWebSocketErrorEvent(e: unknown): e is WebSocketErrorEvent {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as Record<string, unknown>)["event"] === "error"
  );
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates (but does not yet open a listener on) a WebSocket connection to
 * the WhisperBox server using the provided access token for auth.
 *
 * Returns null if the token is missing.
 */
export function createWhisperSocket(accessToken: string): WebSocket | null {
  if (!accessToken) return null;
  const url = `${WS_BASE_URL}?token=${encodeURIComponent(accessToken)}`;
  return new WebSocket(url);
}
