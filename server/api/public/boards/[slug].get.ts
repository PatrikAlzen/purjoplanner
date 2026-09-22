import { getPublicBoardView } from '../../../utils/board-service'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing board slug' })
  const view = await getPublicBoardView(slug)
  if (!view) throw createError({ statusCode: 404, statusMessage: 'Board not found' })
  return view
})
