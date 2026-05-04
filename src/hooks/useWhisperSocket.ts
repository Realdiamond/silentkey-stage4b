"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createWhisperSocket,
  isMessageReceiveEvent,
  isPresenceEvent,
  isWebSocketErrorEvent,
  type MessageReceiveEvent,
} from "@/lib/websocket";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SocketStatus = "idle" | "connecting" | "open" | "closed" | "error";

interface UseWhisperSocketOptions {
  accessToken: string | null;
  /** Hook only opens the socket when this is true. */
  enabled: boolean;
  onMessageReceive?: (event: MessageReceiveEvent) => void;
  onUserOnline?: (userId: string) => void;
  onUserOffline?: (userId: string) => void;
  onSocketError?: (message: string) => void;
}

interface UseWhisperSocketReturn {
  status: SocketStatus;
  isOpen: boolean;
  /** Serialise and send a JSON payload. Returns false if socket is not OPEN. */
  sendJson: (payload: unknown) => boolean;
  /** Manually reconnect after a close/error. */
  reconnect: () => void;
  close: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages a single WhisperBox WebSocket connection.
 *
 * Key reliability fixes:
 * - Uses a "connection generation" counter (connGen) so that any callback
 *   attached to a stale/cancelled socket cannot mutate the current status.
 *   This is the standard fix for React Strict Mode double-mount teardown.
 * - Cleanup nulls all handlers *before* calling .close() so the onclose
 *   callback of the old socket does not fire "closed" after a reconnect.
 * - `sendJson` checks `ws.readyState === WebSocket.OPEN` directly on the
 *   live socket ref — status state is eventually consistent, the ref is not.
 * - Does NOT auto-reconnect in a loop; `reconnect()` is manual.
 */
export function useWhisperSocket({
  accessToken,
  enabled,
  onMessageReceive,
  onUserOnline,
  onUserOffline,
  onSocketError,
}: UseWhisperSocketOptions): UseWhisperSocketReturn {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);

  /**
   * Monotonically-increasing generation counter.
   * Each new connection gets its own generation snapshot.
   * Any event handler whose captured `gen` no longer matches
   * the ref's value is from a stale socket and is discarded.
   */
  const connGen = useRef(0);

  // Keep callbacks in refs so they can be updated without re-creating the socket
  const onMessageReceiveRef = useRef(onMessageReceive);
  const onUserOnlineRef     = useRef(onUserOnline);
  const onUserOfflineRef    = useRef(onUserOffline);
  const onSocketErrorRef    = useRef(onSocketError);

  useEffect(() => { onMessageReceiveRef.current = onMessageReceive; }, [onMessageReceive]);
  useEffect(() => { onUserOnlineRef.current     = onUserOnline;     }, [onUserOnline]);
  useEffect(() => { onUserOfflineRef.current    = onUserOffline;    }, [onUserOffline]);
  useEffect(() => { onSocketErrorRef.current    = onSocketError;    }, [onSocketError]);

  // ── Tear down a socket without triggering stale state updates ────────────────
  const teardown = useCallback((ws: WebSocket) => {
    ws.onopen    = null;
    ws.onclose   = null;
    ws.onerror   = null;
    ws.onmessage = null;
    if (
      ws.readyState === WebSocket.CONNECTING ||
      ws.readyState === WebSocket.OPEN
    ) {
      ws.close();
    }
  }, []);

  // ── Open a new connection ────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!enabled || !accessToken) return;

    // Tear down any existing socket first so we never have two open
    if (wsRef.current) {
      teardown(wsRef.current);
      wsRef.current = null;
    }

    // Increment generation — all prior socket handlers are now stale
    const gen = ++connGen.current;

    const ws = createWhisperSocket(accessToken);
    if (!ws) return;

    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      if (connGen.current !== gen) return; // stale — discard
      setStatus("open");
    };

    ws.onclose = (ev) => {
      if (connGen.current !== gen) return; // stale — discard
      // Treat abnormal closure codes as errors for clearer UI messaging
      const wasAbnormal = ev.code !== 1000 && ev.code !== 1001;
      setStatus(wasAbnormal ? "error" : "closed");
      wsRef.current = null;
    };

    ws.onerror = () => {
      if (connGen.current !== gen) return; // stale — discard
      // onerror always precedes onclose; onclose will set final status
      // We set "error" here too so the UI reacts immediately
      setStatus("error");
    };

    ws.onmessage = (event: MessageEvent<unknown>) => {
      if (connGen.current !== gen) return; // stale — discard

      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return; // Non-JSON frame — ignore silently
      }

      if (isMessageReceiveEvent(parsed)) {
        console.log("[SilentKey WS] received message.receive");
        onMessageReceiveRef.current?.(parsed);
        return;
      }

      if (isPresenceEvent(parsed)) {
        if (parsed.event === "user.online") {
          onUserOnlineRef.current?.(parsed.user_id);
        } else {
          onUserOfflineRef.current?.(parsed.user_id);
        }
        return;
      }

      if (isWebSocketErrorEvent(parsed)) {
        console.warn("[SilentKey WS] server error event received");
        onSocketErrorRef.current?.(parsed.detail);
        return;
      }

      // Unknown event — ignore safely
    };
  }, [enabled, accessToken, teardown]);

  // ── Effect: open/close based on enabled + accessToken ───────────────────────
  useEffect(() => {
    if (enabled && accessToken) {
      connect();
    }

    return () => {
      // Invalidate all handlers for the current connection generation.
      // This must happen BEFORE teardown() so the onclose handler
      // (which checks connGen) does not fire a "closed" state update
      // that would interfere with the next connect() call.
      connGen.current += 1;

      if (wsRef.current) {
        teardown(wsRef.current);
        wsRef.current = null;
      }
      setStatus("idle");
    };
    // connect is stable (accessToken/enabled are its deps, which are also listed here)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, accessToken]);

  // ── sendJson — checks the live socket, not React state ──────────────────────
  const sendJson = useCallback((payload: unknown): boolean => {
    // Deliberately use wsRef.current.readyState instead of `status` state
    // because React state is asynchronous; the ref is synchronous.
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return false;
    }
    try {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Manual reconnect ─────────────────────────────────────────────────────────
  const reconnect = useCallback(() => {
    if (!enabled || !accessToken) return;
    // Invalidate the current generation so its onclose cannot fire after reconnect
    connGen.current += 1;
    if (wsRef.current) {
      teardown(wsRef.current);
      wsRef.current = null;
    }
    connect();
  }, [enabled, accessToken, connect, teardown]);

  // ── Manual close ─────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    connGen.current += 1;
    if (wsRef.current) {
      teardown(wsRef.current);
      wsRef.current = null;
    }
    setStatus("closed");
  }, [teardown]);

  return {
    status,
    isOpen: status === "open",
    sendJson,
    reconnect,
    close,
  };
}
