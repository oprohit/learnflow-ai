import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { communities, mastery, postVotes, posts, quizAttempts, studySessions, users } from "@/db/schema";

const DEFAULT_COMMUNITIES = [
  { slug: "kpriet-it", name: "KPRIET IT", description: "Information Technology students at KPRIET — coursework, labs and exam prep." },
  { slug: "physics-class", name: "Physics Class", description: "Mechanics, waves, electricity — explain it like a friend would." },
  { slug: "neet-biology", name: "NEET Biology", description: "Daily NEET biology practice, mnemonics and doubt-solving." },
  { slug: "maths-grade-12", name: "Mathematics Grade 12", description: "Calculus, vectors, probability — step-by-step solutions." },
];

export async function ensureCommunities() {
  await db.insert(communities).values(DEFAULT_COMMUNITIES).onConflictDoNothing();
}

/**
 * Leaderboard points reward learning outcomes, not activity volume or AI calls:
 * strong concepts ×10, distinct questions answered correctly ×2, lessons completed ×3, helpful votes received ×5.
 */
export async function leaderboard(userIds: string[] | null, since?: Date) {
  const scope = (col: Parameters<typeof inArray>[0]) => (userIds ? inArray(col, userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]) : undefined);
  const strong = await db.select({ userId: mastery.userId, n: sql<number>`count(*)::int` }).from(mastery)
    .where(and(gte(mastery.score, 75), scope(mastery.userId), since ? gte(mastery.lastStudied, since) : undefined)).groupBy(mastery.userId);
  const correct = await db.select({ userId: quizAttempts.userId, n: sql<number>`count(distinct ${quizAttempts.questionId})::int` }).from(quizAttempts)
    .where(and(eq(quizAttempts.correct, true), scope(quizAttempts.userId), since ? gte(quizAttempts.createdAt, since) : undefined)).groupBy(quizAttempts.userId);
  const lessons = await db.select({ userId: studySessions.userId, n: sql<number>`count(distinct ${studySessions.conceptId})::int` }).from(studySessions)
    .where(and(eq(studySessions.kind, "lesson"), scope(studySessions.userId), since ? gte(studySessions.createdAt, since) : undefined)).groupBy(studySessions.userId);
  const helpful = await db.select({ userId: posts.userId, n: sql<number>`count(${postVotes.postId})::int` }).from(posts)
    .innerJoin(postVotes, eq(postVotes.postId, posts.id)).where(and(scope(posts.userId), since ? gte(posts.createdAt, since) : undefined)).groupBy(posts.userId);

  const ids = new Set([...strong, ...correct, ...lessons, ...helpful].map((r) => r.userId));
  if (userIds) userIds.forEach((id) => ids.add(id));
  if (!ids.size) return [];
  const people = await db.select({ id: users.id, name: users.name, handle: users.handle, shareProgress: users.shareProgress, streak: users.streak }).from(users).where(inArray(users.id, [...ids]));
  const get = (arr: { userId: string; n: number }[], id: string) => arr.find((r) => r.userId === id)?.n ?? 0;
  return people.map((p) => {
    const s = get(strong, p.id), c = get(correct, p.id), l = get(lessons, p.id), h = get(helpful, p.id);
    return { ...p, strong: s, correct: c, lessons: l, helpful: h, points: s * 10 + c * 2 + l * 3 + h * 5 };
  }).sort((a, b) => b.points - a.points);
}
