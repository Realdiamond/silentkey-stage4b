/**
 * api.ts — SilentKey WhisperBox API Layer
 *
 * Thin, browser-safe fetch wrapper around the WhisperBox REST API.
 * All network I/O lives here. No crypto, no WebSocket, no storage.
 *
 * Auth notes:
 *  - Access tokens expire after 15 minutes (900 s).
 *  - Pass token via the `token` option on apiRequest, or use the
 *    typed helper functions which handle this for you.
 *  - Refresh via refreshAccessToken() before the token expires.
 *  - Endpoints /auth/register, /auth/login, /auth/refresh are public.
 */

import { API_BASE_URL } from "@/lib/config";
import type {
  AuthResponse,
  UserProfile,
  PublicUser,
  EncryptedPayload,
  Message,
  Conversation,
} from "@/lib/types";

// ─── ApiError ────────────────────────────────────────────────────────────────

/**
 * Thrown by apiRequest when the server returns a non-2xx status.
 * Consumers can check `err instanceof ApiError` and read `err.status`.
 */
export class ApiError extends Error {
  readonly name = "ApiError" as const;
  readonly status: number;
  readonly detail: string;
  readonly data?: unknown;

  constructor(status: number, detail: string, data?: unknown) {
    super(`[${status}] ${detail}`);
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface ApiRequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Base fetch wrapper used by every API function.
 *
 * - Prefixes `path` with API_BASE_URL.
 * - Serialises `body` as JSON and sets Content-Type automatically.
 * - Injects Authorization header when `token` is provided.
 * - Parses JSON responses safely; handles empty 204 bodies.
 * - Throws `ApiError` for non-2xx responses with server error detail.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = "GET", token, body, headers = {}, signal } = options;

  const requestHeaders: Record<string, string> = { ...headers };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // Safely parse the body — some endpoints return 204 No Content
  let responseData: unknown = undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      responseData = await response.json();
    } catch {
      responseData = undefined;
    }
  } else {
    // Non-JSON body (e.g. plain text error pages)
    const text = await response.text().catch(() => "");
    if (text) responseData = text;
  }

  if (!response.ok) {
    // Extract a human-readable detail from the error body
    let detail = `HTTP ${response.status}`;
    if (responseData !== null && typeof responseData === "object") {
      const obj = responseData as Record<string, unknown>;
      if (typeof obj["detail"] === "string") detail = obj["detail"];
      else if (typeof obj["message"] === "string") detail = obj["message"];
      else if (typeof obj["error"] === "string") detail = obj["error"];
    } else if (typeof responseData === "string" && responseData) {
      detail = responseData;
    }
    throw new ApiError(response.status, detail, responseData);
  }

  return responseData as T;
}

// ─── 2. registerUser ─────────────────────────────────────────────────────────

/**
 * POST /auth/register
 *
 * Creates a new account. The caller is responsible for generating
 * the RSA keypair and wrapping the private key before calling this
 * (see crypto.ts → createRegistrationKeyBundle).
 */
export async function registerUser(payload: {
  username: string;
  display_name: string;
  password: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: payload,
  });
}

// ─── 3. loginUser ────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 *
 * Returns an AuthResponse containing access_token, refresh_token, and
 * the user's stored public_key, wrapped_private_key, and pbkdf2_salt —
 * the caller must then restore the private key via crypto.ts →
 * restorePrivateKeyFromPassword.
 */
export async function loginUser(payload: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

// ─── 4. getCurrentUser ───────────────────────────────────────────────────────

/**
 * GET /auth/me
 *
 * Returns the authenticated user's profile. Useful for session restore
 * and verifying a stored token is still valid.
 */
export async function getCurrentUser(token: string): Promise<UserProfile> {
  return apiRequest<UserProfile>("/auth/me", { token });
}

// ─── 5. refreshAccessToken ───────────────────────────────────────────────────

/**
 * POST /auth/refresh
 *
 * Exchanges a refresh token for a new access token.
 * Should be called proactively before the 15-minute access token expires.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}> {
  return apiRequest("/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

// ─── 6. logoutUser ───────────────────────────────────────────────────────────

/**
 * POST /auth/logout
 *
 * Invalidates the current session server-side.
 * The caller should clear all in-memory keys and state afterwards.
 */
export async function logoutUser(
  token: string,
  refreshToken: string
): Promise<{ detail: string }> {
  return apiRequest("/auth/logout", {
    method: "POST",
    token,
    body: { refresh_token: refreshToken },
  });
}

// ─── 7. searchUsers ──────────────────────────────────────────────────────────

/**
 * GET /users/search?q=<query>
 *
 * Searches for users by username or display name.
 * Returns [] for empty queries without making a network request.
 */
export async function searchUsers(
  token: string,
  query: string
): Promise<PublicUser[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({ q: trimmed });
  return apiRequest<PublicUser[]>(`/users/search?${params.toString()}`, {
    token,
  });
}

// ─── 8. getUserPublicKey ─────────────────────────────────────────────────────

/**
 * GET /users/{userId}/public-key
 *
 * Retrieves the RSA-OAEP public key for a given user.
 * Called before encrypting a message to that user.
 */
export async function getUserPublicKey(
  token: string,
  userId: string
): Promise<{ public_key: string }> {
  return apiRequest<{ public_key: string }>(
    `/users/${encodeURIComponent(userId)}/public-key`,
    { token }
  );
}

// ─── 9. getConversations ─────────────────────────────────────────────────────

/**
 * GET /conversations
 *
 * Returns all conversations the current user has participated in,
 * ordered by last_message_at descending.
 */
export async function getConversations(
  token: string
): Promise<Conversation[]> {
  return apiRequest<Conversation[]>("/conversations", { token });
}

// ─── 10. getMessages ─────────────────────────────────────────────────────────

/**
 * GET /conversations/{userId}/messages?limit=50&before=...
 *
 * Returns paginated message history with another user.
 * Use the `before` cursor (a message ID or ISO timestamp) to load
 * older pages. Defaults to the 50 most recent messages.
 */
export async function getMessages(
  token: string,
  userId: string,
  options: { limit?: number; before?: string } = {}
): Promise<Message[]> {
  const { limit = 50, before } = options;

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (before) params.set("before", before);

  return apiRequest<Message[]>(
    `/conversations/${encodeURIComponent(userId)}/messages?${params.toString()}`,
    { token }
  );
}

// ─── 11. sendMessageFallback ─────────────────────────────────────────────────

/**
 * POST /messages
 *
 * REST fallback for sending a message when the WebSocket connection
 * is unavailable. The payload must be pre-encrypted by the caller
 * (see crypto.ts → encryptMessageForRecipient).
 *
 * Phase 4 will prefer the WebSocket path; this stays as the fallback.
 */
export async function sendMessageFallback(
  token: string,
  payload: {
    to: string;
    payload: EncryptedPayload;
  }
): Promise<Message> {
  return apiRequest<Message>("/messages", {
    method: "POST",
    token,
    body: payload,
  });
}

// ─── 12. healthCheck ─────────────────────────────────────────────────────────

/**
 * GET /health
 *
 * Public endpoint. Returns server status and environment.
 * No auth token required.
 *
 * Quick test from the browser console:
 *   import { healthCheck } from "@/lib/api";
 *   healthCheck().then(console.log);
 *
 * Or from DevTools:
 *   fetch("https://whisperbox.koyeb.app/health").then(r => r.json()).then(console.log)
 */
export async function healthCheck(): Promise<{
  status: string;
  environment: string;
}> {
  return apiRequest("/health");
}
