"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { requestReset, resetPassword, signIn, signUp, type AuthState } from "@/app/actions/auth";

type Kind = "login" | "signup" | "forgot" | "reset";

export default function AuthForm({ kind, token }: { kind: Kind; token?: string }) {
  const action = { login: signIn, signup: signUp, forgot: requestReset, reset: resetPassword }[kind];
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);
  const [show, setShow] = useState(false);
  const copy = {
    login: { eyebrow: "Welcome back", title: "Continue learning", cta: "Sign in" },
    signup: { eyebrow: "Start free", title: "Meet your personal teacher", cta: "Create account" },
    forgot: { eyebrow: "Account recovery", title: "Reset your password", cta: "Send reset link" },
    reset: { eyebrow: "Account recovery", title: "Choose a new password", cta: "Save and continue" },
  }[kind];

  return (
    <div className="animate-rise">
      <p className="eyebrow mb-3">{copy.eyebrow}</p>
      <h1 className="font-display text-[2.6rem] leading-[1.02]">{copy.title}</h1>
      <form action={formAction} className="mt-8 space-y-4" noValidate>
        {token && <input type="hidden" name="token" value={token} />}
        {kind === "signup" && (
          <Field label="Your name" htmlFor="name">
            <input id="name" name="name" className="input" autoComplete="name" placeholder="Priya" required />
          </Field>
        )}
        {kind !== "reset" && (
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" inputMode="email" className="input" autoComplete="email" placeholder="you@school.edu" required />
          </Field>
        )}
        {kind !== "forgot" && (
          <Field label={kind === "reset" ? "New password" : "Password"} htmlFor="password"
            extra={kind === "login" ? <Link href="/forgot-password" className="text-xs text-muted hover:text-paper">Forgot password?</Link> : null}>
            <div className="relative">
              <input id="password" name="password" type={show ? "text" : "password"} className="input pr-12"
                autoComplete={kind === "login" ? "current-password" : "new-password"} placeholder={kind === "login" ? "Your password" : "At least 8 characters"} required minLength={8} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-paper"
                aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
        )}
        {state?.error && <p role="alert" className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm text-coral">{state.error}</p>}
        {state?.message && <p role="status" className="rounded-lg border border-sage/30 bg-sage/10 px-3 py-2.5 text-sm text-sage">{state.message}</p>}
        <button className="btn btn-primary mt-2 h-12 w-full text-base" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" size={18} /> : <>{copy.cta}<ArrowRight size={18} /></>}
        </button>
      </form>
      <div className="mt-8 border-t hairline pt-6 text-sm text-muted">
        {kind === "login" && <>New to LearnFlow? <Link href="/signup" className="font-semibold text-paper underline-offset-4 hover:underline">Create an account</Link></>}
        {kind === "signup" && <>Already learning with us? <Link href="/login" className="font-semibold text-paper underline-offset-4 hover:underline">Sign in</Link></>}
        {(kind === "forgot" || kind === "reset") && <Link href="/login" className="font-semibold text-paper underline-offset-4 hover:underline">Back to sign in</Link>}
      </div>
      {kind === "signup" && <p className="mt-4 text-xs text-dim">You&rsquo;ll choose the language you understand best in the next step. You can change it any time — even mid-lesson.</p>}
    </div>
  );
}

function Field({ label, htmlFor, children, extra }: { label: string; htmlFor: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-paper/90">{label}</label>
        {extra}
      </div>
      {children}
    </div>
  );
}
