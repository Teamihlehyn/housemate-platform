import type { Metadata } from "next";
import "./globals.css";
import { PROTOTYPE_BANNER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Housemate — find people, organise a shared home",
  description:
    "Match on living preferences and move-in dates, see what's verified, and organise a shared home. Prototype with sample people and simulated checks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <div className="sticky top-0 z-50 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 border-b border-amber-200">
          {PROTOTYPE_BANNER}
        </div>
        {children}
      </body>
    </html>
  );
}
