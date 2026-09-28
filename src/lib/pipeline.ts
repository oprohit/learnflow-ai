import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  chapters, conceptRelations, concepts, flashcards, learningObjectives, materialChunks, materialFiles, materials, quizQuestions,
  type StageEntry,
} from "@/db/schema";
import { capabilityReady, generateJSON } from "@/lib/ai/provider";
import { extractText, ExtractionError, type Page } from "@/lib/extract";
import { SAMPLE_MODEL, samplePages } from "@/lib/sample";
import { getRepresentation, seededShuffle } from "@/lib/teach";
import { buildStudyPlan, notify } from "@/lib/learning";
import type { CanonicalConcept, CanonicalModel } from "@/lib/types";

async function stage(materialId: string, status: string, label: string, detail?: string) {
  const entry: StageEntry = { stage: status, label, at: new Date().toISOString(), detail };
  await db.update(materials).set({
    status,
    stageLog: sql`${materials.stageLog} || ${JSON.stringify([entry])}::jsonb`,
  }).where(eq(materials.id, materialId));
}

export function startProcessing(materialId: string, userId: string, source: "file" | "sample") {
  // Runs in the long-lived Node server process; the client polls real stage updates.
  void run(materialId, userId, source).catch(async (e) => {
    console.error("[pipeline]", materialId, e);
    const msg = e instanceof ExtractionError ? e.message : "Something went wrong while analysing this material. Please try uploading again.";
    await db.update(materials).set({ status: "failed", error: msg }).where(eq(materials.id, materialId));
    await stage(materialId, "failed", "Processing stopped", msg);
  });
}

