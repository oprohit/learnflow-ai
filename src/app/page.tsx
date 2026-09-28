import Link from "next/link";
import { ArrowRight, FileText, Brain, GraduationCap, Eye, Volume2, Zap, TrendingUp, Upload, Languages, Layers } from "lucide-react";
import { getUser } from "@/lib/auth";
import { Logo } from "@/components/ui";

const PIPE = [
  { icon: FileText, label: "PDF", sub: "Newton's Laws.pdf" },
  { icon: Brain, label: "Understanding", sub: "4 objectives · 14 concepts" },
  { icon: GraduationCap, label: "Lesson", sub: "“Let's start with the basics.”" },
  { icon: Eye, label: "Visual", sub: "Object → Force → Acceleration" },
  { icon: Volume2, label: "Voice", sub: "Spoken in தமிழ்" },
  { icon: Zap, label: "Quiz", sub: "“Quick check.”" },
  { icon: TrendingUp, label: "Mastery", sub: "Second Law 41% → 67%" },
];

const FEATURES = [
  { icon: Upload, title: "Upload anything", body: "PDF, EPUB, DOCX, slides, or a photo of a page. LearnFlow reads the structure — chapters, objectives, definitions, formulas, examples and the misconceptions students usually fall into." },
  { icon: GraduationCap, title: "Learn from zero", body: "Tap “Teach me from zero” and your teacher walks the prerequisite chain — from the most basic idea up to the concept in your book — instead of starting with jargon." },
  { icon: Languages, title: "Switch language anytime", body: "Start in English, continue in Tamil halfway through. Same concept, same objective, same progress. Only the language changes — the lesson never restarts." },
  { icon: Eye, title: "See concepts visually", body: "Deterministic diagrams for processes and relationships, an interactive concept map, and mind maps per chapter. Illustrations only where they genuinely help." },
  { icon: Volume2, title: "Listen to lessons", body: "Every lesson can be read aloud at 1×, 1.25× or 1.5×. Audio is generated once and cached, with your device's voice as a fallback." },
  { icon: Zap, title: "Practice adaptively", body: "Seven question types from a stored bank, difficulty tuned to your mastery, and short surprise checks timed to the moment you're most likely to forget." },
  { icon: TrendingUp, title: "Track mastery", body: "Per-concept mastery calculated from your answers — not guessed. Weak concepts, fading concepts, and a study plan that rebalances itself." },
];

