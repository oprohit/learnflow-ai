import { eq } from "drizzle-orm";
import { db } from "@/db";
import { concepts, mediaCache } from "@/db/schema";
import { apiUser, sha256 } from "@/lib/auth";
import { capabilityReady, getProvider, logCacheHit } from "@/lib/ai/provider";
import { SPEECH_LOCALES } from "@/lib/constants";
import { canAccessMaterial, getRepresentation } from "@/lib/teach";

export const dynamic = "force-dynamic";

/**
 * Voice teacher. Audio is generated once per (concept, mode, language) and cached.
 * If Gemini TTS is unavailable, returns the script so the client uses browser SpeechSynthesis.
 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const b = (await req.json()) as { conceptId: string; mode: string; language: string };
  const [c] = await db.select({ materialId: concepts.materialId }).from(concepts).where(eq(concepts.id, b.conceptId));
  if (!c || !(await canAccessMaterial(user.id, c.materialId))) return Response.json({ error: "Not found" }, { status: 404 });
  const simplified = !!user.accessibility?.simplified;
  const rep = await getRepresentation({ conceptId: b.conceptId, mode: b.mode, language: b.language, userId: user.id, profile: { simplified } });
  if (!rep) return Response.json({ error: "Not found" }, { status: 404 });
  const script = [rep.content.teacherIntro, ...rep.content.sections.map((s) => `${s.heading}. ${s.body}`), rep.content.summary].join("\n\n").slice(0, 4500);
  const locale = SPEECH_LOCALES[rep.language] ?? "en-IN";
  const key = `tts:${sha256(`${b.conceptId}:${b.mode}:${rep.language}:${simplified}:${script.length}`)}`;

  const [hit] = await db.select({ key: mediaCache.key }).from(mediaCache).where(eq(mediaCache.key, key));
  if (hit) { void logCacheHit("tts", user.id); return Response.json({ url: `/api/media/${encodeURIComponent(key)}`, script, locale, cached: true }); }

  // Only cache generated audio for AI/curated content (deterministic content may be superseded later).
  if (capabilityReady("tts") && rep.engine !== "local") {
    try {
      const audio = await getProvider().speech("tts", `Read this lesson aloud like a warm, patient teacher:\n\n${script}`, { userId: user.id });
      await db.insert(mediaCache).values({ key, kind: "audio", mime: audio.mime, dataBase64: audio.base64 }).onConflictDoNothing();
      return Response.json({ url: `/api/media/${encodeURIComponent(key)}`, script, locale, cached: false });
    } catch { /* fall back to browser speech */ }
  }
  return Response.json({ fallback: true, script, locale });
}
