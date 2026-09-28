/**
 * Deterministic learning engine. No AI here by design:
 * mastery math, scheduling, next-step decisions, surprise triggers and plans are pure app logic.
 */
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conceptRelations, concepts, chapters, mastery, materials, notifications, quizAttempts, quizQuestions,
  studyPlans, studySessions, surpriseQuizzes, users,
} from "@/db/schema";
import type { NextStep } from "@/lib/types";

const DIFF_W: Record<string, number> = { easy: 0.75, medium: 1, hard: 1.3 };
const CTX_W: Record<string, number> = { check: 0.6, quiz: 1, surprise: 1.2, flashcard: 0.4, challenge: 1 };

export const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);

export async function getMastery(userId: string, conceptId: string) {
  const [m] = await db.select().from(mastery).where(and(eq(mastery.userId, userId), eq(mastery.conceptId, conceptId))).limit(1);
  return m;
}

async function upsertMastery(userId: string, conceptId: string, materialId: string, patch: (m: typeof mastery.$inferSelect | undefined) => Partial<typeof mastery.$inferInsert>) {
  const current = await getMastery(userId, conceptId);
  const values = patch(current);
  if (current) {
    await db.update(mastery).set(values).where(and(eq(mastery.userId, userId), eq(mastery.conceptId, conceptId)));
  } else {
    await db.insert(mastery).values({ userId, conceptId, materialId, ...values });
  }
  return { before: current?.score ?? 0, after: (values.score as number | undefined) ?? current?.score ?? 0 };
}

const reviewAfter = (score: number) => {
  const days = score < 40 ? 0.5 : score < 60 ? 1 : score < 75 ? 3 : score < 90 ? 7 : 14;
  return new Date(Date.now() + days * 86400_000);
};

/** Elo-style update: gains shrink as mastery rises, losses scale with overconfidence. */
export function masteryDelta(score: number, correct: boolean, difficulty = "medium", context = "quiz") {
  const w = DIFF_W[difficulty] ?? 1;
  const cw = CTX_W[context] ?? 1;
  const d = correct ? (18 * w * (1 - score / 100) + 2) * cw : -((12 * (score / 100)) / w + 2) * cw;
  return Math.round(Math.max(-score, Math.min(100 - score, d)) * 10) / 10;
}

export async function applyAttempt(p: {
  userId: string; conceptId: string; materialId: string; correct: boolean; difficulty?: string; context?: string;
  questionId?: string | null; answer?: unknown; timeMs?: number; misconception?: string | null;
}) {
  const m = await getMastery(p.userId, p.conceptId);
  const delta = masteryDelta(m?.score ?? 0, p.correct, p.difficulty, p.context);
  const prior = p.questionId
    ? await db.select({ n: sql<number>`count(*)::int` }).from(quizAttempts)
        .where(and(eq(quizAttempts.userId, p.userId), eq(quizAttempts.questionId, p.questionId)))
    : [{ n: 0 }];
  await db.insert(quizAttempts).values({
    userId: p.userId, questionId: p.questionId ?? null, conceptId: p.conceptId, materialId: p.materialId,
    correct: p.correct, answer: (p.answer ?? null) as object, timeMs: p.timeMs, attemptNo: (prior[0]?.n ?? 0) + 1,
    difficulty: p.difficulty, masteryDelta: delta, context: p.context ?? "quiz",
  });
  const res = await upsertMastery(p.userId, p.conceptId, p.materialId, (cur) => {
    const score = Math.max(0, Math.min(100, (cur?.score ?? 0) + delta));
    return {
      score, attempts: (cur?.attempts ?? 0) + 1, correct: (cur?.correct ?? 0) + (p.correct ? 1 : 0),
      lastStudied: new Date(), nextReview: reviewAfter(score),
      lastMisconception: p.correct ? cur?.lastMisconception ?? null : p.misconception ?? cur?.lastMisconception ?? null,
    };
  });
  await touchStudy(p.userId, p.correct ? 4 : 1, p.materialId);
  await milestone(p.userId, p.conceptId, res.before, res.after);
  return { delta, score: res.after };
}

