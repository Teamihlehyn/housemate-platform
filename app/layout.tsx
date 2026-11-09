import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { BANNER, CLARITY_ID } from "@/lib/env";
import ResearchTools from "@/components/ResearchTools";
import BannerHeight from "@/components/BannerHeight";

// latin-ext carries ₦ and Ṣ; vietnamese carries precomposed Ọ/Ẹ and combining tone marks
// (Yoruba names). Both fonts have tabular figures for money.
const display = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const sans = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});

// Absolute URLs are required for link previews (WhatsApp, iMessage, LinkedIn).
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const TITLE = "Peabudy — find a housemate and agree the money stuff upfront";
const DESCRIPTION =
  "Match on move-in dates and living habits, see what's been checked, and agree rent split, bills and notice in writing before you move in. London & Lagos.";

export const viewport: Viewport = { themeColor: "#f6f4ef", width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Peabudy",
  openGraph: {
    type: "website",
    siteName: "Peabudy",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_GB",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Microsoft Clarity session recordings for user research: CLARITY_ID is validated in lib/env
// and is always null in beta (HM-05).

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={`${display.variable} ${sans.variable}`}
      style={BANNER ? undefined : ({ "--banner-h": "0px" } as React.CSSProperties)}
    >
      <body>
        {BANNER && (
          <>
            <div id="env-banner" role="note" className="sticky top-0 z-50 border-b border-amber-200 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium leading-5 text-amber-900 min-h-[33px]">
              {BANNER}
            </div>
            <BannerHeight />
          </>
        )}
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
