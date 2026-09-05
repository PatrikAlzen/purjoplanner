import { deleteBoard } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing board id' })
  await deleteBoard(id)
  setResponseStatus(event, 204)
  return null
})
