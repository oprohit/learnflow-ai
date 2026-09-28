"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2, X, GraduationCap, Eye, Zap, Sparkles, Layers } from "lucide-react";
import { masteryBand } from "@/lib/constants";
import { toneColor, timeAgo } from "@/components/ui";

export type MapNode = { id: string; name: string; chapterIdx: number; chapter: string; level: string; score: number; attempts: number; lastStudied: string | null; summary: string | null };
export type MapEdge = { from: string; to: string; type: string };

export default function ConceptMap({ nodes, edges, title, initialView = "graph" }: { nodes: MapNode[]; edges: MapEdge[]; title: string; initialView?: "graph" | "mind" | "list" }) {
  const [view, setView] = useState<"graph" | "mind" | "list">(initialView);
  const [sel, setSel] = useState<MapNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const prereqOf = (id: string) => edges.filter((e) => e.type === "prerequisite" && e.to === id).map((e) => e.from);
  const depth = useMemo(() => {
    const memo = new Map<string, number>();
    const d = (id: string, seen: Set<string>): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (seen.has(id)) return 0;
      seen.add(id);
      const ps = prereqOf(id);
      const v = ps.length ? 1 + Math.max(...ps.map((p) => d(p, seen))) : 0;
      memo.set(id, v);
      return v;
    };
    nodes.forEach((n) => d(n.id, new Set()));
    return memo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    if (view === "mind") {
      const chapters = [...new Set(nodes.map((n) => n.chapterIdx))].sort((a, b) => a - b);
      const cx = 500, cy = 360;
      chapters.forEach((ci, k) => {
        const a = (k / chapters.length) * Math.PI * 2 - Math.PI / 2;
        const chX = cx + Math.cos(a) * 170, chY = cy + Math.sin(a) * 150;
        pos.set(`ch-${ci}`, { x: chX, y: chY });
        const kids = nodes.filter((n) => n.chapterIdx === ci);
        kids.forEach((n, j) => {
          const spread = Math.min(Math.PI / 1.4, (Math.PI * 2) / chapters.length * 0.9);
          const b = a + (kids.length > 1 ? (j / (kids.length - 1) - 0.5) * spread : 0);
          pos.set(n.id, { x: cx + Math.cos(b) * 340, y: cy + Math.sin(b) * 300 });
        });
      });
      return { pos, w: 1000, h: 720, chapters };
    }
    const cols = new Map<number, MapNode[]>();
    nodes.forEach((n) => { const d = depth.get(n.id) ?? 0; cols.set(d, [...(cols.get(d) ?? []), n]); });
    const maxRows = Math.max(1, ...[...cols.values()].map((c) => c.length));
    [...cols.entries()].forEach(([d, list]) => list.forEach((n, i) => pos.set(n.id, { x: 110 + d * 230, y: 60 + (i + (maxRows - list.length) / 2) * 92 })));
    return { pos, w: 220 + Math.max(0, ...cols.keys()) * 230 + 120, h: 60 + maxRows * 92 + 20, chapters: [] as number[] };
  }, [nodes, depth, view]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chapterName = (ci: number) => nodes.find((n) => n.chapterIdx === ci)?.chapter ?? `Chapter ${ci + 1}`;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border hairline p-0.5" role="tablist" aria-label="Map view">
          {(["graph", "mind", "list"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); setZoom(1); setPan({ x: 0, y: 0 }); }}
              className={`h-9 rounded-md px-3 text-xs font-semibold ${view === v ? "bg-white/10 text-paper" : "text-muted"}`}>{v === "graph" ? "Concept map" : v === "mind" ? "Mind map" : "List"}</button>
          ))}
        </div>
        {view !== "list" && (
          <div className="flex gap-1">
            <button className="btn btn-sm" onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))} aria-label="Zoom in"><Plus size={15} /></button>
            <button className="btn btn-sm" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} aria-label="Zoom out"><Minus size={15} /></button>
            <button className="btn btn-sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset view"><Maximize2 size={15} /></button>
          </div>
        )}
      </div>

      {view === "list" ? (
        <div className="space-y-6">
          {[...new Set(nodes.map((n) => n.chapterIdx))].sort((a, b) => a - b).map((ci) => (
            <div key={ci}>
              <p className="eyebrow mb-2">{chapterName(ci)}</p>
              <ul className="space-y-1.5">
                {nodes.filter((n) => n.chapterIdx === ci).map((n) => (
                  <li key={n.id} style={{ paddingLeft: `${Math.min(3, depth.get(n.id) ?? 0) * 14}px` }}>
                    <button onClick={() => setSel(n)} className="card card-hover flex w-full items-center gap-3 px-3 py-3 text-left">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: toneColor(n.score, n.attempts) }} />
                      <span className="min-w-0 flex-1 truncate text-sm">{(depth.get(n.id) ?? 0) > 0 && <span className="mr-1 text-dim">└</span>}{n.name}</span>
                      <span className="text-xs tabular-nums text-muted">{Math.round(n.score)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative h-[62dvh] min-h-[380px] touch-none overflow-hidden rounded-2xl border hairline bg-ink-2/60 lg:h-[600px]"
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
          onPointerMove={(e) => { if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }}
          onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}
          onWheel={(e) => setZoom((z) => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)))}>
          <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="h-full w-full select-none" role="img" aria-label={`${view === "mind" ? "Mind map" : "Concept map"} of ${title}`}>
            <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8C83FF" /></marker></defs>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} style={{ transformOrigin: "center" }}>
              {view === "mind" && (
                <>
                  {layout.chapters.map((ci) => { const c = layout.pos.get(`ch-${ci}`)!; return <line key={ci} x1={500} y1={360} x2={c.x} y2={c.y} stroke="rgba(244,184,96,.4)" strokeWidth={2} />; })}
                  {nodes.map((n) => { const a = layout.pos.get(`ch-${n.chapterIdx}`)!, b = layout.pos.get(n.id)!; return <line key={n.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,.12)" />; })}
                  <circle cx={500} cy={360} r={62} fill="#161636" stroke="#F4B860" />
                  <foreignObject x={440} y={320} width={120} height={80}><div className="grid h-full place-items-center text-center font-display text-[15px] leading-tight text-paper">{title}</div></foreignObject>
                  {layout.chapters.map((ci) => { const c = layout.pos.get(`ch-${ci}`)!; return (
                    <g key={ci}><rect x={c.x - 70} y={c.y - 18} width={140} height={36} rx={18} fill="#1f1f45" stroke="rgba(244,184,96,.5)" />
                      <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="11" fill="#eeeae0">{chapterName(ci).slice(0, 22)}</text></g>); })}
                </>
              )}
              {view === "graph" && edges.filter((e) => e.type === "prerequisite").map((e, i) => {
                const a = layout.pos.get(e.from), b = layout.pos.get(e.to);
                if (!a || !b) return null;
                const hot = sel && (sel.id === e.from || sel.id === e.to);
                return <path key={i} d={`M${a.x + 80} ${a.y} C ${a.x + 150} ${a.y}, ${b.x - 150} ${b.y}, ${b.x - 84} ${b.y}`} stroke={hot ? "#F4B860" : "rgba(140,131,255,.45)"} strokeWidth={hot ? 2 : 1.3} fill="none" markerEnd="url(#arr)" />;
              })}
              {nodes.map((n) => {
                const pt = layout.pos.get(n.id);
                if (!pt) return null;
                const w = view === "mind" ? 130 : 160;
                return (
                  <g key={n.id} transform={`translate(${pt.x - w / 2} ${pt.y - 26})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSel(n); }}
                    role="button" tabIndex={0} aria-label={`${n.name}, mastery ${Math.round(n.score)}%`} onKeyDown={(e) => e.key === "Enter" && setSel(n)}>
                    <rect width={w} height={52} rx={10} fill={sel?.id === n.id ? "#26264f" : "#161636"} stroke={sel?.id === n.id ? "#F4B860" : "rgba(255,255,255,.14)"} />
                    <rect x={0} y={48} width={(w * Math.min(100, n.score)) / 100} height={4} rx={2} fill={toneColor(n.score, n.attempts)} />
                    <foreignObject x={8} y={4} width={w - 16} height={42}><div className="flex h-full items-center text-[12px] leading-tight text-paper">{n.name}</div></foreignObject>
                  </g>
                );
              })}
            </g>
          </svg>
          <p className="pointer-events-none absolute bottom-3 left-3 text-[0.7rem] text-dim">Drag to pan · scroll or buttons to zoom · tap a concept</p>
        </div>
      )}

      {sel && (
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t hairline bg-ink-2 p-5 pb-safe shadow-2xl animate-rise lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-16 lg:w-80 lg:rounded-2xl lg:border" role="dialog" aria-label={sel.name}>
          <div className="flex items-start justify-between gap-2">
            <div><p className="eyebrow">{sel.chapter}</p><p className="font-display text-2xl leading-tight">{sel.name}</p></div>
            <button onClick={() => setSel(null)} className="grid h-10 w-10 shrink-0 place-items-center text-muted" aria-label="Close"><X size={18} /></button>
          </div>
          {sel.summary && <p className="mt-2 text-sm text-muted">{sel.summary}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/[0.04] p-2"><dt className="text-dim">Mastery</dt><dd className="font-semibold" style={{ color: toneColor(sel.score, sel.attempts) }}>{Math.round(sel.score)}% · {masteryBand(sel.score, sel.attempts).label}</dd></div>
            <div className="rounded-lg bg-white/[0.04] p-2"><dt className="text-dim">Last studied</dt><dd className="font-semibold">{timeAgo(sel.lastStudied)}</dd></div>
          </dl>
          {prereqOf(sel.id).length > 0 && <p className="mt-3 text-xs text-muted"><b className="text-paper">Needs:</b> {prereqOf(sel.id).map((id) => byId.get(id)?.name).join(", ")}</p>}
          {edges.some((e) => e.type === "related" && (e.from === sel.id || e.to === sel.id)) && (
            <p className="mt-1 text-xs text-muted"><b className="text-paper">Related:</b> {edges.filter((e) => e.type === "related" && (e.from === sel.id || e.to === sel.id)).map((e) => byId.get(e.from === sel.id ? e.to : e.from)?.name).filter(Boolean).join(", ")}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/learn/${sel.id}`} className="btn btn-primary btn-sm"><GraduationCap size={15} /> Teach</Link>
            <Link href={`/learn/${sel.id}?mode=visual`} className="btn btn-sm"><Eye size={15} /> Visualize</Link>
            <Link href={`/quiz?concept=${sel.id}`} className="btn btn-sm"><Zap size={15} /> Quiz</Link>
            <Link href={`/learn/${sel.id}?mode=analogy`} className="btn btn-sm"><Sparkles size={15} /> Explain differently</Link>
            <Link href={`/flashcards?concept=${sel.id}`} className="btn btn-sm col-span-2"><Layers size={15} /> Review flashcards</Link>
          </div>
        </div>
      )}
    </div>
  );
}
