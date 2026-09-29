import { z } from 'zod'

// Best-effort import of another roadmap tool's export format — a
// URL-encoded JSON blob shaped like:
//
//   { title, timeline: {...}, lanes: [{ title, color: {bar, ...}, bars: [
//     { title, description, startDate: "YYYY-MM-DD HH:MM:SS",
//       duration: <weeks, float>, rowIndex, pageLink }
//   ] }], markers: [{ title, markerDate }] }
//
// The naming is a false friend across the two tools: the source format's
// top-level `lanes` are really this app's *groups* (e.g. "Prio 1" reads as a
// whole priority bucket, not a single row), and each `bar` inside one is a
// *task*. `title`/`timeline` are the source tool's own document metadata and
// aren't used for anything here — every import gets a fixed board name.
//
// Everything else is deliberately lenient: this is third-party data with no
// contract with this app, so a malformed field skips just that item (with a
// warning collected for the caller to surface) rather than failing the
// whole import. Only a document that doesn't look like this format at all
// throws.

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const URL_LIKE = /^(https?:\/\/|\/|#)[^\s]*$/i
// Matches server/utils/validation.ts's own constraints (name lengths, hex
// color, link shape) so every task/lane/group this produces is guaranteed
// to pass the normal create schemas — nothing here bypasses that validation,
// it just avoids surprising the user with a raw schema-error mid-import.
const FALLBACK_PALETTE = ['#DF9438', '#2F8F8B', '#C9584A', '#5B6EE1', '#6B8F47', '#8B5FBF', '#5A6B7A', '#C6689A']
const MARKER_COLOR = '#5A6B7A'
const IMPORTED_BOARD_NAME = 'Imported board'

// Just enough structure to confirm this is the expected export format —
// everything inside `lanes`/`markers` is handled field-by-field below
// instead of through Zod, so one bad bar/marker doesn't reject the payload.
// `lanes` is required (an empty array is fine) specifically so an unrelated
// JSON document doesn't quietly "succeed" with zero groups imported — every
// real export from the source tool includes it, even a blank roadmap.
const externalExportSchema = z.object({
  lanes: z.array(z.unknown()),
  markers: z.array(z.unknown()).optional()
})

export interface ImportedTask {
  name: string
  color: string
  description: string
  link: string
  year: number
  start: number
  end: number
}

export interface ImportedLane {
  name: string
  tasks: ImportedTask[]
}

export interface ImportedGroup {
  name: string
  lanes: ImportedLane[]
}

// The source format's markers apply across the whole roadmap, not to one
// particular lane — they always import as global (this app's `groupId: null`)
// instantaneous markers.
export interface ImportedMarker {
  label: string
  color: string
  year: number
  start: number
}

export interface ImportedBoard {
  boardName: string
  groups: ImportedGroup[]
  markers: ImportedMarker[]
}

export interface ConvertResult {
  board: ImportedBoard
  warnings: string[]
}

function sanitizeText(raw: unknown, fallback: string, maxLen: number): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s.slice(0, maxLen) || fallback
}

function sanitizeDescription(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 5000) : ''
}

function sanitizeColor(raw: unknown, fallbackIndex: number): string {
  if (typeof raw === 'string' && HEX_COLOR.test(raw)) return raw
  return FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length]!
}

function extractLink(raw: unknown): string {
  let candidate = ''
  if (typeof raw === 'string') {
    candidate = raw
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    candidate = [obj.url, obj.href, obj.link].find((v): v is string => typeof v === 'string' && v.length > 0) ?? ''
  }
  candidate = candidate.trim()
  return URL_LIKE.test(candidate) ? candidate.slice(0, 2000) : ''
}

interface ExternalDate {
  year: number
  month: number // 0-based
  day: number
}

/** Parses "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" — the time-of-day is never used beyond which day it falls on. */
function parseExternalDate(raw: string): ExternalDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim())
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined
  return { year, month, day }
}

/** Which week of the month (0-3) a day falls in, for this app's week-granularity board. */
function weekOfMonth(day: number): number {
  return Math.min(3, Math.max(0, Math.floor((day - 1) / 7)))
}

/** Snaps a months value onto this app's week grid (steps of 1/4 month). */
function snapToStep(months: number): number {
  return Math.round(months * 4) / 4
}