async function run(materialId: string, userId: string, source: "file" | "sample") {
  const [mat] = await db.select().from(materials).where(eq(materials.id, materialId));
  if (!mat) return;

  await stage(materialId, "extracting", "Reading your material…");
  let pages: Page[];
  if (source === "sample") pages = samplePages();
  else {
    const [file] = await db.select().from(materialFiles).where(eq(materialFiles.materialId, materialId));
    if (!file) throw new ExtractionError("The uploaded file is missing. Please upload again.");
    const ex = await extractText(Buffer.from(file.dataBase64, "base64"), mat.mimeType ?? "", mat.fileName ?? "file", userId);
    pages = ex.pages;
  }
  const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
  await db.update(materials).set({ pageCount: pages.length }).where(eq(materials.id, materialId));
  await stage(materialId, "extracting", "Text extracted", `${pages.length} pages · ${Math.round(totalChars / 1000)}k characters`);

  // Chunks for grounded chat (never re-send the whole document).
  const chunks: { page: number; text: string }[] = [];
  for (const p of pages) {
    for (let i = 0; i < p.text.length; i += 1400) chunks.push({ page: p.page, text: p.text.slice(i, i + 1500) });
  }
  for (let i = 0; i < chunks.length; i += 200) {
    await db.insert(materialChunks).values(chunks.slice(i, i + 200).map((c, j) => ({ materialId, idx: i + j, page: c.page, text: c.text })));
  }

  await stage(materialId, "structuring", "Finding chapters and sections…");
  let model: CanonicalModel;
  let engine = "local";
  if (source === "sample") {
    model = SAMPLE_MODEL;
    engine = "curated";
  } else if (capabilityReady("text")) {
    try {
      model = await aiStructure(pages, userId, mat.subject);
      engine = "gemini";
    } catch {
      await stage(materialId, "structuring", "AI teacher busy — using on-device analysis");
      model = localStructure(pages, mat.title);
    }
  } else {
    model = localStructure(pages, mat.title);
  }
  if (!model.concepts.length) throw new ExtractionError("We couldn't identify concepts in this material. Try a file with more explanatory text.");

  await db.update(materials).set({
    title: mat.title || model.title, subject: mat.subject || model.subject, summary: model.summary, engine,
  }).where(eq(materials.id, materialId));

  await stage(materialId, "objectives", "Identifying learning objectives…");
  const chapterRows = await db.insert(chapters).values(
    model.chapters.map((c, i) => ({ materialId, idx: i, title: c.title, summary: c.summary, pageStart: c.pageStart ?? null }))
  ).returning();
  const objRows = await db.insert(learningObjectives).values(
    model.objectives.map((o, i) => ({ materialId, idx: i, chapterId: chapterRows[o.chapter]?.id ?? chapterRows[0]?.id, title: o.title, description: o.description, bloom: o.bloom }))
  ).returning();
  await stage(materialId, "objectives", `${objRows.length} learning objectives found`);

  await stage(materialId, "concepts", "Finding the important concepts…");
  const conceptRows = await db.insert(concepts).values(model.concepts.map((c, i) => ({
    materialId, idx: i, name: c.name.slice(0, 120), chapterId: chapterRows[c.chapter]?.id ?? chapterRows[0]?.id,
    objectiveId: objRows[c.objective]?.id ?? objRows[0]?.id, summary: c.summary, definition: c.definition,
    formulas: c.formulas ?? [], examples: c.examples ?? [], misconceptions: c.misconceptions ?? [],
    facts: [...(c.facts ?? []), ...(c.analogy ? [`Analogy: ${c.analogy}`] : [])],
    difficulty: Math.max(1, Math.min(5, Math.round(c.difficulty || 2))), level: c.level ?? "core",
    sourcePage: c.sourcePage ?? null, sourceSection: c.sourceSection ?? null,
    sourceExcerpt: c.excerpt ?? pages.find((p) => p.page === c.sourcePage)?.text.slice(0, 1500) ?? null,
  }))).returning();
  await stage(materialId, "concepts", `${conceptRows.length} concepts across ${chapterRows.length} chapters`);

  await stage(materialId, "prerequisites", "Building the concept map…");
  const byName = new Map(conceptRows.map((c) => [c.name.toLowerCase(), c]));
  const rels: { materialId: string; fromId: string; toId: string; type: string }[] = [];
  model.concepts.forEach((c, i) => {
    const to = conceptRows[i];
    for (const p of c.prerequisites ?? []) { const f = byName.get(p.toLowerCase()); if (f && f.id !== to.id) rels.push({ materialId, fromId: f.id, toId: to.id, type: "prerequisite" }); }
    for (const r of c.related ?? []) { const f = byName.get(r.toLowerCase()); if (f && f.id !== to.id) rels.push({ materialId, fromId: to.id, toId: f.id, type: "related" }); }
    if (c.parent) { const p = byName.get(c.parent.toLowerCase()); if (p) void db.update(concepts).set({ parentId: p.id }).where(eq(concepts.id, to.id)); }
  });
  if (rels.length) await db.insert(conceptRelations).values(rels);
  await stage(materialId, "prerequisites", `${rels.filter((r) => r.type === "prerequisite").length} prerequisite links mapped`);

  await stage(materialId, "lesson", "Preparing your first lesson…");
  const first = conceptRows[0];
  await getRepresentation({ conceptId: first.id, mode: "standard", language: "en", userId, profile: {} });

  await stage(materialId, "quiz", "Writing your quiz bank…");
  let questions: QInsert[] = [];
  if (engine === "gemini" && capabilityReady("text")) {
    try { questions = await aiQuizBank(model, conceptRows, materialId, userId); } catch { questions = []; }
  }
  if (!questions.length) questions = localQuizBank(model, conceptRows, materialId);
  for (let i = 0; i < questions.length; i += 100) await db.insert(quizQuestions).values(questions.slice(i, i + 100));

  const cards = conceptRows.flatMap((c) => [
    ...(c.definition ? [{ materialId, conceptId: c.id, kind: "definition", front: `What is ${c.name}?`, back: c.definition }] : []),
    ...c.formulas.slice(0, 2).map((f) => ({ materialId, conceptId: c.id, kind: "formula", front: `Key relation for ${c.name}`, back: f })),
    ...c.examples.slice(0, 1).map((e) => ({ materialId, conceptId: c.id, kind: "example", front: `Real-world example of ${c.name}`, back: e })),
    ...c.misconceptions.slice(0, 1).map((m) => ({ materialId, conceptId: c.id, kind: "mistake", front: `True or false? “${m}”`, back: `False. ${c.definition ?? ""}` })),
  ]);
  if (cards.length) await db.insert(flashcards).values(cards);
  await stage(materialId, "quiz", `${questions.length} questions · ${cards.length} flashcards`);

  await buildStudyPlan(userId);
  await stage(materialId, "ready", "Your personal teacher is ready", `${objRows.length} learning objectives and ${conceptRows.length} concepts`);
  await notify(userId, "lesson", "New lesson ready", `“${model.title}” — ${objRows.length} objectives, ${conceptRows.length} concepts.`, `/materials/${materialId}`);
}

