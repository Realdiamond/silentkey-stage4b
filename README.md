# SilentKey — End-to-End Encrypted Messaging App

> **Frontend Wizards Stage 4B** — A secure messaging app built with Next.js and the WhisperBox backend. Every message is encrypted on your device before it ever leaves your browser. The server stores only ciphertext.

---

## Live Demo & Repository

| | Link |
|---|---|
| 🌐 Live Demo | [silentkey-stage4b.vercel.app](https://silentkey-stage4b.vercel.app/) |
| 📦 GitHub | [github.com/Realdiamond/silentkey-stage4b](https://github.com/Realdiamond/silentkey-stage4b) |
| 🔗 Backend | [whisperbox.koyeb.app](https://whisperbox.koyeb.app) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Cryptography | Web Crypto API (`window.crypto.subtle`) |
| Backend API | WhisperBox REST API |
| Real-time | WhisperBox WebSocket API |
| Key derivation | PBKDF2 (SHA-256, 250 000 iterations) |
| Message encryption | AES-GCM 256-bit |
| Key encapsulation | RSA-OAEP 2048-bit / SHA-256 |

---

## Core Security Promise

| Property | Guarantee |
|---|---|
| **Zero plaintext on server** | Messages are encrypted with AES-GCM before the POST or WebSocket send. The server receives only `ciphertext`, `iv`, `encryptedKey`, and `encryptedKeyForSelf`. |
| **Private key never leaves the client as plaintext** | The RSA private key is wrapped (AES-GCM) using a key derived from the user's password (PBKDF2) before registration. The server stores only the wrapped blob. |
| **Memory-only private key** | After login the unwrapped private key lives only in React component state. It is never written to `localStorage`, `sessionStorage`, or `IndexedDB`. Refreshing the page clears it. |
| **Recipient-only decryption** | The AES message key is wrapped with the recipient's RSA public key (`encryptedKey`). Only the holder of the matching private key can unwrap it. |
| **Sender self-decryption** | The same AES message key is also wrapped with the sender's own RSA public key (`encryptedKeyForSelf`). Senders can decrypt their own sent messages without storing the plaintext. |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   User Device A                      │
│                                                      │
│  plaintext message                                   │
│       │                                              │
│       ▼                                              │
│  Generate AES-GCM 256-bit message key + 96-bit IV   │
│       │                                              │
│       ▼                                              │
│  Encrypt plaintext → ciphertext                      │
│       │                                              │
│       ▼                                              │
│  Wrap AES key → encryptedKey (recipient RSA-OAEP)   │
│  Wrap AES key → encryptedKeyForSelf (sender RSA)    │
│       │                                              │
│       ▼                                              │
│  { ciphertext, iv, encryptedKey,                     │
│    encryptedKeyForSelf }  ← ONLY THIS LEAVES         │
└──────────────────────────────────────────────────────┘
                        │
                        ▼  WebSocket / POST /messages
┌──────────────────────────────────────────────────────┐
│              WhisperBox Backend                      │
│                                                      │
│  Stores and forwards encrypted payload only          │
│  Never sees plaintext                                │
└──────────────────────────────────────────────────────┘
                        │
                        ▼  GET /messages or WS push
┌──────────────────────────────────────────────────────┐
│                   User Device B                      │
│                                                      │
│  Receive { ciphertext, iv, encryptedKey, ... }       │
│       │                                              │
│       ▼                                              │
│  Unwrap encryptedKey with own RSA private key        │
│       │                                              │
│       ▼                                              │
│  Decrypt ciphertext with AES-GCM key + IV            │
│       │                                              │
│       ▼                                              │
│  plaintext (never stored)                            │
└──────────────────────────────────────────────────────┘
```

---

## Encryption Flow (Step by Step)

**Sending a message:**

1. Generate a fresh random AES-GCM 256-bit message key and 96-bit IV for each message
2. Encrypt the plaintext using AES-GCM → produces `ciphertext`
3. Wrap the AES key with the **recipient's RSA-OAEP public key** → `encryptedKey`
4. Wrap the same AES key with the **sender's own RSA-OAEP public key** → `encryptedKeyForSelf`
5. Send only `{ ciphertext, iv, encryptedKey, encryptedKeyForSelf }` to the server
6. The AES key and plaintext are discarded from memory

**Receiving a message:**

1. Fetch the encrypted payload from REST or receive it via WebSocket push
2. Unwrap `encryptedKey` (or `encryptedKeyForSelf` if own message) using the local RSA private key
3. Decrypt `ciphertext` with the unwrapped AES key and the stored `iv`
4. Display the plaintext — it is never written to any persistent storage

---

## Key Management

| Step | What Happens |
|---|---|
| **Registration** | Browser generates an RSA-OAEP 2048-bit keypair client-side |
| **PBKDF2 salt** | 128-bit random salt generated client-side |
| **Wrapping key** | User password + salt → 250 000 PBKDF2 iterations → AES-GCM wrapping key |
| **Private key wrap** | RSA private key (PKCS8) wrapped with AES-GCM → base64 blob |
| **Server storage** | Server stores: `public_key`, `wrapped_private_key`, `pbkdf2_salt` |
| **Login** | Password + stored salt → re-derive AES-GCM key → unwrap private key into memory |
| **Memory only** | Unwrapped `CryptoKey` object lives in React state only |
| **Refresh** | Private key is cleared; user must sign in again to restore decryption capability |

> **Note on AES-GCM vs AES-KW:** AES-KW requires plaintext to be a multiple of 8 bytes. RSA-2048 PKCS8 DER output is 1218–1220 bytes (not divisible by 8), which causes a guaranteed `DataError` in every browser. AES-GCM handles arbitrary-length plaintext with authenticated encryption and is used here instead.

---

## API Integration

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Register with public key + wrapped private key |
| `POST` | `/auth/login` | Authenticate and receive tokens |
| `GET` | `/auth/me` | Fetch current user profile |
| `POST` | `/auth/refresh` | Refresh access token |
| `GET` | `/users/search?q=` | Search for users to message |
| `GET` | `/users/{id}/public-key` | Fetch recipient's RSA public key |
| `GET` | `/conversations` | List conversations |
| `GET` | `/conversations/{id}/messages` | Fetch message history |
| `POST` | `/messages` | Send encrypted message (REST fallback) |
| `WS` | `/ws?token=` | Real-time encrypted message delivery |

---

## REST + WebSocket Strategy

```
Send message
    │
    ├─ WebSocket status === "open"?
    │       │
    │       ├─ YES → sendJson({ event: "message.send", to, payload })
    │       │           │
    │       │           ├─ sent = true  → optimistic UI, done ✓
    │       │           └─ sent = false → fall through to REST ↓
    │       │
    │       └─ NO  → REST fallback ↓
    │
    └─ POST /messages with encrypted payload
           Response → decrypt with encryptedKeyForSelf → display
```

Incoming messages via WebSocket are decrypted immediately using the in-memory private key. REST history is fetched and decrypted on page load. Both paths send and receive **only encrypted payloads**.

---

## WebSocket Close Code Handling

| Close Code | Meaning | SilentKey Response |
|---|---|---|
| `4001` | Access token expired | Auto-refresh via `POST /auth/refresh`, then reconnect with new token |
| `4003` | Token missing or invalid | Redirect to `/login` immediately (no retry) |
| `1000` / `1001` | Normal close | Status → "closed" |
| Other | Abnormal close | Status → "error", REST fallback active |

**Proactive refresh:** A timer fires at the 14-minute mark (60 seconds before the 15-minute token expiry) to refresh the access token and reconnect the WebSocket before the server drops the connection. This prevents any interruption in real-time delivery.

```
WS opened → start 14-min timer
           │
           ├─ Timer fires → refreshSession() → reconnect with new token
           │
           ├─ Server sends 4001 → refreshSession() → reconnect
           │                       └─ refresh fails → redirect to /login
           │
           └─ Server sends 4003 → redirect to /login immediately
```

---

## Security Trade-offs & Honest Limitations

| Item | Status |
|---|---|
| Key exchange | RSA-OAEP used instead of modern Double Ratchet protocol |
| Forward secrecy | None — compromising the private key exposes all past messages |
| Private key durability | Memory-only; lost on page refresh. User must sign in again |
| Session tokens | `accessToken` and `refreshToken` stored in `sessionStorage` for practicality |
| Unread status | `localStorage` is used to remember unread message timestamps because the backend explicitly refuses to track read receipts to guarantee maximum user privacy. |
| WebSocket auth | Token passed as a URL query parameter because browsers cannot set custom headers on WebSocket connections |
| Key verification | No key fingerprint UI — a compromised server could substitute public keys (TOFU risk) |
| Message editing | Not supported |
| Message deletion | Not supported |
| Attachment encryption | Not supported |
| Security audit | No formal audit has been conducted |
| Password recovery | If the user forgets their password, the wrapped private key cannot be recovered |

---

## Known Limitations

- No push notifications when the app is not open
- No group chat support
- No file/attachment encryption
- No unread message badges across conversations
- No typing indicators
- No message pagination (loads last 50 messages only)
- No formal security audit

---

## Local Setup

```bash
# Clone the repo
git clone https://github.com/Realdiamond/silentkey-stage4b.git
cd silentkey-stage4b

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> No `.env` file is required for local development. The WhisperBox backend URL is hardcoded in `src/lib/config.ts`.

---

## Manual Testing Guide

Test end-to-end encrypted messaging with two accounts:

1. **Open two separate browser contexts** (e.g., Chrome + Firefox, or Chrome + Chrome Incognito)
2. **Register Alice** in browser 1 at `http://localhost:3000/register`
3. **Register Bob** in browser 2 at `http://localhost:3000/register`
4. **Alice searches for Bob** using the sidebar search on the dashboard
5. **Alice clicks "Chat →"** — the chat page opens
6. **Alice types a message** and sends it
7. **Bob should receive it live** (WebSocket) without refreshing
8. **Bob replies** — Alice receives it live
9. **Open DevTools → Network → WS** — confirm WS frames contain only `ciphertext/iv/encryptedKey/encryptedKeyForSelf` with no plaintext
10. **Refresh Alice's page** — she is still "logged in" (tokens in sessionStorage) but the private key is cleared
11. The dashboard shows: **"Private key not loaded"** — messages cannot be decrypted until sign-in again
12. **Alice signs in again** — private key is restored; message history decrypts correctly

---

## Folder Structure

```
src/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout (Providers wrapper)
│   ├── providers.tsx             # Client boundary for AuthContext
│   ├── login/page.tsx            # Login page
│   ├── register/page.tsx         # Registration page
│   ├── dashboard/page.tsx        # Authenticated dashboard shell
│   └── chat/[userId]/page.tsx    # Encrypted chat view
│
├── components/
│   ├── ui/                       # Reusable base components (Button, Input)
│   ├── AuthCard.tsx              # Auth page wrapper card
│   ├── ChatComposer.tsx          # Message input with encryption notice
│   ├── ChatHeader.tsx            # Chat header with WS status badge
│   ├── ConversationList.tsx      # Sidebar conversation list
│   ├── DashboardHeader.tsx       # Top header bar
│   ├── DecryptionNotice.tsx      # E2EE info pill in message thread
│   ├── EmptyChatState.tsx        # Empty state for main panel
│   ├── MessageBubble.tsx         # Single message bubble (decrypted or error)
│   ├── SecureBadge.tsx           # Encrypted badge chip
│   └── UserSearch.tsx            # Debounced user search sidebar
│
├── context/
│   └── AuthContext.tsx           # Session + memory-only private key provider
│
├── hooks/
│   └── useWhisperSocket.ts       # Reliable WebSocket hook (generation-safe)
│
└── lib/
    ├── api.ts                    # WhisperBox REST API layer
    ├── config.ts                 # API_BASE_URL, WS_BASE_URL, APP_NAME
    ├── crypto.ts                 # Web Crypto API engine (AES-GCM, RSA-OAEP, PBKDF2)
    ├── message-utils.ts          # Timestamp formatting, DecryptedMessage type
    ├── types.ts                  # Shared TypeScript types
    └── websocket.ts              # WS event types, type guards, socket factory
```

---

## Evaluation Checklist

- [x] Client-side encryption implemented (AES-GCM + RSA-OAEP)
- [x] Server never receives plaintext — only `{ ciphertext, iv, encryptedKey, encryptedKeyForSelf }`
- [x] Private key not stored in localStorage or sessionStorage
- [x] AES-GCM 256-bit message encryption
- [x] RSA-OAEP 2048-bit key encapsulation
- [x] PBKDF2 + AES-GCM private key wrapping at registration
- [x] REST fallback for message sending (`POST /messages`)
- [x] WebSocket real-time messaging (`/ws?token=`)
- [x] Per-message decryption failure handling (safe fallback, no crash)
- [x] WebSocket reliability (generation-safe hook, React Strict Mode safe)
- [x] WebSocket close code handling (4001 auto-refresh, 4003 redirect)
- [x] Proactive token refresh at 14-minute mark
- [x] TypeScript — zero `any`, `npx tsc --noEmit` passes
- [x] Full README with security explanation included


_Built by Realdiamond for Frontend Wizards Stage 4B._