function convertBar(
  bar: Record<string, unknown>,
  laneColor: string,
  groupTitle: string,
  warnings: string[]
): ImportedTask | undefined {
  const name = sanitizeText(bar.title, 'Untitled task', 200)
  const startRaw = typeof bar.startDate === 'string' ? bar.startDate : undefined
  const start = startRaw ? parseExternalDate(startRaw) : undefined
  if (!start) {
    warnings.push(`Skipped "${name}" in "${groupTitle}": missing or unreadable start date.`)
    return undefined
  }

  const startPos = start.month + weekOfMonth(start.day) * 0.25
  const absStart = start.year * 12 + startPos

  // `duration` is in weeks; this app's own step size is exactly 1 week
  // (1/4 month), so it converts directly without going through real
  // calendar dates at all.
  const durationWeeks = typeof bar.duration === 'number' && Number.isFinite(bar.duration) ? bar.duration : 1
  const durationMonths = Math.max(0, snapToStep(durationWeeks / 4))
  const absEnd = absStart + durationMonths
  // A task's `end` is relative to `start`'s year and can spill into the
  // following year (up to <24 — see validation.ts), but not further; a
  // multi-year source item gets truncated to fit rather than rejected.
  const relEnd = Math.min(absEnd - start.year * 12, 23.75)

  return {
    name,
    color: laneColor,
    description: sanitizeDescription(bar.description),
    link: extractLink(bar.pageLink),
    year: start.year,
    start: startPos,
    end: relEnd
  }
}

/** Converts one source "lane" (-> this app's group) into a group with 1+ lanes underneath it. */
function convertGroup(rawLane: unknown, groupIdx: number, warnings: string[]): ImportedGroup {
  const lane = (rawLane ?? {}) as Record<string, unknown>
  const groupTitle = sanitizeText(lane.title, `Group ${groupIdx + 1}`, 120)
  const groupColor = sanitizeColor((lane.color as Record<string, unknown> | undefined)?.bar, groupIdx)
  const bars = Array.isArray(lane.bars) ? (lane.bars as Record<string, unknown>[]) : []

  // The source format allows several bars in one "lane" to overlap in time
  // by stacking them at different `rowIndex`es (sub-rows drawn within the
  // same row); this app's lanes are single-row, so each distinct rowIndex
  // found becomes its own lane within the group.
  const byRow = new Map<number, Record<string, unknown>[]>()
  for (const bar of bars) {
    const row = typeof bar.rowIndex === 'number' ? bar.rowIndex : 0
    if (!byRow.has(row)) byRow.set(row, [])
    byRow.get(row)!.push(bar)
  }

  const rows = [...byRow.keys()].sort((a, b) => a - b)
  if (rows.length === 0) {
    // No bars at all in the source — keep the group, with one empty lane,
    // so the imported board's structure still matches the source 1:1.
    return { name: groupTitle, lanes: [{ name: 'Lane 1', tasks: [] }] }
  }

  const lanes = rows.map((row, i) => ({
    name: `Lane ${i + 1}`,
    tasks: byRow
      .get(row)!
      .map((bar) => convertBar(bar, groupColor, groupTitle, warnings))
      .filter((t): t is ImportedTask => t !== undefined)
  }))
  return { name: groupTitle, lanes }
}

function convertMarkers(rawMarkers: unknown[], warnings: string[]): ImportedMarker[] {
  const markers: ImportedMarker[] = []
  for (const rawMarker of rawMarkers) {
    const marker = rawMarker as Record<string, unknown>
    const dateRaw = typeof marker.markerDate === 'string' ? marker.markerDate : undefined
    const date = dateRaw ? parseExternalDate(dateRaw) : undefined
    if (!date) {
      warnings.push('Skipped a marker with a missing or unreadable date.')
      continue
    }
    const pos = date.month + weekOfMonth(date.day) * 0.25
    markers.push({
      label: sanitizeText(marker.title, 'Marker', 200),
      color: MARKER_COLOR,
      year: date.year,
      start: pos
    })
  }
  return markers
}

export function convertRoadmapExport(raw: string): ConvertResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Nothing was pasted.')
  }

  let json: unknown
  try {
    json = JSON.parse(decodeURIComponent(trimmed))
  } catch {
    // Maybe it was pasted already-decoded (plain JSON) — accept that too.
    try {
      json = JSON.parse(trimmed)
    } catch {
      throw new Error('Could not parse the pasted data as JSON (tried both URL-encoded and plain).')
    }
  }

  const parsed = externalExportSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('The pasted data does not look like a roadmap export (expected an object with a "lanes" array).')
  }
  const data = parsed.data

  const warnings: string[] = []
  const groups = (data.lanes ?? []).map((rawLane, idx) => convertGroup(rawLane, idx, warnings))
  const markers = Array.isArray(data.markers) ? convertMarkers(data.markers, warnings) : []

  return {
    board: { boardName: IMPORTED_BOARD_NAME, groups, markers },
    warnings
  }
}
