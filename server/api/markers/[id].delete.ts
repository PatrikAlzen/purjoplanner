import { deleteMarker } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing marker id' })
  await deleteMarker(id)
  setResponseStatus(event, 204)
  return null
})
