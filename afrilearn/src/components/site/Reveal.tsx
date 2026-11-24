"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** Scroll-triggered fade/slide, disabled when the user prefers reduced motion. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** Card that tilts in 3D following the pointer (desktop). */
export function Tilt({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} style={{ transformPerspective: 900 }}
      whileHover={reduce ? undefined : { rotateX: 4, rotateY: -6, y: -6, scale: 1.02 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
      {children}
    </motion.div>
  );
}