export async function applyLessonComplete(userId: string, conceptId: string, materialId: string, understood: boolean) {
  const res = await upsertMastery(userId, conceptId, materialId, (cur) => {
    const s = cur?.score ?? 0;
    // Lessons alone can lift mastery to 60 at most — assessment is required for "Strong".
    const score = s < 60 ? Math.min(60, s + (understood ? 10 : 4)) : s;
    return { score, lessonsCompleted: (cur?.lessonsCompleted ?? 0) + 1, lastStudied: new Date(), nextReview: reviewAfter(score), attempts: cur?.attempts ?? 0 };
  });
  await db.update(materials).set({ lastStudiedAt: new Date() }).where(eq(materials.id, materialId));
  await touchStudy(userId, 10, materialId);
  return res.after;
}

export async function applyConfusion(userId: string, conceptId: string, materialId: string) {
  await upsertMastery(userId, conceptId, materialId, (cur) => ({
    confusions: (cur?.confusions ?? 0) + 1, lastStudied: new Date(), score: Math.max(0, (cur?.score ?? 0) - 2),
  }));
}

export async function applyFlashcard(userId: string, conceptId: string, materialId: string, know: boolean) {
  await upsertMastery(userId, conceptId, materialId, (cur) => {
    const s = cur?.score ?? 0;
    const score = know ? Math.min(Math.max(s, 85), s + 3) : Math.max(0, s - 3);
    return { score: know && s >= 85 ? s : score, lastStudied: new Date(), nextReview: reviewAfter(score) };
  });
}

/** Forgetting curve used for "forgotten concepts" and review priority. */
export function effectiveScore(score: number, lastStudied: Date | null) {
  if (!lastStudied) return score;
  const days = (Date.now() - new Date(lastStudied).getTime()) / 86400_000;
  return Math.round(score * Math.max(0.55, 1 - days / 45));
}

async function touchStudy(userId: string, xp: number, materialId?: string) {
  const [u] = await db.select({ lastStudyDate: users.lastStudyDate, streak: users.streak }).from(users).where(eq(users.id, userId));
  const today = todayStr();
  const yesterday = todayStr(new Date(Date.now() - 86400_000));
  const streak = u?.lastStudyDate === today ? u.streak : u?.lastStudyDate === yesterday ? (u?.streak ?? 0) + 1 : 1;
  await db.update(users).set({ xp: sql`${users.xp} + ${xp}`, streak, lastStudyDate: today }).where(eq(users.id, userId));
  if (materialId) await db.update(materials).set({ lastStudiedAt: new Date() }).where(eq(materials.id, materialId));
}

export async function logSession(userId: string, kind: string, minutes: number, materialId?: string | null, conceptId?: string | null) {
  await db.insert(studySessions).values({ userId, kind, minutes: Math.max(0.2, Math.min(90, minutes)), materialId: materialId ?? null, conceptId: conceptId ?? null });
}

export async function notify(userId: string, kind: string, title: string, body?: string, href?: string) {
  await db.insert(notifications).values({ userId, kind, title, body, href });
}

async function milestone(userId: string, conceptId: string, before: number, after: number) {
  if (before < 75 && after >= 75) {
    const [c] = await db.select({ name: concepts.name }).from(concepts).where(eq(concepts.id, conceptId));
    await notify(userId, "milestone", `You've mastered ${c?.name ?? "a concept"}`, "Strong mastery reached. It'll come back for spaced review.", `/learn/${conceptId}`);
  }
}

/* ---------------- graph helpers ---------------- */
export async function materialGraph(materialId: string, userId: string) {
  const cs = await db.select().from(concepts).where(eq(concepts.materialId, materialId)).orderBy(concepts.idx);
  const rels = await db.select().from(conceptRelations).where(eq(conceptRelations.materialId, materialId));
  const ms = cs.length ? await db.select().from(mastery).where(and(eq(mastery.userId, userId), inArray(mastery.conceptId, cs.map((c) => c.id)))) : [];
  const mMap = new Map(ms.map((m) => [m.conceptId, m]));
  const prereqOf = (id: string) => rels.filter((r) => r.type === "prerequisite" && r.toId === id).map((r) => r.fromId);
  return { concepts: cs, rels, mMap, prereqOf };
}

