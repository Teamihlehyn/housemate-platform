---
name: city-photo-cards
description: City step uses founder-supplied London/Lagos photos; rights unconfirmed; JPEG-only because local tools can't write AVIF/WebP
metadata:
  type: project
---

Founder asked (2026-11-10) for photo city cards. Photos are the founder's own files; licence and
credit are **unknown** until the founder confirms rights. Lagos sorts first during the pilot;
London carries "Opening later — we'll hold your application".

**Why:** Lagos users are often on mobile data; macOS `sips` reads AVIF but only writes JPEG/HEIC,
and there's no cwebp/avifenc/ImageMagick here, so assets are 480/960 w JPEG via plain srcset.
**How to apply:** keep `CITY_VISUALS` the single source for any city imagery; if AVIF becomes
possible, add a `<picture>` source rather than switching to next/image. See [[invite-only-entry]].
