import { listBoards } from '../utils/board-service'

export default defineEventHandler(async () => {
  return listBoards()
})