/** Topological order over prerequisite edges, stable by source order. */
export function topoOrder<T extends { id: string; idx: number }>(cs: T[], prereqOf: (id: string) => string[]) {
  const done = new Set<string>();
  const out: T[] = [];
  const byId = new Map(cs.map((c) => [c.id, c]));
  const visit = (c: T, stack: Set<string>) => {
    if (done.has(c.id) || stack.has(c.id)) return;
    stack.add(c.id);
    for (const p of prereqOf(c.id)) { const pc = byId.get(p); if (pc) visit(pc, stack); }
    done.add(c.id);
    out.push(c);
  };
  [...cs].sort((a, b) => a.idx - b.idx).forEach((c) => visit(c, new Set()));
  return out;
}

/* ---------------- next best lesson ---------------- */
export async function decideNextStep(userId: string, conceptId: string, opts: { justFailedCheck?: boolean } = {}): Promise<NextStep> {
  const [c] = await db.select().from(concepts).where(eq(concepts.id, conceptId));
  if (!c) return { action: "done", label: "Back to library", reason: "", href: "/library" };
  const g = await materialGraph(c.materialId, userId);
  const m = g.mMap.get(conceptId);
  const score = m?.score ?? 0;
  const weakPrereqs = g.prereqOf(conceptId)
    .map((id) => g.concepts.find((x) => x.id === id)!)
    .filter((p) => p && (g.mMap.get(p.id)?.score ?? 0) < 50);

  if ((opts.justFailedCheck || score < 40) && weakPrereqs.length && ((m?.confusions ?? 0) >= 1 || (m?.attempts ?? 0) > (m?.correct ?? 0))) {
    const p = weakPrereqs[0];
    return { action: "prerequisite", label: `Revisit ${p.name}`, reason: `${c.name} builds on ${p.name}. Let's make that solid first — then come back.`, conceptId: p.id, conceptName: p.name, mode: "simple", href: `/learn/${p.id}?mode=simple&from=${conceptId}` };
  }
  if ((m?.confusions ?? 0) >= 2 && score < 50) {
    return { action: "simplify", label: "Try a simpler explanation", reason: "You've found this tricky — a slower, simpler version will help.", conceptId, conceptName: c.name, mode: "steps", href: `/learn/${conceptId}?mode=steps` };
  }
  if ((m?.attempts ?? 0) > 0 && score < 55) {
    return { action: "practice", label: `Practise ${c.name}`, reason: "A few targeted questions will lock this in.", conceptId, conceptName: c.name, href: `/quiz?concept=${conceptId}` };
  }
  if ((m?.attempts ?? 0) === 0 && (m?.lessonsCompleted ?? 0) >= 1 && score < 75) {
    return { action: "practice", label: "Quick check", reason: "You've studied this — let's see if it stuck.", conceptId, conceptName: c.name, href: `/quiz?concept=${conceptId}` };
  }
  if (score >= 85 && (m?.lessonsCompleted ?? 0) < 3) {
    return { action: "deeper", label: `Go deeper into ${c.name}`, reason: "You've got the fundamentals. Ready for the advanced view?", conceptId, conceptName: c.name, mode: "advanced", href: `/learn/${conceptId}?mode=advanced` };
  }
  const due = g.concepts.find((x) => x.id !== conceptId && (() => { const mm = g.mMap.get(x.id); return mm && mm.nextReview && mm.nextReview < new Date() && mm.score < 75; })());
  const order = topoOrder(g.concepts, g.prereqOf);
  const pos = order.findIndex((x) => x.id === conceptId);
  const next = [...order.slice(pos + 1), ...order.slice(0, pos)].find((x) => (g.mMap.get(x.id)?.score ?? 0) < 75);
  if (due && (!next || Math.random() < 0.35)) {
    return { action: "review", label: `Review ${due.name}`, reason: "It's been a while — a quick review keeps it from fading.", conceptId: due.id, conceptName: due.name, href: `/learn/${due.id}?mode=simple` };
  }
  if (next) return { action: "continue", label: `Continue to ${next.name}`, reason: "You're ready for the next idea in the chain.", conceptId: next.id, conceptName: next.name, href: `/learn/${next.id}` };
  return { action: "done", label: "Material mastered — revise", reason: "Every concept is strong. Keep it that way with revision.", href: "/progress" };
}

