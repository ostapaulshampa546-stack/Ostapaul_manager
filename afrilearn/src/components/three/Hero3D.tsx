"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { africaDots, CITIES, project } from "@/lib/africa";

const AfricaScene = dynamic(() => import("./AfricaScene"), { ssr: false, loading: () => null });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Light SVG version of the map: shown instantly, kept when WebGL is unavailable or the connection is slow. */
export function AfricaPoster({ className = "" }: { className?: string }) {
  const dots = africaDots(1.6);
  return (
    <svg viewBox="-4.2 -4.0 8.4 8.0" className={className} aria-hidden="true">
      <g transform="scale(1,-1)">
        {dots.map(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          return <circle key={i} cx={x} cy={y} r={0.055} fill={i % 23 === 0 ? "#f5b82e" : "#2f66ff"} opacity={0.75} />;
        })}
        {CITIES.map((c) => {
          const [x, y] = project(c.lon, c.lat);
          return <circle key={c.name} cx={x} cy={y} r={0.1} fill="#f5b82e" />;
        })}
      </g>
    </svg>
  );
}

export default function Hero3D() {
  const [mode, setMode] = useState<"poster" | "3d">("poster");
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = conn?.saveData || conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";
    if (!slow && hasWebGL()) setMode("3d");
  }, []);
  return mode === "3d" ? <AfricaScene /> : (
    <div className="absolute inset-0 flex items-center justify-end pr-[4vw] opacity-80">
      <AfricaPoster className="h-[80%] max-h-[620px]" />
    </div>
  );
}
