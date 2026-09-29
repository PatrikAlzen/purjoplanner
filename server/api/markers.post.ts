import { createMarker } from '../utils/board-service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const marker = await createMarker(body)
  setResponseStatus(event, 201)
  return marker
})
