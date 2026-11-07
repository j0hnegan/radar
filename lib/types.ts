// Shared by the board (browser) and the API (server).

export const STATUSES = [
  "New",
  "Interested",
  "Applied",
  "Screen",
  "Interviewing",
  "Offer",
  "Rejected",
  "Passed",
] as const
export type Status = (typeof STATUSES)[number]

export const REMOVE_REASONS = ["pay", "company", "role type", "location", "vibe", "other"] as const
export type RemoveReason = (typeof REMOVE_REASONS)[number]

export const STAGES = ["", "Seed / Series A", "Series B-C", "Late-stage private", "Public", "Frontier lab"] as const
export type Stage = (typeof STAGES)[number]

export const ROUND_TYPES = [
  "Recruiter screen",
  "Hiring manager",
  "Portfolio review",
  "Design exercise",
  "Panel",
  "Onsite",
  "Founder / exec",
  "Other",
] as const

export const ROUND_OUTCOMES = ["Scheduled", "Waiting", "Passed", "Did not pass"] as const
export type RoundOutcome = (typeof ROUND_OUTCOMES)[number]

export type Round = {
  id: string
  date: string
  type: string
  with: string
  notes: string
  outcome: RoundOutcome
}

export type Job = {
  id: string
  company: string
  job_title: string
  one_line_about: string
  location: string
  salary_range: string
  fit_score: number | null
  fit_reason: string
  hiring_manager: { name: string; linkedin: string }
  job_url: string
  company_careers_url: string
  source: string
  posted_date: string
  company_stage: Stage
  status: Status
  status_history: { status: Status; at: string }[]
  applied_at: string
  last_activity_at: string
  added_at: string
  rounds: Round[]
  thumbs: "up" | "down" | null
  thumbs_at?: string
  removed: { reason: RemoveReason; note: string; at: string } | null
  notes: string
  overridden_screen?: { reason: string; at: string }
}

// Raw job as a fetcher sends it to /api/ingest (and as it sits in the inbox).
export type IncomingJob = {
  id?: string
  company: string
  job_title: string
  location: string
  salary_range: string
  posted_date: string
  job_url: string
  company_careers_url: string
  source: string
  one_line_about_company: string
  received_at?: string
}

// A job the screener turned down, kept with its reason.
export type ScreenedOutJob = IncomingJob & {
  id: string
  screen_reason: string
  screened_at: string
  fit_score?: number | null
}

export type JobsFile<T> = { version: 1; updated_at: string | null; jobs: T[] }

export type BoardData = {
  jobs: Job[]
  screened_out: ScreenedOutJob[]
  inbox_count: number
  updated_at: string | null
}
