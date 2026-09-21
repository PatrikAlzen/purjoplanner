import { updateGroup } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing group id' })
  const body = await readBody(event)
  return updateGroup(id, body)
})
