import { ImageResponse } from "next/og";

export const alt = "OSTAPAUL MANAGER — Un seul logiciel. Trois secteurs. Une gestion intelligente.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72,
        background: "linear-gradient(135deg, #050f2a 0%, #0b1f4b 55%, #1a3f8f 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, border: "12px solid #1E6BFF", borderTopColor: "#D4A72C", display: "flex" }} />
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>OSTAPAUL&nbsp;<span style={{ color: "#D4A72C" }}>MANAGER</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>Un seul logiciel. Trois secteurs.</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#3B82FF", lineHeight: 1.1 }}>Une gestion intelligente.</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 30, color: "rgba(255,255,255,0.8)" }}>
          <span>Restaurants</span><span>·</span><span>Écoles & universités</span><span>·</span><span>PME</span><span style={{ color: "#E5BF4F" }}>· RDC</span>
        </div>
      </div>
    ),
    size,
  );
}
