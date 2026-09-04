import { setActiveTheme } from '../../utils/board-service'
import { parseWithSchema } from '../../utils/http'
import { activeThemeSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { themeId } = parseWithSchema(activeThemeSchema, body)
  await setActiveTheme(themeId)
  return { activeThemeId: themeId }
})