/* ---------------- surprise quizzes ---------------- */
const MIN_GAP_MIN = 12;
const DAILY_CAP = 5;

export async function maybeCreateSurprise(userId: string, trigger: "lesson" | "dashboard" | "quiz", justCompletedConceptId?: string) {
  const pending = await db.select({ id: surpriseQuizzes.id }).from(surpriseQuizzes)
    .where(and(eq(surpriseQuizzes.userId, userId), eq(surpriseQuizzes.status, "pending"))).limit(1);
  if (pending.length) return null;
  const [last] = await db.select().from(surpriseQuizzes).where(eq(surpriseQuizzes.userId, userId)).orderBy(desc(surpriseQuizzes.createdAt)).limit(1);
  if (last && Date.now() - last.createdAt.getTime() < MIN_GAP_MIN * 60_000) return null;
  const todayCount = await db.select({ n: sql<number>`count(*)::int` }).from(surpriseQuizzes)
    .where(and(eq(surpriseQuizzes.userId, userId), gte(surpriseQuizzes.createdAt, new Date(Date.now() - 86400_000))));
  if ((todayCount[0]?.n ?? 0) >= DAILY_CAP) return null;

  const ms = await db.select({ m: mastery, name: concepts.name }).from(mastery)
    .innerJoin(concepts, eq(concepts.id, mastery.conceptId)).where(eq(mastery.userId, userId));
  if (!ms.length) return null;
  const recentWrong = await db.select({ conceptId: quizAttempts.conceptId }).from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.correct, false), gte(quizAttempts.createdAt, new Date(Date.now() - 2 * 86400_000))))
    .orderBy(desc(quizAttempts.createdAt)).limit(5);

  type Cand = { conceptId: string; name: string; title: string; reason: string };
  let cand: Cand | undefined;
  const byId = new Map(ms.map((r) => [r.m.conceptId, r]));
  const wrong = recentWrong.map((r) => byId.get(r.conceptId)).find((r) => r && r.m.conceptId !== justCompletedConceptId && r.m.score < 75);
  const old = ms.find((r) => r.m.lastStudied && Date.now() - r.m.lastStudied.getTime() > 2 * 86400_000 && r.m.score > 0);
  const weak = ms.filter((r) => r.m.attempts > 0 && r.m.score < 40).sort((a, b) => a.m.score - b.m.score)[0];
  const fresh = justCompletedConceptId ? byId.get(justCompletedConceptId) : undefined;

  if (wrong) cand = { conceptId: wrong.m.conceptId, name: wrong.name, title: "Quick check.", reason: `You missed a question on ${wrong.name} recently. Let's see if it's clicked now.` };
  else if (old) cand = { conceptId: old.m.conceptId, name: old.name, title: `Do you still remember ${old.name}?`, reason: "It's been a few days since you studied this." };
  else if (weak) cand = { conceptId: weak.m.conceptId, name: weak.name, title: "Two-minute challenge.", reason: `${weak.name} needs attention — three quick questions.` };
  else if (fresh && trigger === "lesson" && fresh.m.lessonsCompleted >= 1 && fresh.m.attempts === 0) cand = { conceptId: fresh.m.conceptId, name: fresh.name, title: "Before we move on…", reason: `A quick check on ${fresh.name} before the next idea.` };
  if (!cand) return null;

  const qs = await db.select({ id: quizQuestions.id, type: quizQuestions.type }).from(quizQuestions).where(eq(quizQuestions.conceptId, cand.conceptId));
  const pick = qs.filter((q) => ["mcq", "tf", "fill", "application"].includes(q.type)).sort(() => Math.random() - 0.5).slice(0, 3);
  if (!pick.length) return null;
  const [sq] = await db.insert(surpriseQuizzes).values({
    userId, conceptId: cand.conceptId, questionIds: pick.map((q) => q.id), title: cand.title, reason: cand.reason,
  }).returning();
  await notify(userId, "surprise", cand.title, cand.reason, `/quiz?surprise=${sq.id}`);
  return sq;
}

/* ---------------- study plan ---------------- */
export type PlanItem = { conceptId: string; name: string; material: string; materialId: string; chapter: string; kind: "lesson" | "visual" | "quiz" | "review"; minutes: number };
export type PlanDay = { date: string; items: PlanItem[]; total: number };

