import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowRight, Target, Zap, Layers, BookOpen, Loader2 } from "lucide-react";
import { db } from "@/db";
import { chapters, conceptRelations, concepts, learningObjectives, mastery, materials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canAccessMaterial } from "@/lib/teach";
import { decideNextStep } from "@/lib/learning";
import ConceptMap, { type MapNode } from "@/components/ConceptMap";
import { AutoRefresh, DeleteMaterialButton, MaterialChat } from "@/components/ClientBits";
import { MasteryRing, ProgressBar, toneColor } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!(await canAccessMaterial(user.id, id))) notFound();
  const [m] = await db.select().from(materials).where(eq(materials.id, id));
  if (!m) notFound();

  if (m.status !== "ready") {
    return (
      <div className="mx-auto max-w-xl py-10">
        {m.status !== "failed" && <AutoRefresh />}
        <p className="eyebrow">{m.title}</p>
        <h1 className="mt-2 font-display text-4xl">{m.status === "failed" ? "Processing stopped" : "Still reading your material…"}</h1>
        {m.error && <p className="mt-3 text-coral">{m.error}</p>}
        <ul className="mt-6 space-y-2 text-sm">{m.stageLog.map((s, i) => <li key={i} className="flex gap-2 text-muted">{i === m.stageLog.length - 1 && m.status !== "failed" ? <Loader2 size={15} className="mt-0.5 animate-spin text-saffron" /> : <span className="text-sage">✓</span>}{s.label}{s.detail ? ` — ${s.detail}` : ""}</li>)}</ul>
        {m.status === "failed" && <div className="mt-6 flex gap-2"><Link href="/upload" className="btn btn-primary">Upload again</Link><DeleteMaterialButton id={m.id} /></div>}
      </div>
    );
  }

  const [chs, objs, cs, rels] = await Promise.all([
    db.select().from(chapters).where(eq(chapters.materialId, id)).orderBy(chapters.idx),
    db.select().from(learningObjectives).where(eq(learningObjectives.materialId, id)).orderBy(learningObjectives.idx),
    db.select().from(concepts).where(eq(concepts.materialId, id)).orderBy(concepts.idx),
    db.select().from(conceptRelations).where(eq(conceptRelations.materialId, id)),
  ]);
  const ms = cs.length ? await db.select().from(mastery).where(and(eq(mastery.userId, user.id), inArray(mastery.conceptId, cs.map((c) => c.id)))) : [];
  const mm = new Map(ms.map((x) => [x.conceptId, x]));
  const overall = cs.length ? cs.reduce((n, c) => n + (mm.get(c.id)?.score ?? 0), 0) / cs.length : 0;
  const started = cs.find((c) => !mm.get(c.id) || (mm.get(c.id)?.score ?? 0) < 75) ?? cs[0];
  const next = started ? await decideNextStep(user.id, ms.length ? ms.sort((a, b) => (b.lastStudied?.getTime() ?? 0) - (a.lastStudied?.getTime() ?? 0))[0].conceptId : started.id) : null;
  const nodes: MapNode[] = cs.map((c) => {
    const chIdx = chs.findIndex((x) => x.id === c.chapterId);
    const x = mm.get(c.id);
    return { id: c.id, name: c.name, chapterIdx: Math.max(0, chIdx), chapter: chs[chIdx]?.title ?? "", level: c.level, score: x?.score ?? 0, attempts: x?.attempts ?? 0, lastStudied: x?.lastStudied?.toISOString() ?? null, summary: c.summary };
  });
  const href = ms.length && next ? next.href : `/learn/${started?.id}`;

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">{m.subject ?? "Material"} · {m.pageCount ?? "?"} pages{m.engine === "gemini" ? " · AI-analysed" : m.engine === "curated" ? " · Sample" : " · On-device analysis"}</p>
          <h1 className="mt-2 font-display text-4xl leading-[1.02] sm:text-6xl">{m.title}</h1>
          {m.summary && <p className="mt-3 max-w-2xl text-muted">{m.summary}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={href} className="btn btn-primary"><BookOpen size={17} /> {ms.length ? "Continue" : "Start learning"}</Link>
            <Link href={`/quiz?material=${id}`} className="btn"><Zap size={17} /> Quiz</Link>
            <Link href={`/flashcards?material=${id}`} className="btn"><Layers size={17} /> Flashcards</Link>
            {m.userId === user.id && <DeleteMaterialButton id={id} />}
          </div>
        </div>
        <div className="card flex items-center gap-4 p-4 lg:w-72">
          <MasteryRing value={overall} size={64} />
          <div className="text-sm"><p className="font-semibold">Overall mastery</p><p className="text-muted">{chs.length} chapters · {objs.length} objectives · {cs.length} concepts</p></div>
        </div>
      </header>

      <section aria-labelledby="objectives">
        <p className="eyebrow">The canonical structure</p>
        <h2 id="objectives" className="mt-1 font-display text-3xl sm:text-4xl">Here&rsquo;s what you&rsquo;ll learn.</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {objs.map((o, i) => {
            const oc = cs.filter((c) => c.objectiveId === o.id);
            const avg = oc.length ? oc.reduce((n, c) => n + (mm.get(c.id)?.score ?? 0), 0) / oc.length : 0;
            return (
              <details key={o.id} className="card group p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-saffron/40 text-sm font-semibold text-saffron">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">Learning objective {i + 1}{o.bloom ? ` · ${o.bloom}` : ""}</p>
                      <p className="mt-0.5 text-lg font-medium leading-snug">{o.title}</p>
                      <ProgressBar value={avg} className="mt-3" tone="sage" />
                    </div>
                  </div>
                </summary>
                {o.description && <p className="mt-4 text-sm text-muted">{o.description}</p>}
                <ul className="mt-3 space-y-1">
                  {oc.map((c) => (
                    <li key={c.id}><Link href={`/learn/${c.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-white/[0.04]">
                      <span className="h-2 w-2 rounded-full" style={{ background: toneColor(mm.get(c.id)?.score ?? 0, mm.get(c.id)?.attempts ?? 0) }} />
                      <span className="flex-1">{c.name}</span><span className="text-xs text-dim">{c.level}</span><ArrowRight size={14} className="text-dim" />
                    </Link></li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="map">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><p className="eyebrow">Prerequisites → core → applications</p><h2 id="map" className="mt-1 font-display text-3xl sm:text-4xl">Concept map</h2></div>
          <p className="hidden text-xs text-muted sm:block"><Target size={12} className="mr-1 inline" /> Tap any concept to teach, visualise or quiz</p>
        </div>
        <ConceptMap nodes={nodes} edges={rels.map((r) => ({ from: r.fromId, to: r.toId, type: r.type }))} title={m.title} />
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="font-display text-3xl">Chapters</h2>
          <ol className="mt-4 space-y-2">
            {chs.map((ch, i) => {
              const cc = cs.filter((c) => c.chapterId === ch.id);
              const avg = cc.length ? cc.reduce((n, c) => n + (mm.get(c.id)?.score ?? 0), 0) / cc.length : 0;
              return (
                <li key={ch.id} className="card p-4">
                  <div className="flex items-baseline justify-between gap-3"><p className="font-medium"><span className="mr-2 font-display text-xl text-dim">{i + 1}</span>{ch.title}</p><span className="text-xs tabular-nums text-muted">{Math.round(avg)}%</span></div>
                  {ch.summary && <p className="mt-1 text-sm text-muted">{ch.summary}</p>}
                  <p className="mt-2 text-xs text-dim">{cc.length} concepts{ch.pageStart ? ` · from p. ${ch.pageStart}` : ""}</p>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <h2 className="font-display text-3xl">Ask about this material</h2>
          <div className="card mt-4 p-4"><MaterialChat materialId={id} language={user.primaryLanguage} preferred={[user.primaryLanguage, user.secondaryLanguage, "en"]} /></div>
        </div>
      </section>
    </div>
  );
}
