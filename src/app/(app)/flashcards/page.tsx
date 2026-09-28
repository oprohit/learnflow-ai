import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { concepts, flashcards, mastery } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleMaterialIds } from "@/lib/teach";
import Flashcards from "@/components/Flashcards";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Flashcards · LearnFlow AI" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ material?: string; concept?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const allowed = await accessibleMaterialIds(user.id);
  const mats = sp.material && allowed.includes(sp.material) ? [sp.material] : allowed;
  const rows = mats.length ? await db.select({ f: flashcards, name: concepts.name }).from(flashcards).innerJoin(concepts, eq(concepts.id, flashcards.conceptId))
    .where(sp.concept ? and(eq(flashcards.conceptId, sp.concept), inArray(flashcards.materialId, mats)) : inArray(flashcards.materialId, mats)) : [];
  const ms = rows.length ? await db.select().from(mastery).where(and(eq(mastery.userId, user.id), inArray(mastery.conceptId, [...new Set(rows.map((r) => r.f.conceptId))]))) : [];
  const score = (id: string) => ms.find((m) => m.conceptId === id)?.score ?? 0;
  // Weakest concepts first, a bounded deck.
  const deck = rows.sort((a, b) => score(a.f.conceptId) - score(b.f.conceptId)).slice(0, 20)
    .map((r) => ({ id: r.f.id, front: r.f.front, back: r.f.back, kind: r.f.kind, conceptName: r.name }));
  return (<>
    <PageHeader eyebrow="Active recall" title="Flashcards" subtitle="Definitions, formulas, examples and common mistakes — weakest concepts first. Results feed your mastery." />
    <Flashcards cards={deck} />
  </>);
}
