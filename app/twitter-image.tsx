import { OG_ALT, OG_SIZE, renderSocialCard } from "@/components/brand/socialImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderSocialCard();
}
