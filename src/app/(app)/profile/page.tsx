import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { LogOut, Cpu, CheckCircle2, XCircle, CalendarDays, Layers, RotateCcw, Users, Trophy, MessageCircle, School } from "lucide-react";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { aiStatus } from "@/lib/ai/provider";
import { EDUCATION_LEVELS, GOALS, LANGUAGES, STYLES } from "@/lib/constants";
import { signOut } from "@/app/actions/auth";
import { updateAccessibility, updateProfile } from "@/app/actions/social";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Profile · LearnFlow AI" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const status = aiStatus();
  const usage = await db.select({
    operation: aiUsage.operation,
    calls: sql<number>`sum(case when not ${aiUsage.cached} then 1 else 0 end)::int`,
    hits: sql<number>`sum(case when ${aiUsage.cached} then 1 else 0 end)::int`,
    failed: sql<number>`sum(case when not ${aiUsage.ok} then 1 else 0 end)::int`,
    tokens: sql<number>`coalesce(sum(${aiUsage.tokensIn} + ${aiUsage.tokensOut}),0)::int`,
  }).from(aiUsage).where(eq(aiUsage.userId, user.id)).groupBy(aiUsage.operation).orderBy(desc(sql`count(*)`));
  const a = user.accessibility ?? {};

  return (
    <>
      <PageHeader eyebrow={`@${user.handle ?? "learner"} · ${user.email}`} title={user.name} action={<form action={signOut}><button className="btn btn-sm"><LogOut size={15} /> Sign out</button></form>} />

      <div className="mb-8 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:hidden">
        {[["/plan", "Plan", CalendarDays], ["/flashcards", "Cards", Layers], ["/revision", "Revise", RotateCcw], ["/community", "Community", Users], ["/leaderboard", "Ranks", Trophy], ["/messages", "Messages", MessageCircle], ["/teacher", "Classes", School]].map(([href, label, Icon]) => {
          const I = Icon as typeof Users;
          return <Link key={href as string} href={href as string} className="card flex flex-col items-center gap-1.5 py-3 text-xs"><I size={18} className="text-saffron" />{label as string}</Link>;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={updateProfile} className="card space-y-4 p-5">
          <p className="font-display text-2xl">Learning preferences</p>
          <label className="block"><span className="mb-1.5 block text-sm">Name</span><input name="name" defaultValue={user.name} className="input" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm">Primary language</span>
              <select name="primaryLanguage" defaultValue={user.primaryLanguage} className="input">{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} · {l.name}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm">Secondary language</span>
              <select name="secondaryLanguage" defaultValue={user.secondaryLanguage ?? ""} className="input"><option value="">None</option>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} · {l.name}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm">Education level</span>
              <select name="educationLevel" defaultValue={user.educationLevel ?? ""} className="input">{EDUCATION_LEVELS.map((e) => <option key={e}>{e}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm">Goal</span>
              <select name="learningGoal" defaultValue={user.learningGoal ?? ""} className="input">{GOALS.map((g) => <option key={g}>{g}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm">Teaching style</span>
              <select name="teachingStyle" defaultValue={user.teachingStyle ?? "adaptive"} className="input">{STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm">Daily minutes</span><input type="number" min={5} max={240} name="dailyMinutes" defaultValue={user.dailyMinutes} className="input" /></label>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="shareProgress" defaultChecked={user.shareProgress} className="h-5 w-5 accent-[#F4B860]" /> Share my progress with friends &amp; leaderboards</label>
          <p className="text-xs text-dim">You can also switch language inside any lesson, quiz or chat — your place is always kept.</p>
          <button className="btn btn-primary">Save preferences</button>
        </form>

        <div className="space-y-6">
          <form action={updateAccessibility} className="card space-y-1 p-5">
            <p className="font-display text-2xl">Accessibility</p>
            <p className="pb-2 text-xs text-muted">These also change how your teacher explains things.</p>
            {[
              ["largeText", "Large text", a.largeText], ["highContrast", "High contrast", a.highContrast], ["reducedMotion", "Reduced motion", a.reducedMotion],
              ["simplified", "Simplified language (shorter, plainer lessons)", a.simplified], ["audioFirst", "Prefer audio explanations", a.audioFirst],
            ].map(([k, label, on]) => (
              <label key={k as string} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name={k as string} defaultChecked={!!on} className="h-5 w-5 accent-[#F4B860]" /> {label as string}</label>
            ))}
            <button className="btn mt-2">Apply</button>
          </form>

          <section className="card p-5">
            <p className="flex items-center gap-2 font-display text-2xl"><Cpu size={18} className="text-iris" /> AI teacher status</p>
            <p className="mt-1 text-xs text-muted">Gemini (free tier) is the only external AI. Everything works offline from saved content; new lessons use on-device templates when AI is unavailable.</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {status.capabilities.map((c) => (
                <li key={c.capability} className="flex items-center gap-2">{c.available ? <CheckCircle2 size={15} className="text-sage" /> : <XCircle size={15} className="text-dim" />}
                  <span className="w-14 capitalize">{c.capability}</span><span className="truncate font-mono text-xs text-muted">{c.model}</span>
                  {!c.available && <span className="ml-auto truncate text-xs text-dim">{c.capability === "tts" ? "→ device voice" : c.capability === "image" ? "→ SVG diagrams" : "→ cached / on-device"}</span>}</li>
              ))}
            </ul>
            <p className="mt-4 eyebrow">Your AI usage</p>
            {usage.length ? (
              <table className="mt-2 w-full text-left text-xs"><thead className="text-dim"><tr><th className="py-1 font-medium">Operation</th><th className="font-medium">Calls</th><th className="font-medium">Cache hits</th><th className="font-medium">Tokens</th></tr></thead>
                <tbody>{usage.map((u) => <tr key={u.operation} className="border-t hairline"><td className="py-1.5">{u.operation}</td><td className="tabular-nums">{u.calls}{u.failed ? <span className="text-coral"> ({u.failed}✕)</span> : ""}</td><td className="tabular-nums text-sage">{u.hits}</td><td className="tabular-nums text-muted">{u.tokens}</td></tr>)}</tbody></table>
            ) : <p className="mt-1 text-xs text-muted">No AI calls yet.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
