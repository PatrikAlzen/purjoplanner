import { deleteTask } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing task id' })
  await deleteTask(id)
  setResponseStatus(event, 204)
  return null
})
