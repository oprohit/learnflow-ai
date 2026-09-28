import Link from "next/link";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Trophy, Flame } from "lucide-react";
import { db } from "@/db";
import { communities, communityMembers, materials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureCommunities, leaderboard } from "@/lib/social";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Leaderboard · LearnFlow AI" };
export const dynamic = "force-dynamic";

const TABS = [{ id: "global", label: "Global" }, { id: "weekly", label: "Weekly" }, { id: "community", label: "Community" }, { id: "book", label: "Per-book" }];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; c?: string; b?: string }> }) {
  const user = await requireUser();
  await ensureCommunities();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "global";
  const myCommunities = await db.select({ id: communities.id, name: communities.name }).from(communities).innerJoin(communityMembers, eq(communityMembers.communityId, communities.id)).where(eq(communityMembers.userId, user.id));
  const myBooks = await db.select({ id: materials.id, title: materials.title }).from(materials).where(and(eq(materials.userId, user.id), eq(materials.status, "ready")));
  let scope: string[] | null = null;
  let since: Date | undefined;
  let context = "";
  if (tab === "weekly") since = new Date(Date.now() - 7 * 86400_000);
  if (tab === "community") {
    const c = myCommunities.find((x) => x.id === sp.c) ?? myCommunities[0];
    context = c?.name ?? "";
    scope = c ? (await db.select({ id: communityMembers.userId }).from(communityMembers).where(eq(communityMembers.communityId, c.id))).map((r) => r.id) : [];
  }
  if (tab === "book") {
    const b = myBooks.find((x) => x.id === sp.b) ?? myBooks[0];
    context = b?.title ?? "";
    // Books are private; learners of the same title are grouped without exposing anyone's file.
    scope = b ? (await db.selectDistinct({ id: materials.userId }).from(materials).where(sql`lower(${materials.title}) = lower(${b.title})`)).map((r) => r.id) : [];
  }
  const rows = (await leaderboard(scope, since)).filter((r) => r.shareProgress || r.id === user.id);
  const meIdx = rows.findIndex((r) => r.id === user.id);
  void inArray;

  return (
    <>
      <PageHeader eyebrow="Rewards mastery, accuracy, completion and helpful answers — never spam or AI usage" title="Leaderboard" />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => <Link key={t.id} href={`/leaderboard?tab=${t.id}`} className={`h-10 shrink-0 content-center rounded-full border px-4 text-sm font-semibold ${tab === t.id ? "border-saffron bg-saffron text-ink" : "border-line text-muted"}`}>{t.label}</Link>)}
      </div>
      {tab === "community" && myCommunities.length > 1 && <div className="mb-4 flex flex-wrap gap-1.5">{myCommunities.map((c) => <Link key={c.id} href={`/leaderboard?tab=community&c=${c.id}`} className={`chip ${context === c.name ? "text-paper border-line-2" : ""}`}>{c.name}</Link>)}</div>}
      {tab === "book" && myBooks.length > 1 && <div className="mb-4 flex flex-wrap gap-1.5">{myBooks.map((b) => <Link key={b.id} href={`/leaderboard?tab=book&b=${b.id}`} className={`chip ${context === b.title ? "text-paper border-line-2" : ""}`}>{b.title}</Link>)}</div>}
      {context && <p className="mb-4 text-sm text-muted">{context}</p>}
      {!rows.length ? <Empty title="No rankings yet" body={tab === "community" ? "Join a community to compete with classmates." : "Complete lessons and quizzes to appear here."} /> : (
        <ol className="card divide-y divide-white/5">
          {rows.slice(0, 50).map((r, i) => (
            <li key={r.id} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 ${r.id === user.id ? "bg-saffron/[0.06]" : ""}`}>
              <span className={`font-display text-2xl ${i < 3 ? "text-saffron" : "text-dim"}`}>{i < 3 ? <Trophy size={20} /> : i + 1}</span>
              <div className="min-w-0"><p className="truncate font-medium">{r.name}{r.id === user.id && <span className="ml-2 text-xs text-saffron">You</span>}</p>
                <p className="truncate text-xs text-muted">{r.strong} mastered · {r.correct} correct · {r.lessons} lessons · {r.helpful} helpful <Flame size={11} className="ml-1 inline text-saffron" />{r.streak}</p></div>
              <span className="font-display text-2xl tabular-nums">{r.points}</span>
            </li>
          ))}
        </ol>
      )}
      {meIdx >= 50 && <p className="mt-3 text-sm text-muted">You&rsquo;re #{meIdx + 1} with {rows[meIdx].points} points.</p>}
    </>
  );
}
