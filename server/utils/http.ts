import type { z } from 'zod'
import { createError } from 'h3'

/**
 * Parses `input` against `schema`, throwing an H3 400 error (rather than a
 * raw ZodError) on failure so Nitro returns a proper HTTP validation error.
 */
export function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { issues: result.error.issues }
    })
  }
  return result.data
}
