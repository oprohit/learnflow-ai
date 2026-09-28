import Link from "next/link";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { ArrowLeft, Check, UserPlus, X, Send, Swords, BookOpen } from "lucide-react";
import { db } from "@/db";
import { concepts, friends, mastery, messages, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { accessibleMaterialIds } from "@/lib/teach";
import { respondFriend, sendFriendRequest, sendMessage } from "@/app/actions/social";
import { PageHeader, timeAgo } from "@/components/ui";

export const metadata = { title: "Messages · LearnFlow AI" };
export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const rels = await db.select().from(friends).where(or(eq(friends.requesterId, user.id), eq(friends.addresseeId, user.id)));
  const otherIds = rels.map((r) => (r.requesterId === user.id ? r.addresseeId : r.requesterId));
  const people = otherIds.length ? await db.select({ id: users.id, name: users.name, handle: users.handle, shareProgress: users.shareProgress, streak: users.streak, xp: users.xp }).from(users).where(inArray(users.id, otherIds)) : [];
  const person = (id: string) => people.find((p) => p.id === id);
  const accepted = rels.filter((r) => r.status === "accepted");
  const incoming = rels.filter((r) => r.status === "pending" && r.addresseeId === user.id);
  const outgoing = rels.filter((r) => r.status === "pending" && r.requesterId === user.id);
  const withId = sp.with && accepted.some((r) => r.requesterId === sp.with || r.addresseeId === sp.with) ? sp.with : undefined;
  const convo = withId ? await db.select().from(messages).where(or(and(eq(messages.fromId, user.id), eq(messages.toId, withId)), and(eq(messages.fromId, withId), eq(messages.toId, user.id)))).orderBy(asc(messages.createdAt)).limit(200) : [];
  if (withId) await db.update(messages).set({ readAt: new Date() }).where(and(eq(messages.fromId, withId), eq(messages.toId, user.id), isNull(messages.readAt)));
  const matIds = await accessibleMaterialIds(user.id);
  const myConcepts = matIds.length ? await db.select({ id: concepts.id, name: concepts.name }).from(concepts).where(inArray(concepts.materialId, matIds)).limit(80) : [];
  const friendProgress = withId && person(withId)?.shareProgress ? await db.select({ score: mastery.score }).from(mastery).where(eq(mastery.userId, withId)) : null;
  const other = withId ? person(withId) : undefined;

  return (
    <>
      {!withId && <PageHeader eyebrow="Study with friends" title="Messages" />}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className={`space-y-5 ${withId ? "hidden lg:block" : ""}`}>
          <form action={sendFriendRequest} className="flex gap-2"><input name="query" className="input" placeholder="Add by @handle or email" aria-label="Find a friend" required /><button className="btn shrink-0" aria-label="Send request"><UserPlus size={17} /></button></form>
          <p className="-mt-3 text-xs text-dim">Your handle: <b className="text-muted">@{user.handle}</b></p>
          {incoming.length > 0 && (
            <div><p className="eyebrow mb-2">Requests</p>
              {incoming.map((r) => (
                <div key={r.id} className="card mb-2 flex items-center gap-2 p-3"><span className="flex-1 truncate text-sm">{person(r.requesterId)?.name}</span>
                  <form action={respondFriend}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="accept" value="1" /><button className="btn btn-sm text-sage" aria-label="Accept"><Check size={15} /></button></form>
                  <form action={respondFriend}><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm text-coral" aria-label="Decline"><X size={15} /></button></form></div>
              ))}</div>
          )}
          <div><p className="eyebrow mb-2">Friends</p>
            {!accepted.length && <p className="text-sm text-muted">Add a classmate to share concepts and challenges.</p>}
            {accepted.map((r) => { const id = r.requesterId === user.id ? r.addresseeId : r.requesterId; const p = person(id); return (
              <div key={r.id} className={`mb-1.5 flex items-center gap-2 rounded-xl border px-3 py-2.5 ${withId === id ? "border-saffron/50 bg-saffron/[0.05]" : "border-line"}`}>
                <Link href={`/messages?with=${id}`} className="flex min-w-0 flex-1 items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-iris/20 text-xs font-bold text-iris">{p?.name[0]}</span><span className="min-w-0"><span className="block truncate text-sm">{p?.name}</span><span className="text-xs text-dim">@{p?.handle}</span></span></Link>
                <form action={respondFriend}><input type="hidden" name="id" value={r.id} /><button className="grid h-9 w-9 place-items-center text-dim hover:text-coral" aria-label={`Remove ${p?.name}`}><X size={14} /></button></form>
              </div>); })}
          </div>
          {outgoing.length > 0 && <p className="text-xs text-dim">Pending: {outgoing.map((r) => person(r.addresseeId)?.name).join(", ")}</p>}
        </aside>

        {withId && other ? (
          <section className="flex min-h-[70dvh] flex-col">
            <div className="mb-3 flex items-center gap-3 border-b hairline pb-3">
              <Link href="/messages" className="grid h-10 w-10 place-items-center lg:hidden" aria-label="Back"><ArrowLeft size={19} /></Link>
              <div className="min-w-0 flex-1"><p className="font-display text-2xl">{other.name}</p>
                <p className="text-xs text-muted">{friendProgress ? `${friendProgress.filter((m) => m.score >= 75).length} concepts mastered · ${other.streak}-day streak` : "Progress is private"}</p></div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {convo.map((m) => { const mine = m.fromId === user.id; const a = m.attachment as { type: string; name: string; definition: string } | null; return (
                <div key={m.id} className={`max-w-[85%] ${mine ? "ml-auto" : ""}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${mine ? "rounded-br-sm bg-iris/20" : "rounded-bl-sm bg-white/[0.05]"}`}>
                    <p>{m.body}</p>
                    {a && <div className="mt-2 rounded-lg border hairline bg-ink/40 p-2.5"><p className="flex items-center gap-1.5 text-xs font-semibold text-saffron">{a.type === "challenge" ? <Swords size={12} /> : <BookOpen size={12} />}{a.type === "challenge" ? "Study challenge · reach 75%" : a.type === "quiz" ? "Quiz invite" : "Concept"}</p><p className="mt-1 font-medium">{a.name}</p><p className="text-xs text-muted">{a.definition}</p></div>}
                  </div>
                  <p className={`mt-0.5 text-[0.65rem] text-dim ${mine ? "text-right" : ""}`}>{timeAgo(m.createdAt)}</p>
                </div>); })}
              {!convo.length && <p className="py-10 text-center text-sm text-muted">Say hi, share a concept, or send a study challenge.</p>}
            </div>
            <form action={sendMessage} className="sticky bottom-0 mt-3 space-y-2 border-t hairline bg-ink pt-3 pb-safe">
              <input type="hidden" name="toId" value={withId} />
              <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr]">
                <select name="conceptId" className="input min-h-10 py-2 text-sm" aria-label="Concept to share"><option value="">Attach a concept…</option>{myConcepts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select name="share" className="input min-h-10 py-2 text-sm" aria-label="Share as"><option value="concept">Share concept</option><option value="quiz">Quiz invite</option><option value="challenge">Study challenge</option></select>
              </div>
              <div className="flex gap-2"><input name="body" className="input" placeholder="Message" aria-label="Message" /><button className="btn btn-primary shrink-0" aria-label="Send"><Send size={17} /></button></div>
            </form>
          </section>
        ) : <section className="hidden place-items-center text-sm text-muted lg:grid">Select a friend to start a conversation.</section>}
      </div>
    </>
  );
}
