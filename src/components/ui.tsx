import Link from "next/link";
import type { ReactNode } from "react";
import { masteryBand } from "@/lib/constants";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="LearnFlow AI home">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#161636" stroke="rgba(255,255,255,.14)" />
        <path d="M9 9v14h9" stroke="#F4B860" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M14 18c3-6 6-8 10-9" stroke="#8C83FF" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="24" cy="9" r="2" fill="#8C83FF" />
      </svg>
      {!compact && <span className="font-display text-[1.35rem] leading-none">LearnFlow<span className="text-saffron"> AI</span></span>}
    </Link>
  );
}

export function ProgressBar({ value, tone = "saffron", className = "" }: { value: number; tone?: "saffron" | "iris" | "sage" | "coral"; className?: string }) {
  const color = { saffron: "bg-saffron", iris: "bg-iris", sage: "bg-sage", coral: "bg-coral" }[tone];
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function toneColor(score: number, attempts = 1) {
  const t = masteryBand(score, attempts).tone;
  return t === "strong" ? "#7ED6A7" : t === "developing" ? "#F4B860" : t === "weak" ? "#FF8A7A" : "#6d6b8c";
}

export function MasteryRing({ value, size = 56, stroke = 5, label = true, attempts = 1 }: { value: number; size?: number; stroke?: number; label?: boolean; attempts?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} aria-label={`Mastery ${Math.round(value)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={toneColor(value, attempts)} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} style={{ transition: "stroke-dashoffset .8s" }} />
      </svg>
      {label && <span className="absolute text-[0.72rem] font-semibold tabular-nums">{Math.round(value)}%</span>}
    </div>
  );
}

export function MasteryBadge({ score, attempts = 1 }: { score: number; attempts?: number }) {
  const b = masteryBand(score, attempts);
  const cls = { strong: "text-sage border-sage/30", developing: "text-saffron border-saffron/30", weak: "text-coral border-coral/30", idle: "text-dim border-line" }[b.tone];
  return <span className={`chip ${cls}`}>{b.label}</span>;
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[2.1rem] leading-[1.05] sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[0.95rem] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card grid place-items-center gap-3 px-6 py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function timeAgo(d: Date | string | null | undefined) {
  if (!d) return "Never";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}
