import Link from "next/link";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { BookOpen, Eye, Zap, RotateCcw, AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { buildStudyPlan } from "@/lib/learning";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Study plan · LearnFlow AI" };
export const dynamic = "force-dynamic";

async function savePlan(fd: FormData) {
  "use server";
  const user = await requireUser();
  await db.update(users).set({
    targetExam: String(fd.get("targetExam") ?? "").slice(0, 80) || null,
    targetDate: String(fd.get("targetDate") ?? "") || null,
    dailyMinutes: Math.max(5, Math.min(240, Number(fd.get("dailyMinutes")) || 25)),
  }).where(eq(users.id, user.id));
  revalidatePath("/plan");
}

const ICON = { lesson: BookOpen, visual: Eye, quiz: Zap, review: RotateCcw };
const href = (kind: string, id: string) => kind === "quiz" ? `/quiz?concept=${id}` : kind === "visual" ? `/learn/${id}?mode=visual` : kind === "review" ? `/learn/${id}?mode=simple` : `/learn/${id}`;

export default async function PlanPage() {
  const user = await requireUser();
  const plan = await buildStudyPlan(user.id);
  const [today, ...rest] = plan.days;
  return (
    <>
      <PageHeader eyebrow="Adjusts automatically to progress, missed days and weak concepts" title={plan.targetExam ? <>{plan.targetExam} <span className="text-muted">·</span> <span className="text-saffron">{plan.daysLeft} days</span></> : "Your study plan"}
        subtitle={`${plan.remainingConcepts} concepts left to master · ${plan.dailyMinutes} minutes a day`} />
      {plan.missedDays > 0 && <p className="mb-6 flex items-center gap-2 rounded-xl border border-saffron/30 bg-saffron/[0.06] px-4 py-3 text-sm"><AlertTriangle size={16} className="text-saffron" /> You missed {plan.missedDays} day{plan.missedDays > 1 ? "s" : ""}. I&rsquo;ve rebalanced the plan — no need to catch up all at once.</p>}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section>
          {today?.items.length ? (
            <div className="card p-6">
              <p className="eyebrow">Today · {today.total} minutes</p>
              <p className="mt-1 font-display text-3xl">{today.items[0].material}</p>
              <p className="text-sm text-muted">{today.items[0].chapter}</p>
              <ol className="mt-5 space-y-2">
                {today.items.map((it, i) => { const I = ICON[it.kind]; return (
                  <li key={i}><Link href={href(it.kind, it.conceptId)} className="flex items-center gap-3 rounded-xl border hairline px-4 py-3 hover:border-line-2">
                    <I size={17} className="text-saffron" /><span className="w-14 text-sm tabular-nums text-muted">{it.minutes} min</span><span className="capitalize text-muted">{it.kind}</span><span className="min-w-0 flex-1 truncate">{it.name}</span>
                  </Link></li>); })}
              </ol>
            </div>
          ) : <Empty title="Nothing scheduled" body="Upload material or everything is already strong — revision keeps it that way." action={<Link href="/revision" className="btn">Revise</Link>} />}
          {rest.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="eyebrow">Coming up</p>
              {rest.slice(0, 7).map((d) => (
                <div key={d.date} className="card flex items-center gap-4 px-4 py-3">
                  <span className="w-20 text-sm text-muted">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{[...new Set(d.items.map((i) => i.name))].join(", ") || "Rest / revision"}</span>
                  <span className="text-xs tabular-nums text-dim">{d.total}m</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <aside className="card h-fit p-6">
          <p className="font-display text-2xl">Goal settings</p>
          <form action={savePlan} className="mt-4 space-y-4">
            <label className="block"><span className="mb-1.5 block text-sm">Target exam</span><input name="targetExam" defaultValue={plan.targetExam ?? ""} className="input" placeholder="Board Exam" /></label>
            <label className="block"><span className="mb-1.5 block text-sm">Target date</span><input type="date" name="targetDate" defaultValue={plan.targetDate ?? ""} className="input" /></label>
            <label className="block"><span className="mb-1.5 block text-sm">Daily minutes</span><input type="number" name="dailyMinutes" min={5} max={240} defaultValue={plan.dailyMinutes} className="input" /></label>
            <button className="btn btn-primary w-full">Update plan</button>
          </form>
          <p className="mt-4 text-xs text-dim">Each concept block: lesson → visual → quiz → review. Weak concepts come first because they block what depends on them.</p>
        </aside>
      </div>
    </>
  );
}
