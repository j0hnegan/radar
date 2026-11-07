import { connection } from "next/server"
import { route, json } from "@/lib/server/http"
import { requireSession } from "@/lib/server/auth"
import * as store from "@/lib/server/store"
import type { BoardData, IncomingJob, Job, ScreenedOutJob } from "@/lib/types"

export const GET = route(async (req) => {
  await connection() // always per request, never prerendered
  requireSession(req)
  const [jobs, screened, inbox] = await Promise.all([
    store.read<Job>("jobs"),
    store.read<ScreenedOutJob>("screenedOut"),
    store.read<IncomingJob>("inbox"),
  ])
  const body: BoardData = {
    jobs: jobs.data.jobs || [],
    screened_out: screened.data.jobs || [],
    inbox_count: (inbox.data.jobs || []).length,
    updated_at: jobs.data.updated_at,
  }
  return json(200, body)
})
