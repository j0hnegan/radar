import "server-only"
import fs from "node:fs"
import path from "node:path"
import { HttpError } from "./http"
import type { JobsFile } from "../types"

// Reads and writes the JSON files in data/.
// On Vercel every write is a commit through the GitHub Contents API, with a
// token that can only touch this one repo. With RADAR_LOCAL_DATA=1 (local dev
// only) it uses the files on disk instead.

const FILES = {
  jobs: "data/jobs.json",
  inbox: "data/inbox.json",
  screenedOut: "data/screened-out.json",
} as const
export type FileName = keyof typeof FILES

const empty = <T,>(): JobsFile<T> => ({ version: 1, updated_at: null, jobs: [] })
const isLocal = () => process.env.RADAR_LOCAL_DATA === "1" && process.env.NODE_ENV !== "production"

function repo() {
  const owner = process.env.VERCEL_GIT_REPO_OWNER
  const slug = process.env.VERCEL_GIT_REPO_SLUG
  const r = process.env.GITHUB_REPO || (owner && slug ? `${owner}/${slug}` : "")
  if (!/^[\w.-]+\/[\w.-]+$/.test(r)) throw new HttpError(500, "Set GITHUB_REPO (owner/name)")
  return r
}

// Write to the branch this deployment was built from, so data and code stay together.
const branch = () => process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || ""

async function gh(method: string, url: string, body?: unknown) {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new HttpError(500, "GITHUB_TOKEN is not set")
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "radar-board",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const text = await res.text()
  let data: Record<string, unknown> | null = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  return { status: res.status, data }
}

type Read<T> = { data: JobsFile<T>; sha: string | null }

async function readGithub<T>(file: string): Promise<Read<T>> {
  const ref = branch()
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const { status, data } = await gh("GET", `/repos/${repo()}/contents/${file}${q}`)
  if (status === 404) return { data: empty<T>(), sha: null }
  if (status !== 200 || !data) throw new HttpError(502, `GitHub read failed (${status})`)
  let b64 = (data.content as string) || ""
  if (!b64 && Number(data.size) > 0) {
    // Files over 1 MB come back without content, so read the blob instead.
    const blob = await gh("GET", `/repos/${repo()}/git/blobs/${data.sha}`)
    if (blob.status !== 200 || !blob.data) throw new HttpError(502, `GitHub blob read failed (${blob.status})`)
    b64 = blob.data.content as string
  }
  const text = Buffer.from(b64, "base64").toString("utf8")
  return { data: text ? JSON.parse(text) : empty<T>(), sha: data.sha as string }
}

async function writeGithub(file: string, body: unknown, sha: string | null, message: string) {
  const payload: Record<string, unknown> = {
    message,
    content: Buffer.from(JSON.stringify(body, null, 2) + "\n", "utf8").toString("base64"),
  }
  if (sha) payload.sha = sha
  const ref = branch()
  if (ref) payload.branch = ref
  const { status } = await gh("PUT", `/repos/${repo()}/contents/${file}`, payload)
  if (status === 200 || status === 201) return true
  if (status === 409 || status === 422) return false // another write landed first: retry
  throw new HttpError(502, `GitHub write failed (${status})`)
}

export async function read<T>(name: FileName): Promise<Read<T>> {
  const file = FILES[name]
  if (isLocal()) {
    const p = path.join(process.cwd(), file)
    if (!fs.existsSync(p)) return { data: empty<T>(), sha: null }
    return { data: JSON.parse(fs.readFileSync(p, "utf8")), sha: "local" }
  }
  return readGithub<T>(file)
}

export type Skip<R> = { skipWrite: true; result: R }

// Read, change, write; retry if another write landed in between.
// mutate changes data in place and returns a result, or { skipWrite, result }
// to finish without committing.
export async function update<T, R>(
  name: FileName,
  mutate: (data: JobsFile<T>) => R | Skip<R> | Promise<R | Skip<R>>,
  message: string
): Promise<R> {
  const file = FILES[name]
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, sha } = await read<T>(name)
    if (!Array.isArray(data.jobs)) data.jobs = []
    const out = await mutate(data)
    if (out && typeof out === "object" && "skipWrite" in (out as object)) return (out as Skip<R>).result
    data.updated_at = new Date().toISOString()
    let ok: boolean
    if (isLocal()) {
      fs.writeFileSync(path.join(process.cwd(), file), JSON.stringify(data, null, 2) + "\n")
      ok = true
    } else {
      ok = await writeGithub(file, data, sha, message)
    }
    if (ok) return out as R
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1) + Math.random() * 200))
  }
  throw new HttpError(409, "The board was busy. Try again.")
}
