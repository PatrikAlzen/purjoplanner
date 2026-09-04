import { z } from 'zod'

const hexColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const looksLikeUrl = /^(https?:\/\/|\/|#)[^\s]*$/i

const monthIndex = z.number().int().min(0).max(11)
// A task's `end` may spill into the following year (12-23 = Jan-Dec of year+1),
// allowing a task to span exactly one year boundary.
const endMonthIndex = z.number().int().min(0).max(23)
const linkField = z
  .string()
  .max(2000)
  .refine((v) => v === '' || looksLikeUrl.test(v), {
    message: 'link must be a valid absolute URL (http/https) or empty'
  })

export const taskCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    color: z.string().regex(hexColor, 'color must be a hex value like #DF9438'),
    laneId: z.string().min(1),
    start: monthIndex,
    end: endMonthIndex,
    year: z.number().int().min(1970).max(3000),
    description: z.string().max(5000).optional().default(''),
    link: linkField.optional().default('')
  })
  .refine((v) => v.end >= v.start, { message: 'end must be >= start', path: ['end'] })

export const taskUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    color: z.string().regex(hexColor, 'color must be a hex value like #DF9438').optional(),
    laneId: z.string().min(1).optional(),
    start: monthIndex.optional(),
    end: endMonthIndex.optional(),
    year: z.number().int().min(1970).max(3000).optional(),
    description: z.string().max(5000).optional(),
    link: linkField.optional()
  })
  .refine((v) => (v.start === undefined || v.end === undefined ? true : v.end >= v.start), {
    message: 'end must be >= start',
    path: ['end']
  })

export const laneCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  order: z.number().int().optional()
})

export const laneUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  order: z.number().int().optional()
})

export const themeColorsSchema = z.object({
  paper: z.string().min(1),
  paperAlt: z.string().min(1),
  ink: z.string().min(1),
  inkSoft: z.string().min(1),
  headerBg: z.string().min(1),
  headerFg: z.string().min(1),
  accent: z.string().min(1),
  panelBg: z.string().min(1),
  line: z.string().min(1),
  lineStrong: z.string().min(1)
})

export const themeCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colors: themeColorsSchema,
  palette: z.array(z.string().min(1)).min(1).max(24)
})

export const themeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  colors: themeColorsSchema.partial().optional(),
  palette: z.array(z.string().min(1)).min(1).max(24).optional()
})

export const activeThemeSchema = z.object({
  themeId: z.string().min(1)
})
