import {
  pgTable,
  text,
  uuid,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export type Accessibility = {
  largeText?: boolean;
  highContrast?: boolean;
  reducedMotion?: boolean;
  simplified?: boolean;
  audioFirst?: boolean;
};

/* ---------------- Identity ---------------- */
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default("Learner"),
  handle: text("handle"),
  role: text("role").notNull().default("learner"), // learner | teacher
  primaryLanguage: text("primary_language").notNull().default("en"),
  secondaryLanguage: text("secondary_language"),
  educationLevel: text("education_level"),
  learningGoal: text("learning_goal"),
  teachingStyle: text("teaching_style").default("adaptive"),
  dailyMinutes: integer("daily_minutes").notNull().default(25),
  subject: text("subject"),
  targetExam: text("target_exam"),
  targetDate: text("target_date"),
  onboarded: boolean("onboarded").notNull().default(false),
  accessibility: jsonb("accessibility").$type<Accessibility>().notNull().default({}),
  shareProgress: boolean("share_progress").notNull().default(true),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastStudyDate: text("last_study_date"),
  createdAt: created(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/* ---------------- Source material ---------------- */
export type StageEntry = { stage: string; label: string; at: string; detail?: string };

export const materials = pgTable("materials", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subject: text("subject"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("queued"),
  stageLog: jsonb("stage_log").$type<StageEntry[]>().notNull().default([]),
  error: text("error"),
  summary: text("summary"),
  pageCount: integer("page_count"),
  engine: text("engine").default("local"), // gemini | local | curated
  createdAt: created(),
  lastStudiedAt: timestamp("last_studied_at", { withTimezone: true }),
});

export const materialFiles = pgTable("material_files", {
  id: id(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  dataBase64: text("data_base64").notNull(),
  createdAt: created(),
});

export const chapters = pgTable("chapters", {
  id: id(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  pageStart: integer("page_start"),
});

export const materialChunks = pgTable(
  "material_chunks",
  {
    id: id(),
    materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
    chapterIdx: integer("chapter_idx"),
    idx: integer("idx").notNull(),
    page: integer("page"),
    section: text("section"),
    text: text("text").notNull(),
  },
  (t) => [index("chunks_material_idx").on(t.materialId)]
);

export const learningObjectives = pgTable("learning_objectives", {
  id: id(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  idx: integer("idx").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  bloom: text("bloom"),
});

export const concepts = pgTable(
  "concepts",
  {
    id: id(),
    materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    objectiveId: uuid("objective_id").references(() => learningObjectives.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"),
    idx: integer("idx").notNull(),
    name: text("name").notNull(),
    summary: text("summary"),
    definition: text("definition"),
    formulas: jsonb("formulas").$type<string[]>().notNull().default([]),
    examples: jsonb("examples").$type<string[]>().notNull().default([]),
    facts: jsonb("facts").$type<string[]>().notNull().default([]),
    misconceptions: jsonb("misconceptions").$type<string[]>().notNull().default([]),
    difficulty: integer("difficulty").notNull().default(2),
    level: text("level").notNull().default("core"), // prerequisite | basic | core | application | advanced
    sourcePage: integer("source_page"),
    sourceSection: text("source_section"),
    sourceExcerpt: text("source_excerpt"),
  },
  (t) => [index("concepts_material_idx").on(t.materialId)]
);

export const conceptRelations = pgTable("concept_relations", {
  id: id(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  fromId: uuid("from_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // prerequisite (from is prereq of to) | related
});

/* ---------------- Representations (cached AI output) ---------------- */
export const lessonRepresentations = pgTable(
  "lesson_representations",
  {
    id: id(),
    conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
    objectiveId: uuid("objective_id"),
    mode: text("mode").notNull(),
    language: text("language").notNull(),
    variant: text("variant").notNull().default("default"),
    engine: text("engine").notNull().default("local"),
    content: jsonb("content").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("rep_unique").on(t.conceptId, t.mode, t.language, t.variant)]
);

export const translations = pgTable(
  "translations",
  {
    id: id(),
    key: text("key").notNull(),
    language: text("language").notNull(),
    content: jsonb("content").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("translation_unique").on(t.key, t.language)]
);

export const mediaCache = pgTable("media_cache", {
  id: id(),
  key: text("key").notNull().unique(),
  kind: text("kind").notNull(), // audio | image
  mime: text("mime").notNull(),
  dataBase64: text("data_base64").notNull(),
  createdAt: created(),
});

/* ---------------- Assessment ---------------- */
export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: id(),
    materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
    objectiveId: uuid("objective_id"),
    type: text("type").notNull(), // mcq | tf | fill | short | ordering | matching | application
    difficulty: text("difficulty").notNull().default("medium"),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    answer: jsonb("answer").notNull(), // index | boolean | string | string[] | [string,string][]
    explanation: text("explanation"),
    misconception: text("misconception"),
    sourcePage: integer("source_page"),
  },
  (t) => [index("questions_concept_idx").on(t.conceptId)]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => quizQuestions.id, { onDelete: "set null" }),
    conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
    materialId: uuid("material_id").notNull(),
    correct: boolean("correct").notNull(),
    answer: jsonb("answer"),
    timeMs: integer("time_ms"),
    attemptNo: integer("attempt_no").notNull().default(1),
    difficulty: text("difficulty"),
    masteryDelta: real("mastery_delta").notNull().default(0),
    context: text("context").notNull().default("quiz"),
    createdAt: created(),
  },
  (t) => [index("attempts_user_idx").on(t.userId)]
);

export const flashcards = pgTable("flashcards", {
  id: id(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // definition | formula | example | mistake
  front: text("front").notNull(),
  back: text("back").notNull(),
});

export const flashcardReviews = pgTable("flashcard_reviews", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  flashcardId: uuid("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  result: text("result").notNull(), // know | later
  createdAt: created(),
});

export const mastery = pgTable(
  "mastery",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
    materialId: uuid("material_id").notNull(),
    score: real("score").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    confusions: integer("confusions").notNull().default(0),
    lessonsCompleted: integer("lessons_completed").notNull().default(0),
    lastStudied: timestamp("last_studied", { withTimezone: true }),
    nextReview: timestamp("next_review", { withTimezone: true }),
    lastMisconception: text("last_misconception"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.conceptId] })]
);

/** Persistent lesson state — survives language/representation switches. */
export const lessonStates = pgTable(
  "lesson_states",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("standard"),
    language: text("language").notNull().default("en"),
    step: integer("step").notNull().default(0),
    progress: integer("progress").notNull().default(0),
    difficulty: text("difficulty").notNull().default("standard"),
    strategyIdx: integer("strategy_idx").notNull().default(0),
    checkAnswered: boolean("check_answered").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.conceptId] })]
);

