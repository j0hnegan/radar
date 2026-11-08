"use client"

import { useMemo, useState } from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Job } from "@/lib/types"

export type Filter = { field: string; q: string }

const FIELDS: { key: string; label: string; get: (j: Job) => string }[] = [
  { key: "company", label: "Company", get: (j) => j.company },
  { key: "job_title", label: "Role", get: (j) => j.job_title },
  { key: "location", label: "Location", get: (j) => j.location },
  { key: "company_stage", label: "Stage", get: (j) => j.company_stage },
  { key: "status", label: "Status", get: (j) => j.status },
  { key: "salary_range", label: "Salary", get: (j) => j.salary_range },
  { key: "one_line_about", label: "About", get: (j) => j.one_line_about },
  { key: "fit_reason", label: "Fit note", get: (j) => j.fit_reason },
  { key: "hiring_manager", label: "Hiring manager", get: (j) => j.hiring_manager?.name || "" },
  { key: "notes", label: "Notes", get: (j) => j.notes },
  { key: "source", label: "Source", get: (j) => j.source },
]

const ANY = { key: "any", label: "Anywhere", get: (j: Job) => FIELDS.map((f) => f.get(j)).join(" ") }

const fieldOf = (key: string) => FIELDS.find((f) => f.key === key) || ANY
const has = (text: string, q: string) => String(text || "").toLowerCase().includes(q.toLowerCase())

export function matchesFilters(j: Job, filters: Filter[]) {
  return filters.every((f) => has(fieldOf(f.field).get(j), f.q))
}

export function SearchBox({ jobs, onAdd }: { jobs: Job[]; onAdd: (f: Filter) => void }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const term = q.trim()

  // Anywhere first, then every field that has a match, with how many roles it would keep.
  const options = useMemo(() => {
    if (!term) return []
    const count = (get: (j: Job) => string) => jobs.filter((j) => has(get(j), term)).length
    return [ANY, ...FIELDS]
      .map((f) => ({ key: f.key, label: f.label, count: count(f.get) }))
      .filter((o) => o.key === "any" || o.count > 0)
  }, [jobs, term])

  const add = (field: string) => {
    if (!term) return
    onAdd({ field, q: term })
    setQ("")
    setActive(0)
  }

  return (
    <div className="relative shrink-0">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, options.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === "Enter") {
            add(options[active]?.key || "any")
          } else if (e.key === "Escape") {
            setQ("")
            e.currentTarget.blur()
          }
        }}
        placeholder="Search to add a filter"
        className="h-8 w-44 pl-8 sm:w-60"
        aria-label="Search to add a filter"
      />
      {open && options.length > 0 && (
        <div
          role="listbox"
          className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 w-64 overflow-hidden rounded-md border p-1 shadow-md"
        >
          {options.map((o, i) => (
            <button
              key={o.key}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(o.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]",
                i === active && "bg-accent"
              )}
            >
              <span className="text-muted-foreground shrink-0">{o.label}</span>
              <span className="min-w-0 flex-1 truncate font-medium">“{term}”</span>
              <span className="text-muted-foreground text-xs tabular-nums">{o.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function FilterChips({ filters, onRemove, onClear }: { filters: Filter[]; onRemove: (i: number) => void; onClear: () => void }) {
  if (!filters.length) return null
  return (
    <div className="flex shrink-0 items-center gap-1">
      {filters.map((f, i) => (
        <span
          key={`${f.field}:${f.q}:${i}`}
          className="bg-primary/10 text-primary inline-flex h-7 items-center gap-1 rounded-md pr-1 pl-2 text-xs font-medium whitespace-nowrap"
        >
          <span className="opacity-70">{fieldOf(f.field).label}:</span> {f.q}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="hover:bg-primary/15 grid size-5 place-items-center rounded"
            aria-label={`Remove filter ${fieldOf(f.field).label}: ${f.q}`}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      {filters.length > 1 && (
        <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground px-1.5 text-xs whitespace-nowrap">
          Clear all
        </button>
      )}
    </div>
  )
}