/* ---------------- AI structuring (one call on structured page text) ---------------- */
async function aiStructure(pages: Page[], userId: string, subject: string | null): Promise<CanonicalModel> {
  let text = "";
  for (const p of pages) { if (text.length > 90_000) break; text += `\n[p.${p.page}]\n${p.text}`; }
  const prompt = `You are an expert curriculum designer. Analyse this learning material and build its CANONICAL learning model.
Only use what's in the material; page numbers must come from the [p.N] markers.
${subject ? `Subject hint: ${subject}.` : ""}
Return JSON:
{"title":string,"subject":string,"summary":string (2 sentences),
"chapters":[{"title":string,"summary":string,"pageStart":number}],
"objectives":[{"chapter":index,"title":string (starts with a verb),"description":string,"bloom":"Remember|Understand|Apply|Analyze|Evaluate|Create"}] (3-8 total),
"concepts":[{"name":string,"chapter":index,"objective":index,"level":"prerequisite|basic|core|application|advanced","difficulty":1-5,
"summary":string (1 sentence),"definition":string,"formulas":[string],"examples":[string],"facts":[string],"misconceptions":[string],
"prerequisites":[exact names of other concepts in this list],"related":[names],"analogy":string,"parent":string|null,
"sourcePage":number,"sourceSection":string,"excerpt":string (<=400 chars verbatim)}] (8-24 concepts, ordered from foundational to advanced; include basic prerequisite concepts a beginner needs even if briefly mentioned)}

MATERIAL:
${text}`;
  const m = await generateJSON<CanonicalModel>("material.structure", prompt, { userId, maxTokens: 30000, temperature: 0.2 });
  if (!m?.concepts?.length || !m.chapters?.length) throw new Error("invalid structure");
  if (!m.objectives?.length) m.objectives = m.chapters.map((c, i) => ({ chapter: i, title: `Understand ${c.title}`, description: c.summary }));
  return m;
}

