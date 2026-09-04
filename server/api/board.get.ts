import { getBoard } from '../utils/board-service'

export default defineEventHandler(async () => {
  return getBoard()
})
