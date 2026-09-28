"use server";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, sessions, users } from "@/db/schema";
import { createSession, destroySession, hashPassword, requireUser, sha256, verifyPassword } from "@/lib/auth";
import { buildStudyPlan } from "@/lib/learning";

export type AuthState = { error?: string; message?: string } | undefined;

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "What should your teacher call you?" };
  if (!emailOk(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: "An account with this email already exists. Try signing in." };
  const handle = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || "learner"}${Math.floor(Math.random() * 900 + 100)}`;
  const [u] = await db.insert(users).values({ name, email, passwordHash: hashPassword(password), handle }).returning();
  await createSession(u.id);
  redirect("/onboarding");
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || !verifyPassword(password, u.passwordHash)) return { error: "That email and password don't match. Try again." };
  await createSession(u.id);
  redirect(u.onboarded ? "/dashboard" : "/onboarding");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function requestReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!emailOk(email)) return { error: "Please enter a valid email address." };
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (u) {
    const token = randomBytes(24).toString("base64url");
    await db.insert(passwordResets).values({ id: sha256(token), userId: u.id, expiresAt: new Date(Date.now() + 3600_000) });
    // No email provider is required on the free setup: the link is written to the server log for the operator.
    console.info(`[auth] Password reset link for ${email}: /reset-password?token=${token}`);
  }
  return { message: "If an account exists for that email, a reset link is on its way. It expires in one hour." };
}

export async function resetPassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  const [r] = await db.select().from(passwordResets).where(eq(passwordResets.id, sha256(token)));
  if (!r || r.expiresAt < new Date()) return { error: "This reset link has expired. Request a new one." };
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, r.userId));
  await db.delete(passwordResets).where(eq(passwordResets.id, r.id));
  await db.delete(sessions).where(eq(sessions.userId, r.userId));
  await createSession(r.userId);
  redirect("/dashboard");
}

export type OnboardingData = {
  primaryLanguage: string; secondaryLanguage?: string | null; educationLevel: string; learningGoal: string;
  teachingStyle: string; dailyMinutes: number; subject?: string; targetExam?: string; targetDate?: string;
};

export async function completeOnboarding(data: OnboardingData) {
  const user = await requireUser();
  await db.update(users).set({
    primaryLanguage: data.primaryLanguage || "en",
    secondaryLanguage: data.secondaryLanguage || null,
    educationLevel: data.educationLevel,
    learningGoal: data.learningGoal,
    teachingStyle: data.teachingStyle,
    dailyMinutes: Math.max(5, Math.min(240, Number(data.dailyMinutes) || 25)),
    subject: data.subject?.slice(0, 80) || null,
    targetExam: data.targetExam?.slice(0, 80) || null,
    targetDate: data.targetDate || null,
    onboarded: true,
    accessibility: data.learningGoal === "Learn from basics" ? { simplified: false } : {},
  }).where(eq(users.id, user.id));
  await buildStudyPlan(user.id);
  redirect("/upload?welcome=1");
}
