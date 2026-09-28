import Link from "next/link";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Heart, MessageSquare, Lock, Users } from "lucide-react";
import { db } from "@/db";
import { communities, communityMembers, concepts, posts, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureCommunities } from "@/lib/social";
import { accessibleMaterialIds } from "@/lib/teach";
import { createCommunity, createPost, joinCommunity, leaveCommunity, markHelpful } from "@/app/actions/social";
import { PageHeader, timeAgo } from "@/components/ui";

export const metadata = { title: "Community · LearnFlow AI" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { discussion: "Discussion", question: "Question", explanation: "Concept explanation", score: "Quiz score", challenge: "Study challenge" };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireUser();
  await ensureCommunities();
  const { c } = await searchParams;
  const all = await db.select({ c: communities, members: sql<number>`(select count(*)::int from community_members m where m.community_id = ${communities.id})` }).from(communities).orderBy(communities.createdAt);
  const mine = new Set((await db.select().from(communityMembers).where(eq(communityMembers.userId, user.id))).map((m) => m.communityId));
  const active = all.find((x) => x.c.slug === c || x.c.id === c)?.c ?? all.find((x) => mine.has(x.c.id))?.c ?? all[0]?.c;
  const feed = active ? await db.select({ p: posts, name: users.name, handle: users.handle }).from(posts).innerJoin(users, eq(users.id, posts.userId))
    .where(and(eq(posts.communityId, active.id), isNull(posts.parentId))).orderBy(desc(posts.createdAt)).limit(40) : [];
  const replies = feed.length ? await db.select({ p: posts, name: users.name }).from(posts).innerJoin(users, eq(users.id, posts.userId))
    .where(inArray(posts.parentId, feed.map((f) => f.p.id))).orderBy(posts.createdAt) : [];
  const matIds = await accessibleMaterialIds(user.id);
  const myConcepts = matIds.length ? await db.select({ id: concepts.id, name: concepts.name }).from(concepts).where(inArray(concepts.materialId, matIds)).limit(60) : [];
  const isMember = active && mine.has(active.id);

  return (
    <>
      <PageHeader eyebrow="Learn together" title="Community" subtitle={<span className="inline-flex items-center gap-1.5"><Lock size={13} /> Your uploaded books stay private. Only what you choose to post is shared.</span>} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-1.5 lg:px-0">
            {all.map(({ c: x, members }) => (
              <Link key={x.id} href={`/community?c=${x.slug}`} className={`block shrink-0 rounded-xl border px-4 py-3 lg:w-full ${active?.id === x.id ? "border-saffron/50 bg-saffron/[0.06]" : "border-line hover:border-line-2"}`}>
                <p className="text-sm font-medium">{x.name}</p><p className="text-xs text-muted"><Users size={11} className="mr-1 inline" />{members} · {mine.has(x.id) ? "Joined" : "Open"}</p>
              </Link>
            ))}
          </div>
          <details className="card hidden p-4 lg:block">
            <summary className="cursor-pointer text-sm font-semibold">Create a community</summary>
            <form action={createCommunity} className="mt-3 space-y-2"><input name="name" className="input" placeholder="Name" required /><input name="description" className="input" placeholder="What's it for?" /><button className="btn btn-sm w-full">Create</button></form>
          </details>
        </aside>

        {active && (
          <section className="min-w-0">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><h2 className="font-display text-3xl">{active.name}</h2><p className="text-sm text-muted">{active.description}</p></div>
              <form action={isMember ? leaveCommunity : joinCommunity}><input type="hidden" name="communityId" value={active.id} /><button className={`btn btn-sm ${isMember ? "" : "btn-primary"}`}>{isMember ? "Leave" : "Join"}</button></form>
            </div>
            {isMember ? (
              <form action={createPost} className="card mb-6 space-y-3 p-4">
                <input type="hidden" name="communityId" value={active.id} />
                <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                  <select name="kind" className="input" aria-label="Post type">{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input name="title" className="input" placeholder="Title (optional)" />
                </div>
                <textarea name="body" required className="input min-h-24" placeholder="Ask a question, explain a concept, or start a study challenge…" />
                <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <select name="conceptId" className="input" aria-label="Attach a concept"><option value="">Attach a concept explanation (optional)</option>{myConcepts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  <input name="score" className="input" placeholder="Score e.g. 8/10" />
                  <button className="btn btn-primary">Post</button>
                </div>
              </form>
            ) : <p className="card mb-6 p-4 text-sm text-muted">Join to post and reply.</p>}

            <div className="space-y-3">
              {!feed.length && <p className="text-sm text-muted">No posts yet — start the first discussion.</p>}
              {feed.map(({ p, name, handle }) => {
                const meta = p.meta as { concept?: { name: string; definition: string }; score?: string };
                const rs = replies.filter((r) => r.p.parentId === p.id);
                return (
                  <article key={p.id} className="card p-4">
                    <div className="flex items-center gap-2 text-xs text-muted"><span className="grid h-7 w-7 place-items-center rounded-full bg-iris/20 text-[0.7rem] font-bold text-iris">{name[0]}</span><b className="text-paper">{name}</b><span>@{handle}</span><span>· {timeAgo(p.createdAt)}</span><span className="chip ml-auto py-0.5">{KIND_LABEL[p.kind] ?? p.kind}</span></div>
                    {p.title && <p className="mt-3 font-medium">{p.title}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
                    {meta.concept && <div className="mt-3 rounded-lg border-l-2 border-iris bg-iris/[0.06] p-3 text-sm"><p className="font-semibold">{meta.concept.name}</p><p className="text-muted">{meta.concept.definition}</p></div>}
                    {meta.score && <p className="mt-3 inline-block rounded-lg bg-sage/10 px-3 py-1.5 text-sm text-sage">Quiz score: {meta.score}</p>}
                    <div className="mt-3 flex items-center gap-2">
                      <form action={markHelpful}><input type="hidden" name="postId" value={p.id} /><button className="btn btn-sm btn-ghost text-muted" disabled={p.userId === user.id}><Heart size={14} /> Helpful · {p.helpful}</button></form>
                      <span className="text-xs text-dim"><MessageSquare size={12} className="mr-1 inline" />{rs.length}</span>
                    </div>
                    {rs.length > 0 && <div className="mt-2 space-y-2 border-l hairline pl-4">{rs.map((r) => <p key={r.p.id} className="text-sm"><b>{r.name}</b> <span className="text-muted">{r.p.body}</span></p>)}</div>}
                    {isMember && (
                      <form action={createPost} className="mt-3 flex gap-2"><input type="hidden" name="communityId" value={active.id} /><input type="hidden" name="parentId" value={p.id} /><input type="hidden" name="kind" value="discussion" />
                        <input name="body" className="input min-h-10 py-2 text-sm" placeholder="Reply…" required /><button className="btn btn-sm">Reply</button></form>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
