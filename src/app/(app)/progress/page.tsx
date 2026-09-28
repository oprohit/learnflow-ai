import Link from "next/link";
import { and, eq, inArray, sql } from "drizzle-orm";
import { RotateCcw } from "lucide-react";
import { db } from "@/db";
import { concepts, mastery, materials, quizAttempts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleMaterialIds } from "@/lib/teach";
import { effectiveScore } from "@/lib/learning";
import { masteryBand } from "@/lib/constants";
import { Empty, MasteryBadge, PageHeader, ProgressBar, Stat, timeAgo, toneColor } from "@/components/ui";

export const metadata = { title: "Progress · LearnFlow AI" };
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireUser();
  const ids = await accessibleMaterialIds(user.id);
  const mats = ids.length ? await db.select().from(materials).where(and(inArray(materials.id, ids), eq(materials.status, "ready"))) : [];
  const cs = ids.length ? await db.select().from(concepts).where(inArray(concepts.materialId, ids)).orderBy(concepts.idx) : [];
  const ms = cs.length ? await db.select().from(mastery).where(and(eq(mastery.userId, user.id), inArray(mastery.conceptId, cs.map((c) => c.id)))) : [];
  const mm = new Map(ms.map((m) => [m.conceptId, m]));
  const [{ n, c }] = await db.select({ n: sql<number>`count(*)::int`, c: sql<number>`coalesce(sum(case when ${quizAttempts.correct} then 1 else 0 end),0)::int` }).from(quizAttempts).where(eq(quizAttempts.userId, user.id));
  const bands = { strong: 0, developing: 0, weak: 0, idle: 0 };
  cs.forEach((x) => { const m = mm.get(x.id); bands[masteryBand(m?.score ?? 0, m?.attempts ?? (m ? 1 : 0)).tone]++; });

  if (!cs.length) return (<><PageHeader title="Progress" /><Empty title="No progress yet" body="Study your first lesson and your concept mastery will appear here." action={<Link href="/upload" className="btn btn-primary">Upload material</Link>} /></>);

  return (
    <>
      <PageHeader eyebrow="Deterministic mastery — calculated, not guessed" title="Progress" action={<Link href="/revision" className="btn"><RotateCcw size={16} /> Revise</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Strong" value={<span className="text-sage">{bands.strong}</span>} hint="≥ 75% mastery" />
        <Stat label="Developing" value={<span className="text-saffron">{bands.developing}</span>} hint="40–74%" />
        <Stat label="Needs attention" value={<span className="text-coral">{bands.weak}</span>} hint="< 40%" />
        <Stat label="Accuracy" value={n ? `${Math.round((c / n) * 100)}%` : "—"} hint={`${n} answers`} />
      </div>
      {mats.map((m) => {
        const mc = cs.filter((x) => x.materialId === m.id);
        return (
          <section key={m.id} className="mt-10">
            <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="font-display text-3xl">{m.title}</h2><Link href={`/materials/${m.id}`} className="shrink-0 text-xs text-muted hover:text-paper">Concept map →</Link></div>
            <div className="card divide-y divide-white/5">
              {mc.map((x) => {
                const s = mm.get(x.id);
                const score = s?.score ?? 0;
                const eff = effectiveScore(score, s?.lastStudied ?? null);
                return (
                  <Link key={x.id} href={`/learn/${x.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-white/[0.02] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto]">
                    <div className="min-w-0"><p className="truncate font-medium">{x.name}</p><p className="text-xs text-dim">{timeAgo(s?.lastStudied)}{s?.lastMisconception ? ` · ${s.lastMisconception.slice(0, 60)}` : ""}</p></div>
                    <span className="text-right font-display text-2xl tabular-nums sm:order-3" style={{ color: toneColor(score, s?.attempts ?? (s ? 1 : 0)) }}>{Math.round(score)}%</span>
                    <div className="col-span-2 sm:order-2 sm:col-span-1"><ProgressBar value={score} tone={score >= 75 ? "sage" : score >= 40 ? "saffron" : "coral"} />{eff < score - 8 && <p className="mt-1 text-[0.7rem] text-coral">Fading — review soon ({eff}%)</p>}</div>
                    <span className="hidden sm:order-4 sm:block"><MasteryBadge score={score} attempts={s?.attempts ?? (s ? 1 : 0)} /></span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
