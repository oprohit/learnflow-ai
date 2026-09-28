"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileText, Camera, Check, Loader2, AlertTriangle, Sparkles, X, BookOpen, ArrowRight } from "lucide-react";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

type Status = {
  id: string; title: string; status: string; error: string | null; engine: string | null;
  stageLog: { stage: string; label: string; at: string; detail?: string }[];
  counts: { concepts: number; objectives: number; chapters: number; questions: number };
  firstConceptId: string | null;
};

const PIPELINE = [
  { stage: "extracting", label: "Reading your material" },
  { stage: "structuring", label: "Finding chapters & sections" },
  { stage: "objectives", label: "Identifying learning objectives" },
  { stage: "concepts", label: "Finding the important concepts" },
  { stage: "prerequisites", label: "Building the concept map" },
  { stage: "lesson", label: "Preparing your first lesson" },
  { stage: "quiz", label: "Writing quizzes & flashcards" },
  { stage: "ready", label: "Ready" },
];

const fmt = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export default function UploadFlow({ subject, welcome }: { subject?: string | null; welcome?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subj, setSubj] = useState(subject ?? "");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) { setError("Files up to 15 MB are supported."); return; }
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    setPreview(f.type.startsWith("image/") || f.type === "application/pdf" ? URL.createObjectURL(f) : null);
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!materialId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/materials/${materialId}`, { cache: "no-store" });
        if (r.ok) { const s = (await r.json()) as Status; setStatus(s); if (s.status === "ready" || s.status === "failed") stop = true; }
      } catch { /* network blip: keep polling */ }
      if (!stop) setTimeout(tick, 1100);
    };
    tick();
    return () => { stop = true; };
  }, [materialId]);

  const upload = () => {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("title", title); fd.append("subject", subj);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/materials");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const res = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 400) { setError(res.error ?? "Upload failed. Please try again."); setProgress(null); return; }
      setMaterialId(res.id);
    };
    xhr.onerror = () => { setError("You seem to be offline. Check your connection and try again."); setProgress(null); };
    setProgress(0);
    xhr.send(fd);
  };

  const sample = async () => {
    setError(null); setProgress(100);
    const r = await fetch("/api/materials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sample: true }) });
    const res = await r.json();
    if (!r.ok) { setError(res.error); setProgress(null); return; }
    setMaterialId(res.id);
  };

  /* ---------- processing view ---------- */
  if (materialId) {
    const reached = new Set(status?.stageLog.map((s) => s.stage) ?? []);
    const current = status?.status ?? "queued";
    const detailFor = (stage: string) => [...(status?.stageLog ?? [])].reverse().find((s) => s.stage === stage && s.detail)?.detail;
    return (
      <div className="mx-auto max-w-2xl animate-rise">
        <p className="eyebrow mb-3">{status?.title ?? file?.name ?? "Your material"}</p>
        {current === "ready" && status ? (
          <>
            <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">Your material contains <span className="text-saffron">{status.counts.objectives} learning objectives</span> and <span className="text-iris">{status.counts.concepts} concepts</span>.</h1>
            <p className="mt-4 text-muted">I&rsquo;ve built a concept map, a study plan, your first lesson, {status.counts.questions} quiz questions and flashcards. Let&rsquo;s start with the basics.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {status.firstConceptId && <Link href={`/learn/${status.firstConceptId}`} className="btn btn-primary h-12 text-base"><Sparkles size={18} /> Start first lesson</Link>}
              <Link href={`/materials/${status.id}`} className="btn h-12 text-base"><BookOpen size={18} /> See what you&rsquo;ll learn</Link>
            </div>
            {status.engine === "local" && <p className="mt-6 text-xs text-dim">Analysed on-device because the AI teacher wasn&rsquo;t available. Add a Gemini key for richer lessons — everything you do now is kept.</p>}
          </>
        ) : current === "failed" ? (
          <>
            <h1 className="font-display text-4xl">We couldn&rsquo;t finish reading this.</h1>
            <p className="mt-3 flex items-start gap-2 text-coral"><AlertTriangle size={18} className="mt-0.5 shrink-0" /> {status?.error}</p>
            <button className="btn mt-6" onClick={() => { setMaterialId(null); setStatus(null); setProgress(null); }}>Try another file</button>
          </>
        ) : (
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">{PIPELINE.find((p) => p.stage === current)?.label ?? "Getting started"}<span className="loading-dot">…</span></h1>
        )}
        <ol className="mt-10 space-y-1" aria-live="polite">
          {PIPELINE.map((p) => {
            const done = reached.has(p.stage) && p.stage !== current || current === "ready";
            const active = p.stage === current && current !== "ready";
            return (
              <li key={p.stage} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-white/[0.04]" : ""}`}>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-sage bg-sage/20 text-sage" : active ? "border-saffron text-saffron" : "border-line text-dim"}`}>
                  {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : null}
                </span>
                <div className="min-w-0">
                  <p className={done || active ? "text-paper" : "text-dim"}>{p.label}</p>
                  {detailFor(p.stage) && <p className="text-xs text-muted">{detailFor(p.stage)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  /* ---------- picker view ---------- */
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow mb-3">{welcome ? "You're all set" : "New material"}</p>
      <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">{welcome ? "Now, give me something to teach you." : "Upload anything you need to learn."}</h1>
      <p className="mt-3 text-muted">Textbooks, notes, slides or photos of pages. I&rsquo;ll find the learning objectives and concepts — without changing what you need to learn.</p>

      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={`mt-8 rounded-2xl border border-dashed p-8 text-center transition sm:p-14 ${drag ? "border-saffron bg-saffron/5" : "border-line-2 bg-white/[0.015]"}`}>
          <UploadCloud className="mx-auto text-saffron" size={36} strokeWidth={1.5} />
          <p className="mt-4 font-display text-2xl"><span className="hidden sm:inline">Drop your file here</span><span className="sm:hidden">Choose your material</span></p>
          <p className="mt-1 text-sm text-muted">PDF · EPUB · DOCX · PPTX · JPG · PNG — up to 15 MB</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button className="btn btn-primary" onClick={() => inputRef.current?.click()}><FileText size={18} /> Browse files</button>
            <button className="btn sm:hidden" onClick={() => camRef.current?.click()}><Camera size={18} /> Photograph a page</button>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a file" />
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Take a photo" />
        </div>
      ) : (
        <div className="card mt-8 overflow-hidden">
          <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
            <div className="grid h-44 place-items-center border-b hairline bg-ink-3 sm:h-auto sm:border-b-0 sm:border-r">
              {preview && file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview of your upload" className="h-full max-h-60 w-full object-contain" />
              ) : preview && file.type === "application/pdf" ? (
                <object data={`${preview}#toolbar=0&view=FitH`} type="application/pdf" className="pointer-events-none h-44 w-full sm:h-full" aria-label="PDF preview"><FileText size={40} className="text-muted" /></object>
              ) : <FileText size={40} className="text-muted" />}
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-medium">{file.name}</p><p className="text-xs text-muted">{fmt(file.size)} · {file.name.split(".").pop()?.toUpperCase()}</p></div>
                <button className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:text-paper" onClick={() => { setFile(null); setPreview(null); setProgress(null); }} aria-label="Remove file"><X size={18} /></button>
              </div>
              <label className="block"><span className="mb-1.5 block text-sm">Title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label className="block"><span className="mb-1.5 block text-sm">Subject</span><input className="input" value={subj} onChange={(e) => setSubj(e.target.value)} placeholder="Physics" /></label>
              {progress !== null ? (
                <div><div className="mb-1 flex justify-between text-xs text-muted"><span>Uploading securely…</span><span>{progress}%</span></div><div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-saffron transition-all" style={{ width: `${progress}%` }} /></div></div>
              ) : (
                <button className="btn btn-primary w-full" onClick={upload}>Analyse material <ArrowRight size={18} /></button>
              )}
            </div>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-coral"><AlertTriangle size={16} /> {error}</p>}

      <div className="mt-8 flex flex-col items-start gap-3 border-t hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-medium">No file handy?</p><p className="text-sm text-muted">Try the sample chapter: <em>Newton&rsquo;s Laws of Motion</em> — the full journey in two minutes.</p></div>
        <button className="btn btn-iris" onClick={sample} disabled={progress !== null}><Sparkles size={18} /> Use sample</button>
      </div>
    </div>
  );
}
