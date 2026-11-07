import { route, readJson, json, HttpError } from "@/lib/server/http"
import { requireSession } from "@/lib/server/auth"
import * as store from "@/lib/server/store"
import { normalizeUrl, makeId, str, nowIso } from "@/lib/server/jobs"
import {
  STATUSES,
  REMOVE_REASONS,
  STAGES,
  ROUND_TYPES,
  ROUND_OUTCOMES,
  type Job,
  type Round,
  type ScreenedOutJob,
  type Stage,
  type Status,
  type RemoveReason,
  type RoundOutcome,
} from "@/lib/types"

const AFTER_APPLY: Status[] = ["Applied", "Screen", "Interviewing", "Offer"]

// Fields the board can edit directly, with max lengths.
const EDITABLE = {
  company: 120,
  job_title: 200,
  one_line_about: 300,
  location: 200,
  salary_range: 80,
  fit_reason: 300,
  job_url: 1000,
  company_careers_url: 1000,
  source: 40,
  posted_date: 40,
  applied_at: 40,
} as const

function newJob(fields: Partial<Job> = {}): Job {
  const t = nowIso()
  return {
    id: "",
    company: "",
    job_title: "",
    one_line_about: "",
    location: "",
    salary_range: "",
    fit_score: null,
    fit_reason: "",
    hiring_manager: { name: "", linkedin: "" },
    job_url: "",
    company_careers_url: "",
    source: "",
    posted_date: "",
    company_stage: "",
    status: "New",
    status_history: [{ status: "New", at: t }],
    applied_at: "",
    last_activity_at: t,
    added_at: t,
    rounds: [],
    thumbs: null,
    removed: null,
    notes: "",
    ...fields,
  }
}

function applyEdit(job: Job, fields: Record<string, unknown>) {
  for (const [k, max] of Object.entries(EDITABLE) as [keyof typeof EDITABLE, number][]) {
    if (fields[k] === undefined) continue
    job[k] = k.endsWith("_url") ? normalizeUrl(fields[k]) : str(fields[k], max)
  }
  if (fields.fit_score !== undefined) {
    const v = fields.fit_score
    const n = v === "" || v === null ? null : Math.round(Number(v))
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) throw new HttpError(400, "Fit score must be 0-100")
    job.fit_score = n
  }
  if (fields.company_stage !== undefined) {
    if (!STAGES.includes(fields.company_stage as Stage)) throw new HttpError(400, "Unknown company stage")
    job.company_stage = fields.company_stage as Stage
  }
  if (fields.hiring_manager_name !== undefined || fields.hiring_manager_linkedin !== undefined) {
    job.hiring_manager = job.hiring_manager || { name: "", linkedin: "" }
    if (fields.hiring_manager_name !== undefined) job.hiring_manager.name = str(fields.hiring_manager_name, 120)
    if (fields.hiring_manager_linkedin !== undefined)
      job.hiring_manager.linkedin = normalizeUrl(fields.hiring_manager_linkedin)
  }
}

function cleanRound(r: unknown): Omit<Round, "id"> {
  if (!r || typeof r !== "object") throw new HttpError(400, "Missing round")
  const o = r as Record<string, unknown>
  const type = str(o.type, 40)
  if (type && !(ROUND_TYPES as readonly string[]).includes(type)) throw new HttpError(400, "Unknown round type")
  const outcome = (str(o.outcome, 20) || "Scheduled") as RoundOutcome
  if (!ROUND_OUTCOMES.includes(outcome)) throw new HttpError(400, "Unknown outcome")
  return { date: str(o.date, 40), type, with: str(o.with, 160), notes: str(o.notes, 4000), outcome }
}

function setStatus(job: Job, status: unknown) {
  if (!STATUSES.includes(status as Status)) throw new HttpError(400, "Unknown status")
  const s = status as Status
  if (job.status === s) return
  const t = nowIso()
  job.status = s
  job.status_history = job.status_history || []
  job.status_history.push({ status: s, at: t })
  job.last_activity_at = t
  if (AFTER_APPLY.includes(s) && !job.applied_at) job.applied_at = t.slice(0, 10)
}

