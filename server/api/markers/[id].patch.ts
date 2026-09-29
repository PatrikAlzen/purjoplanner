import { updateMarker } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing marker id' })
  const body = await readBody(event)
  return updateMarker(id, body)
})
