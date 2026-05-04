"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  validateUsername,
  validateDisplayName,
  validatePassword,
} from "@/lib/auth";

type FieldErrors = {
  username?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
};

type Step = "idle" | "keys" | "registering";

const STEP_LABELS: Record<Step, string | undefined> = {
  idle: undefined,
  keys: "Generating your encryption keys… (this takes a moment)",
  registering: "Creating your account…",
};

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading, authError, clearError } = useAuth();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("idle");

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    const uErr = validateUsername(username);
    const dErr = validateDisplayName(displayName);
    const pErr = validatePassword(password);
    if (uErr) errs.username = uErr;
    if (dErr) errs.displayName = dErr;
    if (pErr) errs.password = pErr;
    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;

    setIsSubmitting(true);

    // Key generation (PBKDF2 + RSA) — show step before blocking work begins
    setStep("keys");
    await new Promise((r) => setTimeout(r, 30));

    // The register() call in context handles key gen + API call
    // We update the step label mid-flight after a small delay
    const stepTimer = setTimeout(() => setStep("registering"), 2500);

    const success = await register(username, displayName, password);
    clearTimeout(stepTimer);

    setIsSubmitting(false);
    setStep("idle");

    if (success) router.push("/dashboard");
  };

  const stepLabel = STEP_LABELS[step];

  return (
    <AuthCard
      title="Create your account"
      subtitle="Your keys are generated on this device — we never see them"
      footerLink={{ href: "/login", label: "Sign in", text: "Already have an account?" }}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {authError && (
          <div
            role="alert"
            className="rounded-xl bg-danger/10 border border-danger/25 px-4 py-3 text-sm text-danger"
          >
            {authError}
          </div>
        )}

        <Input
          id="reg-username"
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={fieldErrors.username}
          hint="3–32 characters. Letters, digits, _ or - only."
          autoComplete="username"
          autoFocus
          disabled={isSubmitting}
        />

        <Input
          id="reg-display-name"
          label="Display Name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors.displayName}
          hint="Shown to other users."
          autoComplete="name"
          disabled={isSubmitting}
        />

        <Input
          id="reg-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint="8–128 characters. Also used to protect your private key."
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        <Input
          id="reg-confirm-password"
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        {/* Key generation progress */}
        {stepLabel && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <span
              className="inline-block w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0"
              aria-hidden="true"
            />
            <p className="text-xs text-primary">{stepLabel}</p>
          </div>
        )}

        <Button
          id="reg-submit"
          type="submit"
          fullWidth
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="mt-1"
        >
          Create Account
        </Button>
      </form>
    </AuthCard>
  );
}
