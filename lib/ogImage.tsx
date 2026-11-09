import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Peabudy — find a flatmate and agree rent split, bills and notice upfront";

// Shared link-preview card for Open Graph and Twitter.
export function renderOgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f6f4ef", padding: 72, color: "#23221e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#2f6a5a", color: "#faf9f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 700 }}>P</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Peabudy</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, lineHeight: 1.02, letterSpacing: -3 }}>Find a flatmate whose plans fit yours</div>
          <div style={{ fontSize: 32, color: "#6b6a65" }}>Match on move-in dates and habits · agree rent split, bills and notice in writing</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["London", "Lagos"].map((c) => (
            <div key={c} style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: "#ffffff", border: "2px solid #e7e5df", fontSize: 26 }}>{c}</div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE
  );
}

// Apple touch icon.
export function renderAppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2f6a5a", color: "#faf9f5", fontSize: 120, fontWeight: 700 }}>P</div>
    ),
    { width: 180, height: 180 }
  );
}
