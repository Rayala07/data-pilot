"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Alert } from "@/components/ui";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { verifyOtp, resendOtp } from "@/features/auth/auth.thunks";
import { isLoading } from "@/store/asyncState";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { request, pendingEmail, token } = useAppSelector((s) => s.auth);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState("");
  const [localError, setLocalError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const submitting = isLoading(request);
  const otp = digits.join("");

  // As long as pendingEmail is set we are in the OTP flow — stay on this page
  // regardless of what the token is (Supabase fires a transient SIGNED_IN on
  // signUp before the email is confirmed, which would otherwise kick the user
  // to /connections immediately).
  // Only redirect once pendingEmail is cleared:
  //   • If token is also set → OTP was verified → go to the app
  //   • If no token → user came here directly with no signup in progress → go to signup
  useEffect(() => {
    if (pendingEmail) return; // still in OTP flow, stay here
    if (token) {
      router.replace("/connections");
    } else {
      router.replace("/signup");
    }
  }, [token, pendingEmail, router]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function focusNext(index: number) {
    inputRefs.current[index + 1]?.focus();
  }

  function focusPrev(index: number) {
    inputRefs.current[index - 1]?.focus();
  }

  function handleChange(index: number, value: string) {
    // Accept only digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setLocalError("");
    if (digit) focusNext(index);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index]) {
      focusPrev(index);
    }
    if (e.key === "ArrowLeft") focusPrev(index);
    if (e.key === "ArrowRight") focusNext(index);
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    // Focus the last filled box or submit
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  const handleVerify = useCallback(async () => {
    if (!pendingEmail || digits.includes("")) return;
    setLocalError("");
    try {
      await dispatch(verifyOtp({ email: pendingEmail, token: otp })).unwrap();
      // Explicit redirect — don't rely on the effect which fires only after the
      // pendingEmail/token Redux update propagates.
      router.replace("/connections");
    } catch (err: any) {
      setLocalError(err?.message || "Invalid or expired code. Please try again.");
    }
  }, [dispatch, pendingEmail, otp, digits, router]);

  // Auto-submit when all digits are filled
  useEffect(() => {
    if (!digits.includes("") && digits.length === OTP_LENGTH) {
      handleVerify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function handleResend() {
    if (!pendingEmail || resendCooldown > 0) return;
    setResendMsg("");
    try {
      await dispatch(resendOtp(pendingEmail)).unwrap();
      setResendMsg("A new code has been sent!");
      setResendCooldown(RESEND_COOLDOWN);
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch {
      setResendMsg("Failed to resend. Please wait a moment and try again.");
    }
  }

  if (!pendingEmail && !token) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="mx-auto w-full max-w-sm space-y-8">

        {/* Icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-brand/20 blur-xl scale-150 opacity-50" />
            <div className="relative h-20 w-20 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center">
              <svg className="h-10 w-10 text-brand" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-fg">Check your inbox</h1>
            <p className="text-sm text-fg-muted">
              We sent a 6-digit code to
            </p>
            <p className="text-sm font-semibold text-fg">{pendingEmail}</p>
          </div>
        </div>

        {/* OTP input */}
        <div className="space-y-4">
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={[
                  "h-14 w-12 rounded-xl border text-center text-xl font-bold",
                  "bg-surface text-fg outline-none transition-all duration-150",
                  "focus:ring-2 focus:ring-brand focus:border-brand",
                  digit
                    ? "border-brand/60 bg-brand/5"
                    : "border-line hover:border-fg-muted/40",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Error / feedback */}
          {(localError || request.error) && (
            <Alert>{localError || request.error}</Alert>
          )}

          <Button
            type="button"
            className="w-full"
            loading={submitting}
            disabled={digits.includes("") || submitting}
            onClick={handleVerify}
          >
            {submitting ? "Verifying…" : "Verify code"}
          </Button>
        </div>

        {/* Resend section */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-fg-muted">Didn't receive it?</p>
            {resendCooldown > 0 ? (
              <span className="text-xs text-fg-muted tabular-nums">
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-sm font-medium text-brand hover:underline focus:outline-none"
              >
                Resend code
              </button>
            )}
          </div>
          {resendMsg && (
            <p className={`text-xs ${resendMsg.includes("sent") ? "text-success" : "text-danger"}`}>
              {resendMsg}
            </p>
          )}
          <p className="text-xs text-fg-subtle">
            Check your spam folder too. Codes expire after 60 minutes.
          </p>
        </div>

        <p className="text-center text-xs text-fg-muted">
          Wrong email?{" "}
          <a href="/signup" className="text-brand hover:underline font-medium">
            Go back to sign up
          </a>
        </p>
      </div>
    </div>
  );
}
