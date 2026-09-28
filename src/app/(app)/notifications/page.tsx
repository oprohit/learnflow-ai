import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell, Zap, Trophy, UserPlus, BookOpen, Swords, MessageSquare, CalendarClock } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { markAllRead } from "@/app/actions/social";
import { Empty, PageHeader, timeAgo } from "@/components/ui";

export const metadata = { title: "Notifications · LearnFlow AI" };
export const dynamic = "force-dynamic";
const ICON: Record<string, typeof Bell> = { surprise: Zap, milestone: Trophy, friend: UserPlus, lesson: BookOpen, challenge: Swords, community: MessageSquare, assignment: CalendarClock, reminder: Bell };

export default async function Page() {
  const user = await requireUser();
  const list = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(60);
  return (<>
    <PageHeader title="Notifications" action={list.some((n) => !n.readAt) ? <form action={markAllRead}><button className="btn btn-sm">Mark all read</button></form> : undefined} />
    {!list.length ? <Empty title="All quiet" body="Study reminders, surprise quizzes, milestones, assignments and friend activity will appear here." /> : (
      <ul className="card divide-y divide-white/5">
        {list.map((n) => { const I = ICON[n.kind] ?? Bell; return (
          <li key={n.id}><Link href={n.href ?? "#"} className={`flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.02] ${n.readAt ? "opacity-60" : ""}`}>
            <I size={18} className="mt-0.5 shrink-0 text-saffron" />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{n.title}</p>{n.body && <p className="text-xs text-muted">{n.body}</p>}</div>
            <span className="shrink-0 text-xs text-dim">{timeAgo(n.createdAt)}</span>
            {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-saffron" aria-label="Unread" />}
          </Link></li>); })}
      </ul>
    )}
  </>);
}
