import { updateTask } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing task id' })
  const body = await readBody(event)
  return updateTask(id, body)
})
