import { createTask } from '../utils/board-service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const task = await createTask(body)
  setResponseStatus(event, 201)
  return task
})
