import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Plus, ArrowRight, Map, Zap, BookOpen, Loader2 } from "lucide-react";
import { db } from "@/db";
import { chapters, concepts, mastery, materials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleMaterialIds } from "@/lib/teach";
import { DeleteMaterialButton } from "@/components/ClientBits";
import { Empty, MasteryRing, PageHeader, timeAgo } from "@/components/ui";

export const metadata = { title: "My Library · LearnFlow AI" };
export const dynamic = "force-dynamic";

export default async function Library() {
  const user = await requireUser();
  const ids = await accessibleMaterialIds(user.id);
  const mats = ids.length ? await db.select().from(materials).where(inArray(materials.id, ids)).orderBy(desc(materials.lastStudiedAt), desc(materials.createdAt)) : [];
  const cs = ids.length ? await db.select({ id: concepts.id, materialId: concepts.materialId, name: concepts.name, idx: concepts.idx }).from(concepts).where(inArray(concepts.materialId, ids)) : [];
  const chs = ids.length ? await db.select({ materialId: chapters.materialId }).from(chapters).where(inArray(chapters.materialId, ids)) : [];
  const ms = cs.length ? await db.select().from(mastery).where(and(eq(mastery.userId, user.id), inArray(mastery.conceptId, cs.map((c) => c.id)))) : [];
  const mm = new globalThis.Map(ms.map((m) => [m.conceptId, m.score]));

  return (
    <>
      <PageHeader eyebrow="Everything you're learning" title="My Library" action={<Link href="/upload" className="btn btn-primary"><Plus size={17} /> Upload</Link>} />
      {!mats.length ? (
        <Empty title="Your library is empty" body="Upload a textbook, notes, slides or a photo of a page — or try the sample chapter on Newton's Laws." action={<Link href="/upload" className="btn btn-primary">Add your first material</Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mats.map((m) => {
            const mc = cs.filter((c) => c.materialId === m.id).sort((a, b) => a.idx - b.idx);
            const avg = mc.length ? mc.reduce((n, c) => n + (mm.get(c.id) ?? 0), 0) / mc.length : 0;
            const next = mc.find((c) => (mm.get(c.id) ?? 0) < 75);
            const ready = m.status === "ready";
            return (
              <article key={m.id} className="card card-hover flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow truncate">{m.subject ?? "Material"}{m.userId !== user.id ? " · Assigned" : ""}</p>
                    <Link href={`/materials/${m.id}`} className="mt-1 block font-display text-2xl leading-tight hover:text-saffron">{m.title}</Link>
                  </div>
                  {ready ? <MasteryRing value={avg} size={52} /> : <Loader2 className="animate-spin text-saffron" size={20} />}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-y hairline py-3 text-center text-xs">
                  <div><dt className="text-dim">Chapters</dt><dd className="mt-0.5 text-base font-semibold">{chs.filter((c) => c.materialId === m.id).length}</dd></div>
                  <div><dt className="text-dim">Concepts</dt><dd className="mt-0.5 text-base font-semibold">{mc.length}</dd></div>
                  <div><dt className="text-dim">Studied</dt><dd className="mt-0.5 text-sm font-semibold">{timeAgo(m.lastStudiedAt)}</dd></div>
                </dl>
                {ready ? (
                  <>
                    {next && <p className="mt-3 truncate text-sm text-muted">Next: <span className="text-paper">{next.name}</span></p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={next ? `/learn/${next.id}` : `/materials/${m.id}`} className="btn btn-primary btn-sm flex-1"><BookOpen size={15} /> {m.lastStudiedAt ? "Continue" : "Study"}</Link>
                      <Link href={`/materials/${m.id}#map`} className="btn btn-sm" aria-label="View concept map"><Map size={15} /></Link>
                      <Link href={`/quiz?material=${m.id}`} className="btn btn-sm" aria-label="Quiz"><Zap size={15} /></Link>
                      {m.userId === user.id && <DeleteMaterialButton id={m.id} compact />}
                    </div>
                  </>
                ) : (
                  <Link href={`/materials/${m.id}`} className="mt-4 inline-flex items-center gap-1 text-sm text-saffron">{m.status === "failed" ? "Processing failed — details" : "Processing…"} <ArrowRight size={14} /></Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
