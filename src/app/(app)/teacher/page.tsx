import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { School, Shield, CalendarClock } from "lucide-react";
import { db } from "@/db";
import { assignments, chapters, classMembers, concepts, mastery, materials, teacherClasses, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { createAssignment, createClass, joinClass, setRole } from "@/app/actions/social";
import { PageHeader, toneColor } from "@/components/ui";

export const metadata = { title: "Classes · LearnFlow AI" };
export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const user = await requireUser();
  const joined = await db.select({ c: teacherClasses, teacher: users.name }).from(classMembers).innerJoin(teacherClasses, eq(teacherClasses.id, classMembers.classId)).innerJoin(users, eq(users.id, teacherClasses.teacherId)).where(eq(classMembers.userId, user.id));
  const myAssignments = joined.length ? await db.select({ a: assignments, mTitle: materials.title }).from(assignments).leftJoin(materials, eq(materials.id, assignments.materialId)).where(inArray(assignments.classId, joined.map((j) => j.c.id))).orderBy(desc(assignments.createdAt)) : [];

  const isTeacher = user.role === "teacher";
  const classes = isTeacher ? await db.select().from(teacherClasses).where(eq(teacherClasses.teacherId, user.id)).orderBy(desc(teacherClasses.createdAt)) : [];
  const myMaterials = isTeacher ? await db.select().from(materials).where(and(eq(materials.userId, user.id), eq(materials.status, "ready"))) : [];
  const myChapters = myMaterials.length ? await db.select().from(chapters).where(inArray(chapters.materialId, myMaterials.map((m) => m.id))) : [];

  return (
    <>
      <PageHeader eyebrow={isTeacher ? "Evaluator mode" : "Classes"} title={isTeacher ? "Your classes" : "My classes"}
        action={<form action={setRole}><input type="hidden" name="role" value={isTeacher ? "learner" : "teacher"} /><button className="btn btn-sm">{isTeacher ? "Switch to learner view" : "Enable evaluator mode"}</button></form>} />

      {!isTeacher && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="space-y-3">
            {!myAssignments.length && <p className="card p-6 text-sm text-muted">No assignments yet. Join your teacher&rsquo;s class with the code they share.</p>}
            {myAssignments.map(({ a, mTitle }) => (
              <Link key={a.id} href={a.kind === "quiz" ? `/quiz?material=${a.materialId}` : `/materials/${a.materialId}`} className="card card-hover flex items-center gap-4 p-4">
                <CalendarClock size={18} className="text-saffron" />
                <div className="min-w-0 flex-1"><p className="font-medium">{a.title}</p><p className="text-xs text-muted">{mTitle} · {joined.find((j) => j.c.id === a.classId)?.c.name}</p></div>
                {a.dueDate && <span className="chip">Due {a.dueDate}</span>}
              </Link>
            ))}
          </section>
          <aside className="card h-fit p-5">
            <p className="font-medium">Join a class</p>
            <form action={joinClass} className="mt-3 flex gap-2"><input name="code" className="input uppercase" placeholder="Class code" required /><button className="btn btn-primary">Join</button></form>
            {joined.map((j) => <p key={j.c.id} className="mt-3 text-sm"><School size={14} className="mr-1.5 inline text-iris" />{j.c.name} <span className="text-muted">· {j.teacher}</span></p>)}
            <p className="mt-4 flex gap-2 text-xs text-dim"><Shield size={14} className="shrink-0" /> Teachers see mastery and weak concepts on assigned material only. Your chats with the AI teacher are never stored or shared.</p>
          </aside>
        </div>
      )}

      {isTeacher && (
        <div className="space-y-8">
          <form action={createClass} className="card flex flex-col gap-2 p-4 sm:flex-row"><input name="name" className="input" placeholder="New class name, e.g. Physics 11-B" required /><button className="btn btn-primary shrink-0">Create class</button></form>
          {!myMaterials.length && <p className="text-sm text-muted">Upload material first — then assign chapters or quizzes to a class. <Link href="/upload" className="text-saffron">Upload</Link></p>}
          {await Promise.all(classes.map(async (c) => {
            const students = await db.select({ id: users.id, name: users.name }).from(classMembers).innerJoin(users, eq(users.id, classMembers.userId)).where(eq(classMembers.classId, c.id));
            const as = await db.select().from(assignments).where(eq(assignments.classId, c.id)).orderBy(desc(assignments.createdAt));
            const matIds = [...new Set(as.map((a) => a.materialId!).filter(Boolean))];
            const cs = matIds.length ? await db.select().from(concepts).where(inArray(concepts.materialId, matIds)) : [];
            const ms = cs.length && students.length ? await db.select().from(mastery).where(and(inArray(mastery.conceptId, cs.map((x) => x.id)), inArray(mastery.userId, students.map((s) => s.id)))) : [];
            const avgFor = (sid: string) => cs.length ? cs.reduce((n, x) => n + (ms.find((m) => m.userId === sid && m.conceptId === x.id)?.score ?? 0), 0) / cs.length : 0;
            const weak = cs.map((x) => ({ name: x.name, avg: students.length ? students.reduce((n, s) => n + (ms.find((m) => m.userId === s.id && m.conceptId === x.id)?.score ?? 0), 0) / students.length : 0 })).sort((a, b) => a.avg - b.avg).slice(0, 5);
            return (
              <section key={c.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-3xl">{c.name}</h2><p className="text-sm text-muted">Invite code <b className="font-mono text-lg tracking-widest text-saffron">{c.code}</b> · {students.length} students</p></div>
                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="eyebrow mb-2">Student mastery</p>
                    {!students.length ? <p className="text-sm text-muted">Share the code with students to invite them.</p> : students.map((s) => { const v = avgFor(s.id); return (
                      <div key={s.id} className="flex items-center gap-3 py-1.5 text-sm"><span className="flex-1 truncate">{s.name}</span><div className="h-1.5 w-28 rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${v}%`, background: toneColor(v) }} /></div><span className="w-10 text-right tabular-nums text-muted">{Math.round(v)}%</span></div>); })}
                    {weak.length > 0 && students.length > 0 && <><p className="eyebrow mb-2 mt-5">Class weak concepts</p><div className="flex flex-wrap gap-1.5">{weak.map((w) => <span key={w.name} className="chip" style={{ color: toneColor(w.avg) }}>{w.name} · {Math.round(w.avg)}%</span>)}</div></>}
                  </div>
                  <div>
                    <p className="eyebrow mb-2">Assignments</p>
                    {as.map((a) => <p key={a.id} className="flex justify-between gap-2 border-b hairline py-2 text-sm"><span className="truncate">{a.title}</span><span className="shrink-0 text-xs text-muted">{a.kind}{a.dueDate ? ` · due ${a.dueDate}` : ""}</span></p>)}
                    {myMaterials.length > 0 && (
                      <form action={createAssignment} className="mt-3 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="classId" value={c.id} />
                        <select name="materialId" className="input" required aria-label="Material">{myMaterials.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
                        <select name="chapterId" className="input" aria-label="Chapter"><option value="">Whole material</option>{myChapters.map((ch) => <option key={ch.id} value={ch.id}>{myMaterials.find((m) => m.id === ch.materialId)?.title.slice(0, 16)} · {ch.title}</option>)}</select>
                        <select name="kind" className="input" aria-label="Type"><option value="chapter">Study chapter</option><option value="quiz">Quiz</option></select>
                        <input type="date" name="dueDate" className="input" aria-label="Deadline" />
                        <input name="title" className="input sm:col-span-2" placeholder="Title (optional)" />
                        <button className="btn btn-primary sm:col-span-2">Assign</button>
                      </form>
                    )}
                  </div>
                </div>
              </section>
            );
          }))}
        </div>
      )}
    </>
  );
}
