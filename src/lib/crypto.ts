/**
 * crypto.ts — SilentKey Web Crypto Engine
 *
 * ALL cryptographic operations happen in the browser via window.crypto.subtle.
 * This file is the single source of cryptographic truth for the app.
 *
 * Security model:
 *  - RSA-OAEP (2048-bit / SHA-256) for key encapsulation
 *  - AES-GCM (256-bit) for message encryption AND for wrapping the RSA private key at rest
 *  - PBKDF2 (SHA-256 / 250 000 iterations) to derive the AES-GCM wrapping key from a password
 *
 * NOTE: AES-KW is NOT used for private-key wrapping. AES-KW requires plaintext
 * to be a multiple of 8 bytes; RSA-2048 PKCS8 DER output is 1218–1220 bytes
 * (not divisible by 8), causing a guaranteed DataError in every browser.
 * AES-GCM handles arbitrary-length plaintext and provides authenticated encryption.
 *
 * Private keys NEVER leave memory as plaintext. They are wrapped before export
 * and unwrapped directly into non-extractable CryptoKey objects.
 */

// ─── Algorithm constants ──────────────────────────────────────────────────────

const RSA_OAEP_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const AES_GCM_PARAMS: AesKeyGenParams = {
  name: "AES-GCM",
  length: 256,
};

const PBKDF2_ITERATIONS = 250_000;

// ─── 1. arrayBufferToBase64 ───────────────────────────────────────────────────

/**
 * Converts an ArrayBuffer (or TypedArray) to a base64 string.
 * Used for serialising keys, IVs, salts, and ciphertext for API transport.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const buf: ArrayBuffer =
    buffer instanceof Uint8Array ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer : buffer;
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── 2. base64ToArrayBuffer ───────────────────────────────────────────────────

/**
 * Converts a base64 string back into an ArrayBuffer.
 * Used for deserialising keys, IVs, salts, and ciphertext received from the API.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── 3. generateSalt ─────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 128-bit (16-byte) PBKDF2 salt.
 * Must be stored alongside the wrapped private key (it is not secret).
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// ─── 4. generateIv ───────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 96-bit (12-byte) AES-GCM IV.
 * NEVER reuse an IV with the same AES key — a fresh IV must be generated
 * for every message encrypted.
 */
export function generateIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

// ─── 5. generateRsaKeyPair ───────────────────────────────────────────────────

/**
 * Generates an RSA-OAEP 2048-bit keypair.
 *
 * - publicKey  → extractable (exported as SPKI for the server)
 * - privateKey → non-extractable except via wrapKey (PKCS8 + AES-KW)
 *
 * Usage split is intentional: public key can encrypt and wrap AES keys;
 * private key can decrypt and unwrap AES keys received by the owner.
 */
export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_OAEP_PARAMS, true, [
    "encrypt",
    "decrypt",
    "wrapKey",
    "unwrapKey",
  ]);
}

// ─── 6. exportPublicKey ───────────────────────────────────────────────────────

/**
 * Exports an RSA public key as a base64-encoded SPKI blob.
 * This value is safe to store on and share via the server.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(spki);
}

// ─── 7. importPublicKey ───────────────────────────────────────────────────────

/**
 * Imports a base64 SPKI public key into a CryptoKey usable for
 * RSA-OAEP encryption and AES key wrapping.
 */
export async function importPublicKey(
  base64PublicKey: string
): Promise<CryptoKey> {
  const spki = base64ToArrayBuffer(base64PublicKey);
  return crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt", "wrapKey"]
  );
}

// ─── 8. deriveWrappingKey ─────────────────────────────────────────────────────

/**
 * Derives a 256-bit AES-GCM wrapping key from a user password + salt via PBKDF2.
 *
 * Security notes:
 *  - 250 000 iterations makes brute-force attacks expensive.
 *  - AES-GCM is used (not AES-KW) because AES-KW requires plaintext to be a
 *    multiple of 8 bytes — RSA-2048 PKCS8 keys are not guaranteed to satisfy this.
 *  - The salt must be unique per user and stored server-side (it is not secret).
 *  - The derived key is non-extractable — it only lives in memory during wrap/unwrap.
 */
