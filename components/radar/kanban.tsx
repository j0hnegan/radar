"use client"

import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { MapPinIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { STATUSES, type Job, type Status } from "@/lib/types"
import { companyKey, everApplied, needsFollowUp, STATUS_DOT } from "@/lib/radar"
import { FitScore, setStatusLocal, Thumbs } from "./cells"
import { useBoard } from "./use-board"

function Card({ job, appliedHere, overlay }: { job: Job; appliedHere?: boolean; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "bg-card rounded-lg border p-3 text-[13px] shadow-xs transition-shadow",
        overlay ? "rotate-1 shadow-lg" : "hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{job.company}</div>
          <div className="text-foreground/80 line-clamp-2 leading-snug">{job.job_title}</div>
        </div>
        <div className="w-8 shrink-0 pt-0.5 text-right">
          <FitScore score={job.fit_score} compact />
        </div>
      </div>
      <div className="text-muted-foreground mt-2 space-y-0.5 text-xs">
        {job.salary_range && <div className="truncate tabular-nums">{job.salary_range}</div>}
        {job.location && (
          <div className="flex items-center gap-1 truncate">
            <MapPinIcon className="size-3 shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {needsFollowUp(job) && (
            <span className="rounded bg-amber-100 px-1.5 py-px text-[11px] font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
              Follow up
            </span>
          )}
          {appliedHere && (
            <span className="rounded bg-blue-100 px-1.5 py-px text-[11px] font-medium text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
              Applied here
            </span>
          )}
          {job.rounds?.length > 0 && (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-px text-[11px] font-medium">
              {job.rounds.length} round{job.rounds.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!overlay && (
          <div className="-mr-1.5 -mb-1.5">
            <Thumbs job={job} />
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableCard({ job, appliedHere, onOpen }: { job: Job; appliedHere: boolean; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(job.id)}
      className={cn("cursor-grab touch-manipulation outline-none active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <Card job={job} appliedHere={appliedHere} />
    </div>
  )
}

function Column({ status, jobs, children }: { status: Status; jobs: Job[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "bg-muted/50 flex h-full w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-xl border border-transparent sm:w-72",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
        <h3 className="text-sm font-semibold">{status}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">{jobs.length}</span>
      </header>
      <div className="grid-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">{children}</div>
    </section>
  )
}

export function Kanban({ jobs, onOpen }: { jobs: Job[]; onOpen: (id: string) => void }) {
  const { act, jobs: all } = useBoard()
  const [dragId, setDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } })
  )
  const applied = new Set(all.filter((j) => !j.removed && everApplied(j)).map((j) => companyKey(j.company)))
  const dragging = dragId ? jobs.find((j) => j.id === dragId) : null

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    const to = e.over?.id as Status | undefined
    const job = jobs.find((j) => j.id === e.active.id)
    if (!to || !job || job.status === to) return
    act(job.id, { action: "status", status: to }, (j) => setStatusLocal(j, to))
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className="grid-scroll flex h-full snap-x snap-mandatory gap-3 overflow-x-auto p-3 sm:snap-none sm:p-4">
        {STATUSES.map((s) => {
          const col = jobs.filter((j) => j.status === s)
          return (
            <Column key={s} status={s} jobs={col}>
              {col.map((j) => (
                <DraggableCard
                  key={j.id}
                  job={j}
                  appliedHere={!everApplied(j) && applied.has(companyKey(j.company))}
                  onOpen={onOpen}
                />
              ))}
              {col.length === 0 && (
                <div className="text-muted-foreground/70 rounded-lg border border-dashed px-3 py-6 text-center text-xs">
                  Drop a role here
                </div>
              )}
            </Column>
          )
        })}
      </div>
      <DragOverlay dropAnimation={null}>{dragging ? <Card job={dragging} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}
