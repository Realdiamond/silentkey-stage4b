"use client";

import { AuthProvider } from "@/context/AuthContext";
import { UnreadProvider } from "@/context/UnreadContext";
import type { ReactNode } from "react";

/**
 * Client boundary wrapper for all app-wide providers.
 * Imported by the root layout (a Server Component) to maintain
 * Next.js metadata support while enabling client-side context.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UnreadProvider>{children}</UnreadProvider>
    </AuthProvider>
  );
}