export async function deriveWrappingKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (!password) {
    throw new Error("Password must not be empty when deriving wrapping key.");
  }

  // Import raw UTF-8 password bytes as PBKDF2 key material (not a usable key yet).
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength
      ) as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["wrapKey", "unwrapKey"]
  );
}

// ─── 9. wrapPrivateKey ───────────────────────────────────────────────────────

/**
 * Wraps an RSA private key using AES-GCM so it can be stored safely on the server.
 *
 * A fresh 96-bit IV is generated for each wrap operation and prepended to the
 * ciphertext (first 12 bytes = IV, remaining bytes = AES-GCM wrapped PKCS8).
 * Both are base64-encoded together as a single field.
 *
 * Why AES-GCM instead of AES-KW:
 *  AES-KW requires plaintext to be a multiple of 8 bytes. RSA-2048 PKCS8 DER
 *  encoding is typically 1218–1220 bytes — not a multiple of 8 — causing a
 *  guaranteed DataError. AES-GCM handles arbitrary-length plaintext and
 *  provides authenticated encryption (integrity checking via GCM auth tag).
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivBuffer = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength
  ) as ArrayBuffer;

  const wrappedKeyBuffer = await crypto.subtle.wrapKey(
    "pkcs8",
    privateKey,
    wrappingKey,
    { name: "AES-GCM", iv: ivBuffer }
  );

  // Combine: [12 bytes IV][N bytes wrapped key]
  const combined = new Uint8Array(12 + wrappedKeyBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrappedKeyBuffer), 12);
  return arrayBufferToBase64(combined);
}

// ─── 10. unwrapPrivateKey ────────────────────────────────────────────────────

/**
 * Unwraps a previously wrapped RSA private key back into a CryptoKey.
 *
 * Expects the base64 blob produced by wrapPrivateKey:
 *  bytes  0–11 → AES-GCM IV
 *  bytes 12–N  → AES-GCM wrapped PKCS8 data
 *
 * The result is a non-extractable CryptoKey — it can never be exported
 * as raw bytes, only used for decrypt/unwrapKey operations.
 */
export async function unwrapPrivateKey(
  wrappedPrivateKeyBase64: string,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  const combined = new Uint8Array(base64ToArrayBuffer(wrappedPrivateKeyBase64));

  // Split IV prefix from wrapped key bytes
  const iv = combined.slice(0, 12);
  const wrappedKeyBytes = combined.slice(12);

  const ivBuffer = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength
  ) as ArrayBuffer;
  const wrappedBuffer = wrappedKeyBytes.buffer.slice(
    wrappedKeyBytes.byteOffset,
    wrappedKeyBytes.byteOffset + wrappedKeyBytes.byteLength
  ) as ArrayBuffer;

  return crypto.subtle.unwrapKey(
    "pkcs8",
    wrappedBuffer,
    wrappingKey,
    { name: "AES-GCM", iv: ivBuffer },
    { name: "RSA-OAEP", hash: "SHA-256" },
    false, // non-extractable — private key stays in memory only
    ["decrypt", "unwrapKey"]
  );
}

// ─── 11. createRegistrationKeyBundle ─────────────────────────────────────────

/**
 * Performs all cryptographic steps required at registration time:
 *  1. Generate RSA-OAEP keypair
 *  2. Generate PBKDF2 salt
 *  3. Derive AES-KW wrapping key from password + salt
 *  4. Wrap the private key
 *  5. Export the public key
 *
 * Returns base64-encoded values ready for the WhisperBox API, plus the
 * in-memory CryptoKey references for the current session.
 *
 * ⚠ The plaintext private key exists only briefly in memory during wrapping.
 *    It is never logged or stored outside this function.
 */
