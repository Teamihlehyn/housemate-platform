import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Approval-first sign-up (ENG-41): the old request form is replaced by the /join application.
  // City photos (public/cities): the file names aren't content-hashed, so a day's cache with
  // background revalidation rather than "immutable". Rename a file to bust it sooner.
  async headers() {
    return [
      { source: "/cities/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      // Back office: never send its URLs (e.g. a set-up token) to another site (ENG-47 review).
      { source: "/staff/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      // No page may be framed (clickjacking, SEC-15): the back office above all, but nothing on
      // the site needs to be embedded elsewhere.
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/request-access", destination: "/join", permanent: false }];
  },
  // /privacy and /terms read the draft legal text from docs/ in beta (ENG-25).
  outputFileTracingIncludes: {
    "/privacy": ["./docs/product/beta/legal/*.md"],
    "/terms": ["./docs/product/beta/legal/*.md"],
  },
};

export default nextConfig;
