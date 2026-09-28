import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { concepts, mastery, quizQuestions, surpriseQuizzes } from "@/db/schema";
import { apiUser } from "@/lib/auth";
import { accessibleMaterialIds, cachedTranslate, canAccessMaterial } from "@/lib/teach";
import { applyAttempt, decideNextStep, logSession, maybeCreateSurprise, effectiveScore } from "@/lib/learning";
import type { QuizQuestionDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

type Q = typeof quizQuestions.$inferSelect;

function toDTO(q: Q, names: Map<string, string>): QuizQuestionDTO {
  const left = q.type === "matching" && Array.isArray(q.answer) ? (q.answer as [string, string][]).map((p) => p[0]) : undefined;
  return { id: q.id, conceptId: q.conceptId, conceptName: names.get(q.conceptId), type: q.type as QuizQuestionDTO["type"], difficulty: q.difficulty, prompt: q.prompt, options: q.options, left, sourcePage: q.sourcePage };
}

/**
 * GET questions from the stored bank (no AI per question).
 * ?concept= | ?material= | ?surprise= | ?revision=quick|weak|exam|yesterday|forgotten  &lang=
 */
export async function GET(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") || user.primaryLanguage || "en";
  const conceptId = url.searchParams.get("concept");
  const materialId = url.searchParams.get("material");
  const surpriseId = url.searchParams.get("surprise");
  const revision = url.searchParams.get("revision");
  const allowed = await accessibleMaterialIds(user.id);
  let qs: Q[] = [];
  let title = "Practice";
  let subtitle = "";

  if (surpriseId) {
    const [s] = await db.select().from(surpriseQuizzes).where(and(eq(surpriseQuizzes.id, surpriseId), eq(surpriseQuizzes.userId, user.id)));
    if (!s) return Response.json({ error: "This quiz has expired." }, { status: 404 });
    qs = s.questionIds.length ? await db.select().from(quizQuestions).where(inArray(quizQuestions.id, s.questionIds)) : [];
    title = s.title; subtitle = s.reason;
  } else if (conceptId) {
    const [c] = await db.select().from(concepts).where(eq(concepts.id, conceptId));
    if (!c || !allowed.includes(c.materialId)) return Response.json({ error: "Not found" }, { status: 404 });
    const m = (await db.select().from(mastery).where(and(eq(mastery.userId, user.id), eq(mastery.conceptId, conceptId))))[0];
    const all = await db.select().from(quizQuestions).where(eq(quizQuestions.conceptId, conceptId));
    // Adaptive difficulty from mastery.
    const target = !m || m.score < 40 ? ["easy", "medium"] : m.score < 75 ? ["medium", "hard", "easy"] : ["hard", "medium"];
    qs = all.sort((a, b) => target.indexOf(a.difficulty) - target.indexOf(b.difficulty)).slice(0, 5);
    title = `Quiz · ${c.name}`; subtitle = "Questions adapt to your current mastery.";
  } else if (materialId) {
    if (!allowed.includes(materialId)) return Response.json({ error: "Not found" }, { status: 404 });
    const all = await db.select().from(quizQuestions).where(eq(quizQuestions.materialId, materialId));
    qs = all.sort(() => Math.random() - 0.5).slice(0, 10);
    title = "Material quiz"; subtitle = "Mixed questions across every chapter.";
  } else if (revision && allowed.length) {
    const ms = await db.select().from(mastery).where(and(eq(mastery.userId, user.id), inArray(mastery.materialId, allowed)));
    let ids: string[] = [];
    const now = Date.now();
    if (revision === "weak") { ids = ms.filter((m) => m.score < 50).sort((a, b) => a.score - b.score).map((m) => m.conceptId); title = "Weak topics"; }
    else if (revision === "yesterday") { ids = ms.filter((m) => m.lastStudied && now - m.lastStudied.getTime() < 2 * 86400_000 && now - m.lastStudied.getTime() > 6 * 3600_000).map((m) => m.conceptId); title = "Yesterday's concepts"; }
    else if (revision === "forgotten") { ids = ms.filter((m) => m.score > 0 && effectiveScore(m.score, m.lastStudied) < m.score - 8).map((m) => m.conceptId); title = "Forgotten concepts"; }
    else if (revision === "exam") { ids = ms.map((m) => m.conceptId); title = "Exam revision"; }
    else { ids = ms.sort(() => Math.random() - 0.5).map((m) => m.conceptId); title = "Quick revision"; }
    if (!ids.length) {
      const due = await db.select({ id: mastery.conceptId }).from(mastery).where(and(eq(mastery.userId, user.id), lt(mastery.score, 75)));
      ids = due.map((d) => d.id);
    }
    const all = ids.length ? await db.select().from(quizQuestions).where(inArray(quizQuestions.conceptId, ids.slice(0, 12))) : await db.select().from(quizQuestions).where(inArray(quizQuestions.materialId, allowed)).orderBy(asc(quizQuestions.id)).limit(40);
    const perConcept = new Map<string, number>();
    qs = all.sort(() => Math.random() - 0.5).filter((q) => { const n = perConcept.get(q.conceptId) ?? 0; perConcept.set(q.conceptId, n + 1); return n < (revision === "exam" ? 3 : 2); })
      .slice(0, revision === "exam" ? 15 : revision === "quick" ? 6 : 10);
    subtitle = "Built from your mastery data.";
  }

  const cIds = [...new Set(qs.map((q) => q.conceptId))];
  const names = new Map((cIds.length ? await db.select({ id: concepts.id, name: concepts.name }).from(concepts).where(inArray(concepts.id, cIds)) : []).map((c) => [c.id, c.name]));
  let dtos = qs.map((q) => toDTO(q, names));
  let translated = true;
  if (lang !== "en" && dtos.length) {
    const payload = dtos.map((d) => ({ prompt: d.prompt, options: d.type === "ordering" || d.type === "matching" ? [] : d.options }));
    const res = await cachedTranslate(`quiz:${dtos.map((d) => d.id).join(",")}`.slice(0, 500), payload, lang, user.id);
    translated = res.translated;
    if (res.translated) dtos = dtos.map((d, i) => ({ ...d, prompt: res.value[i]?.prompt ?? d.prompt, options: res.value[i]?.options?.length ? res.value[i].options : d.options }));
  }
  return Response.json({ title, subtitle, questions: dtos, language: translated ? lang : "en", notice: translated ? null : "Quiz shown in English while the AI teacher is offline." });
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function grade(q: Q, given: unknown): boolean {
  switch (q.type) {
    case "mcq": case "application": return Number(given) === Number(q.answer);
    case "tf": return String(given) === String(q.answer);
    case "fill": { const a = norm(q.answer), g = norm(given); return !!g && (a === g || (g.length > 3 && (a.includes(g) || g.includes(a)))); }
    case "short": {
      const keys = (Array.isArray(q.answer) ? q.answer : []) as string[];
      const g = norm(given);
      const hits = keys.filter((k) => g.includes(norm(k).slice(0, Math.max(4, norm(k).length - 2))));
      return keys.length ? hits.length >= Math.max(2, Math.ceil(keys.length * 0.35)) : g.length > 10;
    }
    case "ordering": return JSON.stringify(given) === JSON.stringify(q.answer);
    case "matching": {
      const pairs = q.answer as [string, string][];
      const g = (given ?? {}) as Record<string, string>;
      return pairs.every(([l, r]) => g[l] === r);
    }
    default: return false;
  }
}

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const b = (await req.json()) as { questionId?: string; answer?: unknown; timeMs?: number; context?: string; surpriseId?: string; action?: "finish" | "dismiss"; score?: number; minutes?: number };

  if (b.action && b.surpriseId) {
    await db.update(surpriseQuizzes).set({ status: b.action === "finish" ? "done" : "dismissed", score: b.score ?? null, completedAt: new Date() })
      .where(and(eq(surpriseQuizzes.id, b.surpriseId), eq(surpriseQuizzes.userId, user.id)));
    return Response.json({ ok: true });
  }
  if (b.action === "finish") {
    await logSession(user.id, b.context === "surprise" ? "surprise" : "quiz", b.minutes ?? 3);
    const surprise = await maybeCreateSurprise(user.id, "quiz");
    return Response.json({ ok: true, surprise: surprise ? { id: surprise.id, title: surprise.title } : null });
  }

  const [q] = await db.select().from(quizQuestions).where(eq(quizQuestions.id, b.questionId ?? ""));
  if (!q || !(await canAccessMaterial(user.id, q.materialId))) return Response.json({ error: "Question not found." }, { status: 404 });
  const correct = grade(q, b.answer);

  let diagnosis: string | null = null;
  if (!correct) {
    if ((q.type === "mcq" || q.type === "application") && typeof b.answer === "number") {
      const chosen = (q.options[b.answer] ?? "").toLowerCase();
      const sibs = await db.select().from(concepts).where(eq(concepts.materialId, q.materialId));
      const self = sibs.find((s) => s.id === q.conceptId);
      const other = sibs.find((s) => s.id !== q.conceptId && ((s.definition && s.definition.toLowerCase().startsWith(chosen.slice(0, 40))) || s.name.toLowerCase() === chosen));
      if (other && self) diagnosis = `You seem to be mixing up “${self.name}” with “${other.name}”. The option you chose describes ${other.name}.`;
    }
    if (!diagnosis && q.misconception) diagnosis = q.type === "tf" && String(b.answer) === "true" ? `You agreed with a common misconception: “${q.misconception}”.` : `Watch out for this trap: ${q.misconception}`;
  }

  const res = await applyAttempt({
    userId: user.id, conceptId: q.conceptId, materialId: q.materialId, correct, difficulty: q.difficulty,
    context: b.context ?? "quiz", questionId: q.id, answer: b.answer, timeMs: b.timeMs, misconception: diagnosis,
  });
  const next = !correct ? await decideNextStep(user.id, q.conceptId, { justFailedCheck: true }) : null;
  const total = await db.select({ n: sql<number>`count(*)::int` }).from(quizQuestions).where(eq(quizQuestions.conceptId, q.conceptId));
  return Response.json({
    correct, answer: q.answer, explanation: q.explanation, diagnosis, mastery: Math.round(res.score), delta: res.delta,
    next: next && next.action === "prerequisite" ? next : null, bankSize: total[0]?.n ?? 0, sourcePage: q.sourcePage,
  });
}
