import "server-only"
import crypto from "node:crypto"
import type { IncomingJob } from "../types"

const TRACKING = /^(utm_|ref$|refId$|trk|trackingId$|src$|source$|lever-source|gh_src$|lipi$|li_fat_id$)/i

export function normalizeUrl(u: unknown): string {
  if (!u || typeof u !== "string") return ""
  try {
    const url = new URL(u.trim())
    if (!/^https?:$/.test(url.protocol)) return ""
    url.hash = ""
    url.protocol = "https:"
    for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k)
    let s = url.toString()
    if (s.endsWith("/") && url.pathname !== "/") s = s.slice(0, -1)
    return s
  } catch {
    return ""
  }
}

export function makeId(seed?: string) {
  const base = seed || crypto.randomBytes(12).toString("hex")
  return crypto.createHash("sha1").update(base).digest("hex").slice(0, 10)
}

export function str(v: unknown, max: number): string {
  if (v === undefined || v === null) return ""
  let s = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim()
  if (s.toLowerCase() === "unknown") s = ""
  return s.slice(0, max)
}

// What an ingested job may carry. Anything else in the payload is dropped.
export function cleanIncoming(j: Record<string, unknown>): IncomingJob {
  return {
    company: str(j.company, 120),
    job_title: str(j.job_title, 200),
    location: str(j.location, 200),
    salary_range: str(j.salary_range, 80),
    posted_date: str(j.posted_date, 40),
    job_url: normalizeUrl(j.job_url),
    company_careers_url: normalizeUrl(j.company_careers_url),
    source: str(j.source, 40).toLowerCase(),
    one_line_about_company: str(j.one_line_about_company, 300),
  }
}

export const nowIso = () => new Date().toISOString()
