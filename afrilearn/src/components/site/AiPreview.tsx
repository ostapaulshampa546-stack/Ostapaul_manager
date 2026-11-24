"use client";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Static design preview of the AI teacher interface (phase 3).
 * Deliberately NOT interactive: the AI teacher is not operational yet.
 */
export function AiPreview({ label, variant }: { label: string; variant: "us" | "uk" }) {
  const reduce = useReducedMotion();
  const lines = variant === "uk"
    ? [{ who: "ai", text: "Good morning! Shall we practise booking a flat in London today?" },
       { who: "me", text: "Yes. I want to rent a flat near the underground." },
       { who: "fix", text: "✓ Great sentence! Try: “I'd like to rent a flat near the Tube.”" }]
    : [{ who: "ai", text: "Hi there! Ready to practice ordering at a café in New York?" },
       { who: "me", text: "Yes, I would like one coffee and a cookie please." },
       { who: "fix", text: "✓ Natural! Americans often say: “Can I get a coffee and a cookie?”" }];
  return (
    <div className="relative">
      <div className="absolute -top-3 left-4 z-10 rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-night-900 shadow">{label}</div>
      <div className="glass rounded-3xl p-5 pt-7 shadow-glow">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-royal-500 to-night-700 font-display font-bold text-gold-400">AI</div>
            <div>
              <p className="font-semibold text-white">AFRILEARN AI Teacher</p>
              <p className="text-xs text-white/60">{variant === "uk" ? "British English · B1" : "American English · B1"}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/80">{variant.toUpperCase()}</span>
        </div>
        <div className="space-y-3 py-4">
          {lines.map((l, i) => (
            <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.6 }}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${l.who === "me" ? "ml-auto bg-royal-600 text-white" : l.who === "fix" ? "border border-gold-500/40 bg-gold-500/10 text-gold-100" : "bg-white/10 text-white"}`}>
              {l.text}
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-night-950/60 p-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-500 text-night-900">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1a7 7 0 0 0 6-6.9h-2Z" /></svg>
          </div>
          <div className="flex h-10 min-w-0 flex-1 items-end gap-1 overflow-hidden" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className="voice-bar w-1.5 shrink-0 rounded-full bg-gradient-to-t from-royal-500 to-gold-400"
                style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 7) * 0.12}s` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
