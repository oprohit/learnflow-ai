"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import LanguageSelect from "@/components/LanguageSelect";

export function DeleteMaterialButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className={`btn ${compact ? "btn-sm" : ""} text-coral`} disabled={pending} aria-label="Delete material"
      onClick={() => {
        if (!confirm("Delete this material and its lessons, quizzes and progress?")) return;
        start(async () => { await fetch(`/api/materials/${id}`, { method: "DELETE" }); router.push("/library"); router.refresh(); });
      }}>
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}{!compact && " Delete"}
    </button>
  );
}

export function AutoRefresh({ ms = 2500 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), ms); return () => clearInterval(t); }, [router, ms]);
  return null;
}

export function MaterialChat({ materialId, language, preferred }: { materialId: string; language: string; preferred: (string | null)[] }) {
  const [lang, setLang] = useState(language);
  return (
    <div className="flex h-[520px] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">Answers come only from this material, with page references.</p>
        <LanguageSelect value={lang} onChange={setLang} preferred={preferred} compact id="chat-lang" />
      </div>
      <div className="min-h-0 flex-1"><ChatPanel materialId={materialId} language={lang} intro="Ask me anything — “Explain chapter 2”, “What does this formula mean?”, “Explain this in Tamil”." /></div>
    </div>
  );
}