/* ---------------- Heuristic structuring (no AI) ---------------- */
function localStructure(pages: Page[], title: string): CanonicalModel {
  type Sec = { title: string; page: number; text: string; level: 1 | 2 };
  const secs: Sec[] = [];
  let cur: Sec = { title: title || "Introduction", page: pages[0]?.page ?? 1, text: "", level: 1 };
  const isHeading = (l: string) => {
    const t = l.trim();
    if (t.length < 3 || t.length > 80 || /[.,;:]$/.test(t)) return 0;
    if (/^(chapter|unit|part|module)\s+[\dIVX]+/i.test(t)) return 1;
    if (/^\d+\.\d+(\.\d+)?\s+\S/.test(t)) return 2;
    if (/^\d+[.)]?\s+[A-Z]/.test(t) && t.split(" ").length <= 8) return 1;
    if (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && t.split(" ").length <= 7) return 2;
    return 0;
  };
  for (const p of pages) {
    for (const line of p.text.split(/\n/)) {
      const lv = isHeading(line);
      if (lv) { if (cur.text.trim().length > 40 || secs.length === 0) secs.push(cur); cur = { title: line.trim().replace(/^(\d+(\.\d+)*[.)]?)\s+/, ""), page: p.page, text: "", level: lv as 1 | 2 }; }
      else cur.text += line + " ";
    }
  }
  secs.push(cur);
  const meaningful = secs.filter((s) => s.text.trim().length > 60);

  // Chapters: level-1 headings, else split pages evenly.
  let chapterSecs = meaningful.filter((s) => s.level === 1);
  if (chapterSecs.length < 1) chapterSecs = [meaningful[0] ?? cur];
  const chaptersOut = chapterSecs.slice(0, 12).map((s) => ({ title: s.title, summary: sentences(s.text)[0] ?? "", pageStart: s.page }));
  const chapterOf = (page: number) => Math.max(0, chaptersOut.findLastIndex((c) => (c.pageStart ?? 0) <= page));

  // Concepts: definitional sentences + section headings.
  const all = pages.map((p) => ({ page: p.page, sents: sentences(p.text) }));
  const found = new Map<string, CanonicalConcept>();
  const defRe = /^(?:An?\s+|The\s+)?([A-Za-z][A-Za-z'’\- ]{2,40}?)\s+(?:is|are|refers to|means|is defined as|can be defined as)\s+(.{15,260})$/;
  for (const { page, sents } of all) {
    for (const s of sents) {
      const m = defRe.exec(s);
      if (!m) continue;
      const name = m[1].trim();
      if (name.split(" ").length > 5 || /^(this|that|it|there|these|those|he|she|they|we|what|which|one|another|a|an|the)\b/i.test(name) || /misconception|example|mistake|reason|result|answer|following/i.test(name)) continue;
      const key = name.toLowerCase();
      if (!found.has(key)) found.set(key, blankConcept(name, s, page, chapterOf(page)));
    }
  }
  for (const s of meaningful.filter((x) => x.level === 2 || chapterSecs.length === 1)) {
    const key = s.title.toLowerCase();
    if (found.has(key) || s.title.split(" ").length > 7) continue;
    found.set(key, blankConcept(s.title, sentences(s.text)[0] ?? s.title, s.page, chapterOf(s.page)));
  }
  let list = [...found.values()].slice(0, 20);
  if (list.length < 3) {
    // Last resort: frequent capitalised terms.
    const freq = new Map<string, number>();
    for (const p of pages) for (const m of p.text.matchAll(/\b([A-Z][a-z]{3,}(?:\s[A-Z][a-z]{3,})?)\b/g)) freq.set(m[1], (freq.get(m[1]) ?? 0) + 1);
    const top = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [term] of top) {
      const hit = all.flatMap((p) => p.sents.map((s) => ({ s, page: p.page }))).find((x) => x.s.includes(term));
      if (hit && !found.has(term.toLowerCase())) list.push(blankConcept(term, hit.s, hit.page, chapterOf(hit.page)));
    }
    list = list.slice(0, 15);
  }

  // Enrich from surrounding text.
  const flat = all.flatMap((p) => p.sents.map((s) => ({ s, page: p.page })));
  for (const c of list) {
    const lc = c.name.toLowerCase();
    const mentions = flat.filter((x) => x.s.toLowerCase().includes(lc));
    c.examples = mentions.filter((x) => /for example|e\.g\.|such as|for instance/i.test(x.s)).map((x) => x.s).slice(0, 2);
    c.formulas = mentions.filter((x) => /[=×÷]/.test(x.s) && x.s.length < 140).map((x) => x.s).slice(0, 2);
    c.facts = mentions.filter((x) => x.s !== c.definition).map((x) => x.s).slice(0, 3);
    c.misconceptions = mentions.filter((x) => /misconception|mistake|not the same|confuse|incorrect/i.test(x.s)).map((x) => x.s).slice(0, 2);
    c.excerpt = mentions.slice(0, 3).map((x) => x.s).join(" ").slice(0, 600);
  }
  list.sort((a, b) => (a.sourcePage ?? 0) - (b.sourcePage ?? 0));
  // Prerequisites: an earlier concept mentioned in a later concept's text.
  list.forEach((c, i) => {
    const text = `${c.definition} ${c.facts.join(" ")}`.toLowerCase();
    c.prerequisites = list.slice(0, i).filter((p) => text.includes(p.name.toLowerCase())).map((p) => p.name).slice(0, 3);
    if (!c.prerequisites.length && i > 0 && list[i - 1].chapter === c.chapter) c.related = [list[i - 1].name];
    const n = list.length;
    c.level = i < n * 0.2 ? "basic" : i < n * 0.7 ? "core" : "application";
    c.difficulty = 1 + Math.min(4, Math.floor((i / Math.max(1, n)) * 4) + (c.formulas.length ? 1 : 0));
  });

  const objectives = chaptersOut.map((ch, i) => ({ chapter: i, title: `Understand ${ch.title}`, description: ch.summary || `Key ideas from ${ch.title}.`, bloom: "Understand" }));
  if (list.some((c) => c.formulas.length)) objectives.push({ chapter: 0, title: "Apply the key relationships and formulas", description: "Use the formulas in the material to solve problems.", bloom: "Apply" });
  list.forEach((c) => { c.objective = c.formulas.length && objectives.length > chaptersOut.length ? objectives.length - 1 : Math.min(c.chapter, chaptersOut.length - 1); });

  return {
    title: title || chaptersOut[0]?.title || "My material",
    subject: "General",
    summary: sentences(pages[0]?.text ?? "").slice(0, 2).join(" "),
    chapters: chaptersOut.length ? chaptersOut : [{ title: title || "Main", summary: "", pageStart: 1 }],
    objectives,
    concepts: list,
  };
}

