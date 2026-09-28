import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { concepts, lessonStates, mastery, surpriseQuizzes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canAccessMaterial, loadConceptContext } from "@/lib/teach";
import { MODE_IDS, styleToMode } from "@/lib/constants";
import LessonView from "@/components/LessonView";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params, searchParams }: { params: Promise<{ conceptId: string }>; searchParams: Promise<{ mode?: string; from?: string }> }) {
  const user = await requireUser();
  const { conceptId } = await params;
  const sp = await searchParams;
  const ctx = await loadConceptContext(conceptId);
  if (!ctx || !(await canAccessMaterial(user.id, ctx.concept.materialId))) notFound();
  const [state] = await db.select().from(lessonStates).where(and(eq(lessonStates.userId, user.id), eq(lessonStates.conceptId, conceptId)));
  const ids = [conceptId, ...ctx.prereqs.map((p) => p.id)];
  const ms = await db.select().from(mastery).where(and(eq(mastery.userId, user.id), inArray(mastery.conceptId, ids)));
  const score = (id: string) => ms.find((m) => m.conceptId === id)?.score ?? 0;
  const from = sp.from ? (await db.select({ id: concepts.id, name: concepts.name }).from(concepts).where(eq(concepts.id, sp.from)))[0] : null;
  const [pending] = await db.select({ id: surpriseQuizzes.id, title: surpriseQuizzes.title }).from(surpriseQuizzes)
    .where(and(eq(surpriseQuizzes.userId, user.id), eq(surpriseQuizzes.status, "pending"))).limit(1);
  const defaultMode = user.accessibility?.simplified ? "simple" : styleToMode(user.teachingStyle);
  const mode = sp.mode && MODE_IDS.includes(sp.mode) ? sp.mode : state?.mode ?? defaultMode;
  const ordered = [...ctx.siblings].sort((a, b) => a.idx - b.idx);

  return (
    <LessonView
      key={`${conceptId}-${sp.mode ?? ""}`}
      concept={{ id: ctx.concept.id, name: ctx.concept.name, sourcePage: ctx.concept.sourcePage, sourceSection: ctx.concept.sourceSection }}
      chapter={ctx.chapter?.title ?? null}
      objective={ctx.objective?.title ?? null}
      material={{ id: ctx.material.id, title: ctx.material.title }}
      position={{ index: ordered.findIndex((c) => c.id === conceptId) + 1, total: ordered.length }}
      initial={{ mode, language: state?.language ?? user.primaryLanguage, step: sp.mode && sp.mode !== state?.mode ? 1 : state?.step ?? 1 }}
      languages={{ primary: user.primaryLanguage, secondary: user.secondaryLanguage }}
      mastery={score(conceptId)}
      prerequisites={ctx.prereqs.map((p) => ({ id: p.id, name: p.name, score: score(p.id) }))}
      fromConcept={from ?? null}
      pendingSurprise={pending ?? null}
    />
  );
}
