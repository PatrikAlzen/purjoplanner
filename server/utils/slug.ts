/**
 * Turns a board name into a URL-safe slug for its public share link
 * (`/public/<slug>`): lowercased, diacritics stripped (e.g. "Örjans" ->
 * "orjans"), non-alphanumeric runs collapsed to a single hyphen, and leading/
 * trailing hyphens trimmed. Falls back to `"board"` for names with no
 * alphanumeric characters at all (e.g. all emoji).
 */
export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'board'
}

/**
 * Picks a slug for `name` that isn't already used by another board (per
 * `isTaken`), appending `-2`, `-3`, etc. as needed.
 */
export function uniqueSlug(name: string, isTaken: (candidate: string) => boolean): string {
  const base = slugify(name)
  if (!isTaken(base)) return base
  let n = 2
  while (isTaken(`${base}-${n}`)) n++
  return `${base}-${n}`
}
