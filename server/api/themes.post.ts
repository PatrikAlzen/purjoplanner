import { createTheme } from '../utils/theme-service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const theme = await createTheme(body)
  setResponseStatus(event, 201)
  return theme
})
