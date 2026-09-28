import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, concepts, materialChunks, materials } from "@/db/schema";
import { apiUser } from "@/lib/auth";
import { capabilityReady, getProvider, FRIENDLY_AI_ERROR } from "@/lib/ai/provider";
import { langName } from "@/lib/constants";
import { canAccessMaterial } from "@/lib/teach";

export const dynamic = "force-dynamic";

const STOP = new Set("the a an and or of to in is are was what why how does do this that for with on it me my explain give tell about can you please from be as by".split(" "));
const terms = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) ?? []).filter((t) => !STOP.has(t));

/** Grounded chat: keyword retrieval over stored chunks (no paid vector API), citations come only from real chunks. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const b = (await req.json()) as { materialId: string; message: string; language?: string; conceptId?: string; history?: { role: string; text: string }[] };
  if (!b.message?.trim()) return Response.json({ error: "Ask me anything about your material." }, { status: 400 });
  if (!(await canAccessMaterial(user.id, b.materialId))) return Response.json({ error: "Not found" }, { status: 404 });
  const lang = b.language || user.primaryLanguage || "en";
  const msg = b.message.trim().slice(0, 1000);

  // Intent shortcuts handled by app logic, not AI.
  const focus = b.conceptId ? (await db.select().from(concepts).where(eq(concepts.id, b.conceptId)))[0] : undefined;
  if (/\bquiz me\b|test me/i.test(msg)) {
    return Response.json({ text: "Let's test it. I've picked questions from your quiz bank.", citations: [], action: { label: "Start quiz", href: focus ? `/quiz?concept=${focus.id}` : `/quiz?material=${b.materialId}` } });
  }

  const [mat] = await db.select().from(materials).where(eq(materials.id, b.materialId));
  const chunks = await db.select().from(materialChunks).where(eq(materialChunks.materialId, b.materialId));
  const cs = await db.select().from(concepts).where(eq(concepts.materialId, b.materialId));
  const chs = await db.select().from(chapters).where(eq(chapters.materialId, b.materialId)).orderBy(chapters.idx);

  const q = terms(msg + " " + (focus?.name ?? ""));
  const chapterNum = /chapter\s+(\d+)/i.exec(msg)?.[1];
  const df = new Map<string, number>();
  for (const c of chunks) for (const t of new Set(terms(c.text))) df.set(t, (df.get(t) ?? 0) + 1);
  const scored = chunks.map((c) => {
    const tt = terms(c.text);
    let s = 0;
    for (const t of q) { const tf = tt.filter((x) => x === t || x.startsWith(t)).length; if (tf) s += (1 + Math.log(tf)) * Math.log(1 + chunks.length / (df.get(t) ?? 1)); }
    if (chapterNum) { const ch = chs[Number(chapterNum) - 1]; if (ch?.pageStart && c.page && c.page >= ch.pageStart && (!chs[Number(chapterNum)]?.pageStart || c.page < chs[Number(chapterNum)].pageStart!)) s += 3; }
    return { c, s };
  }).filter((x) => x.s > 0).sort((a, b2) => b2.s - a.s).slice(0, 5);

  const chapterFor = (page: number | null) => (page ? [...chs].reverse().find((ch) => (ch.pageStart ?? 0) <= page)?.title : undefined);
  const sources = scored.map((x, i) => ({ ref: `S${i + 1}`, page: x.c.page, chapter: chapterFor(x.c.page), text: x.c.text }));
  const conceptHits = cs.filter((c) => q.some((t) => c.name.toLowerCase().includes(t))).slice(0, 3);

  if (!sources.length && !conceptHits.length && !focus) {
    return Response.json({ text: "I couldn't find that in your material. Try asking about one of its concepts, like " + cs.slice(0, 3).map((c) => `“${c.name}”`).join(", ") + ".", citations: [] });
  }

  if (!capabilityReady("text")) {
    const best = sources[0];
    const concept = focus ?? conceptHits[0];
    return Response.json({
      text: `${FRIENDLY_AI_ERROR}\n\nHere's what your material says${concept ? ` about ${concept.name}` : ""}:\n\n${concept?.definition ? concept.definition + "\n\n" : ""}${best ? `“${best.text.slice(0, 420)}…”` : ""}`,
      citations: best ? [{ page: best.page, chapter: best.chapter }] : concept?.sourcePage ? [{ page: concept.sourcePage, chapter: chapterFor(concept.sourcePage) }] : [],
      offline: true,
    });
  }

  const prompt = `You are the learner's personal teacher for the material "${mat?.title}". Answer ONLY using the SOURCES and CONCEPTS below.
If the answer isn't there, say so honestly. Teach (explain from basics, give an example), don't just summarise.
Cite sources inline as [S1], [S2] only when you used them. Never invent citations or page numbers.
Respond in ${langName(lang)}. Keep it under 220 words. Use short paragraphs.
${focus ? `The learner is currently studying: ${focus.name} — ${focus.definition}` : ""}
CONCEPTS: ${[...(focus ? [focus] : []), ...conceptHits].map((c) => `${c.name}: ${c.definition}`).join(" | ")}
SOURCES:
${sources.map((s) => `[${s.ref}] (page ${s.page ?? "?"}) ${s.text}`).join("\n")}
RECENT CONVERSATION: ${(b.history ?? []).slice(-6).map((h) => `${h.role}: ${h.text.slice(0, 300)}`).join("\n")}
QUESTION: ${msg}`;
  try {
    const text = await getProvider().generate("chat", prompt, { userId: user.id, capability: "text", temperature: 0.4, maxTokens: 1200 });
    const used = [...new Set([...text.matchAll(/\[S(\d)\]/g)].map((m) => Number(m[1]) - 1))];
    const citations = used.map((i) => sources[i]).filter(Boolean).map((s) => ({ ref: s.ref, page: s.page, chapter: s.chapter }));
    const action = /visual|diagram|picture|show me/i.test(msg) && (focus ?? conceptHits[0]) ? { label: "Open visual explanation", href: `/learn/${(focus ?? conceptHits[0]).id}?mode=visual` } : undefined;
    return Response.json({ text, citations, action });
  } catch {
    return Response.json({ text: FRIENDLY_AI_ERROR, citations: [], offline: true });
  }
}
