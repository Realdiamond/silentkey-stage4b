"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { validateUsername, validatePassword } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, authError, clearError } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "auth" | "crypto">("idle");

  // Already authenticated → go to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const validate = (): boolean => {
    const errs: typeof fieldErrors = {};
    const uErr = validateUsername(username);
    const pErr = validatePassword(password);
    if (uErr) errs.username = uErr;
    if (pErr) errs.password = pErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;

    setIsSubmitting(true);
    setStep("auth");

    // Give the UI a tick to render the step label before the blocking crypto
    await new Promise((r) => setTimeout(r, 30));
    setStep("crypto");

    const success = await login(username, password);
    setIsSubmitting(false);
    setStep("idle");

    if (success) router.push("/dashboard");
  };

  const stepLabel =
    step === "auth"
      ? "Signing you in…"
      : step === "crypto"
      ? "Restoring your private key…"
      : undefined;

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to access your encrypted messages"
      footerLink={{ href: "/register", label: "Create account", text: "Don't have an account?" }}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* API error */}
        {authError && (
          <div
            role="alert"
            className="rounded-xl bg-danger/10 border border-danger/25 px-4 py-3 text-sm text-danger"
          >
            {authError}
          </div>
        )}

        <Input
          id="login-username"
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={fieldErrors.username}
          autoComplete="username"
          autoFocus
          disabled={isSubmitting}
        />

        <Input
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint="Also used to decrypt your private key locally."
          autoComplete="current-password"
          disabled={isSubmitting}
        />

        {/* Step indicator */}
        {stepLabel && (
          <p className="text-xs text-primary flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden="true" />
            {stepLabel}
          </p>
        )}

        <Button
          id="login-submit"
          type="submit"
          fullWidth
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          Sign In
        </Button>
      </form>
    </AuthCard>
  );
}
