export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "ar", name: "Arabic", native: "العربية" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export function langName(code: string | null | undefined) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}
export function langNative(code: string | null | undefined) {
  return LANGUAGES.find((l) => l.code === code)?.native ?? "English";
}
export const SPEECH_LOCALES: Record<string, string> = {
  en: "en-IN", ta: "ta-IN", hi: "hi-IN", te: "te-IN", ml: "ml-IN", kn: "kn-IN", bn: "bn-IN",
  mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", ur: "ur-IN", es: "es-ES", fr: "fr-FR", ar: "ar-SA",
};

export const MODES = [
  { id: "simple", label: "Simple" },
  { id: "standard", label: "Standard" },
  { id: "advanced", label: "Advanced" },
  { id: "visual", label: "Visual" },
  { id: "analogy", label: "Analogy" },
  { id: "steps", label: "Steps" },
  { id: "example", label: "Real-world" },
  { id: "zero", label: "From zero" },
] as const;
export type Mode = (typeof MODES)[number]["id"];
export const MODE_IDS = MODES.map((m) => m.id) as string[];

/** Order of strategies the teacher cycles through on "I don't understand". */
export const CONFUSION_STRATEGIES: { mode: Mode; label: string; reason: string }[] = [
  { mode: "analogy", label: "Real-world analogy", reason: "Let me try this with something from everyday life." },
  { mode: "visual", label: "Visual", reason: "Let me show you instead of telling you." },
  { mode: "steps", label: "Step-by-step", reason: "Let's slow down and go one small step at a time." },
  { mode: "zero", label: "From the beginning", reason: "Let's rebuild this from the very basics." },
];

export const EDUCATION_LEVELS = ["School", "College", "University", "Professional", "Other"];
export const GOALS = ["Understand concepts", "Exam preparation", "Homework help", "Learn from basics", "Revision", "Deep mastery"];
export const STYLES = [
  { id: "simple", label: "Explain simply", hint: "Plain words, short sentences" },
  { id: "steps", label: "Step-by-step", hint: "One idea at a time" },
  { id: "visual", label: "Visual", hint: "Diagrams and flows first" },
  { id: "example", label: "Examples first", hint: "Start from real situations" },
  { id: "question", label: "Question-based", hint: "Learn by answering" },
  { id: "advanced", label: "Deep / advanced", hint: "Rigour and precision" },
  { id: "adaptive", label: "Adaptive mix", hint: "Let the teacher decide" },
];

export function styleToMode(style: string | null | undefined): Mode {
  switch (style) {
    case "simple": return "simple";
    case "steps": return "steps";
    case "visual": return "visual";
    case "example": return "example";
    case "advanced": return "advanced";
    default: return "standard";
  }
}

export function masteryBand(score: number, attempts = 1) {
  if (attempts === 0 && score === 0) return { label: "Not started", tone: "idle" as const };
  if (score >= 75) return { label: "Strong", tone: "strong" as const };
  if (score >= 40) return { label: "Developing", tone: "developing" as const };
  return { label: "Needs attention", tone: "weak" as const };
}

export const ACCEPTED_TYPES = ".pdf,.epub,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.md";
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
