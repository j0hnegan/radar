// Grokbot (or any fetcher) posts raw jobs here. They land in data/inbox.json,
// which the board never shows. Screening then moves each one to the board
// (data/jobs.json) or to data/screened-out.json with a reason.

import { route, readJson, json, HttpError } from "@/lib/server/http"
import { requireIngestKey } from "@/lib/server/auth"
import * as store from "@/lib/server/store"
import { cleanIncoming, normalizeUrl, makeId, nowIso } from "@/lib/server/jobs"
import type { IncomingJob, Job, ScreenedOutJob } from "@/lib/types"

const MAX_PER_CALL = 200

export const POST = route(async (req) => {
  requireIngestKey(req)
  const body = await readJson(req)
  if (!Array.isArray(body.jobs)) throw new HttpError(400, 'Body must be {"jobs":[...]}')
  if (body.jobs.length > MAX_PER_CALL) throw new HttpError(400, `At most ${MAX_PER_CALL} jobs per call`)

  const [jobs, screened] = await Promise.all([store.read<Job>("jobs"), store.read<ScreenedOutJob>("screenedOut")])
  const known = new Set<string>()
  for (const j of [...(jobs.data.jobs || []), ...(screened.data.jobs || [])]) {
    const u = normalizeUrl(j.job_url)
    if (u) known.add(u)
  }

  const incoming: IncomingJob[] = []
  let invalid = 0
  for (const raw of body.jobs as unknown[]) {
    if (!raw || typeof raw !== "object") {
      invalid++
      continue
    }
    const j = cleanIncoming(raw as Record<string, unknown>)
    if (!j.job_url || !j.company || !j.job_title) {
      invalid++
      continue
    }
    incoming.push(j)
  }

  const result = await store.update<IncomingJob, { added: number; duplicates: number }>(
    "inbox",
    (data) => {
      const seen = new Set(known)
      for (const j of data.jobs) seen.add(normalizeUrl(j.job_url))
      let added = 0
      let duplicates = 0
      const receivedAt = nowIso()
      for (const j of incoming) {
        if (seen.has(j.job_url)) {
          duplicates++
          continue
        }
        seen.add(j.job_url)
        data.jobs.push({ id: makeId(j.job_url), ...j, received_at: receivedAt })
        added++
      }
      if (added === 0) return { skipWrite: true, result: { added, duplicates } }
      return { added, duplicates }
    },
    "inbox: add jobs from ingest"
  )

  return json(200, { received: body.jobs.length, added: result.added, duplicates: result.duplicates, invalid })
})
