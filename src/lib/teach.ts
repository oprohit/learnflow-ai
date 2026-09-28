import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  assignments, chapters, classMembers, conceptRelations, concepts, learningObjectives,
  lessonRepresentations, materials, translations, teacherClasses,
} from "@/db/schema";
import { capabilityReady, generateJSON, logCacheHit, AIUnavailable } from "@/lib/ai/provider";
import { langName } from "@/lib/constants";
import { CURATED_TRANSLATIONS } from "@/lib/sample";
import type { LessonContent, LessonSection } from "@/lib/types";

export type ConceptRow = typeof concepts.$inferSelect;

/* ---------------- access control (app-level row security) ---------------- */
export async function canAccessMaterial(userId: string, materialId: string) {
  const own = await db.select({ id: materials.id }).from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.userId, userId))).limit(1);
  if (own.length) return true;
  const assigned = await db.select({ id: assignments.id }).from(assignments)
    .innerJoin(classMembers, eq(classMembers.classId, assignments.classId))
    .where(and(eq(assignments.materialId, materialId), eq(classMembers.userId, userId))).limit(1);
  if (assigned.length) return true;
  const teacher = await db.select({ id: assignments.id }).from(assignments)
    .innerJoin(teacherClasses, eq(teacherClasses.id, assignments.classId))
    .where(and(eq(assignments.materialId, materialId), eq(teacherClasses.teacherId, userId))).limit(1);
  return teacher.length > 0;
}

export async function accessibleMaterialIds(userId: string) {
  const own = await db.select({ id: materials.id }).from(materials).where(eq(materials.userId, userId));
  const assigned = await db.selectDistinct({ id: assignments.materialId }).from(assignments)
    .innerJoin(classMembers, eq(classMembers.classId, assignments.classId))
    .where(eq(classMembers.userId, userId));
  return [...new Set([...own.map((r) => r.id), ...assigned.map((r) => r.id!).filter(Boolean)])];
}

/* ---------------- context ---------------- */
export async function loadConceptContext(conceptId: string) {
  const [concept] = await db.select().from(concepts).where(eq(concepts.id, conceptId)).limit(1);
  if (!concept) return null;
  const [material] = await db.select().from(materials).where(eq(materials.id, concept.materialId)).limit(1);
  const [chapter] = concept.chapterId ? await db.select().from(chapters).where(eq(chapters.id, concept.chapterId)).limit(1) : [];
  const [objective] = concept.objectiveId
    ? await db.select().from(learningObjectives).where(eq(learningObjectives.id, concept.objectiveId)).limit(1) : [];
  const rels = await db.select().from(conceptRelations)
    .where(or(eq(conceptRelations.toId, conceptId), eq(conceptRelations.fromId, conceptId)));
  const siblings = await db.select().from(concepts).where(eq(concepts.materialId, concept.materialId));
  const prereqIds = rels.filter((r) => r.type === "prerequisite" && r.toId === conceptId).map((r) => r.fromId);
  const relatedIds = rels.filter((r) => r.type === "related").map((r) => (r.fromId === conceptId ? r.toId : r.fromId));
  const prereqs = siblings.filter((s) => prereqIds.includes(s.id));
  const related = siblings.filter((s) => relatedIds.includes(s.id));
  const dependents = siblings.filter((s) => rels.some((r) => r.type === "prerequisite" && r.fromId === conceptId && r.toId === s.id));
  return { concept, material, chapter, objective, prereqs, related, dependents, siblings };
}
export type ConceptContext = NonNullable<Awaited<ReturnType<typeof loadConceptContext>>>;

/* ---------------- deterministic helpers ---------------- */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let x = hash(seed) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const firstSentence = (s?: string | null) => (s ?? "").split(/(?<=[.!?])\s/)[0] ?? "";

export function buildCheck(ctx: ConceptContext, seed: string) {
  const c = ctx.concept;
  const others = ctx.siblings.filter((s) => s.id !== c.id && s.definition);
  // Prefer confusable distractors: prerequisites & related first (this is where misconceptions live).
  const pool = [...ctx.prereqs, ...ctx.related, ...others].filter((s, i, arr) => s.id !== c.id && s.definition && arr.findIndex((x) => x.id === s.id) === i);
  const distractors = pool.slice(0, 3).map((s) => firstSentence(s.definition));
  const correct = firstSentence(c.definition) || c.summary || c.name;
  const options = seededShuffle([correct, ...distractors], seed + c.id);
  return {
    question: `Which statement best describes ${c.name.toLowerCase().startsWith("newton") ? c.name : c.name.toLowerCase()}?`,
    options,
    answer: options.indexOf(correct),
    explanation: `${c.definition ?? c.summary}`,
    misconception: c.misconceptions[0],
  };
}