export async function createRegistrationKeyBundle(password: string): Promise<{
  publicKey: string;
  wrappedPrivateKey: string;
  pbkdf2Salt: string;
  privateKey: CryptoKey;
  publicCryptoKey: CryptoKey;
}> {
  if (!password) {
    throw new Error("Password is required to create a key bundle.");
  }

  const keyPair = await generateRsaKeyPair();
  const salt = generateSalt();
  const wrappingKey = await deriveWrappingKey(password, salt);

  const [publicKeyBase64, wrappedPrivateKeyBase64] = await Promise.all([
    exportPublicKey(keyPair.publicKey),
    wrapPrivateKey(keyPair.privateKey, wrappingKey),
  ]);

  return {
    publicKey: publicKeyBase64,
    wrappedPrivateKey: wrappedPrivateKeyBase64,
    pbkdf2Salt: arrayBufferToBase64(salt),
    privateKey: keyPair.privateKey,
    publicCryptoKey: keyPair.publicKey,
  };
}

// ─── 12. restorePrivateKeyFromPassword ───────────────────────────────────────

/**
 * Restores a user's RSA private key from their password and the server-stored
 * wrapped private key + salt.
 *
 * Called at login time. The returned CryptoKey is used for the session;
 * it is never written to disk or storage.
 *
 * Throws a descriptive error if the password is wrong (unwrap fails).
 */
export async function restorePrivateKeyFromPassword(
  password: string,
  wrappedPrivateKeyBase64: string,
  pbkdf2SaltBase64: string
): Promise<CryptoKey> {
  if (!password) {
    throw new Error("Password is required to restore the private key.");
  }

  const salt = new Uint8Array(base64ToArrayBuffer(pbkdf2SaltBase64));
  const wrappingKey = await deriveWrappingKey(password, salt);

  try {
    return await unwrapPrivateKey(wrappedPrivateKeyBase64, wrappingKey);
  } catch {
    // Do not expose internal error details — wrong password is the most
    // common cause, but the exact reason is intentionally opaque.
    throw new Error(
      "Failed to decrypt your private key. Please check your password and try again."
    );
  }
}

// ─── 13. generateMessageKey ───────────────────────────────────────────────────

/**
 * Generates a fresh 256-bit AES-GCM symmetric key for encrypting one message.
 * A NEW key must be generated per message — key reuse would be catastrophic
 * for AES-GCM security.
 */
export async function generateMessageKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES_GCM_PARAMS, true, ["encrypt", "decrypt"]);
}

// ─── 14. encryptPlaintextMessage ─────────────────────────────────────────────

/**
 * Encrypts a UTF-8 plaintext string with AES-GCM using the given key and IV.
 * Returns a base64-encoded ciphertext (which includes the GCM auth tag).
 *
 * The IV must be stored alongside the ciphertext and must NEVER be reused
 * with the same key.
 */
export async function encryptPlaintextMessage(
  plaintext: string,
  aesKey: CryptoKey,
  iv: Uint8Array
): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext);
  const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBuffer },
    aesKey,
    encoded
  );
  return arrayBufferToBase64(cipherBuffer);
}

// ─── 15. decryptPlaintextMessage ─────────────────────────────────────────────

/**
 * Decrypts a base64 AES-GCM ciphertext back to a UTF-8 string.
 *
 * Throws a user-friendly error if decryption fails (wrong key, wrong IV,
 * or tampered ciphertext — the GCM auth tag verification fails).
 */
export async function decryptPlaintextMessage(
  ciphertextBase64: string,
  aesKey: CryptoKey,
  ivBase64: string
): Promise<string> {
  const cipherBuffer = base64ToArrayBuffer(ciphertextBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      cipherBuffer
    );
  } catch {
    throw new Error(
      "Message decryption failed. The message may have been tampered with, " +
        "or the wrong key/IV was used."
    );
  }

  return new TextDecoder().decode(decrypted);
}

// ─── 16. encryptAesKeyForUser ─────────────────────────────────────────────────

