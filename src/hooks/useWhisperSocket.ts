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

/** WhisperBox custom WebSocket close codes (see API guide). */
const WS_CLOSE_TOKEN_EXPIRED = 4001;
const WS_CLOSE_TOKEN_INVALID = 4003;

/** Proactive refresh: fire 60 s before the 15-minute access-token expiry. */
const PROACTIVE_REFRESH_MS = (15 * 60 - 60) * 1000; // 14 minutes

/** Auto-reconnect backoff schedule (milliseconds). */
const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 10000];
const MAX_RETRIES = BACKOFF_SCHEDULE.length;

interface UseWhisperSocketOptions {
  accessToken: string | null;
  /** Hook only opens the socket when this is true. */
  enabled: boolean;
  onMessageReceive?: (event: MessageReceiveEvent) => void;
  onUserOnline?: (userId: string) => void;
  onUserOffline?: (userId: string) => void;
  onSocketError?: (message: string) => void;
  /**
   * Called when the server closes with 4001 (token expired).
   * Should call refreshSession() and return the new token, or null if refresh failed.
   */
  onTokenExpired?: () => Promise<string | null>;
  /**
   * Called when the server closes with 4003 (token invalid/tampered).
   * Should redirect the user to /login immediately.
   */
  onTokenInvalid?: () => void;
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
 * Reliability features:
 * - Connection generation counter prevents stale socket handlers.
 * - Automatic reconnect with exponential backoff (1s → 2s → 4s → 8s → 10s).
 * - Handles close code 4001 (expired) → auto-refresh + reconnect.
 * - Handles close code 4003 (invalid) → immediate redirect to login.
 * - Proactive refresh timer fires at the 14-minute mark to prevent 4001.
 * - sendJson checks ws.readyState directly (synchronous, not state).
 * - Manual reconnect() resets retry count.
 */
export function useWhisperSocket({
  accessToken,
  enabled,
  onMessageReceive,
  onUserOnline,
  onUserOffline,
  onSocketError,
  onTokenExpired,
  onTokenInvalid,
}: UseWhisperSocketOptions): UseWhisperSocketReturn {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const connGen = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  // Callback refs — keeps the socket stable when callbacks change
  const onMessageReceiveRef = useRef(onMessageReceive);
  const onUserOnlineRef     = useRef(onUserOnline);
  const onUserOfflineRef    = useRef(onUserOffline);
  const onSocketErrorRef    = useRef(onSocketError);
  const onTokenExpiredRef   = useRef(onTokenExpired);
  const onTokenInvalidRef   = useRef(onTokenInvalid);

  useEffect(() => { onMessageReceiveRef.current = onMessageReceive; }, [onMessageReceive]);
  useEffect(() => { onUserOnlineRef.current     = onUserOnline;     }, [onUserOnline]);
  useEffect(() => { onUserOfflineRef.current    = onUserOffline;    }, [onUserOffline]);
  useEffect(() => { onSocketErrorRef.current    = onSocketError;    }, [onSocketError]);
  useEffect(() => { onTokenExpiredRef.current   = onTokenExpired;   }, [onTokenExpired]);
  useEffect(() => { onTokenInvalidRef.current   = onTokenInvalid;   }, [onTokenInvalid]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

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

  // ── Connect ──────────────────────────────────────────────────────────────────

  const connect = useCallback((tokenOverride?: string) => {
    const token = tokenOverride ?? accessToken;
    if (!enabled || !token) return;

    // Tear down existing socket
    if (wsRef.current) {
      teardown(wsRef.current);
      wsRef.current = null;
    }
    clearRefreshTimer();
    clearRetryTimer();

    const gen = ++connGen.current;
    const ws = createWhisperSocket(token);
    if (!ws) return;

    wsRef.current = ws;
    setStatus("connecting");
    console.log("[SilentKey WS] connecting");

    ws.onopen = () => {
      if (connGen.current !== gen) return;
      console.log("[SilentKey WS] open");
      setStatus("open");
      // Reset retry count on successful connection
      retryCountRef.current = 0;

      // Start proactive refresh timer — fires at 14 min to refresh
      // the access token BEFORE the server drops us with 4001.
      refreshTimerRef.current = setTimeout(async () => {
        if (connGen.current !== gen) return;
        console.log("[SilentKey WS] proactive token refresh at 14-min mark");
        const newToken = await onTokenExpiredRef.current?.();
        if (newToken && connGen.current === gen) {
          connGen.current += 1;
          teardown(ws);
          wsRef.current = null;
          connect(newToken);
        }
      }, PROACTIVE_REFRESH_MS);
    };

    ws.onclose = async (ev) => {
      if (connGen.current !== gen) return;
      clearRefreshTimer();
      wsRef.current = null;

      // ── Handle WhisperBox custom close codes ──

      if (ev.code === WS_CLOSE_TOKEN_EXPIRED) {
        console.log("[SilentKey WS] closed (4001 — token expired)");
        setStatus("connecting");

        const newToken = await onTokenExpiredRef.current?.();
        if (newToken && connGen.current === gen) {
          retryCountRef.current = 0;
          connect(newToken);
          return;
        }

        console.warn("[SilentKey WS] refresh failed after 4001");
        onTokenInvalidRef.current?.();
        setStatus("error");
        return;
      }

      if (ev.code === WS_CLOSE_TOKEN_INVALID) {
        console.warn("[SilentKey WS] closed (4003 — token invalid)");
        onTokenInvalidRef.current?.();
        setStatus("error");
        return;
      }

      // Normal close (1000/1001) — no retry
      if (ev.code === 1000 || ev.code === 1001) {
        console.log("[SilentKey WS] closed (normal)");
        setStatus("closed");
        return;
      }

      // ── Abnormal close — auto reconnect with backoff ──
      console.log(`[SilentKey WS] closed (code ${ev.code})`);

      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BACKOFF_SCHEDULE[retryCountRef.current] ?? 10000;
        retryCountRef.current += 1;
        console.log(`[SilentKey WS] reconnect scheduled in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
        setStatus("connecting"); // show "Connecting…" during retry, not error
        retryTimerRef.current = setTimeout(() => {
          if (connGen.current !== gen) return;
          connect();
        }, delay);
      } else {
        // Max retries exhausted — show error, user can manually retry
        console.warn("[SilentKey WS] max retries reached");
        setStatus("error");
      }
    };

    ws.onerror = () => {
      if (connGen.current !== gen) return;
      // onerror always fires before onclose — onclose handles status + retry
      // Don't set "error" here; let onclose decide based on retry budget
    };

    ws.onmessage = (event: MessageEvent<unknown>) => {
      if (connGen.current !== gen) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }

      if (isMessageReceiveEvent(parsed)) {
        console.log("[SilentKey WS] received message");
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
        console.warn("[SilentKey WS] server error event");
        onSocketErrorRef.current?.(parsed.detail);
        return;
      }
    };
  }, [enabled, accessToken, teardown, clearRefreshTimer, clearRetryTimer]);

  // ── Effect: open/close based on enabled + accessToken ───────────────────────

  useEffect(() => {
    if (enabled && accessToken) {
      console.log("[SilentKey WS] enabled");
      retryCountRef.current = 0;
      connect();
    }

    return () => {
      connGen.current += 1;
      clearRefreshTimer();
      clearRetryTimer();
      if (wsRef.current) {
        teardown(wsRef.current);
        wsRef.current = null;
      }
      setStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, accessToken]);

  // ── sendJson ────────────────────────────────────────────────────────────────

  const sendJson = useCallback((payload: unknown): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Manual reconnect (resets retry count) ─────────────────────────────────────

  const reconnect = useCallback(() => {
    if (!enabled || !accessToken) return;
    connGen.current += 1;
    clearRefreshTimer();
    clearRetryTimer();
    retryCountRef.current = 0; // manual reconnect resets the backoff
    connect();
  }, [enabled, accessToken, connect, teardown, clearRefreshTimer, clearRetryTimer]);

  // ── Manual close ─────────────────────────────────────────────────────────────

  const close = useCallback(() => {
    connGen.current += 1;
    clearRefreshTimer();
    clearRetryTimer();
    if (wsRef.current) {
      teardown(wsRef.current);
      wsRef.current = null;
    }
    setStatus("closed");
  }, [teardown, clearRefreshTimer, clearRetryTimer]);

  return {
    status,
    isOpen: status === "open",
    sendJson,
    reconnect,
    close,
  };
}
