import { setActiveBoard } from '../../utils/board-service'
import { parseWithSchema } from '../../utils/http'
import { setActiveBoardSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { boardId } = parseWithSchema(setActiveBoardSchema, body)
  return setActiveBoard(boardId)
})
