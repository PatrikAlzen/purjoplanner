import { listThemes } from '../utils/theme-service'

export default defineEventHandler(async () => {
  return listThemes()
})
