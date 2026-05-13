/**
 * Shared slug utility for node-id generation.
 * Used by both frontend (preview) and backend (persist).
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
