"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, HelpCircle, Sparkles, Loader2, MessageSquare, X, Target, BookMarked, Lightbulb, Zap, ImageIcon, RefreshCw, AlertTriangle,
} from "lucide-react";
import FlowDiagram from "@/components/FlowDiagram";
import LanguageSelect from "@/components/LanguageSelect";
import AudioPlayer from "@/components/AudioPlayer";
import ChatPanel from "@/components/ChatPanel";
import { MasteryRing, ProgressBar } from "@/components/ui";
import { MODES, langName } from "@/lib/constants";
import type { LessonContent, NextStep } from "@/lib/types";

type Props = {
  concept: { id: string; name: string; sourcePage: number | null; sourceSection: string | null };
  chapter: string | null;
  objective: string | null;
  material: { id: string; title: string };
  position: { index: number; total: number };
  initial: { mode: string; language: string; step: number };
  languages: { primary: string; secondary: string | null };
  mastery: number;
  prerequisites: { id: string; name: string; score: number }[];
  fromConcept?: { id: string; name: string } | null;
  pendingSurprise?: { id: string; title: string } | null;
};

type CheckResult = { correct: boolean; answer: number; explanation: string; diagnosis: string | null; confusedWith: { id: string; name: string } | null; mastery: number; delta: number; next: NextStep | null };

const TEACH_MORE = [
  { mode: "simple", label: "Explain simpler" },
  { mode: "visual", label: "Explain visually" },
  { mode: "analogy", label: "Give an analogy" },
  { mode: "example", label: "Real-world example" },
  { mode: "advanced", label: "Go deeper" },
  { mode: "zero", label: "Teach from the beginning" },
];

