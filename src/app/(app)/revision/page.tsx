import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Zap, AlertTriangle, GraduationCap, CalendarClock, History, Layers } from "lucide-react";
import { db } from "@/db";
import { concepts, mastery } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { effectiveScore } from "@/lib/learning";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Revision · LearnFlow AI" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requireUser();
  const ms = await db.select({ m: mastery, name: concepts.name }).from(mastery).innerJoin(concepts, eq(concepts.id, mastery.conceptId)).where(and(eq(mastery.userId, user.id)));
  const now = Date.now();
  const weak = ms.filter((r) => r.m.score < 50);
  const yesterday = ms.filter((r) => r.m.lastStudied && now - r.m.lastStudied.getTime() < 2 * 86400_000 && now - r.m.lastStudied.getTime() > 6 * 3600_000);
  const forgotten = ms.filter((r) => r.m.score > 0 && effectiveScore(r.m.score, r.m.lastStudied) < r.m.score - 8);
  const modes = [
    { key: "quick", title: "Quick Revision", body: "Six mixed questions across what you've studied.", icon: Zap, n: ms.length },
    { key: "weak", title: "Weak Topics", body: "Concepts below 50% mastery.", icon: AlertTriangle, n: weak.length },
    { key: "exam", title: "Exam Revision", body: "Fifteen questions, every concept, exam pace.", icon: GraduationCap, n: ms.length },
    { key: "yesterday", title: "Yesterday's Concepts", body: "Lock in what you learned recently.", icon: CalendarClock, n: yesterday.length },
    { key: "forgotten", title: "Forgotten Concepts", body: "Mastery fading on the forgetting curve.", icon: History, n: forgotten.length },
  ];
  return (<>
    <PageHeader eyebrow="Built from your mastery data" title="Revision" subtitle="Every mode pulls from your saved quiz bank — no waiting, works even when the AI teacher is offline." action={<Link href="/flashcards" className="btn"><Layers size={16} /> Flashcards</Link>} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {modes.map(({ key, title, body, icon: Icon, n }) => (
        <Link key={key} href={`/quiz?revision=${key}`} className="card card-hover p-5">
          <Icon size={20} className="text-saffron" />
          <p className="mt-4 font-display text-2xl">{title}</p>
          <p className="mt-1 text-sm text-muted">{body}</p>
          <p className="mt-4 text-xs text-dim">{n} concept{n === 1 ? "" : "s"}</p>
        </Link>
      ))}
    </div>
    {weak.length > 0 && (<div className="mt-10"><p className="eyebrow mb-3">Needs attention</p><div className="flex flex-wrap gap-2">{weak.map((w) => <Link key={w.m.conceptId} href={`/learn/${w.m.conceptId}?mode=simple`} className="chip border-coral/30 text-coral hover:text-paper">{w.name} · {Math.round(w.m.score)}%</Link>)}</div></div>)}
  </>);
}
