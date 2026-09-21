import { createGroup } from '../utils/board-service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const group = await createGroup(body)
  setResponseStatus(event, 201)
  return group
})
