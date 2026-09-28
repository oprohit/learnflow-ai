import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { concepts, learningObjectives, chapters, materials, quizQuestions } from "@/db/schema";
import { apiUser } from "@/lib/auth";
import { canAccessMaterial } from "@/lib/teach";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/materials/[id]">) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!(await canAccessMaterial(user.id, id))) return Response.json({ error: "Not found" }, { status: 404 });
  const [m] = await db.select().from(materials).where(eq(materials.id, id));
  const count = async (t: typeof concepts | typeof learningObjectives | typeof chapters | typeof quizQuestions) =>
    (await db.select({ n: sql<number>`count(*)::int` }).from(t).where(eq(t.materialId, id)))[0]?.n ?? 0;
  const [firstConcept] = await db.select({ id: concepts.id }).from(concepts).where(eq(concepts.materialId, id)).orderBy(concepts.idx).limit(1);
  return Response.json({
    id: m.id, title: m.title, status: m.status, error: m.error, stageLog: m.stageLog, engine: m.engine,
    counts: { concepts: await count(concepts), objectives: await count(learningObjectives), chapters: await count(chapters), questions: await count(quizQuestions) },
    firstConceptId: firstConcept?.id ?? null,
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/materials/[id]">) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  await db.delete(materials).where(and(eq(materials.id, id), eq(materials.userId, user.id)));
  return Response.json({ ok: true });
}
