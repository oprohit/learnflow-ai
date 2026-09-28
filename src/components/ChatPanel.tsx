"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Loader2, BookMarked } from "lucide-react";
import { SPEECH_LOCALES } from "@/lib/constants";

type Msg = { role: "user" | "teacher"; text: string; citations?: { page?: number | null; chapter?: string; ref?: string }[]; action?: { label: string; href: string } };

const SUGGEST = ["Make this easier", "Give me a real-world example", "What does this formula mean?", "Why does this happen?", "Quiz me"];

type SpeechRec = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void };

/** Grounded chat with the learner's material. Conversations are never stored server-side (privacy). */
export default function ChatPanel({ materialId, conceptId, language, intro }: { materialId: string; conceptId?: string; language: string; intro?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(intro ? [{ role: "teacher", text: intro }] : []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs]);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setVoiceOk(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ materialId, conceptId, message: t, language, history }) });
      const d = await r.json();
      setMsgs((m) => [...m, { role: "teacher", text: d.text ?? d.error ?? "Something went wrong.", citations: d.citations, action: d.action }]);
    } catch {
      setMsgs((m) => [...m, { role: "teacher", text: "You seem to be offline. Your saved lessons are still here." }]);
    } finally { setBusy(false); }
  }

  function voice() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = SPEECH_LOCALES[language] ?? "en-IN";
    r.interimResults = false;
    r.onresult = (e) => { const said = e.results[0]?.[0]?.transcript ?? ""; setInput(said); void send(said); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-thin pr-1" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-8 rounded-xl rounded-br-sm bg-iris/15 px-3.5 py-2.5 text-sm" : "mr-4 text-sm leading-relaxed"}>
            <p className="whitespace-pre-wrap">{m.text.replace(/\[S\d\]/g, "")}</p>
            {!!m.citations?.length && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.citations.map((c, j) => <span key={j} className="chip py-0.5 text-[0.68rem]"><BookMarked size={11} />{c.chapter ? `${c.chapter} · ` : ""}p. {c.page ?? "?"}</span>)}
              </div>
            )}
            {m.action && <Link href={m.action.href} className="btn btn-sm btn-iris mt-2">{m.action.label}</Link>}
          </div>
        ))}
        {busy && <p className="text-sm text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Thinking about your material…</p>}
        <div ref={end} />
      </div>
      {msgs.length <= 1 && (
        <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SUGGEST.map((s) => <button key={s} className="chip shrink-0 min-h-9 hover:text-paper" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input className="input min-h-11 flex-1 py-2" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your teacher…" aria-label="Ask your teacher" />
        {voiceOk && <button type="button" onClick={voice} className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${listening ? "border-coral text-coral" : "border-line-2 text-muted"}`} aria-label={listening ? "Stop listening" : "Ask by voice"}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
        <button className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-saffron text-ink disabled:opacity-40" disabled={!input.trim() || busy} aria-label="Send"><Send size={17} /></button>
      </form>
    </div>
  );
}
