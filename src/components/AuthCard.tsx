import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";
import { SecureBadge } from "@/components/SecureBadge";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footerLink?: { href: string; label: string; text: string };
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="url(#ac-grad)" />
      <path
        d="M16 6L8 10v6c0 4.8 3.2 9.2 8 10.5C20.8 25.2 24 20.8 24 16V10l-8-4z"
        fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M12 16l2.5 2.5L20 12" stroke="white" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="ac-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#25D366" />
          <stop offset="1" stopColor="#128C7E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AuthCard({ title, subtitle, children, footerLink }: AuthCardProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      {/* Subtle background glow */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none opacity-[0.05]"
        style={{ background: "radial-gradient(ellipse, #25D366 0%, #128C7E 60%, transparent 80%)", filter: "blur(60px)" }}
        aria-hidden="true"
      />

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8 group" aria-label={`${APP_NAME} home`}>
        <LogoMark className="w-9 h-9 transition-transform group-hover:scale-105" />
        <span className="font-bold text-lg text-text">{APP_NAME}</span>
      </Link>

      {/* Card */}
      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl shadow-black/40">
        <div className="mb-6">
          <div className="mb-3">
            <SecureBadge size="sm" label="End-to-End Encrypted" />
          </div>
          <h1 className="text-2xl font-bold text-text">{title}</h1>
          {subtitle && (
            <p className="text-sm text-text-muted mt-1">{subtitle}</p>
          )}
        </div>

        {children}
      </div>

      {/* Footer link */}
      {footerLink && (
        <p className="mt-5 text-sm text-text-muted">
          {footerLink.text}{" "}
          <Link href={footerLink.href} className="text-primary hover:text-primary-dark transition-colors font-medium">
            {footerLink.label}
          </Link>
        </p>
      )}

      {/* Security note */}
      <p className="mt-6 max-w-sm text-xs text-text-subtle text-center leading-relaxed">
        🔒 Your private key is decrypted only on this device.{" "}
        {APP_NAME} never sends plaintext messages to the server.
      </p>
    </main>
  );
}
