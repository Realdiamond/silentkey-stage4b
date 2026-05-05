"use client";

import { AuthProvider } from "@/context/AuthContext";
import { UnreadProvider } from "@/context/UnreadContext";
import { SocketProvider } from "@/context/SocketContext";
import type { ReactNode } from "react";

/**
 * Client boundary wrapper for all app-wide providers.
 * Order matters:
 *   AuthProvider    — session, tokens, privateKey
 *   UnreadProvider  — in-memory unread counts
 *   SocketProvider  — global WebSocket (depends on Auth + Unread)
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UnreadProvider>
        <SocketProvider>
          {children}
        </SocketProvider>
      </UnreadProvider>
    </AuthProvider>
  );
}