/* ---------------- local (no-AI) representation templates ---------------- */
export function localLesson(ctx: ConceptContext, mode: string, simplified = false): LessonContent {
  const c = ctx.concept;
  const analogy = c.facts.find((f) => f.startsWith("Analogy:"))?.replace(/^Analogy:\s*/, "");
  const facts = c.facts.filter((f) => !f.startsWith("Analogy:"));
  const ex = c.examples[0] ?? `Look for ${c.name.toLowerCase()} in the examples in your material (page ${c.sourcePage ?? "?"}).`;
  const def = c.definition ?? c.summary ?? c.name;
  let sections: LessonSection[] = [];
  let intro = `Let's understand ${c.name} from the beginning.`;
  const prereqNames = ctx.prereqs.map((p) => p.name);

  switch (mode) {
    case "simple":
      intro = `Let's keep this really simple.`;
      sections = [
        { heading: "In one line", body: c.summary ?? firstSentence(def), kind: "explain" },
        { heading: "Picture it", body: ex, kind: "example" },
        { heading: "Remember", body: facts[0] ?? firstSentence(def), kind: "why" },
      ];
      break;
    case "advanced":
      intro = `Let's go deeper into ${c.name} with more precision.`;
      sections = [
        { heading: "Precise definition", body: def, kind: "explain" },
        ...(c.formulas.length ? [{ heading: "Formal relationships", body: c.formulas.join("   ·   "), kind: "formula" as const }] : []),
        { heading: "Key properties", body: facts.join(" ") || c.summary || def, kind: "explain" },
        ...(c.misconceptions.length ? [{ heading: "Edge cases & misconceptions", body: c.misconceptions.map((m) => `“${m}” — not correct.`).join(" "), kind: "why" as const }] : []),
        { heading: "Connections", body: `Builds on ${prereqNames.join(", ") || "foundational ideas"}; leads to ${ctx.dependents.map((d) => d.name).join(", ") || "applications in later chapters"}.`, kind: "explain" },
      ];
      break;
    case "analogy":
      intro = `Let me try this with something from everyday life.`;
      sections = [
        { heading: "Imagine this", body: analogy ?? `Think about a situation you know well: ${ex}`, kind: "analogy" },
        { heading: "Map it back", body: `In the analogy, what you see happening is ${c.name.toLowerCase()}. Formally: ${firstSentence(def)}`, kind: "explain" },
        { heading: "Where the analogy stops", body: facts[0] ? `One thing to keep precise: ${facts[0]}` : `Analogies help intuition — the definition is still what counts.`, kind: "why" },
      ];
      break;
    case "steps":
      intro = `Let's slow down and go one small step at a time.`;
      sections = [
        ...(prereqNames.length ? [{ heading: "Step 1 · What you need first", body: `Remember ${prereqNames.join(" and ")}: ${ctx.prereqs.map((p) => firstSentence(p.definition)).join(" ")}`, kind: "step" as const }] : []),
        { heading: `Step ${prereqNames.length ? 2 : 1} · The idea`, body: firstSentence(def), kind: "step" },
        ...facts.slice(0, 2).map((f, i) => ({ heading: `Step ${i + (prereqNames.length ? 3 : 2)} · Detail`, body: f, kind: "step" as const })),
        ...(c.formulas[0] ? [{ heading: "Step · The relationship", body: c.formulas[0], kind: "formula" as const }] : []),
        { heading: "Final step · See it", body: ex, kind: "example" },
      ];
      break;
    case "example":
      intro = `Let's start with real situations, then find the idea hiding inside them.`;
      sections = [
        ...c.examples.slice(0, 2).map((e, i) => ({ heading: `Situation ${i + 1}`, body: e, kind: "example" as const })),
        { heading: "What's common?", body: `In each case, ${c.name.toLowerCase()} is at work. ${firstSentence(def)}`, kind: "explain" },
      ];
      break;
    case "zero":
      intro = `Let's rebuild this from the very basics — no assumptions.`;
      sections = [
        ...ctx.prereqs.map((p) => ({ heading: `First: what is ${p.name.toLowerCase()}?`, body: `${p.summary ?? firstSentence(p.definition)}`, kind: "prereq" as const })),
        { heading: `Now: what is ${c.name.toLowerCase()}?`, body: c.summary ?? firstSentence(def), kind: "explain" },
        { heading: "A picture", body: ex, kind: "example" },
        { heading: "The full idea", body: def, kind: "explain" },
      ];
      break;
    case "visual":
      intro = `Let me show you instead of only telling you.`;
      sections = [
        { heading: "Read the diagram", body: `Follow the arrows from left to right: ${[...prereqNames.slice(0, 2), c.name, ...ctx.dependents.slice(0, 1).map((d) => d.name)].join(" → ")}.`, kind: "explain" },
        { heading: "What it shows", body: firstSentence(def), kind: "explain" },
        { heading: "Look for it", body: ex, kind: "example" },
      ];
      break;
    default:
      sections = [
        { heading: "What it is", body: def, kind: "explain" },
        { heading: "Why it matters", body: c.summary ?? facts[0] ?? def, kind: "why" },
        ...(c.formulas.length ? [{ heading: "The key relationship", body: c.formulas.join("   ·   "), kind: "formula" as const }] : facts[0] ? [{ heading: "How it works", body: facts.slice(0, 2).join(" "), kind: "explain" as const }] : []),
        { heading: "Example", body: ex, kind: "example" },
      ];
  }
  if (simplified) sections = sections.slice(0, 3).map((s) => ({ ...s, body: firstSentence(s.body) || s.body }));

  const nodes = [...prereqNames.slice(0, 2), c.name, ...(c.formulas[0] ? [c.formulas[0]] : []), ...ctx.dependents.slice(0, 1).map((d) => d.name)];
  return {
    title: c.name,
    teacherIntro: intro,
    sections: sections.filter((s) => s.body),
    visual: { kind: "flow", nodes: nodes.length >= 2 ? nodes : [c.name, firstSentence(def).slice(0, 40)], caption: `How ${c.name} connects to what you already know.` },
    check: buildCheck(ctx, mode),
    summary: c.summary ?? firstSentence(def),
    objective: ctx.objective?.title ?? "",
    source: { chapter: ctx.chapter?.title, section: c.sourceSection ?? undefined, page: c.sourcePage ?? undefined },
  };
}

