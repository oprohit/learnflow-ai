import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { concepts, lessonStates } from "@/db/schema";
import { apiUser } from "@/lib/auth";
import { CONFUSION_STRATEGIES } from "@/lib/constants";
import {
  applyAttempt, applyConfusion, applyLessonComplete, decideNextStep, getMastery, logSession, maybeCreateSurprise, materialGraph,
} from "@/lib/learning";
import { canAccessMaterial, getRepresentation } from "@/lib/teach";

export const dynamic = "force-dynamic";

type Body = {
  action: "confused" | "understood" | "complete" | "check";
  conceptId: string;
  mode?: string;
  language?: string;
  chosen?: number;
  minutes?: number;
};

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const b = (await req.json()) as Body;
  const [c] = await db.select().from(concepts).where(eq(concepts.id, b.conceptId));
  if (!c || !(await canAccessMaterial(user.id, c.materialId))) return Response.json({ error: "Not found" }, { status: 404 });
  const profile = { educationLevel: user.educationLevel, learningGoal: user.learningGoal, simplified: !!user.accessibility?.simplified };

  if (b.action === "confused") {
    await applyConfusion(user.id, c.id, c.materialId);
    const [st] = await db.select().from(lessonStates).where(and(eq(lessonStates.userId, user.id), eq(lessonStates.conceptId, c.id)));
    const idx = st?.strategyIdx ?? 0;
    // Skip the strategy the learner is already looking at.
    let strategy = CONFUSION_STRATEGIES[idx % CONFUSION_STRATEGIES.length];
    let nextIdx = idx + 1;
    if (strategy.mode === b.mode) { strategy = CONFUSION_STRATEGIES[nextIdx % CONFUSION_STRATEGIES.length]; nextIdx++; }
    if (st) await db.update(lessonStates).set({ strategyIdx: nextIdx, difficulty: "easier", mode: strategy.mode }).where(and(eq(lessonStates.userId, user.id), eq(lessonStates.conceptId, c.id)));
    else await db.insert(lessonStates).values({ userId: user.id, conceptId: c.id, strategyIdx: nextIdx, difficulty: "easier", mode: strategy.mode, language: b.language ?? "en" });

    // Inspect likely prerequisite weakness from the dependency graph.
    const g = await materialGraph(c.materialId, user.id);
    const weakPrereq = g.prereqOf(c.id).map((id) => g.concepts.find((x) => x.id === id)!).filter(Boolean)
      .sort((a, b2) => (g.mMap.get(a.id)?.score ?? 0) - (g.mMap.get(b2.id)?.score ?? 0))[0];
    const m = await getMastery(user.id, c.id);
    return Response.json({
      strategy,
      confusions: m?.confusions ?? 1,
      prerequisite: weakPrereq && (g.mMap.get(weakPrereq.id)?.score ?? 0) < 50 && nextIdx >= 2
        ? { id: weakPrereq.id, name: weakPrereq.name, message: `This might feel hard because it builds on ${weakPrereq.name}. Want a two-minute refresher first?` }
        : null,
    });
  }

  if (b.action === "check") {
    const rep = await getRepresentation({ conceptId: c.id, mode: b.mode ?? "standard", language: b.language ?? "en", userId: user.id, profile });
    const en = b.language && b.language !== "en" && rep?.engine !== "curated" ? await getRepresentation({ conceptId: c.id, mode: b.mode ?? "standard", language: "en", userId: user.id, profile }) : rep;
    if (!rep) return Response.json({ error: "Not found" }, { status: 404 });
    const correct = b.chosen === rep.content.check.answer;
    // Diagnose: does the chosen wrong option match another concept's definition?
    let diagnosis: string | null = null;
    let confusedWith: { id: string; name: string } | null = null;
    if (!correct && en && typeof b.chosen === "number") {
      const chosenText = (en.content.check.options[b.chosen] ?? "").toLowerCase().slice(0, 60);
      const siblings = await db.select().from(concepts).where(eq(concepts.materialId, c.materialId));
      const other = siblings.find((s) => s.id !== c.id && s.definition && s.definition.toLowerCase().startsWith(chosenText.slice(0, 40)));
      if (other) {
        confusedWith = { id: other.id, name: other.name };
        diagnosis = `You seem to be mixing up ${c.name.toLowerCase()} and ${other.name.toLowerCase()}. That option describes ${other.name}, not ${c.name}.`;
      } else if (rep.content.check.misconception) diagnosis = `This is a common trap: ${rep.content.check.misconception}`;
    }
    const res = await applyAttempt({ userId: user.id, conceptId: c.id, materialId: c.materialId, correct, difficulty: "easy", context: "check", answer: b.chosen, misconception: diagnosis });
    await db.update(lessonStates).set({ checkAnswered: true }).where(and(eq(lessonStates.userId, user.id), eq(lessonStates.conceptId, c.id)));
    const next = correct ? null : await decideNextStep(user.id, c.id, { justFailedCheck: true });
    return Response.json({ correct, answer: rep.content.check.answer, explanation: rep.content.check.explanation, diagnosis, confusedWith, mastery: res.score, delta: res.delta, next });
  }

  // understood | complete
  const score = await applyLessonComplete(user.id, c.id, c.materialId, b.action === "understood" || b.action === "complete");
  await logSession(user.id, "lesson", b.minutes ?? 5, c.materialId, c.id);
  await db.update(lessonStates).set({ progress: 100 }).where(and(eq(lessonStates.userId, user.id), eq(lessonStates.conceptId, c.id)));
  const next = await decideNextStep(user.id, c.id);
  const surprise = await maybeCreateSurprise(user.id, "lesson", c.id);
  return Response.json({ mastery: score, next, surprise: surprise ? { id: surprise.id, title: surprise.title, reason: surprise.reason } : null });
}
