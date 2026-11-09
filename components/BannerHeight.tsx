"use client";

import { useEffect } from "react";

// The environment banner can wrap onto two or three lines on a phone. Publish its real height
// as --banner-h so sticky headers and the full-screen chat sit directly under it.
export default function BannerHeight() {
  useEffect(() => {
    const el = document.getElementById("env-banner");
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--banner-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return null;
}
