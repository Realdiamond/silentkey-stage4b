import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { SecureBadge } from "@/components/SecureBadge";
import { FeatureCard } from "@/components/FeatureCard";

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <circle cx="8" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12h8M18 12v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <path
        d="M13 2L4.09 12.96A1 1 0 005 14.5h6l-1 7.5 8.91-10.96A1 1 0 0019 9.5h-6l1-7.5z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path
        d="M16 6L8 10v6c0 4.8 3.2 9.2 8 10.5C20.8 25.2 24 20.8 24 16V10l-8-4z"
        fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path
        d="M12 16l2.5 2.5L20 12"
        stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#00d4aa" />
          <stop offset="1" stopColor="#7c6cf0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Encryption Flow Step ────────────────────────────────────────────────────

function FlowStep({
  label,
  sub,
  step,
}: {
  label: string;
  sub: string;
  step: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 text-primary text-[10px] font-bold flex items-center justify-center">
        {step}
      </span>
      <div className="px-3 py-2 rounded-lg bg-surface-elevated border border-border text-xs font-mono text-primary font-semibold whitespace-nowrap">
        {label}
      </div>
      <span className="text-[10px] text-text-subtle leading-snug max-w-[90px]">{sub}</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const features = [
    {
      icon: <IconLock />,
      title: "Client-Side Encryption",
      description:
        "All messages are encrypted on your device before transmission. The server only ever receives opaque ciphertext — never plaintext.",
    },
    {
      icon: <IconKey />,
      title: "Private Key Protection",
      description:
        "Your private key is derived from your passphrase via PBKDF2, encrypted with AES-KW, and stored wrapped. It never leaves your device in plaintext.",
      accentColor: "secondary" as const,
    },
    {
      icon: <IconMessage />,
      title: "Secure Messaging",
      description:
        "Messages use AES-GCM symmetric encryption with a unique IV per message. The AES key itself is sealed with RSA-OAEP for both sender and recipient.",
    },
    {
      icon: <IconZap />,
      title: "Real-Time Delivery",
      description:
        "A WebSocket connection enables instant message delivery. Encrypted payloads are pushed to recipients as soon as they arrive at the server.",
      accentColor: "secondary" as const,
    },
  ];

  return (
    <>
      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-border"
        aria-label="Main navigation"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
            aria-label={`${APP_NAME} home`}
          >
            <LogoMark className="w-8 h-8 transition-transform duration-200 group-hover:scale-105" />
            <span className="font-bold text-lg text-text tracking-tight">
              {APP_NAME}
            </span>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              id="nav-signin"
              className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              id="nav-create-account"
              className="px-3 py-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold bg-primary text-background hover:bg-primary-dark transition-all duration-200 shadow-lg shadow-primary/20 active:scale-95 whitespace-nowrap"
            >
              Create Account
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
        aria-label="Hero"
      >
        {/* Background grid */}
        <div className="absolute inset-0 hero-grid opacity-60" aria-hidden="true" />

        {/* Radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, #00d4aa 0%, #7c6cf0 45%, transparent 75%)",
            filter: "blur(60px)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center gap-8">
          {/* Badge */}
          <div className="animate-fade-in-up">
            <SecureBadge label="End-to-End Encrypted · Zero Knowledge" />
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up delay-100 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Messages only{" "}
            <span className="gradient-text">you can read</span>
          </h1>

          {/* Sub-headline */}
          <p className="animate-fade-in-up delay-200 max-w-2xl text-lg sm:text-xl text-text-muted leading-relaxed">
            {APP_NAME} encrypts every message on your device before it ever
            touches the network.{" "}
            <strong className="text-text font-medium">
              The server stores only encrypted blobs — never plaintext.
            </strong>
          </p>

          {/* CTA buttons */}
          <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Link
              href="/register"
              id="hero-create-account"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold bg-primary text-background hover:bg-primary-dark transition-all duration-200 shadow-xl shadow-primary/25 hover:shadow-primary/40 active:scale-95 animate-pulse-glow"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Create Account
            </Link>
            <Link
              href="/login"
              id="hero-signin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium border border-border text-text hover:bg-surface-hover hover:border-text-subtle/40 transition-all duration-200 active:scale-95"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Encryption Flow ───────────────────────────────────────────────── */}
      <section
        className="py-20 px-4 sm:px-6"
        aria-labelledby="flow-heading"
      >
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-10">
          <div className="text-center flex flex-col gap-3">
            <h2
              id="flow-heading"
              className="text-2xl sm:text-3xl font-bold text-text"
            >
              How your message travels
            </h2>
            <p className="text-text-muted max-w-xl mx-auto text-sm sm:text-base">
              Every step of the encryption chain happens in your browser — never
              on the server.
            </p>
          </div>

          {/* Flow diagram — 2-col grid on mobile, 4-col row on sm+ */}
          <div
            className="w-full"
            role="img"
            aria-label="Encryption flow: Plaintext to AES-GCM encryption to RSA-OAEP key wrapping to Ciphertext stored on server"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 max-w-xl sm:max-w-none mx-auto">
              <FlowStep step={1} label="Plaintext" sub="Your message" />
              <FlowStep step={2} label="AES-GCM" sub="Symmetric encryption" />
              <FlowStep step={3} label="RSA-OAEP" sub="Key wrapping" />
              <FlowStep step={4} label="Ciphertext" sub="Stored on server" />
            </div>
          </div>

          {/* Server note */}
          <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-surface border border-border max-w-xl w-full">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-text-muted leading-relaxed">
              <span className="text-text font-medium">WhisperBox server</span>{" "}
              receives only the encrypted payload, IV, and wrapped key — it has
              no cryptographic material to decrypt anything.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section
        className="py-20 px-4 sm:px-6 bg-surface-elevated/30"
        aria-labelledby="features-heading"
      >
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-12">
          <div className="text-center flex flex-col gap-3">
            <h2
              id="features-heading"
              className="text-2xl sm:text-3xl font-bold text-text"
            >
              Built for privacy by design
            </h2>
            <p className="text-text-muted max-w-xl mx-auto text-sm sm:text-base">
              Every component is designed with the assumption that the server
              is untrusted.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
            {features.map((feat) => (
              <FeatureCard key={feat.title} {...feat} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6" aria-label="Call to action">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-7">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
            style={{
              background: "linear-gradient(135deg, #00d4aa, #7c6cf0)",
            }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white">
              <path
                d="M12 2L4 6v6c0 5.25 3.6 10.15 8 11.5C16.4 22.15 20 17.25 20 12V6l-8-4z"
                fill="currentColor" fillOpacity="0.2"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-text">
            Ready to message in{" "}
            <span className="gradient-text">complete privacy?</span>
          </h2>

          <p className="text-text-muted max-w-md leading-relaxed">
            Create your account and your keys are generated locally — we never
            see your private key or your messages.
          </p>

          <Link
            href="/register"
            id="cta-create-account"
            className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-base font-semibold bg-primary text-background hover:bg-primary-dark transition-all duration-200 shadow-xl shadow-primary/25 hover:shadow-primary/40 active:scale-95"
          >
            Get Started — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark className="w-6 h-6" />
            <span className="text-sm font-semibold text-text-muted">
              {APP_NAME}
            </span>
          </div>

          <p className="text-xs text-text-subtle text-center">
            Powered by Web Crypto API · AES-GCM · RSA-OAEP · PBKDF2
          </p>

          <p className="text-xs text-text-subtle">
            &copy; {new Date().getFullYear()} {APP_NAME}. Stage 4B.
          </p>
        </div>
      </footer>
    </>
  );
}
