"use client";

import { ReactNode, useState } from "react";
import { APP_NAME } from "@/lib/config";

interface AppShellProps {
  children: ReactNode;
  /** Slot for the sidebar conversation list — Phase 2 */
  sidebar?: ReactNode;
  /** Slot for the top navbar actions — Phase 2 */
  headerActions?: ReactNode;
}

/**
 * AppShell
 *
 * Structural layout for the authenticated messaging UI.
 * Renders a responsive 2-column layout: fixed sidebar + scrollable main panel.
 *
 * Phase 2 will hydrate sidebar with conversation list and headerActions with
 * user avatar, settings, and logout controls.
 */
export function AppShell({ children, sidebar, headerActions }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Mobile overlay ───────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed md:static inset-y-0 left-0 z-30",
          "w-72 flex flex-col",
          "bg-surface border-r border-border",
          "transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        aria-label="Conversations sidebar"
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {/* Logo mark */}
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-primary" aria-hidden="true">
                <path d="M12 2L4 6v6c0 5.25 3.6 10.15 8 11.5C16.4 22.15 20 17.25 20 12V6l-8-4z"
                  fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-semibold text-text text-sm">{APP_NAME}</span>
          </div>
        </div>

        {/* Sidebar content — Phase 2: conversation list */}
        <div className="flex-1 overflow-y-auto p-3">
          {sidebar ?? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-text-subtle">
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 opacity-30" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <p className="text-xs text-center">Conversations will appear here</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main panel ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <div className="hidden md:block" />

          {/* Header actions — Phase 2: user avatar, settings */}
          <div className="flex items-center gap-2">
            {headerActions ?? (
              <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border" />
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
