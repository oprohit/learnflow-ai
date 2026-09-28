import { eq } from "drizzle-orm";
import { db } from "@/db";
import { flashcardReviews, flashcards } from "@/db/schema";
import { apiUser } from "@/lib/auth";
import { applyFlashcard, logSession } from "@/lib/learning";
import { canAccessMaterial } from "@/lib/teach";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const b = (await req.json()) as { flashcardId?: string; result?: "know" | "later"; finish?: boolean; minutes?: number };
  if (b.finish) { await logSession(user.id, "flashcards", b.minutes ?? 2); return Response.json({ ok: true }); }
  const [card] = await db.select().from(flashcards).where(eq(flashcards.id, b.flashcardId ?? ""));
  if (!card || !(await canAccessMaterial(user.id, card.materialId))) return Response.json({ error: "Not found" }, { status: 404 });
  await db.insert(flashcardReviews).values({ userId: user.id, flashcardId: card.id, result: b.result === "know" ? "know" : "later" });
  await applyFlashcard(user.id, card.conceptId, card.materialId, b.result === "know");
  return Response.json({ ok: true });
}
