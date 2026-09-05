import { updateBoard } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing board id' })
  const body = await readBody(event)
  return updateBoard(id, body)
})
