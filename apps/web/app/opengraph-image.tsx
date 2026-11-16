import { ImageResponse } from "next/og";
import { site } from "@/content/site";

// The picture shown when a link to the website is shared (WhatsApp, Facebook, LinkedIn, X).
export const alt = `${site.name}: software for schools, clinics and businesses in Liberia`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#064644",
        color: "#ffffff",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          top: 0,
          bottom: 0,
          width: 520,
          background: "#0B6A67",
          transform: "skewX(-14deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 360,
          top: 0,
          bottom: 0,
          width: 34,
          background: "#FF5A12",
          transform: "skewX(-14deg)",
        }}
      />
      <div style={{ display: "flex", alignItems: "baseline", fontSize: 54, fontWeight: 800 }}>
        Core<span style={{ color: "#FF7A3D" }}>X</span>
        <span style={{ fontSize: 22, letterSpacing: 6, marginLeft: 18, color: "#CFE3E1" }}>
          DIGITAL SOLUTIONS
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
        <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          Software that makes your work simpler.
        </div>
        <div style={{ fontSize: 30, color: "#CFE3E1", marginTop: 24, lineHeight: 1.35 }}>
          School, clinic and finance systems for Liberia. Try a live demo before you pay.
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 26, color: "#CFE3E1" }}>
        corexlr.com · Monrovia, Liberia
      </div>
    </div>,
    size,
  );
}