function sentences(t: string) {
  return t.split(/\n+/).flatMap((line) => line.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)).map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 400);
}
function sentencesLegacy(t: string) {
  return t.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 400);
}
void sentencesLegacy;
function blankConcept(name: string, def: string, page: number, chapter: number): CanonicalConcept {
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1), chapter, objective: chapter, level: "core", difficulty: 2,
    summary: def.length > 180 ? def.slice(0, 177) + "…" : def, definition: def, formulas: [], examples: [], facts: [],
    misconceptions: [], prerequisites: [], related: [], sourcePage: page, sourceSection: undefined,
  };
}

/* ---------------- Quiz bank ---------------- */
type QInsert = typeof quizQuestions.$inferInsert;
type CRow = typeof concepts.$inferSelect;

function localQuizBank(model: CanonicalModel, rows: CRow[], materialId: string): QInsert[] {
  const out: QInsert[] = [];
  const first = (s?: string | null) => (s ?? "").split(/(?<=[.!?])\s/)[0];
  rows.forEach((c) => {
    const others = rows.filter((o) => o.id !== c.id && o.definition);
    const base = { materialId, conceptId: c.id, objectiveId: c.objectiveId, sourcePage: c.sourcePage };
    if (c.definition && others.length >= 2) {
      const correct = first(c.definition);
      const opts = seededShuffle([correct, ...seededShuffle(others, c.id).slice(0, 3).map((o) => first(o.definition))], c.name);
      out.push({ ...base, type: "mcq", difficulty: "easy", prompt: `Which statement best describes ${c.name}?`, options: opts, answer: opts.indexOf(correct), explanation: c.definition, misconception: c.misconceptions[0] ?? null });
      const wrong = seededShuffle(others, c.name + "tf")[0];
      out.push({ ...base, type: "tf", difficulty: "medium", prompt: `True or false: “${c.name}” — ${first(wrong.definition).replace(new RegExp(wrong.name, "ig"), "it")}`, options: ["True", "False"], answer: false, explanation: `That describes ${wrong.name}. ${c.name}: ${first(c.definition)}`, misconception: `Mixing up ${c.name.toLowerCase()} and ${wrong.name.toLowerCase()}` });
    }
    if (c.definition && c.definition.toLowerCase().includes(c.name.toLowerCase())) {
      out.push({ ...base, type: "fill", difficulty: "medium", prompt: c.definition.replace(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "_____"), options: [], answer: c.name, explanation: c.definition });
    } else if (c.definition) {
      out.push({ ...base, type: "fill", difficulty: "medium", prompt: `_____: ${c.definition}`, options: [], answer: c.name, explanation: c.definition });
    }
    for (const m of c.misconceptions.slice(0, 1)) {
      out.push({ ...base, type: "tf", difficulty: "hard", prompt: `True or false: “${m}”`, options: ["True", "False"], answer: false, explanation: `This is a common misconception. ${c.definition ?? ""}`, misconception: m });
    }
    if (c.examples[0] && others.length >= 2) {
      const opts = seededShuffle([c.name, ...seededShuffle(others, c.id + "app").slice(0, 3).map((o) => o.name)], c.id);
      out.push({ ...base, type: "application", difficulty: "hard", prompt: `Which idea best explains this situation? ${c.examples[0].replace(new RegExp(c.name, "ig"), "this")}`, options: opts, answer: opts.indexOf(c.name), explanation: `${c.name}: ${first(c.definition)}` });
    }
    if (c.definition) {
      const keys = [...new Set(c.definition.toLowerCase().match(/[a-z]{5,}/g) ?? [])].filter((w) => !["which", "their", "about", "there", "these", "object", "objects"].includes(w)).slice(0, 8);
      out.push({ ...base, type: "short", difficulty: "hard", prompt: `In your own words: what is ${c.name}?`, options: [], answer: keys, explanation: c.definition });
    }
  });
  // Chapter-level matching and ordering.
  model.chapters.forEach((_, ci) => {
    const inCh = rows.filter((r) => r.chapterId && rows.find((x) => x.chapterId === r.chapterId) && model.concepts[r.idx]?.chapter === ci && r.definition);
    if (inCh.length >= 3) {
      const pick = inCh.slice(0, 4);
      out.push({ materialId, conceptId: pick[0].id, objectiveId: pick[0].objectiveId, type: "matching", difficulty: "medium", prompt: "Match each concept to its description.", options: seededShuffle(pick.map((p) => first(p.definition)), "m" + ci), answer: pick.map((p) => [p.name, first(p.definition)]), explanation: pick.map((p) => `${p.name}: ${first(p.definition)}`).join(" ") });
      out.push({ materialId, conceptId: pick[pick.length - 1].id, objectiveId: pick[0].objectiveId, type: "ordering", difficulty: "medium", prompt: "Arrange these from foundational to most advanced (the order you'd learn them).", options: seededShuffle(pick.map((p) => p.name), "o" + ci), answer: pick.map((p) => p.name), explanation: `Each builds on the previous: ${pick.map((p) => p.name).join(" → ")}.` });
    }
  });
  return out;
}

