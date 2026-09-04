import { deleteTheme } from '../../utils/theme-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing theme id' })
  await deleteTheme(id)
  setResponseStatus(event, 204)
  return null
})
