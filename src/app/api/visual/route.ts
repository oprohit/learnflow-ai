import { eq } from "drizzle-orm";
import { db } from "@/db";
import { concepts, mediaCache } from "@/db/schema";
import { apiUser, sha256 } from "@/lib/auth";
import { capabilityReady, getProvider, logCacheHit } from "@/lib/ai/provider";
import { canAccessMaterial, getRepresentation } from "@/lib/teach";

export const dynamic = "force-dynamic";

/** Level-2 visuals: Gemini illustration only where the lesson flagged it as genuinely useful. Cached forever. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const b = (await req.json()) as { conceptId: string };
  const [c] = await db.select().from(concepts).where(eq(concepts.id, b.conceptId));
  if (!c || !(await canAccessMaterial(user.id, c.materialId))) return Response.json({ error: "Not found" }, { status: 404 });
  const rep = await getRepresentation({ conceptId: c.id, mode: "visual", language: "en", userId: user.id, profile: {} });
  const prompt = rep?.content.visual?.imagePrompt?.trim();
  if (!prompt) return Response.json({ fallback: true, reason: "A diagram explains this concept best." });
  const key = `img:${sha256(`${c.id}:${prompt}`)}`;
  const [hit] = await db.select({ key: mediaCache.key }).from(mediaCache).where(eq(mediaCache.key, key));
  if (hit) { void logCacheHit("image", user.id); return Response.json({ url: `/api/media/${encodeURIComponent(key)}` }); }
  if (!capabilityReady("image")) return Response.json({ fallback: true, reason: "Illustrations are unavailable right now — the diagram shows the same idea." });
  try {
    const img = await getProvider().image("image", `Clean, accurate educational illustration for students. No text labels unless essential. Concept: ${c.name}. ${prompt}`, { userId: user.id });
    await db.insert(mediaCache).values({ key, kind: "image", mime: img.mime, dataBase64: img.base64 }).onConflictDoNothing();
    return Response.json({ url: `/api/media/${encodeURIComponent(key)}` });
  } catch {
    return Response.json({ fallback: true, reason: "Couldn't create an illustration right now — the diagram shows the same idea." });
  }
}