export default function LessonView(p: Props) {
  const [mode, setMode] = useState(p.initial.mode);
  const [lang, setLang] = useState(p.initial.language);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [shownLang, setShownLang] = useState(p.initial.language);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState(Math.max(1, p.initial.step));
  const [note, setNote] = useState<{ text: string; tone: "iris" | "saffron" | "coral" } | null>(null);
  const [prereq, setPrereq] = useState<{ id: string; name: string; message: string } | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [mastery, setMastery] = useState(p.mastery);
  const [finish, setFinish] = useState<{ next: NextStep; surprise: { id: string; title: string; reason: string } | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [img, setImg] = useState<{ url?: string; reason?: string; loading?: boolean } | null>(null);
  const started = useRef(Date.now());
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (m: string, l: string) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/lesson?conceptId=${p.concept.id}&mode=${m}&lang=${l}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setContent(d.content); setShownLang(d.language); setNotice(d.notice ?? null);
      setStep((s) => Math.min(Math.max(1, s), d.content.sections.length));
    } catch {
      setError("Your AI teacher is temporarily unavailable. Your saved lessons are still accessible.");
    } finally { setLoading(false); }
  }, [p.concept.id]);

  useEffect(() => { void load(mode, lang); }, [mode, lang, load]);

  const total = content?.sections.length ?? 1;
  const allShown = step >= total;
  const progress = Math.round((Math.min(step, total) / total) * 80 + (check ? 20 : 0));

  // Persist lesson state (concept, mode, language, step, progress) — the invariant that survives language switches.
  useEffect(() => {
    if (!content) return;
    const t = setTimeout(() => {
      void fetch("/api/lesson", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conceptId: p.concept.id, mode, language: lang, step, progress, difficulty: mode === "advanced" ? "advanced" : ["simple", "zero", "steps"].includes(mode) ? "easier" : "standard" }) });
    }, 500);
    return () => clearTimeout(t);
  }, [content, mode, lang, step, progress, p.concept.id]);

  function switchLang(l: string) {
    if (l === lang) return;
    setLang(l);
    setNote({ text: `Continuing in ${langName(l)} — same concept, same objective, same place (${progress}%).`, tone: "iris" });
  }
  function switchMode(m: string, why?: string) {
    if (m === mode) return;
    setMode(m); setStep(1); setChosen(null); setCheck(null); setImg(null); setMore(false);
    if (why) setNote({ text: why, tone: "saffron" });
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function confused() {
    setBusy(true);
    try {
      const r = await fetch("/api/teach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confused", conceptId: p.concept.id, mode, language: lang }) });
      const d = await r.json();
      setPrereq(d.prerequisite);
      switchMode(d.strategy.mode, `${d.strategy.reason} (${d.strategy.label})`);
    } finally { setBusy(false); }
  }

  async function answer(i: number) {
    if (check || !content) return;
    setChosen(i); setBusy(true);
    try {
      const r = await fetch("/api/teach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "check", conceptId: p.concept.id, mode, language: lang, chosen: i }) });
      const d = (await r.json()) as CheckResult;
      setCheck(d); setMastery(d.mastery);
    } finally { setBusy(false); }
  }

  async function complete(understood = true) {
    setBusy(true);
    try {
      const minutes = (Date.now() - started.current) / 60000;
      const r = await fetch("/api/teach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: understood ? "understood" : "complete", conceptId: p.concept.id, minutes }) });
      const d = await r.json();
      setMastery(d.mastery); setFinish({ next: d.next, surprise: d.surprise });
      setTimeout(() => document.getElementById("finish")?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally { setBusy(false); }
  }

  async function illustration() {
    setImg({ loading: true });
    const r = await fetch("/api/visual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conceptId: p.concept.id }) });
    const d = await r.json();
    setImg(d.url ? { url: d.url } : { reason: d.reason });
  }

  const visualFirst = mode === "visual";

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {/* Header */}
        <div ref={topRef} className="sticky top-0 z-20 -mx-4 border-b hairline bg-ink/90 px-4 pb-3 pt-safe backdrop-blur-lg sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none">
          <div className="flex h-14 items-center gap-2 lg:h-auto lg:pb-4">
            <Link href={`/materials/${p.material.id}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:text-paper lg:-ml-3" aria-label="Back to material"><ArrowLeft size={20} /></Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.7rem] font-semibold uppercase tracking-widest text-muted">{p.chapter ?? p.material.title} · {p.position.index}/{p.position.total}</p>
              <p className="truncate text-sm font-medium">{p.concept.name}</p>
            </div>
            <LanguageSelect value={lang} onChange={switchLang} preferred={[p.languages.primary, p.languages.secondary, "en"]} compact id="lesson-lang" />
          </div>
          <div className="flex items-center gap-3"><ProgressBar value={progress} /><span className="w-9 text-right text-xs tabular-nums text-muted">{progress}%</span></div>
          {/* Representation switcher */}
          <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Representation">
            {MODES.map((m) => (
              <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => switchMode(m.id)}
                className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition ${mode === m.id ? "border-saffron bg-saffron text-ink" : "border-line text-muted hover:text-paper"}`}>{m.label}</button>
            ))}
            <Link href={`/quiz?concept=${p.concept.id}`} className="h-9 shrink-0 content-center rounded-full border border-line px-3.5 text-xs font-semibold text-muted hover:text-paper">Quiz</Link>
          </div>
        </div>

        {p.fromConcept && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-iris/30 bg-iris/[0.07] px-4 py-3 text-sm">
            <span>Prerequisite refresher for <b>{p.fromConcept.name}</b></span>
            <Link href={`/learn/${p.fromConcept.id}`} className="btn btn-sm">Back <ArrowRight size={14} /></Link>
          </div>
        )}

        {/* Objective + source (canonical references) */}
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {p.objective && <span className="chip max-w-full"><Target size={12} className="shrink-0 text-saffron" /><span className="truncate">{p.objective}</span></span>}
          {(p.concept.sourcePage || p.concept.sourceSection) && <span className="chip"><BookMarked size={12} />{p.concept.sourceSection ?? ""}{p.concept.sourcePage ? ` · p. ${p.concept.sourcePage}` : ""}</span>}
        </div>

        {note && (
          <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-rise ${note.tone === "iris" ? "border-iris/30 bg-iris/[0.07]" : note.tone === "coral" ? "border-coral/30 bg-coral/[0.07]" : "border-saffron/30 bg-saffron/[0.06]"}`}>
            <Sparkles size={16} className="mt-0.5 shrink-0 text-saffron" /><p className="flex-1">{note.text}</p>
            <button onClick={() => setNote(null)} aria-label="Dismiss" className="text-muted"><X size={15} /></button>
          </div>
        )}
        {notice && <p className="mt-3 flex items-start gap-2 text-xs text-saffron"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{notice}</p>}
        {prereq && (
          <div className="mt-4 rounded-xl border hairline bg-white/[0.02] p-4 animate-rise">
            <p className="text-sm">{prereq.message}</p>
            <Link href={`/learn/${prereq.id}?mode=simple&from=${p.concept.id}`} className="btn btn-sm btn-iris mt-3">Refresh {prereq.name}</Link>
          </div>
        )}

        {/* Lesson */}
        <article className="mt-6" lang={shownLang} aria-busy={loading}>
          {loading && !content ? (
            <div className="space-y-3 py-6">{[80, 95, 60].map((w, i) => <div key={i} className="h-4 animate-pulse rounded bg-white/[0.06]" style={{ width: `${w}%` }} />)}</div>
          ) : error && !content ? (
            <div className="card p-6 text-center"><p className="text-muted">{error}</p><button className="btn mt-4" onClick={() => load(mode, lang)}><RefreshCw size={16} /> Try again</button></div>
          ) : content && (
            <div className={loading ? "opacity-50 transition" : "transition"}>
              <div className="flex items-start gap-3">
                <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-saffron to-iris text-sm font-bold text-ink" aria-hidden>T</span>
                <div>
                  <p className="eyebrow">Your teacher</p>
                  <p className="mt-1 font-display text-[1.7rem] leading-tight sm:text-3xl">{content.teacherIntro}</p>
                </div>
              </div>

              {visualFirst && content.visual && (
                <div className="mt-6">
                  <FlowDiagram visual={content.visual} highlight={p.concept.name} />
                  {content.visual.imagePrompt ? (
                    <div className="mt-3">
                      {img?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt={`Illustration of ${p.concept.name}`} loading="lazy" className="w-full rounded-xl border hairline" />
                      ) : img?.reason ? <p className="text-xs text-muted">{img.reason}</p> : (
                        <button className="btn btn-sm" onClick={illustration} disabled={img?.loading}>{img?.loading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Show an illustration</button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-6 space-y-4">
                {content.sections.slice(0, step).map((s, i) => (
                  <section key={`${mode}-${i}`} className={`animate-rise rounded-xl border-l-2 py-1 pl-4 ${s.kind === "formula" ? "border-iris" : s.kind === "example" || s.kind === "analogy" ? "border-sage" : s.kind === "prereq" ? "border-sky" : "border-saffron/60"}`}>
                    <h3 className="text-[0.8rem] font-semibold uppercase tracking-wider text-muted">{s.heading}</h3>
                    <p className={`mt-1.5 leading-relaxed ${s.kind === "formula" ? "font-mono text-lg text-iris" : "text-[1.05rem]"}`}>{s.body}</p>
                  </section>
                ))}
              </div>

              {!allShown && (
                <button className="btn btn-primary mt-6 w-full sm:w-auto" onClick={() => setStep((s) => s + 1)}>Continue <ArrowRight size={18} /></button>
              )}

              {allShown && !visualFirst && content.visual && (
                <details className="mt-6 group" open={mode === "steps" || mode === "zero"}>
                  <summary className="cursor-pointer list-none text-sm font-semibold text-iris"><Lightbulb size={15} className="mr-1 inline" /> See it as a diagram</summary>
                  <div className="mt-3"><FlowDiagram visual={content.visual} highlight={p.concept.name} /></div>
                </details>
              )}

              {/* Understanding check */}
              {allShown && (
                <section className="mt-8 rounded-2xl border border-line-2 bg-ink-2 p-5 animate-rise" aria-labelledby="check-q">
                  <p className="eyebrow flex items-center gap-1.5 text-saffron"><Zap size={13} /> Quick check</p>
                  <p id="check-q" className="mt-2 text-lg font-medium">{content.check.question}</p>
                  <div className="mt-4 grid gap-2">
                    {content.check.options.map((o, i) => {
                      const isAns = check && i === check.answer;
                      const isWrong = check && chosen === i && !check.correct;
                      return (
                        <button key={i} onClick={() => answer(i)} disabled={!!check || busy}
                          className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm transition ${isAns ? "border-sage bg-sage/10" : isWrong ? "border-coral bg-coral/10" : chosen === i ? "border-saffron" : "border-line hover:border-line-2"}`}>
                          <span className="mr-2 font-semibold text-muted">{String.fromCharCode(65 + i)}</span>{o}
                        </button>
                      );
                    })}
                  </div>
                  {check && (
                    <div className="mt-4 space-y-3 animate-rise" role="status">
                      <p className={`font-semibold ${check.correct ? "text-sage" : "text-coral"}`}>{check.correct ? "Exactly right." : "Not quite — and that's useful to know."} <span className="text-xs font-normal text-muted">Mastery {Math.round(check.mastery)}% ({check.delta >= 0 ? "+" : ""}{check.delta})</span></p>
                      {check.diagnosis && <p className="rounded-lg border border-coral/30 bg-coral/[0.07] p-3 text-sm"><b>Teacher&rsquo;s note:</b> {check.diagnosis}</p>}
                      <p className="text-sm text-muted">{check.explanation}</p>
                      {!check.correct && (
                        <div className="flex flex-wrap gap-2">
                          {check.next?.action === "prerequisite" || check.confusedWith ? (
                            <Link href={check.next?.action === "prerequisite" ? check.next.href : `/learn/${check.confusedWith!.id}?mode=simple&from=${p.concept.id}`} className="btn btn-sm btn-iris">
                              Re-learn {check.next?.action === "prerequisite" ? check.next.conceptName : check.confusedWith!.name} first
                            </Link>
                          ) : null}
                          <button className="btn btn-sm" onClick={() => switchMode(mode === "analogy" ? "visual" : "analogy", "Let's look at it from a different angle.")}>Explain it differently</button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Summary */}
              {allShown && check && <p className="mt-6 border-l-2 border-iris pl-4 text-sm text-muted"><b className="text-paper">In short:</b> {content.summary}</p>}
            </div>
          )}
        </article>

        {/* Teacher controls */}
        <div className="mt-8 space-y-3">
          <AudioPlayer conceptId={p.concept.id} mode={mode} language={shownLang} />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button className="btn border-sage/40 text-sage" onClick={() => complete(true)} disabled={busy || !content}><Check size={18} /> I understand</button>
            <button className="btn border-coral/40 text-coral" onClick={confused} disabled={busy}><HelpCircle size={18} /> I don&rsquo;t understand</button>
            <div className="relative col-span-2 sm:col-span-1">
              <button className="btn w-full" onClick={() => setMore((m) => !m)} aria-expanded={more}><Sparkles size={18} /> Explain differently</button>
              {more && (
                <div className="absolute bottom-full left-0 z-30 mb-2 w-full min-w-60 rounded-xl border hairline bg-ink-3 p-1.5 shadow-2xl animate-rise sm:w-64">
                  {TEACH_MORE.map((t) => <button key={t.mode} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/[0.06]" onClick={() => switchMode(t.mode, `${t.label}.`)}>{t.label}</button>)}
                </div>
              )}
            </div>
            <Link href={`/quiz?concept=${p.concept.id}`} className="btn"><Zap size={18} /> Quiz me</Link>
            <button className="btn lg:hidden" onClick={() => setChatOpen(true)}><MessageSquare size={18} /> Ask teacher</button>
          </div>
        </div>

        {/* Finish / next best lesson */}
        {finish ? (
          <section id="finish" className="mt-8 rounded-2xl border border-saffron/30 bg-gradient-to-br from-saffron/[0.08] to-iris/[0.06] p-5 animate-rise">
            <div className="flex items-center gap-4">
              <MasteryRing value={mastery} size={60} />
              <div className="min-w-0"><p className="eyebrow">Next best step</p><p className="font-display text-2xl leading-tight">{finish.next.label}</p></div>
            </div>
            <p className="mt-3 text-sm text-muted">{finish.next.reason}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href={finish.next.href} className="btn btn-primary">Continue <ArrowRight size={18} /></Link>
              {finish.surprise && <Link href={`/quiz?surprise=${finish.surprise.id}`} className="btn btn-iris"><Zap size={16} /> {finish.surprise.title}</Link>}
            </div>
            {finish.surprise && <p className="mt-2 text-xs text-muted">{finish.surprise.reason}</p>}
          </section>
        ) : allShown && (
          <button className="btn btn-primary mt-6 h-12 w-full text-base" onClick={() => complete(!!check?.correct)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={18} /> : <>Continue <ArrowRight size={18} /></>}
          </button>
        )}
        {p.pendingSurprise && !finish && (
          <Link href={`/quiz?surprise=${p.pendingSurprise.id}`} className="mt-4 flex items-center gap-2 text-sm text-iris"><Zap size={15} /> {p.pendingSurprise.title} — a surprise quiz is waiting</Link>
        )}
        <div className="h-8" />
      </div>

      {/* Desktop: teacher chat column */}
      <aside className="hidden lg:block">
        <div className="sticky top-10 flex h-[calc(100dvh-5rem)] flex-col rounded-2xl border hairline bg-ink-2/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="eyebrow">Ask your teacher</p><p className="text-xs text-muted">Grounded in {p.material.title}</p></div>
            <MasteryRing value={mastery} size={44} stroke={4} />
          </div>
          {p.prerequisites.length > 0 && (
            <div className="mb-3 border-b hairline pb-3">
              <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-dim">Builds on</p>
              <div className="flex flex-wrap gap-1.5">{p.prerequisites.map((x) => <Link key={x.id} href={`/learn/${x.id}?from=${p.concept.id}`} className="chip hover:text-paper">{x.name} · {Math.round(x.score)}%</Link>)}</div>
            </div>
          )}
          <div className="min-h-0 flex-1"><ChatPanel materialId={p.material.id} conceptId={p.concept.id} language={lang} intro={`Ask me anything about ${p.concept.name} — I'll answer from your material.`} /></div>
        </div>
      </aside>

      {/* Mobile: chat sheet */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Ask your teacher">
          <button className="absolute inset-0 bg-black/60" onClick={() => setChatOpen(false)} aria-label="Close" />
          <div className="absolute inset-x-0 bottom-0 flex h-[85dvh] flex-col rounded-t-2xl border-t hairline bg-ink-2 p-4 pb-safe animate-rise">
            <div className="mb-3 flex items-center justify-between"><p className="font-display text-2xl">Ask your teacher</p><button className="grid h-11 w-11 place-items-center" onClick={() => setChatOpen(false)} aria-label="Close"><X size={20} /></button></div>
            <div className="min-h-0 flex-1"><ChatPanel materialId={p.material.id} conceptId={p.concept.id} language={lang} intro={`Ask me anything about ${p.concept.name}.`} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
