import type { Dict } from "@/lib/i18n";

/** Platform modules and their real delivery status. Only `available: true` items are operational. */
export const MODULES = [
  { key: "accounts", phase: 1, available: true, icon: "🔐" },
  { key: "management", phase: 1, available: true, icon: "🏫" },
  { key: "academy", phase: 2, available: false, icon: "📚" },
  { key: "exams", phase: 2, available: false, icon: "🎓" },
  { key: "ai", phase: 3, available: false, icon: "🤖" },
  { key: "classroom", phase: 4, available: false, icon: "🎥" },
  { key: "marketplace", phase: 4, available: false, icon: "🛒" },
  { key: "community", phase: 4, available: false, icon: "🌍" },
  { key: "payments", phase: 4, available: false, icon: "📱" },
] as const;

export const COURSES = [
  { key: "beginners", levels: "A1–A2", color: "from-royal-500 to-royal-700" },
  { key: "grammar", levels: "A1–C1", color: "from-night-700 to-night-900" },
  { key: "business", levels: "B1–C1", color: "from-gold-500 to-gold-600" },
  { key: "spoken", levels: "A2–C1", color: "from-royal-400 to-royal-600" },
  { key: "travel", levels: "A2–B1", color: "from-night-700 to-royal-600" },
  { key: "academic", levels: "B2–C2", color: "from-royal-700 to-night-800" },
  { key: "professionals", levels: "B1–C1", color: "from-gold-600 to-night-700" },
  { key: "pronunciation", levels: "A1–C2", color: "from-royal-500 to-night-700" },
  { key: "vocabulary", levels: "A1–C2", color: "from-gold-500 to-royal-600" },
  { key: "advanced", levels: "C1–C2", color: "from-night-800 to-night-950" },
] as const;

export const AI_SKILLS = [
  ["AI Conversation", "💬"], ["AI Teacher", "👩🏾‍🏫"], ["AI Pronunciation", "🗣️"], ["AI Grammar", "✍️"], ["AI Vocabulary", "🔤"],
  ["AI Listening", "🎧"], ["AI Writing", "📝"], ["AI Examination", "🧪"], ["AI Progress", "📈"], ["AI Personal Coach", "🧭"],
] as const;

export function moduleText(t: Dict, key: (typeof MODULES)[number]["key"]) {
  return t.modules.items[key];
}