async function aiQuizBank(model: CanonicalModel, rows: CRow[], materialId: string, userId: string): Promise<QInsert[]> {
  const out: QInsert[] = [];
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));
  for (let i = 0; i < rows.length; i += 8) {
    const batch = rows.slice(i, i + 8);
    const prompt = `Write an assessment bank for these concepts from a learner's material. For EACH concept write 5 questions:
1 easy mcq, 1 tf, 1 medium fill (answer is a short term), 1 hard application (mcq-style scenario), 1 short answer (answer = list of 3-6 key words).
Also write 1 ordering and 1 matching question for the batch. Wrong options must target real misconceptions.
Types: mcq/application answer=index; tf answer=boolean; fill answer=string; short answer=[keywords]; ordering options=shuffled items, answer=correct order array; matching options=shuffled right-side items, answer=[[left,right],...].
Return JSON {"questions":[{"concept":exact concept name,"type":"mcq|tf|fill|short|ordering|matching|application","difficulty":"easy|medium|hard","prompt":string,"options":[string],"answer":any,"explanation":string,"misconception":string}]}
CONCEPTS:
${batch.map((c) => `- ${c.name}: ${c.definition} | formulas: ${c.formulas.join("; ")} | misconceptions: ${c.misconceptions.join("; ")}`).join("\n")}`;
    const res = await generateJSON<{ questions: { concept: string; type: string; difficulty: string; prompt: string; options?: string[]; answer: unknown; explanation?: string; misconception?: string }[] }>(
      "quiz.bank", prompt, { userId, maxTokens: 16000, temperature: 0.5 }
    );
    for (const q of res.questions ?? []) {
      const c = byName.get((q.concept ?? "").toLowerCase()) ?? batch[0];
      if (!q.prompt || q.answer === undefined) continue;
      out.push({ materialId, conceptId: c.id, objectiveId: c.objectiveId, type: q.type, difficulty: q.difficulty ?? "medium", prompt: q.prompt, options: q.options ?? (q.type === "tf" ? ["True", "False"] : []), answer: q.answer as object, explanation: q.explanation, misconception: q.misconception, sourcePage: c.sourcePage });
    }
  }
  void model;
  return out;
}
