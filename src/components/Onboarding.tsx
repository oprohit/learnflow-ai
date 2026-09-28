"use client";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { completeOnboarding, type OnboardingData } from "@/app/actions/auth";
import { EDUCATION_LEVELS, GOALS, LANGUAGES, STYLES } from "@/lib/constants";
import { Logo } from "@/components/ui";

const TOTAL = 7;

export default function Onboarding({ name }: { name: string }) {
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [d, setD] = useState<OnboardingData>({
    primaryLanguage: "", secondaryLanguage: null, educationLevel: "", learningGoal: "", teachingStyle: "adaptive",
    dailyMinutes: 25, subject: "", targetExam: "", targetDate: "",
  });
  const set = (p: Partial<OnboardingData>) => setD((x) => ({ ...x, ...p }));
  const canNext = [true, !!d.primaryLanguage, !!d.educationLevel, !!d.learningGoal, !!d.teachingStyle, d.dailyMinutes > 0, true][step];
  const next = () => (step < TOTAL - 1 ? setStep(step + 1) : start(() => completeOnboarding(d)));

  return (
    <main className="grain flex min-h-dvh flex-col pt-safe pb-safe">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
        <Logo />
        <span className="text-xs tabular-nums text-muted">{step + 1} / {TOTAL}</span>
      </header>
      <div className="mx-auto w-full max-w-3xl px-5"><div className="h-0.5 w-full bg-white/10"><div className="h-full bg-saffron transition-all duration-500" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} /></div></div>

      <section key={step} className="mx-auto w-full max-w-3xl flex-1 animate-rise px-5 py-8 sm:py-14">
        {step === 0 && (
          <div className="flex min-h-[50dvh] flex-col justify-center">
            <p className="eyebrow mb-4">Hello, {name.split(" ")[0]}</p>
            <h1 className="font-display text-5xl leading-[1] sm:text-7xl">Welcome to <em className="text-saffron">LearnFlow</em>.</h1>
            <p className="mt-6 max-w-xl text-lg text-muted">Give it your textbook. It will understand what you need to learn, teach you in the language you understand, and change the explanation when you struggle.</p>
            <p className="mt-3 text-sm text-dim">Six quick questions so your teacher can adapt to you.</p>
          </div>
        )}
        {step === 1 && (
          <Q title="What language do you understand best?" hint="Lessons, quizzes and voice will use it. Switch any time — even halfway through a lesson.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LANGUAGES.map((l) => (
                <Opt key={l.code} active={d.primaryLanguage === l.code} onClick={() => set({ primaryLanguage: l.code, secondaryLanguage: d.secondaryLanguage === l.code ? null : d.secondaryLanguage })}>
                  <span className="block text-lg">{l.native}</span><span className="text-xs text-muted">{l.name}</span>
                </Opt>
              ))}
            </div>
            {d.primaryLanguage && (
              <div className="mt-8">
                <p className="mb-3 text-sm font-medium">Second language <span className="text-muted">(optional)</span></p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.filter((l) => l.code !== d.primaryLanguage).slice(0, 8).map((l) => (
                    <button key={l.code} type="button" onClick={() => set({ secondaryLanguage: d.secondaryLanguage === l.code ? null : l.code })}
                      className={`chip min-h-10 px-4 ${d.secondaryLanguage === l.code ? "border-iris text-paper bg-iris/15" : ""}`} aria-pressed={d.secondaryLanguage === l.code}>{l.native}</button>
                  ))}
                </div>
              </div>
            )}
          </Q>
        )}
        {step === 2 && (
          <Q title="Where are you in your studies?">
            <div className="grid gap-2 sm:grid-cols-2">{EDUCATION_LEVELS.map((e) => <Opt key={e} active={d.educationLevel === e} onClick={() => set({ educationLevel: e })}>{e}</Opt>)}</div>
          </Q>
        )}
        {step === 3 && (
          <Q title="What do you want from your teacher?">
            <div className="grid gap-2 sm:grid-cols-2">{GOALS.map((g) => <Opt key={g} active={d.learningGoal === g} onClick={() => set({ learningGoal: g })}>{g}</Opt>)}</div>
          </Q>
        )}
        {step === 4 && (
          <Q title="How do you like to be taught?" hint="Your teacher starts here, then adapts when something doesn't click.">
            <div className="grid gap-2 sm:grid-cols-2">
              {STYLES.map((s) => <Opt key={s.id} active={d.teachingStyle === s.id} onClick={() => set({ teachingStyle: s.id })}><span className="block font-semibold">{s.label}</span><span className="text-xs text-muted">{s.hint}</span></Opt>)}
            </div>
          </Q>
        )}
        {step === 5 && (
          <Q title="How much time can you study each day?">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[10, 15, 25, 40, 60, 90].map((m) => <Opt key={m} active={d.dailyMinutes === m} onClick={() => set({ dailyMinutes: m })}><span className="font-display text-3xl">{m}</span><span className="block text-xs text-muted">min</span></Opt>)}
            </div>
            <label className="mt-8 block">
              <span className="mb-2 block text-sm font-medium">What are you studying?</span>
              <input className="input" placeholder="Physics, Biology, Accounting…" value={d.subject} onChange={(e) => set({ subject: e.target.value })} />
            </label>
          </Q>
        )}
        {step === 6 && (
          <Q title="Preparing for something?" hint="Optional. We'll build a day-by-day plan that adjusts to your progress.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="mb-2 block text-sm font-medium">Target exam</span><input className="input" placeholder="Board Exam, NEET, Semester…" value={d.targetExam} onChange={(e) => set({ targetExam: e.target.value })} /></label>
              <label><span className="mb-2 block text-sm font-medium">Exam date</span><input type="date" className="input" value={d.targetDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ targetDate: e.target.value })} /></label>
            </div>
          </Q>
        )}
      </section>

      <footer className="sticky bottom-0 border-t hairline bg-ink/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || pending}><ArrowLeft size={18} /> Back</button>
          <button type="button" className="btn btn-primary min-w-40" onClick={next} disabled={!canNext || pending}>
            {pending ? <Loader2 className="animate-spin" size={18} /> : step === 0 ? <>Let&rsquo;s begin <ArrowRight size={18} /></> : step === TOTAL - 1 ? <>Finish <Check size={18} /></> : <>Continue <ArrowRight size={18} /></>}
          </button>
        </div>
      </footer>
    </main>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">{title}</h1>
      {hint && <p className="mt-3 max-w-xl text-muted">{hint}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Opt({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`min-h-14 rounded-xl border px-4 py-3 text-left transition ${active ? "border-saffron bg-saffron/10 text-paper" : "border-line bg-white/[0.02] hover:border-line-2"}`}>
      {children}
    </button>
  );
}
