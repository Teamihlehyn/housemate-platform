---
name: responsive-qa-method
description: How to run the responsive/overlap QA in the browser pane without getting fooled (iframe sweep, shared cookie jar, 127.0.0.1 doesn't hydrate)
metadata:
  type: project
---

Responsive QA (DES-19, results in docs/design/responsive-qa.md) works best as a same-origin
iframe sweep: one script loads each page in an iframe at exact width × height and checks
scrollWidth, off-screen elements, < 44 px targets, < 16 px inputs and `elementFromPoint` overlap
at top and end of scroll. Keep the helper in the scratchpad and inject it; never leave it in
`public/` (the security reviewer flagged `public/zz-qa.js`).

Traps found 2026-11-10:
- **127.0.0.1:3000 does not hydrate** in Next 16 dev (dev assets blocked for that origin), so
  client pages show skeletons and "pass" falsely. Use localhost only.
- **The browser pane's cookie jar is shared with other agents.** An engineer's HttpOnly
  `hm_session` blocks setting your own from JS; a QA session can vanish mid-run. Check a
  `redirected:/signin` flag on every page, and persist results in localStorage because HMR
  reloads (other agents' edits) kill long scripts. The JS tool times out at 45 s.
- Hidden-pane screenshots freeze CSS animations at frame 0 (see [[peabudy-brand-mascots]]).

- **Beta mode only emails codes.** Run the `housemate-beta-e2e` preview with a tiny fake Resend
  on 127.0.0.1:8025 (scratchpad script writing POST bodies to a log) and read the code from the
  subject. Drive start/verify with `fetch` from the page: HMR reloads from other agents' edits
  wipe multi-step UI state mid-flow.

**Why:** a whole sweep was silently invalid once (unhydrated + signed out) before these checks.
**How to apply:** any future layout pass or "does X cover Y" check.
