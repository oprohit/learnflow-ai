import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

/** Editorial split-screen on desktop, focused full-screen on mobile. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r hairline bg-ink-2 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="relative"><Logo /></div>
        <div className="relative max-w-xl">
          <p className="eyebrow mb-6">A private tutor, built from your own books</p>
          <h2 className="font-display text-6xl leading-[0.98] xl:text-7xl">
            Your textbook shouldn&rsquo;t decide <em className="text-saffron">how</em> you learn.
          </h2>
          <div className="mt-12 grid grid-cols-[auto_1fr] gap-x-5 gap-y-5 text-sm">
            {[
              ["01", "Newton's Laws.pdf", "14 pages · Physics"],
              ["02", "4 learning objectives · 14 concepts", "Concept map built from the source"],
              ["03", "“விசை என்பது ஒரு தள்ளுதல் அல்லது இழுத்தல்…”", "Same lesson, now in Tamil"],
              ["04", "Quick check · Newton's Second Law", "Mastery 41% → 67%"],
            ].map(([n, a, b], i) => (
              <div key={n} className="contents animate-rise" style={{ animationDelay: `${0.15 * i + 0.2}s` }}>
                <span className="font-display text-2xl text-dim">{n}</span>
                <div className="border-b hairline pb-4">
                  <p className="text-paper">{a}</p>
                  <p className="mt-0.5 text-muted">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-dim">Your material. Your language. Your way of learning.</p>
      </section>
      <section className="relative flex min-h-dvh flex-col px-5 pb-safe pt-safe sm:px-10">
        <div className="grain pointer-events-none absolute inset-0 lg:hidden" />
        <div className="relative flex h-16 items-center lg:hidden"><Logo /></div>
        <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-8">{children}</div>
      </section>
    </main>
  );
}
