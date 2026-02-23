import { nanoid } from "nanoid";

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const suffix = nanoid(6);
  return base ? `${base}-${suffix}` : suffix;
}
