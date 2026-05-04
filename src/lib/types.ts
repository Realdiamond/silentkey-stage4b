// ─── User & Auth ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: 900;
  user: UserProfile;
}

export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  public_key: string;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}

export interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: EncryptedPayload;
  delivered: boolean;
  created_at: string;
}

export interface Conversation {
  user_id: string;
  display_name: string;
  username: string;
  last_message_at: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiErrorShape {
  error: string;
  message: string;
  statusCode: number;
}
