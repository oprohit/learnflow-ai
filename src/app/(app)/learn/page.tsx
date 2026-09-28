import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { concepts, lessonStates } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleMaterialIds } from "@/lib/teach";

/** "Learn" resumes the last lesson (same concept, mode, language, step) or picks the first concept. */
export default async function LearnEntry() {
  const user = await requireUser();
  const [last] = await db.select().from(lessonStates).where(eq(lessonStates.userId, user.id)).orderBy(desc(lessonStates.updatedAt)).limit(1);
  if (last) redirect(`/learn/${last.conceptId}`);
  const ids = await accessibleMaterialIds(user.id);
  if (ids.length) {
    const [c] = await db.select({ id: concepts.id }).from(concepts).where(inArray(concepts.materialId, ids)).orderBy(concepts.idx).limit(1);
    if (c) redirect(`/learn/${c.id}`);
  }
  redirect("/upload");
}
