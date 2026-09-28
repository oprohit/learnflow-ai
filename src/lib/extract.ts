import JSZip from "jszip";
import { capabilityReady, getProvider, AIUnavailable } from "@/lib/ai/provider";

export type Page = { page: number; text: string };
export type Extracted = { pages: Page[]; pageCount: number; method: string };

export class ExtractionError extends Error {}

const stripXml = (s: string) =>
  s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h\d|li|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

function paginate(text: string, size = 3000): Page[] {
  const out: Page[] = [];
  const paras = text.split(/\n+/);
  let buf = "";
  for (const p of paras) {
    if ((buf + p).length > size && buf) {
      out.push({ page: out.length + 1, text: buf.trim() });
      buf = "";
    }
    buf += p + "\n";
  }
  if (buf.trim()) out.push({ page: out.length + 1, text: buf.trim() });
  return out;
}

async function aiTranscribe(buf: Buffer, mime: string, userId: string): Promise<Page[]> {
  if (!capabilityReady("text")) throw new ExtractionError(
    "This file needs AI reading (scanned page or image), and the AI teacher isn't available right now. Try a text-based PDF, DOCX or PPTX."
  );
  try {
    const text = await getProvider().generate(
      "extract.transcribe",
      "Transcribe all educational text in this material faithfully. Mark page or slide boundaries with a line '=== PAGE n ==='. Preserve headings, formulas (use plain text notation), lists and captions. Do not summarise.",
      { userId, inline: [{ mime, base64: buf.toString("base64") }], maxTokens: 32000 }
    );
    const parts = text.split(/===\s*PAGE\s*(\d+)\s*===/i);
    const pages: Page[] = [];
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i += 2) pages.push({ page: Number(parts[i]), text: parts[i + 1].trim() });
    } else pages.push(...paginate(text));
    return pages.filter((p) => p.text);
  } catch (e) {
    if (e instanceof AIUnavailable) throw new ExtractionError("We couldn't read this file with AI right now. Please try again in a minute.");
    throw e;
  }
}

export async function extractText(buf: Buffer, mime: string, fileName: string, userId: string): Promise<Extracted> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  let pages: Page[] = [];
  let method = ext;

  if (ext === "pdf" || mime === "application/pdf") {
    try {
      const { getDocumentProxy, extractText: pdfText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await pdfText(pdf, { mergePages: false });
      pages = (text as string[]).map((t, i) => ({ page: i + 1, text: t.replace(/[ \t]+/g, " ").trim() }));
    } catch {
      pages = [];
    }
    const chars = pages.reduce((n, p) => n + p.text.length, 0);
    if (chars < 200) {
      pages = await aiTranscribe(buf, "application/pdf", userId);
      method = "pdf-ai";
    }
  } else if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    pages = paginate(value);
  } else if (ext === "pptx") {
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => Number(/(\d+)\.xml/.exec(a)![1]) - Number(/(\d+)\.xml/.exec(b)![1]));
    for (const [i, f] of slides.entries()) {
      const xml = await zip.files[f].async("string");
      const runs = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) =>
        [...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join("")
      );
      pages.push({ page: i + 1, text: runs.filter(Boolean).join("\n") });
    }
  } else if (ext === "epub") {
    const zip = await JSZip.loadAsync(buf);
    const opfPath = Object.keys(zip.files).find((f) => f.endsWith(".opf"));
    let order: string[] = [];
    if (opfPath) {
      const opf = await zip.files[opfPath].async("string");
      const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
      const manifest = new Map([...opf.matchAll(/<item\s[^>]*id="([^"]+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1], base + m[2]]));
      order = [...opf.matchAll(/<itemref\s[^>]*idref="([^"]+)"/g)].map((m) => manifest.get(m[1])!).filter(Boolean);
    }
    if (!order.length) order = Object.keys(zip.files).filter((f) => /\.x?html?$/.test(f)).sort();
    for (const f of order) {
      const file = zip.files[decodeURIComponent(f)] ?? zip.files[f];
      if (!file) continue;
      const t = stripXml(await file.async("string"));
      if (t.length > 40) pages.push({ page: pages.length + 1, text: t });
    }
  } else if (["jpg", "jpeg", "png"].includes(ext) || mime.startsWith("image/")) {
    pages = await aiTranscribe(buf, mime.startsWith("image/") ? mime : `image/${ext === "jpg" ? "jpeg" : ext}`, userId);
    method = "image-ai";
  } else if (ext === "ppt") {
    throw new ExtractionError("Legacy .ppt files can't be read directly. Please save the deck as PPTX or PDF and upload again.");
  } else if (["txt", "md"].includes(ext) || mime.startsWith("text/")) {
    pages = paginate(buf.toString("utf8"));
  } else {
    throw new ExtractionError("This file type isn't supported yet.");
  }

  pages = pages.filter((p) => p.text.trim().length > 0);
  if (!pages.length) throw new ExtractionError("We couldn't find readable text in this file. If it's a scan, try again when the AI teacher is available.");
  return { pages, pageCount: pages.length, method };
}
