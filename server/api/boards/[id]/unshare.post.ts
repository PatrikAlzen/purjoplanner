import { unshareBoard } from '../../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing board id' })
  return unshareBoard(id)
})
