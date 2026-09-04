import { updateTheme } from '../../utils/theme-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing theme id' })
  const body = await readBody(event)
  return updateTheme(id, body)
})
