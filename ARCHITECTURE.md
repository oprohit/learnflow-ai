# LearnFlow AI — Architecture

**Tagline:** Your material. Your language. Your way of learning.

## Core principle
ONE SOURCE → LEARNING OBJECTIVES → CONCEPT MODEL → MULTIPLE REPRESENTATIONS → ADAPTIVE TEACHING → ASSESSMENT → MASTERY → NEXT BEST LESSON

* `materials` / `material_chunks` — the source, chunked with page numbers (grounded chat never resends the whole document).
* `chapters`, `learning_objectives`, `concepts`, `concept_relations` — the **canonical learning model**, written once by the pipeline.
* `lesson_representations (concept, mode, language, variant)` — cached representations. Every non-English representation is a *translation of the canonical English one*, so objectives never drift. Each carries `objectiveId` and source refs.
* `lesson_states (user, concept)` — mode, language, step, progress, difficulty. Switching language only changes the representation; this row is untouched → the lesson never restarts.

## Pipeline (`src/lib/pipeline.ts`)
UPLOAD → EXTRACT (unpdf / mammoth / JSZip for PPTX+EPUB / Gemini vision for scans+images) → STRUCTURE (1 Gemini call, or heuristic fallback) → OBJECTIVES → CONCEPTS → PREREQUISITES → STORE → FIRST LESSON → QUIZ BANK (batched) → FLASHCARDS (deterministic) → STUDY PLAN → READY. Each stage is written to `materials.stage_log` as it happens; the UI polls real stages.

## AI usage policy (free Gemini only)
* Provider abstraction: `src/lib/ai/provider.ts`. Models from env. Capability verification (`models.get`) + circuit breaker (429 → cooldown, 404/403 → disabled).
* AI does: structuring, lessons, translation, quiz banks, grounded chat, TTS, illustrations.
* App logic does: mastery (Elo-style, `src/lib/learning.ts`), forgetting curve, next-step decisions over the prerequisite graph, surprise-quiz triggers, study plans, leaderboards, grading.
* Everything expensive is cached in Postgres (`lesson_representations`, `translations`, `media_cache` for audio/images). Every call and cache hit is recorded in `ai_usage` (per user + operation) and shown on the profile page.
* Fallbacks: no key/quota → deterministic lesson templates, stored quiz bank, browser SpeechSynthesis, SVG diagrams, offline chat excerpts with citations.

## Security
* Auth: scrypt password hashes, random session tokens stored as SHA-256, HTTP-only cookies. Reset tokens hashed, 1-hour expiry.
* Authorization is enforced server-side on every query (`canAccessMaterial`, user-scoped queries) — the application-level equivalent of RLS. Materials are private; teachers only see mastery for material they assigned; AI chats are never persisted.
* Secrets only in server env (`.env`, never committed). `GEMINI_API_KEY` is never sent to the client.

> Note: the requested Supabase Auth/Storage are replaced by the platform's PostgreSQL + Drizzle. Files are stored as rows (`material_files`, `media_cache`) and served only through authenticated routes.

## Frontend
Mobile-first Next.js App Router, one codebase for desktop, mobile web, and Android (Capacitor, `capacitor.config.ts`, `NativeBridge` for back button / status bar / keyboard). `100dvh`, safe-area insets, bottom nav on mobile, sidebar ≥1024px, 44px+ touch targets.

## Android
```
npm i && npx cap add android
CAP_SERVER_URL=https://your-app npx cap sync android && npx cap open android
```
