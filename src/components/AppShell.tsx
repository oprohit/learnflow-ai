"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home, GraduationCap, Library, CalendarDays, BarChart3, Users, Trophy, MessageCircle, User, Bell, Plus, LayoutGrid, X, Layers, School, RotateCcw,
} from "lucide-react";
import { Logo } from "@/components/ui";

const DESKTOP = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/library", label: "Library", icon: Library },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/community", label: "Community", icon: Users },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/teacher", label: "Classes", icon: School },
  { href: "/profile", label: "Profile", icon: User },
];
const MOBILE = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/library", label: "Library", icon: Library },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];
const MORE = [
  { href: "/plan", label: "Study plan", icon: CalendarDays },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/revision", label: "Revision", icon: RotateCcw },
  { href: "/community", label: "Community", icon: Users },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/teacher", label: "Classes", icon: School },
  { href: "/upload", label: "Upload", icon: Plus },
];

export default function AppShell({ children, name, unread, focus = false }: { children: ReactNode; name: string; unread: number; focus?: boolean }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const active = (href: string) => path === href || (href !== "/dashboard" && path.startsWith(href)) || (href === "/learn" && path.startsWith("/learn"));
  const isLesson = path.startsWith("/learn/") || path.startsWith("/quiz");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r hairline bg-ink-2/60 px-4 py-6 lg:flex">
        <div className="px-2"><Logo /></div>
        <Link href="/upload" className="btn btn-primary mt-7 w-full"><Plus size={18} /> Upload material</Link>
        <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto scroll-thin" aria-label="Main">
          {DESKTOP.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${active(href) ? "bg-white/[0.07] text-paper" : "text-muted hover:bg-white/[0.04] hover:text-paper"}`}>
              <Icon size={18} strokeWidth={1.8} /> {label}
            </Link>
          ))}
        </nav>
        <Link href="/notifications" className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-white/[0.04] hover:text-paper">
          <Bell size={18} strokeWidth={1.8} /> Notifications {unread > 0 && <span className="ml-auto rounded-full bg-saffron px-1.5 text-[0.7rem] font-bold text-ink">{unread}</span>}
        </Link>
        <div className="mt-3 flex items-center gap-3 border-t hairline px-2 pt-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-iris/20 font-semibold text-iris">{name.charAt(0).toUpperCase()}</span>
          <span className="truncate text-sm">{name}</span>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Mobile top bar */}
        {!focus && !isLesson && (
          <header className="sticky top-0 z-30 border-b hairline bg-ink/85 pt-safe backdrop-blur-lg lg:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <Logo />
              <div className="flex items-center gap-1">
                <Link href="/notifications" className="relative grid h-11 w-11 place-items-center rounded-lg text-muted" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
                  <Bell size={20} />
                  {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-saffron" />}
                </Link>
                <button className="grid h-11 w-11 place-items-center rounded-lg text-muted" onClick={() => setMore(true)} aria-label="More sections"><LayoutGrid size={20} /></button>
              </div>
            </div>
          </header>
        )}
        <main className={`mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10 ${isLesson ? "pb-safe lg:pb-10" : "pb-nav"}`}>{children}</main>
      </div>

      {/* Mobile bottom nav */}
      {!isLesson && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-ink/92 pb-safe backdrop-blur-lg lg:hidden" aria-label="Main">
          <div className="mx-auto grid h-[68px] max-w-md grid-cols-5">
            {MOBILE.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-[0.68rem] font-medium ${active(href) ? "text-saffron" : "text-muted"}`}>
                <Icon size={21} strokeWidth={active(href) ? 2.2 : 1.8} /> {label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* Mobile "more" sheet */}
      {more && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More sections">
          <button className="absolute inset-0 bg-black/60 animate-fade" onClick={() => setMore(false)} aria-label="Close" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t hairline bg-ink-2 p-5 pb-safe animate-rise">
            <div className="mb-4 flex items-center justify-between"><p className="font-display text-2xl">Everything</p>
              <button className="grid h-11 w-11 place-items-center" onClick={() => setMore(false)} aria-label="Close"><X size={20} /></button></div>
            <div className="grid grid-cols-3 gap-2 pb-4">
              {MORE.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="card flex flex-col items-center gap-2 px-2 py-4 text-center text-xs"><Icon size={20} className="text-saffron" />{label}</Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
