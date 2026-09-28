import type { LessonVisual } from "@/lib/types";

/** Level-1 deterministic visual: responsive HTML/SVG flow — vertical on phones, horizontal on larger screens. */
export default function FlowDiagram({ visual, highlight }: { visual: LessonVisual; highlight?: string }) {
  const nodes = visual.nodes.slice(0, 6);
  return (
    <figure className="rounded-xl border hairline bg-ink-3/60 p-4 sm:p-6" aria-label={`Diagram: ${nodes.join(" leads to ")}`}>
      <div className="flex flex-col items-stretch gap-0 sm:flex-row sm:items-center">
        {nodes.map((n, i) => {
          const hot = highlight && n.toLowerCase().includes(highlight.toLowerCase());
          return (
            <div key={i} className="flex flex-col items-center sm:flex-1 sm:flex-row">
              <div className={`w-full rounded-lg border px-3 py-3 text-center text-sm font-medium animate-rise sm:min-h-16 sm:content-center ${hot ? "border-saffron bg-saffron/10 text-paper" : "border-line-2 bg-white/[0.03]"}`}
                style={{ animationDelay: `${i * 0.12}s` }}>
                <span className="mb-1 block text-[0.65rem] font-semibold tracking-widest text-dim">{String(i + 1).padStart(2, "0")}</span>
                {n}
              </div>
              {i < nodes.length - 1 && (
                <svg className="h-8 w-6 shrink-0 sm:h-6 sm:w-10 sm:-rotate-90" viewBox="0 0 24 32" aria-hidden>
                  <path d="M12 2v24" stroke="#8C83FF" strokeWidth="2" className="flow-line" fill="none" />
                  <path d="M6 21l6 7 6-7" stroke="#8C83FF" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      {visual.kind === "cycle" && <p className="mt-2 text-center text-xs text-iris">↺ and the cycle repeats</p>}
      <figcaption className="mt-4 text-center text-sm text-muted">{visual.caption}</figcaption>
    </figure>
  );
}
