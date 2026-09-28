"use client";
import { Languages } from "lucide-react";
import { LANGUAGES } from "@/lib/constants";

export default function LanguageSelect({ value, onChange, preferred = [], compact = false, id = "lang" }: {
  value: string; onChange: (code: string) => void; preferred?: (string | null | undefined)[]; compact?: boolean; id?: string;
}) {
  const pref = preferred.filter(Boolean) as string[];
  const ordered = [...LANGUAGES.filter((l) => pref.includes(l.code)), ...LANGUAGES.filter((l) => !pref.includes(l.code))];
  return (
    <label htmlFor={id} className="relative inline-flex items-center">
      <span className="sr-only">Lesson language</span>
      <Languages size={16} className="pointer-events-none absolute left-3 text-saffron" aria-hidden />
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-lg border border-line-2 bg-ink-3 pl-9 pr-8 font-medium text-paper hover:border-saffron/60 focus:border-saffron focus:outline-none ${compact ? "h-10 text-sm" : "h-11 text-sm"}`}>
        {ordered.map((l) => <option key={l.code} value={l.code}>{l.native}{l.native !== l.name ? ` · ${l.name}` : ""}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 text-xs text-muted" aria-hidden>▼</span>
    </label>
  );
}
