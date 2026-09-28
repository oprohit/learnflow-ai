"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Check, RotateCcw, ArrowRight } from "lucide-react";

type Card = { id: string; front: string; back: string; kind: string; conceptName: string };

export default function Flashcards({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [tally, setTally] = useState({ know: 0, later: 0 });
  const start = useRef(Date.now());
  const card = cards[i];

  async function rate(result: "know" | "later") {
    if (!card) return;
    setTally((t) => ({ ...t, [result]: t[result] + 1 }));
    void fetch("/api/flashcards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ flashcardId: card.id, result }) });
    setFlip(false);
    if (i + 1 >= cards.length) void fetch("/api/flashcards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ finish: true, minutes: (Date.now() - start.current) / 60000 }) });
    setI(i + 1);
  }

  if (!cards.length) return <p className="text-muted">No flashcards yet — upload a material to generate them.</p>;
  if (!card) return (
    <div className="card mx-auto max-w-md p-8 text-center animate-rise">
      <p className="font-display text-4xl">Deck complete</p>
      <p className="mt-2 text-muted">{tally.know} known · {tally.later} to review later. Your mastery has been updated.</p>
      <div className="mt-6 flex justify-center gap-2"><button className="btn" onClick={() => { setI(0); setTally({ know: 0, later: 0 }); }}><RotateCcw size={16} /> Again</button><Link href="/progress" className="btn btn-primary">Progress <ArrowRight size={16} /></Link></div>
    </div>
  );
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex justify-between text-xs text-muted"><span>{card.conceptName} · {card.kind}</span><span className="tabular-nums">{i + 1} / {cards.length}</span></div>
      <button onClick={() => setFlip((f) => !f)} className="relative block h-72 w-full [perspective:1200px] sm:h-80" aria-label={flip ? "Show question" : "Reveal answer"}>
        <div className={`relative h-full w-full rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] ${flip ? "[transform:rotateY(180deg)]" : ""}`}>
          <div className="card absolute inset-0 grid place-items-center p-8 text-center [backface-visibility:hidden]"><p className="font-display text-3xl leading-tight">{card.front}</p><span className="absolute bottom-4 text-xs text-dim">Tap to reveal</span></div>
          <div className="absolute inset-0 grid place-items-center rounded-2xl border border-iris/40 bg-iris/[0.08] p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]"><p className="text-lg leading-relaxed">{card.back}</p></div>
        </div>
      </button>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button className="btn h-12 border-coral/40 text-coral" onClick={() => rate("later")}><RotateCcw size={17} /> Review later</button>
        <button className="btn h-12 border-sage/40 text-sage" onClick={() => rate("know")}><Check size={17} /> Know it</button>
      </div>
    </div>
  );
}
