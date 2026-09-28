"use client";
import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, RotateCcw, Loader2, X } from "lucide-react";

type Source = { url?: string; script: string; locale: string; fallback?: boolean };
const SPEEDS = [1, 1.25, 1.5];

/**
 * Voice teacher. Asks the server once per (concept, mode, language); the server caches Gemini audio.
 * Falls back to browser SpeechSynthesis when Gemini TTS is unavailable.
 */
export default function AudioPlayer({ conceptId, mode, language, autoOpen = false }: { conceptId: string; mode: string; language: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [src, setSrc] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<string, Source>());
  const key = `${conceptId}:${mode}:${language}`;

  useEffect(() => { stop(); setSrc(cache.current.get(key) ?? null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  useEffect(() => () => stop(), []);

  function stop() {
    audio.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
  }

  async function load(): Promise<Source | null> {
    if (src) return src;
    const hit = cache.current.get(key);
    if (hit) { setSrc(hit); return hit; }
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conceptId, mode, language }) });
      const d = (await r.json()) as Source;
      if (!r.ok) throw new Error();
      cache.current.set(key, d); setSrc(d);
      return d;
    } catch {
      setError("Voice is unavailable right now. You can keep reading — nothing is lost.");
      return null;
    } finally { setLoading(false); }
  }

  function speak(s: Source, fromStart = false) {
    const synth = window.speechSynthesis;
    if (!synth) { setError("This device doesn't support speech."); return; }
    if (synth.paused && !fromStart) { synth.resume(); setPlaying(true); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(s.script);
    u.lang = s.locale; u.rate = speed;
    const voice = synth.getVoices().find((v) => v.lang === s.locale) ?? synth.getVoices().find((v) => v.lang.startsWith(s.locale.slice(0, 2)));
    if (voice) u.voice = voice;
    else if (!s.locale.startsWith("en")) setError("Your device has no voice for this language installed — it may read with a default voice.");
    u.onend = () => setPlaying(false);
    synth.speak(u); setPlaying(true);
  }

  async function toggle() {
    const s = await load();
    if (!s) return;
    if (s.url) {
      if (!audio.current) {
        audio.current = new Audio(s.url);
        audio.current.onended = () => setPlaying(false);
        audio.current.onerror = () => { setError(null); audio.current = null; speak({ ...s, url: undefined }, true); };
      }
      audio.current.playbackRate = speed;
      if (playing) { audio.current.pause(); setPlaying(false); } else { await audio.current.play().catch(() => speak(s, true)); setPlaying(true); }
    } else if (playing) { window.speechSynthesis.pause(); setPlaying(false); }
    else speak(s);
  }

  async function replay() {
    const s = await load();
    if (!s) return;
    if (s.url && audio.current) { audio.current.currentTime = 0; audio.current.playbackRate = speed; await audio.current.play(); setPlaying(true); }
    else if (s.url) { await toggle(); }
    else speak(s, true);
  }

  function setRate(r: number) {
    setSpeed(r);
    if (audio.current) audio.current.playbackRate = r;
    else if (playing && src && !src.url) { setTimeout(() => speak(src, true), 0); }
  }

  if (!open) {
    return <button className="btn" onClick={() => { setOpen(true); void toggle(); }}><Headphones size={18} /> Listen</button>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-iris/30 bg-iris/[0.07] p-2" role="group" aria-label="Voice teacher">
      <button className="grid h-11 w-11 place-items-center rounded-lg bg-iris text-ink" onClick={toggle} aria-label={playing ? "Pause" : "Play"} disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:text-paper" onClick={replay} aria-label="Replay from start"><RotateCcw size={17} /></button>
      <div className="flex rounded-lg border hairline" role="radiogroup" aria-label="Speed">
        {SPEEDS.map((r) => (
          <button key={r} role="radio" aria-checked={speed === r} onClick={() => setRate(r)} className={`h-9 px-2.5 text-xs font-semibold ${speed === r ? "text-saffron" : "text-muted"}`}>{r}x</button>
        ))}
      </div>
      <span className="px-1 text-xs text-muted">{src?.url ? "AI voice" : src ? "Device voice" : "Voice teacher"}</span>
      <button className="ml-auto grid h-9 w-9 place-items-center text-muted" onClick={() => { stop(); setOpen(false); }} aria-label="Close player"><X size={16} /></button>
      {error && <p className="w-full px-1 text-xs text-coral">{error}</p>}
    </div>
  );
}