/* ---------------- AI generation ---------------- */
const MODE_BRIEF: Record<string, string> = {
  simple: "Explain very simply: plain everyday words, short sentences, 3 short sections. No jargon unless defined.",
  standard: "Standard teaching: sections 'What it is', 'Why it matters', 'How it works', 'Example'.",
  advanced: "Advanced: precise, rigorous language, formal relationships, edge cases, common misconceptions, connections. 4-5 sections.",
  visual: "Visual: the diagram is primary. Provide visual.nodes (3-6 short labels in causal/flow order) and sections that walk through the diagram. Set visual.imagePrompt ONLY if a rich illustration (biology, historical scene, process in nature) would genuinely help; otherwise empty string.",
  analogy: "Analogy: build one vivid everyday analogy (relatable to an Indian student where natural), map each part of the analogy to the concept, then say where the analogy breaks.",
  steps: "Step-by-step: 4-6 very small numbered steps (heading 'Step n · ...'), each one idea.",
  example: "Examples first: start with 2 real-world situations, then reveal the underlying concept.",
  zero: "Teach from zero: assume no prior knowledge. Build a prerequisite chain: start from the most basic idea ('What is ...?'), then each next idea, ending at the concept itself. 4-6 sections with kind 'prereq' then 'explain'.",
};

type Profile = { educationLevel?: string | null; learningGoal?: string | null; simplified?: boolean };

async function aiLesson(ctx: ConceptContext, mode: string, profile: Profile, userId: string): Promise<LessonContent> {
  const c = ctx.concept;
  const prompt = `You are a warm, expert personal teacher. Teach ONE concept from the learner's own material.
Never change the learning objective. Stay faithful to the source facts below; do not invent citations.

LEARNING OBJECTIVE: ${ctx.objective?.title ?? "(none)"}
CHAPTER: ${ctx.chapter?.title ?? ""}
CONCEPT: ${c.name}
DEFINITION (source): ${c.definition ?? ""}
SUMMARY: ${c.summary ?? ""}
FORMULAS: ${c.formulas.join("; ")}
EXAMPLES (source): ${c.examples.join(" | ")}
FACTS: ${c.facts.join(" | ")}
COMMON MISCONCEPTIONS: ${c.misconceptions.join(" | ")}
PREREQUISITES: ${ctx.prereqs.map((p) => `${p.name}: ${p.summary ?? ""}`).join(" | ") || "none"}
CONFUSABLE CONCEPTS: ${[...ctx.prereqs, ...ctx.related].map((p) => p.name).join(", ")}
SOURCE EXCERPT: ${(c.sourceExcerpt ?? "").slice(0, 1200)}

LEARNER: level=${profile.educationLevel ?? "unknown"}, goal=${profile.learningGoal ?? "understand"}${profile.simplified ? ", needs simplified accessible language" : ""}.
MODE: ${mode}. ${MODE_BRIEF[mode] ?? MODE_BRIEF.standard}

Speak like a teacher ("Let's...", "Notice that..."), not a summary. Write in English.
Return JSON exactly:
{"title":string,"teacherIntro":string,"sections":[{"heading":string,"body":string,"kind":"explain|example|analogy|step|formula|prereq|why"}],
"visual":{"kind":"flow","nodes":[string],"caption":string,"imagePrompt":string},
"check":{"question":string,"options":[4 strings],"answer":number (0-3),"explanation":string,"misconception":string (the misconception the wrong options target)},
"summary":string}`;
  const out = await generateJSON<Omit<LessonContent, "objective" | "source">>("lesson.generate", prompt, { userId, temperature: 0.5 });
  if (!out?.sections?.length || !out.check?.options?.length) throw new AIUnavailable("error", "invalid lesson");
  return {
    ...out,
    objective: ctx.objective?.title ?? "",
    source: { chapter: ctx.chapter?.title, section: c.sourceSection ?? undefined, page: c.sourcePage ?? undefined },
  };
}