export const POST = route(async (req) => {
  requireSession(req)
  const body = await readJson(req)
  const action = String(body.action || "")

  // Move a screened-out job onto the board: an override of the screener.
  if (action === "promote") {
    // Add to the board first, then drop from screened-out, so a failed write never loses the job.
    const screened = await store.read<ScreenedOutJob>("screenedOut")
    const picked = screened.data.jobs.find((j) => j.id === body.id)
    if (!picked) throw new HttpError(404, "Not found in screened out")
    const job = newJob({
      id: picked.id,
      company: picked.company,
      job_title: picked.job_title,
      one_line_about: picked.one_line_about_company || "",
      location: picked.location,
      salary_range: picked.salary_range,
      fit_score: picked.fit_score ?? null,
      job_url: picked.job_url,
      company_careers_url: picked.company_careers_url,
      source: picked.source,
      posted_date: picked.posted_date,
      overridden_screen: { reason: picked.screen_reason || "", at: nowIso() },
    })
    await store.update<Job, null>(
      "jobs",
      (data) => {
        if (!data.jobs.some((j) => j.id === job.id)) data.jobs.push(job)
        return null
      },
      `board: add ${job.company} (screen override)`
    )
    await store.update<ScreenedOutJob, null>(
      "screenedOut",
      (data) => {
        data.jobs = data.jobs.filter((j) => j.id !== picked.id)
        return null
      },
      "screened-out: moved a job to the board"
    )
    return json(200, { job })
  }

  if (action === "add") {
    const f = (body.job || {}) as Record<string, unknown>
    const job = newJob()
    applyEdit(job, f)
    if (!job.company || !job.job_title) throw new HttpError(400, "Company and title are required")
    job.id = makeId(job.job_url || `${job.company}|${job.job_title}|${Date.now()}`)
    if (f.status && f.status !== "New") setStatus(job, f.status)
    await store.update<Job, null>(
      "jobs",
      (data) => {
        if (job.job_url && data.jobs.some((j) => normalizeUrl(j.job_url) === job.job_url))
          throw new HttpError(409, "That posting is already on the board")
        data.jobs.push(job)
        return null
      },
      `board: add ${job.company}`
    )
    return json(200, { job })
  }

  const id = String(body.id || "")
  if (!id) throw new HttpError(400, "Missing id")

  const job = await store.update<Job, Job>(
    "jobs",
    (data) => {
      const job = data.jobs.find((j) => j.id === id)
      if (!job) throw new HttpError(404, "Job not found")
      switch (action) {
        case "status":
          setStatus(job, body.status)
          break
        case "thumbs":
          if (![null, "up", "down"].includes(body.value as string | null))
            throw new HttpError(400, "Thumbs must be up, down or null")
          job.thumbs = body.value as Job["thumbs"]
          job.thumbs_at = nowIso()
          break
        case "remove": {
          const reason = String(body.reason || "") as RemoveReason
          if (!REMOVE_REASONS.includes(reason)) throw new HttpError(400, "Pick a reason")
          job.removed = { reason, note: str(body.note, 500), at: nowIso() }
          break
        }
        case "restore":
          job.removed = null
          break
        case "notes":
          job.notes = str(body.notes, 10000)
          break
        case "edit":
          applyEdit(job, (body.fields || {}) as Record<string, unknown>)
          break
        case "round_add": {
          const r = cleanRound(body.round)
          job.rounds = job.rounds || []
          job.rounds.push({ id: makeId(), ...r })
          job.last_activity_at = nowIso()
          if (["New", "Interested", "Applied", "Screen"].includes(job.status) && job.rounds.length >= 2)
            setStatus(job, "Interviewing")
          else if (["New", "Interested", "Applied"].includes(job.status)) setStatus(job, "Screen")
          break
        }
        case "round_update": {
          const r = (job.rounds || []).find((x) => x.id === body.round_id)
          if (!r) throw new HttpError(404, "Round not found")
          Object.assign(r, cleanRound({ ...r, ...(body.round as object) }))
          job.last_activity_at = nowIso()
          break
        }
        case "round_delete":
          job.rounds = (job.rounds || []).filter((x) => x.id !== body.round_id)
          break
        default:
          throw new HttpError(400, "Unknown action")
      }
      return job
    },
    `board: ${action} ${id}`
  )

  return json(200, { job })
})
