import { deleteLane } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing lane id' })
  await deleteLane(id)
  setResponseStatus(event, 204)
  return null
})
