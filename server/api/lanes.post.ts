import { createLane } from '../utils/board-service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const lane = await createLane(body)
  setResponseStatus(event, 201)
  return lane
})
