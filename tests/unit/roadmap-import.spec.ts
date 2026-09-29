import { describe, expect, it } from 'vitest'
import { convertRoadmapExport } from '../../server/utils/roadmap-import'

// The exact sample the user pasted in, URL-encoded — used as a real-world
// regression anchor rather than a synthetic fixture.
const SAMPLE_EXPORT =
  '%7B%22title%22%3A%22Roadmap%20Planner%22%2C%22timeline%22%3A%7B%22startDate%22%3A%222026-01-01%2000%3A00%3A00%22%2C%22endDate%22%3A%222026-12-31%2000%3A00%3A00%22%2C%22displayOption%22%3A%22MONTH%22%7D%2C%22lanes%22%3A%5B%7B%22title%22%3A%22Prio%201%22%2C%22color%22%3A%7B%22lane%22%3A%22%233b7fc4%22%2C%22bar%22%3A%22%236c9fd3%22%2C%22text%22%3A%22%23ffffff%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%7B%22title%22%3A%22Inpasseringsportalen%22%2C%22description%22%3A%22This%20is%20the%20third%20bar.%22%2C%22startDate%22%3A%222026-01-02%2009%3A47%3A35%22%2C%22duration%22%3A4.00990099009901%2C%22rowIndex%22%3A0%2C%22id%22%3A%224a2d3caf-7cb5-45f4-97be-5d5a7782345e%22%2C%22pageLink%22%3A%7B%7D%7D%5D%7D%2C%7B%22title%22%3A%22Prio%202%22%2C%22color%22%3A%7B%22lane%22%3A%22%23f6c342%22%2C%22bar%22%3A%22%23fadb8e%22%2C%22text%22%3A%22%23594300%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%7B%22rowIndex%22%3A0%2C%22startDate%22%3A%222026-01-02%2017%3A09%3A34%22%2C%22id%22%3A%225268258d-4bd3-44a7-850e-f2bf17dcfd28%22%2C%22title%22%3A%22VER-milj%C3%B6%22%2C%22description%22%3A%22%22%2C%22duration%22%3A4.297029702970297%2C%22pageLink%22%3A%7B%7D%7D%5D%7D%2C%7B%22title%22%3A%22Prio%203%22%2C%22color%22%3A%7B%22lane%22%3A%22%238eb021%22%2C%22bar%22%3A%22%23aac459%22%2C%22text%22%3A%22%23ffffff%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%5D%7D%2C%7B%22title%22%3A%22Prio%204%22%2C%22color%22%3A%7B%22lane%22%3A%22%23ea632b%22%2C%22bar%22%3A%22%23ef8a60%22%2C%22text%22%3A%22%23ffffff%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%7B%22rowIndex%22%3A0%2C%22startDate%22%3A%222026-02-07%2012%3A56%3A19%22%2C%22id%22%3A%229c4f16ea-ecbf-441c-b8cd-78b642ad54b8%22%2C%22title%22%3A%22TiB%20admin%22%2C%22description%22%3A%22%22%2C%22duration%22%3A4.712871287128713%2C%22pageLink%22%3A%7B%7D%7D%5D%7D%2C%7B%22title%22%3A%22Prio%205%22%2C%22color%22%3A%7B%22lane%22%3A%22%23654982%22%2C%22bar%22%3A%22%238c77a1%22%2C%22text%22%3A%22%23ffffff%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%7B%22rowIndex%22%3A0%2C%22startDate%22%3A%222026-01-01%2005%3A53%3A34%22%2C%22id%22%3A%22ac380d2f-73e7-46e6-b95e-3c31ed2871cd%22%2C%22title%22%3A%22Ping%20Castle%20rapport%22%2C%22description%22%3A%22%22%2C%22duration%22%3A5.9405940594059405%2C%22pageLink%22%3A%7B%7D%7D%5D%7D%2C%7B%22title%22%3A%22Prio%206%22%2C%22color%22%3A%7B%22lane%22%3A%22%23f15c75%22%2C%22bar%22%3A%22%23f58598%22%2C%22text%22%3A%22%23ffffff%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%7B%22rowIndex%22%3A0%2C%22startDate%22%3A%222026-01-04%2014%3A55%3A21%22%2C%22id%22%3A%22ca0f43b7-5a13-4ecf-b4ec-7b598f6d5669%22%2C%22title%22%3A%22%C3%96vriga%20l%C3%B6sa%20jiror%22%2C%22description%22%3A%22%22%2C%22duration%22%3A5.851485148514851%2C%22pageLink%22%3A%7B%7D%7D%5D%7D%2C%7B%22title%22%3A%22Prio%207%22%2C%22color%22%3A%7B%22lane%22%3A%22%23815b3a%22%2C%22bar%22%3A%22%23a1846b%22%2C%22text%22%3A%22%23ffffff%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%5D%7D%5D%2C%22markers%22%3A%5B%7B%22title%22%3A%22Avst%C3%A4mning%22%2C%22markerDate%22%3A%222024-09-15%2000%3A00%3A00%22%7D%2C%7B%22markerDate%22%3A%222024-12-16%2015%3A40%3A59%22%2C%22title%22%3A%22Avst%C3%A4mning%22%7D%2C%7B%22markerDate%22%3A%222026-07-02%2005%3A27%3A55%22%2C%22title%22%3A%22Semester%22%7D%5D%7D'

