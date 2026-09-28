"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowRight, Check, X, Loader2, Zap, Trophy, BookMarked } from "lucide-react";
import LanguageSelect from "@/components/LanguageSelect";
import { MasteryRing, ProgressBar } from "@/components/ui";
import type { QuizQuestionDTO } from "@/lib/types";

type Feedback = { correct: boolean; answer: unknown; explanation: string | null; diagnosis: string | null; mastery: number; delta: number; next: { label: string; href: string; reason: string } | null; sourcePage: number | null };

export default function QuizRunner({ query, language, preferred, surpriseId, backHref }: { query: string; language: string; preferred: (string | null)[]; surpriseId?: string; backHref: string }) {
  const [lang, setLang] = useState(language);
  const [data, setData] = useState<{ title: string; subtitle: string; questions: QuizQuestionDTO[]; notice: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState<unknown>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [results, setResults] = useState<{ correct: boolean; concept?: string; mastery: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const qStart = useRef(Date.now());
  const quizStart = useRef(Date.now());

  const load = useCallback(async (l: string) => {
    try {
      const r = await fetch(`/api/quiz?${query}&lang=${l}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) { setErr(e instanceof Error && e.message ? e.message : "Couldn't load questions. Your saved quizzes are still available — try again."); }
  }, [query]);
  useEffect(() => { void load(lang); }, [lang, load]);

  const q = data?.questions[idx];
  useEffect(() => {
    qStart.current = Date.now();
    if (!q) return;
    if (q.type === "ordering") setAns([...q.options]);
    else if (q.type === "matching") setAns({});
    else setAns(null);
  }, [q]);

  async function submit() {
    if (!q || ans === null || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: q.id, answer: ans, timeMs: Date.now() - qStart.current, context: surpriseId ? "surprise" : "quiz" }) });
      const d = (await r.json()) as Feedback;
      setFb(d);
      setResults((x) => [...x, { correct: d.correct, concept: q.conceptName, mastery: d.mastery }]);
    } finally { setBusy(false); }
  }

  async function next() {
    setFb(null);
    if (data && idx + 1 >= data.questions.length) {
      const score = Math.round(((results.filter((r) => r.correct).length) / data.questions.length) * 100);
      const minutes = (Date.now() - quizStart.current) / 60000;
      if (surpriseId) await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finish", surpriseId, score }) });
      await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finish", context: surpriseId ? "surprise" : "quiz", minutes }) });
    }
    setIdx((i) => i + 1);
  }

  if (err) return <div className="card mx-auto mt-10 max-w-lg p-8 text-center"><p className="text-muted">{err}</p><Link href={backHref} className="btn mt-4">Go back</Link></div>;
  if (!data) return <div className="grid min-h-[50dvh] place-items-center"><Loader2 className="animate-spin text-saffron" /></div>;
  if (!data.questions.length) return <div className="card mx-auto mt-10 max-w-lg p-8 text-center"><p className="font-display text-2xl">Nothing to practise yet</p><p className="mt-2 text-sm text-muted">Study a few concepts first and your quiz bank will fill up.</p><Link href={backHref} className="btn mt-4">Go back</Link></div>;

  const done = idx >= data.questions.length;
  if (done) {
    const correct = results.filter((r) => r.correct).length;
    const pct = Math.round((correct / results.length) * 100);
    return (
      <div className="mx-auto max-w-xl animate-rise py-6 text-center">
        <Trophy className="mx-auto text-saffron" size={36} />
        <p className="eyebrow mt-4">{data.title}</p>
        <h1 className="mt-2 font-display text-5xl">{correct} of {results.length}</h1>
        <p className="mt-2 text-muted">{pct >= 80 ? "Excellent — this is sticking." : pct >= 50 ? "Good progress. Your teacher will revisit what you missed." : "That's okay — now we know exactly what to work on."}</p>
        <div className="mt-8 space-y-2 text-left">
          {Object.entries(results.reduce<Record<string, { c: number; n: number; m: number }>>((acc, r) => { const k = r.concept ?? "Concept"; acc[k] = { c: (acc[k]?.c ?? 0) + (r.correct ? 1 : 0), n: (acc[k]?.n ?? 0) + 1, m: r.mastery }; return acc; }, {})).map(([k, v]) => (
            <div key={k} className="card flex items-center gap-3 p-3"><MasteryRing value={v.m} size={42} stroke={4} /><div className="flex-1"><p className="text-sm font-medium">{k}</p><p className="text-xs text-muted">{v.c}/{v.n} correct · mastery now {Math.round(v.m)}%</p></div></div>
          ))}
        </div>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row"><Link href={backHref} className="btn btn-primary">Continue learning <ArrowRight size={17} /></Link><Link href="/progress" className="btn">See mastery</Link></div>
      </div>
    );
  }

  const expected = fb?.answer;
  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="sticky top-0 z-20 -mx-4 border-b hairline bg-ink/90 px-4 pb-3 pt-safe backdrop-blur-lg sm:-mx-6 sm:px-6 lg:static lg:border-0 lg:bg-transparent">
        <div className="flex h-14 items-center gap-2">
          <Link href={backHref} className="grid h-11 w-11 place-items-center rounded-lg text-muted" aria-label="Exit quiz"><X size={20} /></Link>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold uppercase tracking-widest text-saffron">{surpriseId && <Zap size={12} className="mr-1 inline" />}{data.title}</p><p className="truncate text-xs text-muted">{data.subtitle}</p></div>
          <LanguageSelect value={lang} onChange={setLang} preferred={preferred} compact id="quiz-lang" />
        </div>
        <div className="flex items-center gap-3"><ProgressBar value={(idx / data.questions.length) * 100} tone="iris" /><span className="text-xs tabular-nums text-muted">{idx + 1}/{data.questions.length}</span></div>
      </div>
      {data.notice && <p className="mt-3 text-xs text-saffron">{data.notice}</p>}

      {q && (
        <section key={q.id} className="mt-8 animate-rise" aria-live="polite">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="chip">{q.conceptName}</span><span className="chip capitalize">{q.difficulty}</span>
            <span className="chip">{{ mcq: "Multiple choice", tf: "True / False", fill: "Fill the blank", short: "Short answer", ordering: "Ordering", matching: "Matching", application: "Application" }[q.type]}</span>
          </div>
          <h1 className="mt-4 text-xl font-medium leading-snug sm:text-2xl">{q.prompt}</h1>

          <div className="mt-6">
            {(q.type === "mcq" || q.type === "application") && (
              <div className="grid gap-2">{q.options.map((o, i) => (
                <button key={i} disabled={!!fb} onClick={() => setAns(i)} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm transition ${fb && i === expected ? "border-sage bg-sage/10" : fb && ans === i && !fb.correct ? "border-coral bg-coral/10" : ans === i ? "border-saffron bg-saffron/5" : "border-line hover:border-line-2"}`}>
                  <span className="mr-2 font-semibold text-muted">{String.fromCharCode(65 + i)}</span>{o}</button>))}</div>
            )}
            {q.type === "tf" && (
              <div className="grid grid-cols-2 gap-2">{[true, false].map((v, i) => (
                <button key={String(v)} disabled={!!fb} onClick={() => setAns(v)} className={`h-14 rounded-xl border text-base font-semibold ${fb && String(expected) === String(v) ? "border-sage bg-sage/10" : fb && ans === v ? "border-coral bg-coral/10" : ans === v ? "border-saffron bg-saffron/5" : "border-line"}`}>{q.options[i] ?? (v ? "True" : "False")}</button>))}</div>
            )}
            {q.type === "fill" && <input className="input" disabled={!!fb} value={(ans as string) ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="Type your answer" aria-label="Your answer" onKeyDown={(e) => e.key === "Enter" && submit()} />}
            {q.type === "short" && <textarea className="input min-h-32" disabled={!!fb} value={(ans as string) ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="Explain in your own words" aria-label="Your answer" />}
            {q.type === "ordering" && Array.isArray(ans) && (
              <ol className="space-y-2">{(ans as string[]).map((item, i) => (
                <li key={item} className="card flex items-center gap-2 p-2 pl-4">
                  <span className="w-5 text-sm font-semibold text-muted">{i + 1}</span><span className="flex-1 text-sm">{item}</span>
                  <button disabled={!!fb || i === 0} className="grid h-10 w-10 place-items-center rounded-lg text-muted disabled:opacity-30" aria-label={`Move ${item} up`} onClick={() => { const a = [...(ans as string[])]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setAns(a); }}><ArrowUp size={16} /></button>
                  <button disabled={!!fb || i === (ans as string[]).length - 1} className="grid h-10 w-10 place-items-center rounded-lg text-muted disabled:opacity-30" aria-label={`Move ${item} down`} onClick={() => { const a = [...(ans as string[])]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setAns(a); }}><ArrowDown size={16} /></button>
                </li>))}</ol>
            )}
            {q.type === "matching" && q.left && (
              <div className="space-y-3">{q.left.map((l) => (
                <label key={l} className="block"><span className="mb-1 block text-sm font-semibold">{l}</span>
                  <select className="input" disabled={!!fb} value={((ans as Record<string, string>) ?? {})[l] ?? ""} onChange={(e) => setAns({ ...((ans as Record<string, string>) ?? {}), [l]: e.target.value })}>
                    <option value="">Choose a description…</option>{q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select></label>))}</div>
            )}
          </div>

          {fb ? (
            <div className={`mt-6 rounded-2xl border p-5 animate-rise ${fb.correct ? "border-sage/40 bg-sage/[0.06]" : "border-coral/40 bg-coral/[0.06]"}`} role="status">
              <p className={`flex items-center gap-2 font-semibold ${fb.correct ? "text-sage" : "text-coral"}`}>{fb.correct ? <Check size={18} /> : <X size={18} />}{fb.correct ? "Correct" : "Not quite"}<span className="ml-auto text-xs font-normal text-muted">Mastery {fb.mastery}% ({fb.delta >= 0 ? "+" : ""}{fb.delta})</span></p>
              {fb.diagnosis && <p className="mt-3 text-sm"><b>Teacher&rsquo;s note:</b> {fb.diagnosis}</p>}
              {!fb.correct && typeof expected === "string" && <p className="mt-2 text-sm">Answer: <b>{expected}</b></p>}
              {!fb.correct && Array.isArray(expected) && q.type === "ordering" && <p className="mt-2 text-sm">Correct order: {(expected as string[]).join(" → ")}</p>}
              {fb.explanation && <p className="mt-2 text-sm text-muted">{fb.explanation}</p>}
              {fb.sourcePage && <p className="mt-2 text-xs text-dim"><BookMarked size={11} className="mr-1 inline" />Source: page {fb.sourcePage}</p>}
              {fb.next && <Link href={fb.next.href} className="btn btn-sm btn-iris mt-3">{fb.next.label}</Link>}
              <button className="btn btn-primary mt-4 w-full" onClick={next} autoFocus>{idx + 1 >= data.questions.length ? "See results" : "Next question"} <ArrowRight size={17} /></button>
            </div>
          ) : (
            <div className="mt-6 flex gap-2">
              <button className="btn btn-primary h-12 flex-1 text-base" onClick={submit} disabled={ans === null || ans === "" || busy}>{busy ? <Loader2 className="animate-spin" size={18} /> : "Check answer"}</button>
              {surpriseId && idx === 0 && <button className="btn h-12" onClick={async () => { await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "dismiss", surpriseId }) }); location.href = backHref; }}>Not now</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
