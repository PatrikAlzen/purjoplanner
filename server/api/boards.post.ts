import { createBoard } from '../utils/board-service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const board = await createBoard(body)
  setResponseStatus(event, 201)
  return board
})
