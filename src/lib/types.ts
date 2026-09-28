/** Canonical learning model extracted from ONE source. Every representation references it. */
export type CanonicalConcept = {
  name: string;
  chapter: number;
  objective: number;
  level: "prerequisite" | "basic" | "core" | "application" | "advanced";
  difficulty: number; // 1..5
  summary: string;
  definition: string;
  formulas: string[];
  examples: string[];
  facts: string[];
  misconceptions: string[];
  prerequisites: string[];
  related: string[];
  analogy?: string;
  parent?: string;
  sourcePage?: number;
  sourceSection?: string;
  excerpt?: string;
};

export type CanonicalModel = {
  title: string;
  subject: string;
  summary: string;
  chapters: { title: string; summary: string; pageStart?: number }[];
  objectives: { chapter: number; title: string; description: string; bloom?: string }[];
  concepts: CanonicalConcept[];
};

export type LessonSection = {
  heading: string;
  body: string;
  kind?: "explain" | "example" | "analogy" | "step" | "formula" | "prereq" | "why";
};

export type LessonVisual = {
  kind: "flow" | "cycle" | "hierarchy" | "compare";
  nodes: string[];
  caption: string;
  imagePrompt?: string;
};

export type LessonCheck = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  misconception?: string;
};

export type LessonContent = {
  title: string;
  teacherIntro: string;
  sections: LessonSection[];
  visual?: LessonVisual;
  check: LessonCheck;
  summary: string;
  objective: string;
  source: { chapter?: string; section?: string; page?: number };
};

export type QuizQuestionDTO = {
  id: string;
  conceptId: string;
  conceptName?: string;
  type: "mcq" | "tf" | "fill" | "short" | "ordering" | "matching" | "application";
  difficulty: string;
  prompt: string;
  options: string[];
  left?: string[];
  sourcePage?: number | null;
};

export type NextStep = {
  action: "continue" | "review" | "simplify" | "deeper" | "practice" | "prerequisite" | "done";
  label: string;
  reason: string;
  conceptId?: string;
  conceptName?: string;
  mode?: string;
  href: string;
};
