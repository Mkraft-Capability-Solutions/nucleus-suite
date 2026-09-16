"use client";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [signupAvailable, setSignupAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/auth/registration-state", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Registration state unavailable");
        return response.json() as Promise<{ available?: boolean }>;
      })
      .then((result) => {
        if (active) setSignupAvailable(result.available === true);
      })
      .catch(() => {
        if (active) setSignupAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    if (!email || password.length < 12 || (mode === "signup" && !name)) {
      setError("Enter the required details and use at least 12 characters for the password.");
      setPending(false);
      return;
    }
    try {
      const result = mode === "signin"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message ?? "Authentication failed. Check your details and try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("We could not reach the secure sign-in service. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative grid min-h-svh overflow-hidden bg-background text-foreground lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between">

        <div className="relative z-10 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-primary font-heading text-base font-bold text-primary-foreground">
            N
          </span>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">Nucleus HRMS</p>
            <p className="text-[12px] text-muted-foreground">
              Workforce operating system
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"><span className="size-1.5 rounded-full bg-primary" />Governed, human-led workflows</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="font-heading text-4xl font-semibold leading-[1.12] text-foreground sm:text-5xl"
          >
            Make every person decision feel clear.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground"
          >
            One clear workspace for people, time, payroll, talent, performance and organisational capability.
          </motion.p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, value: "Tenant-safe", label: "RLS isolated" },
            { icon: Fingerprint, value: "Auditable", label: "Every decision" },
            { icon: LockKeyhole, value: "Human-led", label: "Safe workflows" },
          ].map((item) => (
            <div
              key={item.value}
              className="rounded-lg border border-border bg-card p-4"
            >
              <item.icon className="size-4 text-primary" />
              <p className="mt-3 text-xs font-bold text-foreground">{item.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12 sm:px-12">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 w-full max-w-[420px]"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
              N
            </span>
            <p className="font-bold text-base tracking-tight text-foreground">Nucleus HRMS</p>
          </div>

          <p className="text-[11px] font-bold text-primary">
            Secure authentication
          </p>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-foreground">
            {mode === "signin" ? "Welcome back." : "Create account."}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {mode === "signin"
              ? "Sign in with your organization credentials to enter the workspace."
              : "Provision your secure administrative profile."}
          </p>

          <div
            className={`mt-6 grid ${signupAvailable ? "grid-cols-2" : "grid-cols-1"} rounded-lg border border-border bg-secondary p-1 text-[12px]`}
          >
            {(["signin", ...(signupAvailable ? ["signup" as const] : [])] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError("");
                }}
                className={`relative h-9 rounded-lg font-bold transition-colors ${
                  mode === item
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-2 block text-xs font-bold text-foreground">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Ananya Mehta"
                  className="h-11 w-full rounded-xl border border-border bg-secondary/40 px-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-bold text-foreground">
                Work Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="h-11 w-full rounded-xl border border-border bg-secondary/40 px-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold text-foreground">
                  Password
                </label>
                {mode === "signin" && (
                  <span className="font-mono text-[11px] text-muted-foreground">12–128 characters</span>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="At least 12 characters"
                  className="h-11 w-full rounded-xl border border-border bg-secondary/40 px-4 pr-11 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <CheckCircle2 className="size-3 text-primary" />
                  Must be 12–128 characters. Protected with scrypt.
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Securing Session…
                </>
              ) : (
                <>
                  {mode === "signin" ? "Enter Workspace" : "Create Account"}
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground leading-relaxed">
            Guaranteed tenant isolation, secure HTTP-only cookies, and revocable sessions.
          </p>
        </motion.div>
      </section>
    </main>
  );
}
