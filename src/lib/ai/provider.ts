/**
 * AI provider abstraction. Gemini is the only external provider (free tier).
 * All calls are server-side; GEMINI_API_KEY never reaches the client.
 * Models are environment-driven so they can be swapped without code changes.
 */
import { db } from "@/db";
import { aiUsage } from "@/db/schema";

export type Capability = "text" | "fast" | "tts" | "image";
export type InlinePart = { mime: string; base64: string };

export class AIUnavailable extends Error {
  constructor(public reason: "no_key" | "quota" | "unavailable" | "error", msg?: string) {
    super(msg ?? reason);
  }
}

export interface AIProvider {
  name: string;
  configured(): boolean;
  generate(op: string, prompt: string, opts?: GenOpts): Promise<string>;
  speech(op: string, text: string, opts?: { userId?: string | null; voice?: string }): Promise<InlinePart>;
  image(op: string, prompt: string, opts?: { userId?: string | null }): Promise<InlinePart>;
}

export type GenOpts = {
  userId?: string | null;
  capability?: "text" | "fast";
  json?: boolean;
  system?: string;
  inline?: InlinePart[];
  temperature?: number;
  maxTokens?: number;
};

const env = (k: string, d: string) => process.env[k]?.trim() || d;
export const MODELS = {
  text: () => env("GEMINI_TEXT_MODEL", "gemini-3.8-flash"),
  fast: () => env("GEMINI_FAST_MODEL", "gemini-3.8-flash"),
  tts: () => env("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts"),
  image: () => env("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image"),
};

/* ---- process-wide health state (circuit breaker) ---- */
type Health = { disabledUntil: number; reason?: string; verified?: boolean };
const g = globalThis as typeof globalThis & { __lfHealth?: Record<string, Health> };
const health: Record<string, Health> = (g.__lfHealth ??= {});
const h = (cap: Capability) => (health[cap] ??= { disabledUntil: 0 });

function trip(cap: Capability, ms: number, reason: string) {
  h(cap).disabledUntil = Date.now() + ms;
  h(cap).reason = reason;
}

export function aiStatus() {
  const key = !!process.env.GEMINI_API_KEY;
  const caps = (["text", "fast", "tts", "image"] as Capability[]).map((c) => ({
    capability: c,
    model: MODELS[c](),
    available: key && h(c).disabledUntil < Date.now(),
    reason: !key ? "No GEMINI_API_KEY configured" : h(c).disabledUntil > Date.now() ? h(c).reason : undefined,
  }));
  return { configured: key, capabilities: caps };
}

export function capabilityReady(cap: Capability) {
  return !!process.env.GEMINI_API_KEY && h(cap).disabledUntil < Date.now();
}

async function logUsage(row: {
  userId?: string | null; operation: string; model: string; ok: boolean; cached?: boolean; tokensIn?: number; tokensOut?: number;
}) {
  try {
    await db.insert(aiUsage).values({
      userId: row.userId ?? null, operation: row.operation, model: row.model, ok: row.ok,
      cached: row.cached ?? false, tokensIn: row.tokensIn ?? 0, tokensOut: row.tokensOut ?? 0,
    });
  } catch { /* accounting must never break the product */ }
}

/** Record a cache hit so we can see how much Gemini traffic caching saves. */
export const logCacheHit = (operation: string, userId?: string | null) =>
  logUsage({ userId, operation, model: "cache", ok: true, cached: true });

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Verify once per process that the configured model exists for this key. */
async function verify(cap: Capability) {
  if (h(cap).verified) return;
  const res = await fetch(`${BASE}/${MODELS[cap]()}`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
  }).catch(() => null);
  if (res && (res.status === 404 || res.status === 400 || res.status === 403)) {
    trip(cap, 6 * 3600_000, "Model not available for this key");
    throw new AIUnavailable("unavailable");
  }
  if (res?.ok) h(cap).verified = true;
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

async function call(cap: Capability, op: string, body: unknown, userId?: string | null): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AIUnavailable("no_key");
  if (h(cap).disabledUntil > Date.now()) throw new AIUnavailable(h(cap).reason === "quota" ? "quota" : "unavailable");
  await verify(cap);
  const model = MODELS[cap]();
  let res: Response;
  try {
    res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cap === "text" ? 120_000 : 60_000),
    });
  } catch {
    await logUsage({ userId, operation: op, model, ok: false });
    throw new AIUnavailable("error", "network");
  }
  if (!res.ok) {
    await logUsage({ userId, operation: op, model, ok: false });
    if (res.status === 429) {
      trip(cap, 60_000, "quota");
      throw new AIUnavailable("quota");
    }
    if (res.status === 404 || res.status === 403) {
      trip(cap, 6 * 3600_000, "Model not available for this key");
      throw new AIUnavailable("unavailable");
    }
    if (res.status >= 500) trip(cap, 20_000, "Service temporarily unavailable");
    throw new AIUnavailable("error", `status ${res.status}`);
  }
  const data = (await res.json()) as GeminiResponse;
  await logUsage({
    userId, operation: op, model, ok: true,
    tokensIn: data.usageMetadata?.promptTokenCount, tokensOut: data.usageMetadata?.candidatesTokenCount,
  });
  return data;
}

function pcmToWav(pcm: Buffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export const gemini: AIProvider = {
  name: "gemini",
  configured: () => !!process.env.GEMINI_API_KEY,
  async generate(op, prompt, opts = {}) {
    const cap = opts.capability ?? "text";
    const model = MODELS[cap]();
    const parts: unknown[] = (opts.inline ?? []).map((p) => ({ inlineData: { mimeType: p.mime, data: p.base64 } }));
    parts.push({ text: prompt });
    const generationConfig: Record<string, unknown> = {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 8192,
    };
    if (opts.json) generationConfig.responseMimeType = "application/json";
    if (/2\.5-flash|3\.\d+-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const data = await call(cap, op, {
      contents: [{ role: "user", parts }],
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      generationConfig,
    }, opts.userId);
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new AIUnavailable("error", "empty");
    return text;
  },
  async speech(op, text, opts = {}) {
    const data = await call("tts", op, {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice ?? env("GEMINI_TTS_VOICE", "Kore") } } },
      },
    }, opts.userId);
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline) throw new AIUnavailable("error", "no audio");
    const rate = Number(/rate=(\d+)/.exec(inline.mimeType)?.[1] ?? 24000);
    const wav = inline.mimeType.includes("wav") ? Buffer.from(inline.data, "base64") : pcmToWav(Buffer.from(inline.data, "base64"), rate);
    return { mime: "audio/wav", base64: wav.toString("base64") };
  },
  async image(op, prompt, opts = {}) {
    const data = await call("image", op, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }, opts.userId);
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline) throw new AIUnavailable("error", "no image");
    return { mime: inline.mimeType, base64: inline.data };
  },
};

export function getProvider(): AIProvider {
  // Single provider today; the switch point for future providers.
  return gemini;
}

/** Parse JSON from a model response defensively. */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new AIUnavailable("error", "bad json");
  }
}

export async function generateJSON<T>(op: string, prompt: string, opts: GenOpts = {}): Promise<T> {
  const raw = await getProvider().generate(op, prompt, { ...opts, json: true });
  return parseJSON<T>(raw);
}

export const FRIENDLY_AI_ERROR =
  "Your AI teacher is temporarily unavailable. Your saved lessons are still accessible.";
