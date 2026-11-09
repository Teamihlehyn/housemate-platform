import { ImageResponse } from "next/og";

// Peabudy link-preview card and touch icon. Supersedes lib/ogImage.tsx's renderers
// (engineer: those can be deleted once nothing imports them).

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Peabudy — find a housemate and agree rent split, bills and notice upfront";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#2f6a5a"/><path d="M8 34 C16 18 48 18 56 34 C48 46 16 46 8 34 Z" fill="#dbece4"/><path d="M54 30 c4 -3 6 -7 5 -12" stroke="#dbece4" stroke-width="3.2" stroke-linecap="round" fill="none"/><circle cx="23.5" cy="33" r="9.5" fill="#7cb24a"/><circle cx="22.8" cy="32.3" r="8.7" fill="#97c964"/><circle cx="40.5" cy="33" r="9.5" fill="#7cb24a"/><circle cx="39.8" cy="32.3" r="8.7" fill="#97c964"/><g fill="#23221e"><circle cx="20.2" cy="31.4" r="1.35"/><circle cx="25.6" cy="31.4" r="1.35"/><circle cx="37.2" cy="31.4" r="1.35"/><circle cx="42.6" cy="31.4" r="1.35"/></g></svg>`;
const MARK_URI = `data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`;

export function renderSocialCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#23221e",
          backgroundColor: "#f6f4ef",
          backgroundImage:
            "radial-gradient(circle at 0% 0%, #e6f3d6 0%, rgba(246,244,239,0) 55%), radial-gradient(circle at 100% 100%, #ece6fb 0%, rgba(246,244,239,0) 50%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK_URI} width={80} height={80} alt="" />
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2 }}>peabudy</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>Two peas. One home.</div>
          <div style={{ fontSize: 32, color: "#4a4740" }}>
            Match on move-in dates, budget and habits · agree rent, bills and notice in writing
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["London", "Lagos"].map((c) => (
            <div key={c} style={{ display: "flex", padding: "10px 24px", borderRadius: 999, background: "#ffffff", border: "2px solid #e4e0d6", fontSize: 26 }}>
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE
  );
}

export function renderTouchIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK_URI.replace("rx%3D%2218%22", "rx%3D%220%22")} width={180} height={180} alt="" />
      </div>
    ),
    { width: 180, height: 180 }
  );
}
