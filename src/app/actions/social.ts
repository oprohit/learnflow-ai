"use server";
import { revalidatePath } from "next/cache";
import { and, eq, ilike, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import {
  assignments, challenges, classMembers, communities, communityMembers, concepts, friends, messages, notifications, postVotes, posts,
  teacherClasses, users, materials, type Accessibility,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/learning";
import { canAccessMaterial } from "@/lib/teach";

const s = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? "").trim().slice(0, max);

/* ---------- community ---------- */
export async function joinCommunity(fd: FormData) {
  const user = await requireUser();
  await db.insert(communityMembers).values({ communityId: s(fd, "communityId"), userId: user.id }).onConflictDoNothing();
  revalidatePath("/community");
}
export async function leaveCommunity(fd: FormData) {
  const user = await requireUser();
  await db.delete(communityMembers).where(and(eq(communityMembers.communityId, s(fd, "communityId")), eq(communityMembers.userId, user.id)));
  revalidatePath("/community");
}
export async function createCommunity(fd: FormData) {
  const user = await requireUser();
  const name = s(fd, "name", 60);
  if (!name) return;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${randomBytes(2).toString("hex")}`;
  const [c] = await db.insert(communities).values({ name, slug, description: s(fd, "description", 200), createdBy: user.id }).returning();
  await db.insert(communityMembers).values({ communityId: c.id, userId: user.id });
  revalidatePath("/community");
}
export async function createPost(fd: FormData) {
  const user = await requireUser();
  const communityId = s(fd, "communityId");
  const body = s(fd, "body", 4000);
  const [member] = await db.select().from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, user.id)));
  if (!member || !body) return;
  const meta: Record<string, unknown> = {};
  const conceptId = s(fd, "conceptId");
  if (conceptId) {
    // Share the concept's explanation only — never the private source material.
    const [c] = await db.select().from(concepts).where(eq(concepts.id, conceptId));
    if (c && (await canAccessMaterial(user.id, c.materialId))) meta.concept = { name: c.name, definition: c.definition };
  }
  const score = s(fd, "score");
  if (score) meta.score = score;
  const parentId = s(fd, "parentId") || null;
  await db.insert(posts).values({ communityId, userId: user.id, kind: s(fd, "kind", 20) || "discussion", title: s(fd, "title", 140) || null, body, meta, parentId });
  if (parentId) {
    const [parent] = await db.select().from(posts).where(eq(posts.id, parentId));
    if (parent && parent.userId !== user.id) await notify(parent.userId, "community", `${user.name} replied to your post`, body.slice(0, 80), `/community?c=${communityId}`);
  }
  revalidatePath("/community");
}
export async function markHelpful(fd: FormData) {
  const user = await requireUser();
  const postId = s(fd, "postId");
  const [p] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!p || p.userId === user.id) return; // can't farm your own points
  const inserted = await db.insert(postVotes).values({ postId, userId: user.id }).onConflictDoNothing().returning();
  if (inserted.length) await db.update(posts).set({ helpful: p.helpful + 1 }).where(eq(posts.id, postId));
  revalidatePath("/community");
}

/* ---------- friends & messages ---------- */
export async function sendFriendRequest(fd: FormData) {
  const user = await requireUser();
  const q = s(fd, "query", 100).toLowerCase().replace(/^@/, "");
  const [target] = await db.select().from(users).where(or(eq(users.email, q), eq(users.handle, q)));
  if (!target || target.id === user.id) return;
  const [existing] = await db.select().from(friends).where(or(
    and(eq(friends.requesterId, user.id), eq(friends.addresseeId, target.id)),
    and(eq(friends.requesterId, target.id), eq(friends.addresseeId, user.id))));
  if (existing) return;
  await db.insert(friends).values({ requesterId: user.id, addresseeId: target.id });
  await notify(target.id, "friend", `${user.name} sent you a friend request`, undefined, "/messages");
  revalidatePath("/messages");
}
export async function respondFriend(fd: FormData) {
  const user = await requireUser();
  const id = s(fd, "id");
  const accept = s(fd, "accept") === "1";
  const [f] = await db.select().from(friends).where(eq(friends.id, id));
  if (!f || (f.addresseeId !== user.id && f.requesterId !== user.id)) return;
  if (accept && f.addresseeId === user.id) {
    await db.update(friends).set({ status: "accepted" }).where(eq(friends.id, id));
    await notify(f.requesterId, "friend", `${user.name} accepted your friend request`, undefined, `/messages?with=${user.id}`);
  } else await db.delete(friends).where(eq(friends.id, id));
  revalidatePath("/messages");
}
export async function sendMessage(fd: FormData) {
  const user = await requireUser();
  const toId = s(fd, "toId");
  const body = s(fd, "body", 2000);
  const [f] = await db.select().from(friends).where(and(eq(friends.status, "accepted"), or(
    and(eq(friends.requesterId, user.id), eq(friends.addresseeId, toId)), and(eq(friends.requesterId, toId), eq(friends.addresseeId, user.id)))));
  if (!f) return;
  let attachment: Record<string, unknown> | null = null;
  const share = s(fd, "share");
  const conceptId = s(fd, "conceptId");
  if (share && conceptId) {
    const [c] = await db.select().from(concepts).where(eq(concepts.id, conceptId));
    if (c && (await canAccessMaterial(user.id, c.materialId))) {
      if (share === "challenge") {
        await db.insert(challenges).values({ fromId: user.id, toId, conceptId, title: `Master ${c.name}` });
        await notify(toId, "challenge", `${user.name} challenged you`, `Reach 75% on ${c.name}`, `/messages?with=${user.id}`);
      }
      attachment = { type: share, name: c.name, definition: c.definition };
    }
  }
  if (!body && !attachment) return;
  await db.insert(messages).values({ fromId: user.id, toId, body: body || (share === "challenge" ? "Study challenge!" : "Shared a concept"), attachment });
  revalidatePath("/messages");
}

/* ---------- notifications ---------- */
export async function markAllRead() {
  const user = await requireUser();
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, user.id));
  revalidatePath("/notifications");
}

/* ---------- teacher / evaluator ---------- */
export async function setRole(fd: FormData) {
  const user = await requireUser();
  await db.update(users).set({ role: s(fd, "role") === "teacher" ? "teacher" : "learner" }).where(eq(users.id, user.id));
  revalidatePath("/teacher");
}
export async function createClass(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "teacher") return;
  const name = s(fd, "name", 80);
  if (!name) return;
  await db.insert(teacherClasses).values({ teacherId: user.id, name, code: randomBytes(3).toString("hex").toUpperCase() });
  revalidatePath("/teacher");
}
export async function joinClass(fd: FormData) {
  const user = await requireUser();
  const [c] = await db.select().from(teacherClasses).where(ilike(teacherClasses.code, s(fd, "code", 12)));
  if (!c) return;
  await db.insert(classMembers).values({ classId: c.id, userId: user.id }).onConflictDoNothing();
  await notify(c.teacherId, "community", `${user.name} joined ${c.name}`, undefined, "/teacher");
  revalidatePath("/teacher");
}
export async function createAssignment(fd: FormData) {
  const user = await requireUser();
  const classId = s(fd, "classId");
  const materialId = s(fd, "materialId");
  const [c] = await db.select().from(teacherClasses).where(and(eq(teacherClasses.id, classId), eq(teacherClasses.teacherId, user.id)));
  const [m] = await db.select().from(materials).where(and(eq(materials.id, materialId), eq(materials.userId, user.id)));
  if (!c || !m) return;
  const kind = s(fd, "kind") === "quiz" ? "quiz" : "chapter";
  const title = s(fd, "title", 120) || `${kind === "quiz" ? "Quiz" : "Study"}: ${m.title}`;
  await db.insert(assignments).values({ classId, materialId, chapterId: s(fd, "chapterId") || null, title, kind, dueDate: s(fd, "dueDate") || null });
  const students = await db.select().from(classMembers).where(eq(classMembers.classId, classId));
  for (const st of students) await notify(st.userId, "assignment", `New assignment: ${title}`, s(fd, "dueDate") ? `Due ${s(fd, "dueDate")}` : undefined, kind === "quiz" ? `/quiz?material=${materialId}` : `/materials/${materialId}`);
  revalidatePath("/teacher");
}

/* ---------- profile ---------- */
export async function updateProfile(fd: FormData) {
  const user = await requireUser();
  await db.update(users).set({
    name: s(fd, "name", 80) || user.name,
    primaryLanguage: s(fd, "primaryLanguage", 5) || user.primaryLanguage,
    secondaryLanguage: s(fd, "secondaryLanguage", 5) || null,
    educationLevel: s(fd, "educationLevel", 40) || user.educationLevel,
    learningGoal: s(fd, "learningGoal", 40) || user.learningGoal,
    teachingStyle: s(fd, "teachingStyle", 20) || user.teachingStyle,
    dailyMinutes: Math.max(5, Math.min(240, Number(fd.get("dailyMinutes")) || user.dailyMinutes)),
    shareProgress: fd.get("shareProgress") === "on",
  }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}
export async function updateAccessibility(fd: FormData) {
  const user = await requireUser();
  const a: Accessibility = {
    largeText: fd.get("largeText") === "on", highContrast: fd.get("highContrast") === "on", reducedMotion: fd.get("reducedMotion") === "on",
    simplified: fd.get("simplified") === "on", audioFirst: fd.get("audioFirst") === "on",
  };
  await db.update(users).set({ accessibility: a }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}