export async function buildStudyPlan(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const mats = await db.select().from(materials).where(and(eq(materials.userId, userId), eq(materials.status, "ready"))).orderBy(desc(materials.lastStudiedAt));
  const daily = u?.dailyMinutes ?? 25;
  const target = u?.targetDate ? new Date(u.targetDate) : new Date(Date.now() + 30 * 86400_000);
  const daysLeft = Math.max(1, Math.min(90, Math.ceil((target.getTime() - Date.now()) / 86400_000)));
  const horizon = Math.min(daysLeft, 14);

  const queue: { item: Omit<PlanItem, "kind" | "minutes">; score: number; weak: boolean }[] = [];
  const reviews: Omit<PlanItem, "kind" | "minutes">[] = [];
  for (const mat of mats) {
    const g = await materialGraph(mat.id, userId);
    const chs = await db.select().from(chapters).where(eq(chapters.materialId, mat.id));
    for (const c of topoOrder(g.concepts, g.prereqOf)) {
      const m = g.mMap.get(c.id);
      const eff = effectiveScore(m?.score ?? 0, m?.lastStudied ?? null);
      const base = { conceptId: c.id, name: c.name, material: mat.title, materialId: mat.id, chapter: chs.find((x) => x.id === c.chapterId)?.title ?? "" };
      if (eff < 75) queue.push({ item: base, score: eff, weak: !!m && m.attempts > 0 && eff < 40 });
      else if (m?.nextReview && m.nextReview < new Date(Date.now() + horizon * 86400_000)) reviews.push(base);
    }
  }
  // Weak concepts first (they block dependents), then source order.
  queue.sort((a, b) => Number(b.weak) - Number(a.weak));

  const days: PlanDay[] = [];
  let qi = 0;
  for (let d = 0; d < horizon; d++) {
    const date = todayStr(new Date(Date.now() + d * 86400_000));
    const items: PlanItem[] = [];
    let left = daily;
    const r = reviews[d];
    if (r && left >= 10) { items.push({ ...r, kind: "review", minutes: 5 }); left -= 5; }
    while (qi < queue.length && left >= 10) {
      const q = queue[qi];
      const lesson = q.score >= 40 ? 6 : 10;
      const block: PlanItem[] = [
        { ...q.item, kind: "lesson", minutes: lesson },
        { ...q.item, kind: "visual", minutes: 5 },
        { ...q.item, kind: "quiz", minutes: 5 },
      ];
      const need = block.reduce((n, b) => n + b.minutes, 0);
      if (need > left && items.length) break;
      items.push(...block);
      left -= need;
      qi++;
    }
    if (left >= 5 && items.length) { const last = items[items.length - 1]; items.push({ ...last, kind: "review", minutes: Math.min(left, 5) }); }
    days.push({ date, items, total: items.reduce((n, i) => n + i.minutes, 0) });
    if (qi >= queue.length && !reviews[d + 1]) break;
  }

  const recent = await db.select({ createdAt: studySessions.createdAt }).from(studySessions).where(eq(studySessions.userId, userId)).orderBy(desc(studySessions.createdAt)).limit(1);
  const missedDays = recent[0] ? Math.max(0, Math.floor((Date.now() - recent[0].createdAt.getTime()) / 86400_000) - 1) : 0;
  const plan = { daysLeft, targetExam: u?.targetExam ?? null, targetDate: u?.targetDate ?? null, dailyMinutes: daily, days, remainingConcepts: queue.length, missedDays };

  const [existing] = await db.select({ id: studyPlans.id }).from(studyPlans).where(eq(studyPlans.userId, userId)).limit(1);
  if (existing) await db.update(studyPlans).set({ plan, dailyMinutes: daily, targetDate: u?.targetDate, targetExam: u?.targetExam, updatedAt: new Date() }).where(eq(studyPlans.id, existing.id));
  else await db.insert(studyPlans).values({ userId, plan, dailyMinutes: daily, targetDate: u?.targetDate, targetExam: u?.targetExam });
  return plan;
}
export type StudyPlan = Awaited<ReturnType<typeof buildStudyPlan>>;