export async function translateJSON<T>(value: T, language: string, userId: string, op = "translate"): Promise<T> {
  const prompt = `Translate the string values of this JSON into ${langName(language)} for a student.
Rules: keep the exact same JSON structure, keys, array lengths and order; keep numbers, formulas, symbols and units unchanged;
for important technical terms keep the English term in parentheses on first use; keep meaning and learning objective identical — do not add or remove content.
Return JSON only.
${JSON.stringify(value)}`;
  return generateJSON<T>(op, prompt, { userId, capability: "fast", temperature: 0.2 });
}

/** Cached generic translation (used for quiz questions, chat snippets, UI content). */
export async function cachedTranslate<T>(key: string, value: T, language: string, userId: string): Promise<{ value: T; translated: boolean }> {
  if (language === "en") return { value, translated: true };
  const [hit] = await db.select().from(translations).where(and(eq(translations.key, key), eq(translations.language, language))).limit(1);
  if (hit) { void logCacheHit("translate", userId); return { value: hit.content as T, translated: true }; }
  if (!capabilityReady("fast")) return { value, translated: false };
  try {
    const out = await translateJSON(value, language, userId, "translate.generic");
    await db.insert(translations).values({ key, language, content: out as object }).onConflictDoNothing();
    return { value: out, translated: true };
  } catch {
    return { value, translated: false };
  }
}

export type RepResult = { content: LessonContent; engine: string; cached: boolean; notice?: string; language: string };

/**
 * Core rule: ONE canonical English representation per (concept, mode, variant).
 * Other languages are translations of it, so the objective never drifts.
 */
export async function getRepresentation(opts: {
  conceptId: string; mode: string; language: string; userId: string; profile: Profile;
}): Promise<RepResult | null> {
  const { conceptId, mode, language, userId, profile } = opts;
  const variant = profile.simplified ? "plain" : "default";
  const [hit] = await db.select().from(lessonRepresentations).where(and(
    eq(lessonRepresentations.conceptId, conceptId), eq(lessonRepresentations.mode, mode),
    eq(lessonRepresentations.language, language), eq(lessonRepresentations.variant, variant),
  )).limit(1);
  if (hit) {
    void logCacheHit(`lesson.${language === "en" ? "generate" : "translate"}`, userId);
    return { content: hit.content as LessonContent, engine: hit.engine, cached: true, language };
  }
  const ctx = await loadConceptContext(conceptId);
  if (!ctx) return null;

  const store = async (content: LessonContent, engine: string, lang: string) => {
    await db.insert(lessonRepresentations).values({
      conceptId, objectiveId: ctx.concept.objectiveId, mode, language: lang, variant, engine, content,
    }).onConflictDoNothing();
  };

  if (language !== "en") {
    const curated = CURATED_TRANSLATIONS[ctx.concept.name]?.[language]?.[mode];
    if (curated && ctx.material?.engine === "curated") {
      await store(curated, "curated", language);
      return { content: curated, engine: "curated", cached: false, language };
    }
    const base = await getRepresentation({ ...opts, language: "en" });
    if (!base) return null;
    if (!capabilityReady("fast")) {
      return { ...base, language: "en", notice: `${langName(language)} needs the AI teacher, which is offline right now. Showing English — your progress is unchanged.` };
    }
    try {
      const translated = await translateJSON(base.content, language, userId, "lesson.translate");
      await store(translated, "gemini", language);
      return { content: translated, engine: "gemini", cached: false, language };
    } catch {
      return { ...base, language: "en", notice: `Couldn't switch to ${langName(language)} just now. Showing English — your place in the lesson is saved.` };
    }
  }

  if (capabilityReady("text")) {
    try {
      const content = await aiLesson(ctx, mode, profile, userId);
      await store(content, "gemini", "en");
      return { content, engine: "gemini", cached: false, language: "en" };
    } catch { /* fall through to deterministic */ }
  }
  // Deterministic representation: cheap to compute, not stored so a later AI version can replace it.
  return { content: localLesson(ctx, mode, profile.simplified), engine: "local", cached: false, language: "en" };
}

export async function conceptsByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(concepts).where(inArray(concepts.id, ids));
}