export default async function Landing() {
  const user = await getUser().catch(() => null);
  const start = user ? (user.onboarded ? "/dashboard" : "/onboarding") : "/signup";
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b hairline bg-ink/80 pt-safe backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="flex items-center gap-1 text-sm">
            <a href="#how" className="hidden px-3 py-2 text-muted hover:text-paper sm:block">How it works</a>
            {user ? <Link href={start} className="btn btn-sm btn-primary">Open app</Link> : <><Link href="/login" className="px-3 py-2 text-muted hover:text-paper">Sign in</Link><Link href="/signup" className="btn btn-sm btn-primary">Start</Link></>}
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-24">
          <p className="eyebrow animate-rise">Your material. Your language. Your way of learning.</p>
          <h1 className="mt-5 max-w-5xl font-display text-[3.1rem] leading-[0.95] animate-rise sm:text-7xl lg:text-[6.2rem]" style={{ animationDelay: ".08s" }}>
            Your textbook shouldn&rsquo;t decide <em className="text-saffron">how</em> you learn.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted animate-rise sm:text-xl" style={{ animationDelay: ".16s" }}>Upload your learning material and let AI turn it into a personal teacher.</p>
          <div className="mt-8 flex flex-col gap-3 animate-rise sm:flex-row" style={{ animationDelay: ".24s" }}>
            <Link href={start} className="btn btn-primary h-13 px-6 text-base">Start Learning <ArrowRight size={18} /></Link>
            <a href="#how" className="btn h-13 px-6 text-base">Explore how it works</a>
          </div>

          {/* Pipeline visual */}
          <div className="mt-16 sm:mt-20" aria-label="From PDF to mastery">
            <ol className="grid grid-cols-1 gap-0 sm:grid-cols-7">
              {PIPE.map(({ icon: Icon, label, sub }, i) => (
                <li key={label} className="relative flex items-center gap-4 border-l hairline py-3 pl-5 animate-rise sm:block sm:border-l-0 sm:border-t sm:py-0 sm:pl-0 sm:pt-5" style={{ animationDelay: `${0.35 + i * 0.09}s` }}>
                  <span className="absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-saffron sm:-top-[5px] sm:left-0 sm:translate-y-0" style={{ opacity: 0.4 + i * 0.09 }} />
                  <Icon size={20} className={i === PIPE.length - 1 ? "text-sage" : i === 0 ? "text-muted" : "text-iris"} strokeWidth={1.6} />
                  <div className="sm:mt-3 sm:pr-3">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted">{sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Lesson glimpse */}
      <section className="border-y hairline bg-ink-2/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow">Not a summary. A teacher.</p>
            <h2 className="mt-3 font-display text-4xl leading-[1.02] sm:text-6xl">It changes the explanation when you struggle.</h2>
            <p className="mt-5 max-w-lg text-muted">Press <b className="text-paper">I don&rsquo;t understand</b> and your teacher doesn&rsquo;t repeat itself. It checks which prerequisite is shaky, switches strategy — analogy, visual, step-by-step, or back to basics — then asks one simple question to see if it clicked.</p>
          </div>
          <div className="card space-y-4 p-5 sm:p-7" aria-hidden>
            <div className="flex items-center justify-between text-xs text-muted"><span>Force and Newton&rsquo;s Laws · 5/14</span><span className="rounded-md border hairline px-2 py-1">தமிழ் ▾</span></div>
            <div className="h-1 rounded-full bg-white/10"><div className="h-full w-2/5 rounded-full bg-saffron" /></div>
            <p className="font-display text-2xl">Let me try this with something from everyday life.</p>
            <p className="border-l-2 border-sage pl-4 text-sm leading-relaxed">Imagine pushing a shopping cart in a supermarket. Your push is the force — it&rsquo;s what gets the cart rolling, speeds it up, or turns it into the next aisle.</p>
            <div className="rounded-xl border border-coral/30 bg-coral/[0.07] p-3 text-sm"><b>Teacher&rsquo;s note:</b> You seem to be mixing up mass and force. Let&rsquo;s refresh mass first.</div>
            <div className="flex flex-wrap gap-2 text-xs"><span className="chip text-sage border-sage/30">I understand</span><span className="chip text-coral border-coral/30">I don&rsquo;t understand</span><span className="chip">Listen</span><span className="chip">Quiz me</span></div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 lg:py-24">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-3xl font-display text-4xl leading-[1.02] sm:text-6xl">One source. Many ways to understand it.</h2>
        <p className="mt-4 max-w-2xl text-muted">Every explanation — simple, advanced, visual, analogy, spoken, translated, quizzed — stays anchored to the same chapter, learning objective and concept from your material.</p>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <article key={title} className="border-t hairline pt-5">
              <div className="flex items-center gap-3"><span className="font-display text-xl text-dim">{String(i + 1).padStart(2, "0")}</span><Icon size={18} className="text-saffron" strokeWidth={1.7} /></div>
              <h3 className="mt-3 font-display text-2xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </article>
          ))}
          <article className="flex flex-col justify-between rounded-2xl border border-saffron/30 bg-saffron/[0.05] p-6">
            <Layers className="text-saffron" size={20} />
            <div><p className="mt-6 font-display text-2xl">Works on laptop, phone and Android.</p><Link href={start} className="btn btn-primary mt-4">Start Learning <ArrowRight size={16} /></Link></div>
          </article>
        </div>
      </section>

      <footer className="border-t hairline pb-safe">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
          <Logo compact /><p>Private by default — your books are never shared. Powered by the free Gemini API.</p>
        </div>
      </footer>
    </div>
  );
}