export const studyPlans = pgTable("study_plans", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "cascade" }),
  targetExam: text("target_exam"),
  targetDate: text("target_date"),
  dailyMinutes: integer("daily_minutes").notNull().default(25),
  plan: jsonb("plan").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studySessions = pgTable("study_sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: uuid("material_id"),
  conceptId: uuid("concept_id"),
  kind: text("kind").notNull(), // lesson | quiz | flashcards | revision | surprise
  minutes: real("minutes").notNull().default(0),
  createdAt: created(),
});

export const surpriseQuizzes = pgTable("surprise_quizzes", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
  questionIds: jsonb("question_ids").$type<string[]>().notNull().default([]),
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  score: integer("score"),
  createdAt: created(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/* ---------------- Social ---------------- */
export const communities = pgTable("communities", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by"),
  createdAt: created(),
});

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })]
);

export const posts = pgTable("posts", {
  id: id(),
  communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  kind: text("kind").notNull().default("discussion"),
  title: text("title"),
  body: text("body").notNull(),
  meta: jsonb("meta").notNull().default({}),
  helpful: integer("helpful").notNull().default(0),
  createdAt: created(),
});

export const postVotes = pgTable(
  "post_votes",
  {
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export const friends = pgTable("friends", {
  id: id(),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: uuid("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: created(),
});

export const messages = pgTable("messages", {
  id: id(),
  fromId: uuid("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  attachment: jsonb("attachment"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: created(),
});

export const challenges = pgTable("challenges", {
  id: id(),
  fromId: uuid("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conceptId: uuid("concept_id").references(() => concepts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: created(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: created(),
});

/* ---------------- Teacher / evaluator ---------------- */
export const teacherClasses = pgTable("teacher_classes", {
  id: id(),
  teacherId: uuid("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: created(),
});

export const classMembers = pgTable(
  "class_members",
  {
    classId: uuid("class_id").notNull().references(() => teacherClasses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.classId, t.userId] })]
);

export const assignments = pgTable("assignments", {
  id: id(),
  classId: uuid("class_id").notNull().references(() => teacherClasses.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id"),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("chapter"),
  dueDate: text("due_date"),
  createdAt: created(),
});

/* ---------------- AI usage accounting ---------------- */
export const aiUsage = pgTable("ai_usage", {
  id: id(),
  userId: uuid("user_id"),
  operation: text("operation").notNull(),
  model: text("model").notNull(),
  cached: boolean("cached").notNull().default(false),
  ok: boolean("ok").notNull().default(true),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  createdAt: created(),
});