describe('convertRoadmapExport — real sample payload', () => {
  it('ignores title/timeline, and maps each source "lane" to a group (not a lane)', () => {
    const result = convertRoadmapExport(SAMPLE_EXPORT)
    expect(result.board.boardName).toBe('Imported board')
    expect(result.warnings).toEqual([])

    const groupNames = result.board.groups.map((g) => g.name)
    expect(groupNames).toEqual(['Prio 1', 'Prio 2', 'Prio 3', 'Prio 4', 'Prio 5', 'Prio 6', 'Prio 7', 'Markers'])
  })

  it('gives an empty source lane one empty lane (not zero), so the structure still matches 1:1', () => {
    const result = convertRoadmapExport(SAMPLE_EXPORT)
    const prio3 = result.board.groups.find((g) => g.name === 'Prio 3')!
    expect(prio3.lanes).toEqual([{ name: 'Lane 1', tasks: [] }])
    const prio7 = result.board.groups.find((g) => g.name === 'Prio 7')!
    expect(prio7.lanes).toEqual([{ name: 'Lane 1', tasks: [] }])
  })

  it("converts a bar's title, description, and lane bar-color into a task", () => {
    const result = convertRoadmapExport(SAMPLE_EXPORT)
    const prio1 = result.board.groups.find((g) => g.name === 'Prio 1')!
    expect(prio1.lanes).toHaveLength(1)
    const task = prio1.lanes[0]!.tasks[0]!
    expect(task).toMatchObject({
      name: 'Inpasseringsportalen',
      description: 'This is the third bar.',
      color: '#6c9fd3', // lane.color.bar, not lane.color.lane
      link: ''
    })
  })

  it('converts startDate + duration (in weeks) into a week-snapped {year, start, end}', () => {
    const result = convertRoadmapExport(SAMPLE_EXPORT)
    const task = result.board.groups.find((g) => g.name === 'Prio 1')!.lanes[0]!.tasks[0]!
    // 2026-01-02 -> January (month 0), day 2 -> week 0 of the month.
    expect(task.year).toBe(2026)
    expect(task.start).toBe(0)
    // duration 4.0099... weeks snaps to 4 weeks = exactly 1 month.
    expect(task.end).toBe(1)
  })

  it('snaps a fractional week count that lands mid-month (Prio 4/5/6) to the nearest week', () => {
    const result = convertRoadmapExport(SAMPLE_EXPORT)
    const byGroup = (name: string) => result.board.groups.find((g) => g.name === name)!.lanes[0]!.tasks[0]!

    const prio4 = byGroup('Prio 4') // 2026-02-07, duration 4.7128... weeks
    expect(prio4.year).toBe(2026)
    expect(prio4.start).toBe(1) // February, day 7 -> week 0
    expect(prio4.end).toBe(2.25) // 4.7128/4 -> snaps to 1.25 months

    const prio5 = byGroup('Prio 5') // 2026-01-01, duration 5.9405... weeks
    expect(prio5.start).toBe(0)
    expect(prio5.end).toBe(1.5) // 5.9405/4 -> snaps to 1.5 months
  })

  it('handles non-ASCII titles (Swedish characters) correctly through URL-decoding', () => {
    const result = convertRoadmapExport(SAMPLE_EXPORT)
    const prio6 = result.board.groups.find((g) => g.name === 'Prio 6')!
    expect(prio6.lanes[0]!.tasks[0]!.name).toBe('Övriga lösa jiror')
    const markers = result.board.groups.find((g) => g.name === 'Markers')!
    expect(markers.lanes[0]!.tasks.map((t) => t.name)).toContain('Avstämning')
  })

  it('imports all 3 markers as 1-week tasks in a dedicated Markers group', () => {
    const result = convertRoadmapExport(SAMPLE_EXPORT)
    const markers = result.board.groups.find((g) => g.name === 'Markers')!
    expect(markers.lanes).toHaveLength(1)
    expect(markers.lanes[0]!.tasks).toHaveLength(3)
    const semester = markers.lanes[0]!.tasks.find((t) => t.name === 'Semester')!
    expect(semester.year).toBe(2026)
    expect(semester.start).toBe(semester.end) // zero-width "instant" marker
  })

  it('also accepts the same payload already decoded (plain JSON)', () => {
    const plain = decodeURIComponent(SAMPLE_EXPORT)
    const result = convertRoadmapExport(plain)
    expect(result.board.groups.map((g) => g.name)).toContain('Prio 1')
  })
})

