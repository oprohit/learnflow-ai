import Link from "next/link";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ArrowRight, Flame, Zap, AlertTriangle, Clock, Sparkles, Upload, CalendarDays } from "lucide-react";
import { db } from "@/db";
import { concepts, lessonStates, mastery, materials, quizAttempts, studySessions, surpriseQuizzes, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { buildStudyPlan, maybeCreateSurprise } from "@/lib/learning";
import { accessibleMaterialIds } from "@/lib/teach";
import { MasteryRing, ProgressBar, timeAgo } from "@/components/ui";

export const metadata = { title: "Home · LearnFlow AI" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const ids = await accessibleMaterialIds(user.id);
  await maybeCreateSurprise(user.id, "dashboard");
  const [u] = await db.select().from(users).where(eq(users.id, user.id));
  const [last] = await db.select({ s: lessonStates, name: concepts.name, materialId: concepts.materialId }).from(lessonStates)
    .innerJoin(concepts, eq(concepts.id, lessonStates.conceptId)).where(eq(lessonStates.userId, user.id)).orderBy(desc(lessonStates.updatedAt)).limit(1);
  const [currentMat] = last ? await db.select().from(materials).where(eq(materials.id, last.materialId)) : ids.length ? await db.select().from(materials).where(inArray(materials.id, ids)).orderBy(desc(materials.createdAt)).limit(1) : [];
  const ms = await db.select({ m: mastery, name: concepts.name }).from(mastery).innerJoin(concepts, eq(concepts.id, mastery.conceptId)).where(eq(mastery.userId, user.id));
  const matConcepts = currentMat ? await db.select({ id: concepts.id }).from(concepts).where(eq(concepts.materialId, currentMat.id)) : [];
  const matAvg = matConcepts.length ? matConcepts.reduce((n, c) => n + (ms.find((x) => x.m.conceptId === c.id)?.m.score ?? 0), 0) / matConcepts.length : 0;
  const weak = ms.filter((r) => r.m.attempts > 0 && r.m.score < 50).sort((a, b) => a.m.score - b.m.score).slice(0, 4);
  const [surprise] = await db.select().from(surpriseQuizzes).where(and(eq(surpriseQuizzes.userId, user.id), eq(surpriseQuizzes.status, "pending"))).limit(1);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [{ mins }] = await db.select({ mins: sql<number>`coalesce(sum(${studySessions.minutes}),0)::float` }).from(studySessions).where(and(eq(studySessions.userId, user.id), gte(studySessions.createdAt, today)));
  const plan = await buildStudyPlan(user.id);
  const todayPlan = plan.days[0];
  const due = ms.filter((r) => r.m.nextReview && r.m.nextReview < new Date(Date.now() + 86400_000) && r.m.score < 90).slice(0, 3);
  const recent = await db.select({ a: quizAttempts, name: concepts.name }).from(quizAttempts).innerJoin(concepts, eq(concepts.id, quizAttempts.conceptId))
    .where(eq(quizAttempts.userId, user.id)).orderBy(desc(quizAttempts.createdAt)).limit(5);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (!ids.length) {
    return (
      <div className="py-6">
        <p className="eyebrow">{greet}, {u.name.split(" ")[0]}</p>
        <h1 className="mt-2 font-display text-5xl leading-[1] sm:text-6xl">What shall we learn first?</h1>
        <p className="mt-4 max-w-xl text-muted">Upload a chapter, notes or slides. Your teacher will map the objectives and concepts, then start from the basics — in {u.primaryLanguage === "en" ? "English" : "your language"}.</p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row"><Link href="/upload" className="btn btn-primary h-12"><Upload size={18} /> Upload material</Link><Link href="/upload" className="btn h-12"><Sparkles size={18} /> Try the Newton&rsquo;s Laws sample</Link></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0"><p className="eyebrow">{greet}</p><h1 className="mt-1 truncate font-display text-4xl sm:text-5xl">{u.name.split(" ")[0]}&rsquo;s desk</h1></div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border hairline px-3 py-1.5 text-sm" aria-label={`${u.streak} day streak`}><Flame size={16} className="text-saffron" /><b className="tabular-nums">{u.streak}</b><span className="hidden text-muted sm:inline">day streak</span></div>
      </header>

      {surprise && (
        <Link href={`/quiz?surprise=${surprise.id}`} className="flex items-center gap-4 rounded-2xl border border-iris/40 bg-gradient-to-r from-iris/15 to-transparent p-5 animate-rise">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-iris text-ink"><Zap size={20} /></span>
          <div className="min-w-0 flex-1"><p className="font-display text-2xl leading-tight">{surprise.title}</p><p className="text-sm text-muted">{surprise.reason}</p></div>
          <ArrowRight className="shrink-0 text-iris" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card relative overflow-hidden p-6">
          <div className="grain pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative">
            <p className="eyebrow">Continue learning</p>
            {last ? (
              <>
                <p className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{last.name}</p>
                <p className="mt-1 text-sm text-muted">{currentMat?.title} · {last.s.mode} · {last.s.language.toUpperCase()}</p>
                <ProgressBar value={last.s.progress} className="mt-5 max-w-sm" />
                <Link href={`/learn/${last.s.conceptId}`} className="btn btn-primary mt-5">Resume where you left off <ArrowRight size={17} /></Link>
              </>
            ) : (
              <>
                <p className="mt-2 font-display text-3xl">{currentMat?.title}</p>
                <Link href="/learn" className="btn btn-primary mt-5">Start your first lesson <ArrowRight size={17} /></Link>
              </>
            )}
          </div>
        </section>
        <section className="card p-6">
          <div className="flex items-center justify-between"><p className="eyebrow">Today&rsquo;s goal</p><Link href="/plan" className="text-xs text-muted hover:text-paper"><CalendarDays size={13} className="mr-1 inline" />Plan</Link></div>
          <p className="mt-2 font-display text-4xl tabular-nums">{Math.round(mins)}<span className="text-xl text-muted"> / {u.dailyMinutes} min</span></p>
          <ProgressBar value={(mins / u.dailyMinutes) * 100} tone="sage" className="mt-3" />
          <ul className="mt-4 space-y-1.5 text-sm">
            {(todayPlan?.items ?? []).slice(0, 4).map((it, i) => (
              <li key={i} className="flex items-center gap-2"><span className="w-12 text-xs tabular-nums text-dim">{it.minutes} min</span><span className="capitalize text-muted">{it.kind}</span><span className="truncate">{it.name}</span></li>
            ))}
            {!todayPlan?.items.length && <li className="text-muted">Everything&rsquo;s strong. Try a revision round.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card flex items-center gap-4 p-5">
          <MasteryRing value={matAvg} size={68} />
          <div className="min-w-0"><p className="eyebrow">Mastery</p><p className="truncate font-medium">{currentMat?.title}</p><Link href="/progress" className="text-xs text-saffron">View all concepts →</Link></div>
        </section>
        <section className="card p-5">
          <p className="eyebrow flex items-center gap-1.5"><AlertTriangle size={12} className="text-coral" /> Weak concepts</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {weak.length ? weak.map((w) => <Link key={w.m.conceptId} href={`/learn/${w.m.conceptId}?mode=simple`} className="chip border-coral/30 text-coral hover:text-paper">{w.name} · {Math.round(w.m.score)}%</Link>) : <p className="text-sm text-muted">None yet — keep going.</p>}
          </div>
        </section>
        <section className="card p-5">
          <p className="eyebrow flex items-center gap-1.5"><Clock size={12} /> Upcoming review</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {due.length ? due.map((d) => <li key={d.m.conceptId}><Link href={`/quiz?concept=${d.m.conceptId}`} className="flex justify-between gap-2 hover:text-saffron"><span className="truncate">{d.name}</span><span className="shrink-0 text-xs text-dim">{Math.round(d.m.score)}%</span></Link></li>) : <li className="text-muted">Nothing due.</li>}
          </ul>
        </section>
      </div>

      <section>
        <p className="eyebrow mb-3">Recent activity</p>
        <div className="card divide-y divide-white/5">
          {recent.length ? recent.map((r) => (
            <div key={r.a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className={`h-2 w-2 rounded-full ${r.a.correct ? "bg-sage" : "bg-coral"}`} />
              <span className="flex-1 truncate">{r.a.correct ? "Answered correctly" : "Missed a question"} · {r.name}</span>
              <span className={`text-xs tabular-nums ${r.a.masteryDelta >= 0 ? "text-sage" : "text-coral"}`}>{r.a.masteryDelta >= 0 ? "+" : ""}{r.a.masteryDelta}</span>
              <span className="w-16 text-right text-xs text-dim">{timeAgo(r.a.createdAt)}</span>
            </div>
          )) : <p className="px-4 py-6 text-sm text-muted">Your answers and milestones will appear here.</p>}
        </div>
      </section>
    </div>
  );
}
