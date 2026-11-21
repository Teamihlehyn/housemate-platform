// Where a notification takes you (ENG-50). Pure, so it's unit-tested. Only ids the recipient is
// already party to go in a link; the page re-checks access when it opens (SEC-16).
export const TARGET_TYPES = ["conversation", "introduction", "household", "application", "none"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function notificationHref(targetType: string, targetId: string | null): string | null {
  switch (targetType) {
    case "conversation":
      return targetId && SAFE_ID.test(targetId) ? `/messages/${targetId}` : null;
    case "introduction":
      return targetId && SAFE_ID.test(targetId) ? `/messages?intro=${targetId}` : null;
    case "household":
      return "/household";
    case "application":
      return "/join/status";
    default:
      return null;
  }
}