describe('convertRoadmapExport — edge cases', () => {
  it('splits bars with different rowIndex values into separate lanes within the same group', () => {
    const raw = JSON.stringify({
      lanes: [
        {
          title: 'Shared lane',
          color: { bar: '#112233' },
          bars: [
            { title: 'Row 0 task', startDate: '2026-01-01', duration: 4, rowIndex: 0 },
            { title: 'Row 1 task', startDate: '2026-01-01', duration: 4, rowIndex: 1 }
          ]
        }
      ]
    })
    const result = convertRoadmapExport(raw)
    expect(result.board.groups).toHaveLength(1)
    const group = result.board.groups[0]!
    expect(group.name).toBe('Shared lane')
    expect(group.lanes.map((l) => l.name)).toEqual(['Lane 1', 'Lane 2'])
    expect(group.lanes[0]!.tasks[0]!.name).toBe('Row 0 task')
    expect(group.lanes[1]!.tasks[0]!.name).toBe('Row 1 task')
  })

  it('falls back to a default palette color when the lane color is missing or invalid', () => {
    const raw = JSON.stringify({
      lanes: [
        { title: 'No color', bars: [{ title: 'A', startDate: '2026-01-01', duration: 4 }] },
        { title: 'Bad color', color: { bar: 'not-a-hex' }, bars: [{ title: 'B', startDate: '2026-01-01', duration: 4 }] }
      ]
    })
    const result = convertRoadmapExport(raw)
    for (const group of result.board.groups) {
      expect(group.lanes[0]!.tasks[0]!.color).toMatch(/^#[0-9a-fA-F]{3,6}$/)
    }
  })

  it('skips a bar with a missing/unreadable start date and warns instead of throwing', () => {
    const raw = JSON.stringify({
      lanes: [
        {
          title: 'Lane',
          bars: [
            { title: 'Good', startDate: '2026-01-01', duration: 4 },
            { title: 'Bad', startDate: 'not-a-date', duration: 4 }
          ]
        }
      ]
    })
    const result = convertRoadmapExport(raw)
    expect(result.board.groups[0]!.lanes[0]!.tasks.map((t) => t.name)).toEqual(['Good'])
    expect(result.warnings.some((w) => w.includes('Bad'))).toBe(true)
  })

  it("truncates a multi-year-spanning duration to the app's one-year-boundary limit", () => {
    const raw = JSON.stringify({
      lanes: [{ title: 'Long', bars: [{ title: 'Huge', startDate: '2026-01-01', duration: 400 }] }]
    })
    const result = convertRoadmapExport(raw)
    expect(result.board.groups[0]!.lanes[0]!.tasks[0]!.end).toBe(23.75)
  })

  it('extracts a link from pageLink whether it is a string or an {url} object, and drops invalid ones', () => {
    const raw = JSON.stringify({
      lanes: [
        {
          title: 'Links',
          bars: [
            { title: 'A', startDate: '2026-01-01', duration: 4, pageLink: 'https://example.com/a' },
            { title: 'B', startDate: '2026-01-01', duration: 4, pageLink: { url: 'https://example.com/b' } },
            { title: 'C', startDate: '2026-01-01', duration: 4, pageLink: {} },
            { title: 'D', startDate: '2026-01-01', duration: 4, pageLink: { url: 'not a url' } }
          ]
        }
      ]
    })
    const result = convertRoadmapExport(raw)
    const byName = Object.fromEntries(result.board.groups[0]!.lanes[0]!.tasks.map((t) => [t.name, t.link]))
    expect(byName.A).toBe('https://example.com/a')
    expect(byName.B).toBe('https://example.com/b')
    expect(byName.C).toBe('')
    expect(byName.D).toBe('')
  })

  it('throws a clear error for input that is not JSON at all', () => {
    expect(() => convertRoadmapExport('not json, not url-encoded either {{{')).toThrow(/could not parse/i)
  })

  it('throws a clear error for valid JSON that does not look like a roadmap export', () => {
    expect(() => convertRoadmapExport(JSON.stringify({ hello: 'world' }))).toThrow(/does not look like/i)
  })

  it('throws a clear error for empty input', () => {
    expect(() => convertRoadmapExport('   ')).toThrow(/nothing was pasted/i)
  })

  it('always names the board "Imported board", ignoring any source title', () => {
    const result = convertRoadmapExport(JSON.stringify({ title: 'Some Source Title', lanes: [] }))
    expect(result.board.boardName).toBe('Imported board')
    expect(result.board.groups).toEqual([])
  })
})
