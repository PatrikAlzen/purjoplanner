import { importRoadmapExport } from '../../utils/board-service'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ data?: string }>(event)
  const result = await importRoadmapExport(body?.data)
  setResponseStatus(event, 201)
  return result
})