/**
 * Wraps an AES-GCM message key using the recipient's RSA-OAEP public key.
 *
 * This is the key encapsulation step: the AES key is exported as raw bytes
 * and then encrypted with RSA-OAEP. Only the holder of the matching RSA
 * private key can recover the AES key.
 *
 * Returns a base64-encoded wrapped key for API transport.
 */
export async function encryptAesKeyForUser(
  aesKey: CryptoKey,
  userPublicKey: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", aesKey, userPublicKey, {
    name: "RSA-OAEP",
  });
  return arrayBufferToBase64(wrapped);
}

// ─── 17. decryptAesKeyWithPrivateKey ─────────────────────────────────────────

/**
 * Unwraps a base64 RSA-OAEP-wrapped AES-GCM key using the holder's private key.
 *
 * Returns a CryptoKey ready for AES-GCM encrypt/decrypt operations.
 */
export async function decryptAesKeyWithPrivateKey(
  encryptedKeyBase64: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedBytes = base64ToArrayBuffer(encryptedKeyBase64);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedBytes,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ─── 18. encryptMessageForRecipient ──────────────────────────────────────────

/**
 * Full message encryption pipeline — produces a WhisperBox-compatible payload.
 *
 * Steps:
 *  1. Import recipient and sender public keys
 *  2. Generate a fresh AES-GCM message key + IV
 *  3. Encrypt the plaintext
 *  4. Wrap the AES key for the recipient  → encryptedKey
 *  5. Wrap the AES key for the sender    → encryptedKeyForSelf
 *     (allows the sender to read their own sent messages)
 *
 * The plaintext AES key exists only transiently in memory.
 */
export async function encryptMessageForRecipient(params: {
  plaintext: string;
  recipientPublicKeyBase64: string;
  senderPublicKeyBase64: string;
}): Promise<{
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}> {
  const { plaintext, recipientPublicKeyBase64, senderPublicKeyBase64 } = params;

  const [recipientPublicKey, senderPublicKey] = await Promise.all([
    importPublicKey(recipientPublicKeyBase64),
    importPublicKey(senderPublicKeyBase64),
  ]);

  const messageKey = await generateMessageKey();
  const iv = generateIv();

  const [ciphertext, encryptedKey, encryptedKeyForSelf] = await Promise.all([
    encryptPlaintextMessage(plaintext, messageKey, iv),
    encryptAesKeyForUser(messageKey, recipientPublicKey),
    encryptAesKeyForUser(messageKey, senderPublicKey),
  ]);

  return {
    ciphertext,
    iv: arrayBufferToBase64(iv),
    encryptedKey,
    encryptedKeyForSelf,
  };
}

// ─── 19. decryptMessagePayload ────────────────────────────────────────────────

/**
 * Full message decryption pipeline — accepts a WhisperBox message payload
 * and returns the original plaintext.
 *
 * If isOwnMessage is true (the current user is the sender), the function
 * uses encryptedKeyForSelf instead of encryptedKey.
 */
export async function decryptMessagePayload(params: {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf?: string;
  privateKey: CryptoKey;
  isOwnMessage?: boolean;
}): Promise<string> {
  const {
    ciphertext,
    iv,
    encryptedKey,
    encryptedKeyForSelf,
    privateKey,
    isOwnMessage = false,
  } = params;

  let keyToUnwrap: string;

  if (isOwnMessage) {
    if (!encryptedKeyForSelf) {
      throw new Error(
        "Cannot decrypt own message: encryptedKeyForSelf is missing from the payload."
      );
    }
    keyToUnwrap = encryptedKeyForSelf;
  } else {
    keyToUnwrap = encryptedKey;
  }

  const aesKey = await decryptAesKeyWithPrivateKey(keyToUnwrap, privateKey);
  return decryptPlaintextMessage(ciphertext, aesKey, iv);
}

// ─── 20. runCryptoSelfTest ────────────────────────────────────────────────────

/**
 * Development-only self-test.
 *
 * Simulates a full Alice → Bob encrypted message exchange:
 *  - Creates key bundles for two dummy users (Alice and Bob)
 *  - Alice encrypts a message for Bob
 *  - Bob decrypts using encryptedKey
 *  - Alice decrypts her own copy using encryptedKeyForSelf
 *  - Asserts both results match the original plaintext
 *
 * Returns true on success, false on any failure.
 *
 * Usage (browser DevTools console or a dev-only API route):
 *   import { runCryptoSelfTest } from "@/lib/crypto";
 *   await runCryptoSelfTest();
 *
 * ⚠ DO NOT call this automatically — it is CPU-intensive (two PBKDF2 derivations).
 */
export async function runCryptoSelfTest(): Promise<boolean> {
  const ORIGINAL_PLAINTEXT = "Hello from Alice — secret message 🔒";

  try {
    console.info("[SilentKey] Running crypto self-test…");

    // Step 1: Generate key bundles for Alice and Bob
    console.info("[SilentKey] Step 1/5 — generating key bundles…");
    let alice, bob;
    try {
      [alice, bob] = await Promise.all([
        createRegistrationKeyBundle("alice-test-password-2024"),
        createRegistrationKeyBundle("bob-test-password-2024"),
      ]);
      console.info("[SilentKey] Step 1 ✅ — key bundles created");
    } catch (e) {
      console.error("[SilentKey] Step 1 ❌ — key bundle creation failed:", e);
      return false;
    }

    // Step 2: Alice encrypts a message for Bob
    console.info("[SilentKey] Step 2/5 — Alice encrypts for Bob…");
    let payload;
    try {
      payload = await encryptMessageForRecipient({
        plaintext: ORIGINAL_PLAINTEXT,
        recipientPublicKeyBase64: bob.publicKey,
        senderPublicKeyBase64: alice.publicKey,
      });
      console.info("[SilentKey] Step 2 ✅ — message encrypted");
    } catch (e) {
      console.error("[SilentKey] Step 2 ❌ — encryption failed:", e);
      return false;
    }

    // Step 3: Bob decrypts with his private key
    console.info("[SilentKey] Step 3/5 — Bob decrypts message…");
    let bobPlaintext: string;
    try {
      bobPlaintext = await decryptMessagePayload({
        ...payload,
        privateKey: bob.privateKey,
        isOwnMessage: false,
      });
      console.info("[SilentKey] Step 3 ✅ — Bob decrypted:", bobPlaintext);
    } catch (e) {
      console.error("[SilentKey] Step 3 ❌ — Bob decryption failed:", e);
      return false;
    }

    // Step 4: Alice decrypts her own sent copy
    console.info("[SilentKey] Step 4/5 — Alice decrypts own sent copy…");
    let alicePlaintext: string;
    try {
      alicePlaintext = await decryptMessagePayload({
        ...payload,
        privateKey: alice.privateKey,
        isOwnMessage: true,
      });
      console.info("[SilentKey] Step 4 ✅ — Alice decrypted:", alicePlaintext);
    } catch (e) {
      console.error("[SilentKey] Step 4 ❌ — Alice self-decrypt failed:", e);
      return false;
    }

    // Step 5: Assert both match original plaintext
    console.info("[SilentKey] Step 5/5 — asserting results…");
    const bobOk = bobPlaintext === ORIGINAL_PLAINTEXT;
    const aliceOk = alicePlaintext === ORIGINAL_PLAINTEXT;

    if (bobOk && aliceOk) {
      console.info("[SilentKey] ✅ ALL STEPS PASSED — crypto engine is working correctly.");
      return true;
    }

    if (!bobOk) {
      console.error("[SilentKey] ❌ Bob plaintext mismatch.",
        "\n  expected:", ORIGINAL_PLAINTEXT,
        "\n  got:     ", bobPlaintext);
    }
    if (!aliceOk) {
      console.error("[SilentKey] ❌ Alice plaintext mismatch.",
        "\n  expected:", ORIGINAL_PLAINTEXT,
        "\n  got:     ", alicePlaintext);
    }
    return false;

  } catch (err: unknown) {
    console.error("[SilentKey] ❌ Unexpected error in self-test:", err);
    return false;
  }
}
