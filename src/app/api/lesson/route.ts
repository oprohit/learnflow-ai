import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { concepts, lessonStates } from "@/db/schema";
import { apiUser } from "@/lib/auth";
import { MODE_IDS } from "@/lib/constants";
import { canAccessMaterial, getRepresentation } from "@/lib/teach";

export const dynamic = "force-dynamic";

/** GET a representation of a concept (mode × language). Cached; never restarts lesson state. */
export async function GET(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const url = new URL(req.url);
  const conceptId = url.searchParams.get("conceptId") ?? "";
  const mode = MODE_IDS.includes(url.searchParams.get("mode") ?? "") ? url.searchParams.get("mode")! : "standard";
  const language = url.searchParams.get("lang") || user.primaryLanguage || "en";
  const [c] = await db.select({ materialId: concepts.materialId }).from(concepts).where(eq(concepts.id, conceptId));
  if (!c || !(await canAccessMaterial(user.id, c.materialId))) return Response.json({ error: "Lesson not found." }, { status: 404 });
  const rep = await getRepresentation({
    conceptId, mode, language, userId: user.id,
    profile: { educationLevel: user.educationLevel, learningGoal: user.learningGoal, simplified: !!user.accessibility?.simplified },
  });
  if (!rep) return Response.json({ error: "Lesson not found." }, { status: 404 });
  return Response.json(rep);
}

/** Persist lesson state: concept, mode, language, step, progress, difficulty. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const b = (await req.json()) as { conceptId: string; mode?: string; language?: string; step?: number; progress?: number; difficulty?: string };
  const [c] = await db.select({ materialId: concepts.materialId }).from(concepts).where(eq(concepts.id, b.conceptId));
  if (!c || !(await canAccessMaterial(user.id, c.materialId))) return Response.json({ error: "Not found" }, { status: 404 });
  const values = {
    mode: b.mode ?? "standard", language: b.language ?? "en", step: b.step ?? 0,
    progress: Math.max(0, Math.min(100, Math.round(b.progress ?? 0))), difficulty: b.difficulty ?? "standard", updatedAt: new Date(),
  };
  const [existing] = await db.select().from(lessonStates).where(and(eq(lessonStates.userId, user.id), eq(lessonStates.conceptId, b.conceptId)));
  if (existing) {
    await db.update(lessonStates).set({ ...values, progress: Math.max(existing.progress, values.progress) })
      .where(and(eq(lessonStates.userId, user.id), eq(lessonStates.conceptId, b.conceptId)));
  } else await db.insert(lessonStates).values({ userId: user.id, conceptId: b.conceptId, ...values });
  return Response.json({ ok: true });
}
