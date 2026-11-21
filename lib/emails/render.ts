// Tiny template filler for transactional emails: {{name}} placeholders, values escaped for
// HTML (text bodies get them as-is). An unknown or missing placeholder is an error, so a
// template change can't silently send "{{first_name}}" to real people.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]))].sort();
}

// Optional sections (ENG-60): {{#key}} … {{/key}} stays only when values[key] is non-empty, so a
// line can be left out entirely (e.g. the booking link when none is set).
export function fill(template: string, values: Record<string, string>, mode: "html" | "text"): string {
  template = template.replace(/\{\{#([a-z_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, inner: string) => (values[key] ? inner : ""));
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Email template placeholder {{${key}}} has no value.`);
    return mode === "html" ? escapeHtml(values[key]) : values[key];
  });
}

// First word of a display name, for "Hi Ada". Falls back to "there".
export function firstName(displayName: string | null | undefined): string {
  const w = (displayName || "").trim().split(/\s+/)[0] || "";
  return w.slice(0, 40) || "there";
}
