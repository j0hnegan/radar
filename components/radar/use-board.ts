"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { BoardData, Job, ScreenedOutJob } from "@/lib/types"

class SignedOut extends Error {}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  })
  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (res.status === 401 && path !== "/api/login") throw new SignedOut("Signed out")
  if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`)
  return data as T
}

export type Payload = Record<string, unknown>

export function useBoardState() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [screened, setScreened] = useState<ScreenedOutJob[]>([])
  const [inboxCount, setInboxCount] = useState(0)
  const [loadError, setLoadError] = useState("")
  const jobsRef = useRef<Job[]>([])
  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const handle = useCallback((err: unknown) => {
    if (err instanceof SignedOut) setAuthed(false)
    else toast.error(err instanceof Error ? err.message : "Something went wrong")
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await api<BoardData>("/api/jobs")
      setJobs(data.jobs)
      setScreened(data.screened_out)
      setInboxCount(data.inbox_count)
      setAuthed(true)
      setLoadError("")
    } catch (err) {
      if (err instanceof SignedOut) setAuthed(false)
      else setLoadError(err instanceof Error ? err.message : "Couldn't load the board")
    }
  }, [])

  useEffect(() => {
    // Fetch on mount; load() only sets state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // Pick up changes made elsewhere (the screener, his phone) when the tab comes back.
    const onVis = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  const replace = useCallback((job: Job) => {
    setJobs((list) => {
      const i = list.findIndex((j) => j.id === job.id)
      if (i < 0) return [...list, job]
      const next = list.slice()
      next[i] = job
      return next
    })
  }, [])

  // Optimistic: change locally, then take the server's copy (or roll back).
  const act = useCallback(
    async (id: string, payload: Payload, optimistic?: (j: Job) => Job) => {
      const before = jobsRef.current.find((j) => j.id === id)
      if (before && optimistic) replace(optimistic(structuredClone(before)))
      try {
        const data = await api<{ job: Job }>("/api/update", { id, ...payload })
        replace(data.job)
        return data.job
      } catch (err) {
        if (before) replace(before)
        handle(err)
        return null
      }
    },
    [replace, handle]
  )

  const add = useCallback(
    async (job: Payload) => {
      try {
        const data = await api<{ job: Job }>("/api/update", { action: "add", job })
        replace(data.job)
        return data.job
      } catch (err) {
        handle(err)
        return null
      }
    },
    [replace, handle]
  )

  const promote = useCallback(
    async (id: string) => {
      try {
        const data = await api<{ job: Job }>("/api/update", { action: "promote", id })
        setScreened((s) => s.filter((x) => x.id !== id))
        replace(data.job)
        toast.success(`Added ${data.job.company} to the board`)
      } catch (err) {
        handle(err)
      }
    },
    [replace, handle]
  )

  const login = useCallback(
    async (password: string) => {
      await api("/api/login", { password })
      await load()
    },
    [load]
  )

  const logout = useCallback(async () => {
    try {
      await api("/api/logout", {})
    } finally {
      setAuthed(false)
      setJobs([])
    }
  }, [])

  return { authed, jobs, screened, inboxCount, loadError, load, act, add, promote, login, logout }
}

export type Board = ReturnType<typeof useBoardState>
export const BoardContext = createContext<Board | null>(null)
export function useBoard() {
  const b = useContext(BoardContext)
  if (!b) throw new Error("useBoard outside BoardContext")
  return b
}
