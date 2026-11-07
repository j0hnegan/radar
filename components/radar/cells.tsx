"use client"

import { useState } from "react"
import { ChevronDownIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { STAGES, STATUSES, type Job, type Stage, type Status } from "@/lib/types"
import { STAGE_STYLE, STATUS_DOT, STATUS_STYLE } from "@/lib/radar"
import { useBoard } from "./use-board"

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        STATUS_STYLE[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {status}
    </span>
  )
}

export function StagePill({ stage }: { stage: string }) {
  if (!stage) return <span className="text-muted-foreground/60 text-xs">Not set</span>
  return (
    <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", STAGE_STYLE[stage])}>
      {stage}
    </span>
  )
}

export function setStatusLocal(j: Job, status: Status): Job {
  const at = new Date().toISOString()
  return { ...j, status, last_activity_at: at, status_history: [...(j.status_history || []), { status, at }] }
}

export function StatusMenu({ job, full }: { job: Job; full?: boolean }) {
  const { act } = useBoard()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={stop}
        onPointerDown={stop}
        className={cn(
          "group/status inline-flex max-w-full items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          full && "h-9 w-full justify-between rounded-md border px-2 shadow-xs"
        )}
        aria-label={`Status: ${job.status}`}
      >
        <StatusPill status={job.status} />
        <ChevronDownIcon className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover/status:opacity-100 group-focus-visible/status:opacity-100 max-md:opacity-60 data-[full=true]:opacity-60" data-full={full} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={stop} className="min-w-40">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => s !== job.status && act(job.id, { action: "status", status: s }, (j) => setStatusLocal(j, s))}
            className={cn(s === job.status && "bg-accent")}
          >
            <StatusPill status={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StageMenu({ job, full }: { job: Job; full?: boolean }) {
  const { act } = useBoard()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={stop}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          full && "h-9 w-full justify-between rounded-md border px-2 shadow-xs"
        )}
        aria-label="Company stage"
      >
        <StagePill stage={job.company_stage} />
        {full && <ChevronDownIcon className="text-muted-foreground size-3.5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={stop}>
        {STAGES.map((s) => (
          <DropdownMenuItem
            key={s || "none"}
            onSelect={() =>
              act(job.id, { action: "edit", fields: { company_stage: s } }, (j) => ({ ...j, company_stage: s as Stage }))
            }
          >
            <StagePill stage={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Thumbs({ job, size = "sm" }: { job: Job; size?: "sm" | "md" }) {
  const { act } = useBoard()
  const set = (v: "up" | "down") => {
    const value = job.thumbs === v ? null : v
    act(job.id, { action: "thumbs", value }, (j) => ({ ...j, thumbs: value }))
  }
  const btn = cn(
    "inline-grid place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground",
    size === "sm" ? "size-7" : "size-9"
  )
  return (
    <div className="flex items-center gap-0.5" onClick={stop}>
      <button
        type="button"
        className={cn(btn, job.thumbs === "up" && "text-emerald-600 dark:text-emerald-400")}
        aria-label="Thumbs up"
        aria-pressed={job.thumbs === "up"}
        onClick={() => set("up")}
      >
        <ThumbsUpIcon className={cn("size-4", job.thumbs === "up" && "fill-current/20")} />
      </button>
      <button
        type="button"
        className={cn(btn, job.thumbs === "down" && "text-rose-600 dark:text-rose-400")}
        aria-label="Thumbs down"
        aria-pressed={job.thumbs === "down"}
        onClick={() => set("down")}
      >
        <ThumbsDownIcon className={cn("size-4", job.thumbs === "down" && "fill-current/20")} />
      </button>
    </div>
  )
}

export function FitScore({ score, compact }: { score: number | null; compact?: boolean }) {
  if (score == null) return <span className="text-muted-foreground/60">–</span>
  const color = score >= 85 ? "bg-emerald-500" : score >= 70 ? "bg-blue-500" : "bg-slate-400"
  return (
    <div className="flex w-full items-center gap-2">
      <span className="w-6 text-right font-semibold tabular-nums">{score}</span>
      {!compact && (
        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
        </div>
      )}
    </div>
  )
}

// Click to edit in place; Enter or leaving the cell saves, Escape cancels.
export function NotesCell({ job }: { job: Job }) {
  const { act } = useBoard()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(job.notes || "")
  const save = () => {
    setEditing(false)
    if (value !== (job.notes || "")) act(job.id, { action: "notes", notes: value }, (j) => ({ ...j, notes: value }))
  }
  if (editing)
    return (
      <input
        autoFocus
        value={value}
        onClick={stop}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") {
            setValue(job.notes || "")
            setEditing(false)
          }
        }}
        className="bg-background ring-primary absolute inset-0 z-10 h-full w-full px-2 text-[13px] outline-none ring-2 ring-inset"
        aria-label="Notes"
      />
    )
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setValue(job.notes || "")
        setEditing(true)
      }}
      className={cn("block h-full w-full truncate text-left", !job.notes && "text-muted-foreground/50")}
      title={job.notes || "Add a note"}
    >
      {job.notes || "Add a note"}
    </button>
  )
}
