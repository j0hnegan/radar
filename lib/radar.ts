// Board-side helpers: derived fields, quick filters and formatting.
import type { Job, Status } from "./types"

export const STATUS_ORDER: Status[] = ["Offer", "Interviewing", "Screen", "Applied", "Interested", "New", "Rejected", "Passed"]
export const APPLIED: Status[] = ["Applied", "Screen", "Interviewing", "Offer"]
export const REPLIED: Status[] = ["Screen", "Interviewing", "Offer"]
export const CLOSED: Status[] = ["Rejected", "Passed"]
export const FOLLOW_UP_DAYS = 7

// Pill colors per status, Airtable style.
export const STATUS_STYLE: Record<Status, string> = {
  New: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  Interested: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  Applied: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  Screen: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  Interviewing: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  Offer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  Passed: "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300",
}

export const STATUS_DOT: Record<Status, string> = {
  New: "bg-slate-400",
  Interested: "bg-violet-500",
  Applied: "bg-blue-500",
  Screen: "bg-cyan-500",
  Interviewing: "bg-amber-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-rose-500",
  Passed: "bg-stone-400",
}

export const STAGE_STYLE: Record<string, string> = {
  "Seed / Series A": "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200",
  "Series B-C": "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
  "Late-stage private": "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  Public: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  "Frontier lab": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
}

export function daysSince(iso?: string | null) {
  if (!iso) return null
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T12:00:00" : iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export function fmtDate(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T12:00:00" : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  })
}

export function ago(iso?: string | null) {
  const d = daysSince(iso)
  if (d === null) return ""
  if (d <= 0) return "Today"
  if (d === 1) return "Yesterday"
  if (d < 30) return `${d}d ago`
  return fmtDate(iso)
}

export function salaryMax(s?: string) {
  const nums = String(s || "")
    .replace(/,/g, "")
    .match(/\d+(\.\d+)?\s*k?/gi)
  if (!nums) return 0
  return Math.max(
    ...nums.map((n) => {
      const v = parseFloat(n)
      return /k/i.test(n) ? v * 1000 : v < 1000 ? v * 1000 : v
    })
  )
}

export function level(title?: string) {
  const t = String(title || "")
  if (/principal/i.test(t)) return "Principal"
  if (/staff/i.test(t)) return "Staff"
  if (/\blead\b/i.test(t)) return "Lead"
  if (/senior|\bsr\b/i.test(t)) return "Senior"
  return "Not stated"
}

export const companyKey = (c?: string) =>
  String(c || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "")

export function needsFollowUp(j: Job) {
  if (j.status !== "Applied") return false
  const d = daysSince(j.last_activity_at || j.applied_at)
  return d !== null && d >= FOLLOW_UP_DAYS
}

export function everApplied(j: Job) {
  if (APPLIED.includes(j.status)) return true
  if ((j.status_history || []).some((h) => APPLIED.includes(h.status))) return true
  return j.status === "Rejected" && !!j.applied_at
}

export function everReplied(j: Job) {
  if (REPLIED.includes(j.status)) return true
  if ((j.rounds || []).length) return true
  return (j.status_history || []).some((h) => REPLIED.includes(h.status))
}

export const safeUrl = (u?: string) => (/^https:\/\//i.test(u || "") ? u! : "")

export type QuickFilter = { key: string; label: string; test: (j: Job) => boolean }

export const QUICK_FILTERS: QuickFilter[] = [
  { key: "active", label: "Active", test: (j) => !j.removed && !CLOSED.includes(j.status) },
  { key: "new", label: "New", test: (j) => !j.removed && j.status === "New" },
  { key: "pipeline", label: "In progress", test: (j) => !j.removed && APPLIED.includes(j.status) },
  { key: "follow", label: "Follow up", test: (j) => !j.removed && needsFollowUp(j) },
  { key: "liked", label: "Liked", test: (j) => !j.removed && j.thumbs === "up" },
  { key: "closed", label: "Closed", test: (j) => !j.removed && CLOSED.includes(j.status) },
  { key: "removed", label: "Removed", test: (j) => !!j.removed },
  { key: "all", label: "All", test: () => true },
]

// Default order when no column sort is set: what needs him first, then best fit.
export function smartCompare(a: Job, b: Job) {
  const rank = (j: Job) => STATUS_ORDER.indexOf(j.status) - (needsFollowUp(j) ? 0.5 : 0)
  const fit = (j: Job) => (j.fit_score == null ? -1 : j.fit_score)
  return rank(a) - rank(b) || fit(b) - fit(a)
}

export type JobRow = Job & { subRows?: JobRow[]; _child?: boolean; _appliedHere?: boolean }

// Roles at a company he has applied to sit under that application's row.
export function nestByCompany(list: Job[], allJobs: Job[]): JobRow[] {
  const appliedAt = new Set(allJobs.filter((j) => !j.removed && everApplied(j)).map((j) => companyKey(j.company)))
  const parents = new Map<string, Job>()
  for (const j of list) {
    if (!everApplied(j)) continue
    const k = companyKey(j.company)
    const cur = parents.get(k)
    if (!cur || STATUS_ORDER.indexOf(j.status) < STATUS_ORDER.indexOf(cur.status)) parents.set(k, j)
  }
  const kids = new Map<string, JobRow[]>()
  const top: JobRow[] = []
  for (const j of list) {
    const p = parents.get(companyKey(j.company))
    if (p && p.id !== j.id) {
      if (!kids.has(p.id)) kids.set(p.id, [])
      kids.get(p.id)!.push({ ...j, _child: true })
    } else {
      top.push({ ...j, _appliedHere: !everApplied(j) && appliedAt.has(companyKey(j.company)) })
    }
  }
  return top.map((j) => (kids.has(j.id) ? { ...j, subRows: kids.get(j.id)! } : j))
}
