import type { Metadata } from "next";
import Script from "next/script";
import { Schibsted_Grotesk, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { BANNER } from "@/lib/env";
import ResearchTools from "@/components/ResearchTools";

const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Absolute URLs are required for link previews (WhatsApp, iMessage, LinkedIn).
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const TITLE = "Housemate — find a flatmate and agree the money stuff upfront";
const DESCRIPTION =
  "Match on move-in dates and living habits, see what's been checked, and agree rent split, bills and notice in writing before you move in. London & Lagos.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Housemate",
  openGraph: {
    type: "website",
    siteName: "Housemate",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_GB",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Microsoft Clarity session recordings for user research (set NEXT_PUBLIC_CLARITY_ID).
const CLARITY_ID = /^[a-z0-9]+$/i.test(process.env.NEXT_PUBLIC_CLARITY_ID || "") ? process.env.NEXT_PUBLIC_CLARITY_ID : null;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable}`}>
      <body>
        <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          {BANNER}
        </div>
        {children}
        <ResearchTools />
        {CLARITY_ID && (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
          </Script>
        )}
      </body>
    </html>
  );
}
