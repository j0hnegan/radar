"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnSizingState, SortingState, VisibilityState } from "@tanstack/react-table"
import {
  ArrowDownUpIcon,
  BarChart3Icon,
  CheckIcon,
  EyeOffIcon,
  FilterIcon,
  KanbanSquareIcon,
  ListFilterIcon,
  LogOutIcon,
  MinusIcon,
  MoonIcon,
  PinIcon,
  PlusIcon,
  RowsIcon,
  Sheet as SheetIcon,
  SunIcon,
} from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { nestByCompany, needsFollowUp, QUICK_FILTERS, smartCompare, APPLIED } from "@/lib/radar"
import { BoardContext, useBoard, useBoardState } from "./use-board"
import { Grid, GRID_COLUMNS } from "./grid"
import { Kanban } from "./kanban"
import { RecordSheet } from "./record-sheet"
import { AddDialog, RemoveDialog } from "./dialogs"
import { Screened } from "./screened"
import { Stats } from "./stats"
import { Login } from "./login"
import { FilterChips, matchesFilters, SearchBox, type Filter } from "./search-filters"
import { useTheme } from "./use-theme"

type View = "grid" | "kanban" | "screened" | "stats"

const SORT_OPTIONS: { id: string; label: string; desc: boolean }[] = [
  { id: "", label: "Smart order", desc: false },
  { id: "fit_score", label: "Fit score", desc: true },
  { id: "salary_range", label: "Top salary", desc: true },
  { id: "company", label: "Company", desc: false },
  { id: "last_activity_at", label: "Last activity", desc: true },
  { id: "applied_at", label: "Applied date", desc: true },
]

const DEFAULT_HIDDEN: VisibilityState = { fit_reason: false, source: false, applied_at: false, posting: false }

type Prefs = {
  view: View
  filter: string
  group: boolean
  sorting: SortingState
  visibility: VisibilityState
  sizing: ColumnSizingState
  filters: Filter[]
  frozenRows: number
  frozenCols: number
}

const DEFAULT_PREFS: Prefs = {
  view: "grid",
  filter: "active",
  group: false,
  sorting: [],
  visibility: DEFAULT_HIDDEN,
  sizing: {},
  filters: [],
  frozenRows: 0,
  frozenCols: 1,
}

function usePrefs() {
  // Shell only mounts in the browser after sign-in, so reading storage here is safe.
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem("radar:prefs:v2") || "{}") }
    } catch {
      return DEFAULT_PREFS
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem("radar:prefs:v2", JSON.stringify(prefs))
    } catch {
      /* private mode */
    }
  }, [prefs])
  const set = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K] | ((old: Prefs[K]) => Prefs[K])) => {
    setPrefs((p) => ({ ...p, [k]: typeof v === "function" ? (v as (o: Prefs[K]) => Prefs[K])(p[k]) : v }))
  }, [])
  return [prefs, set] as const
}

export function RadarApp() {
  const board = useBoardState()
  const [theme] = useTheme()
  return (
    <BoardContext.Provider value={board}>
      <TooltipProvider>
        {board.authed === false ? (
          <Login />
        ) : board.authed === null ? (
          <div className="text-muted-foreground grid h-dvh place-items-center text-sm">
            {board.loadError ? `Couldn't load the board: ${board.loadError}` : "Loading…"}
          </div>
        ) : (
          <Shell />
        )}
        <Toaster theme={theme} />
      </TooltipProvider>
    </BoardContext.Provider>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  ...props
}: React.ComponentProps<"button"> & { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "hover:bg-accent inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium whitespace-nowrap transition-colors",
        active ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-foreground/80"
      )}
      {...props}
    >
      <Icon className="size-4" />
      <span className="max-sm:sr-only">{label}</span>
    </button>
  )
}

function Shell() {
  const { jobs, screened, logout } = useBoard()
  const [prefs, setPref] = usePrefs()
  const [theme, toggleTheme] = useTheme()
  const [openId, setOpenId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const quick = QUICK_FILTERS.find((f) => f.key === prefs.filter) || QUICK_FILTERS[0]
  const filtered = useMemo(
    () => jobs.filter((j) => quick.test(j) && matchesFilters(j, prefs.filters)).sort(smartCompare),
    [jobs, quick, prefs.filters]
  )
  const nested = useMemo(() => nestByCompany(filtered, jobs), [filtered, jobs])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const f of QUICK_FILTERS) c[f.key] = jobs.filter(f.test).length
    return c
  }, [jobs])
  const live = jobs.filter((j) => !j.removed)
  const summary = {
    new: live.filter((j) => j.status === "New").length,
    inPlay: live.filter((j) => APPLIED.includes(j.status)).length,
    follow: live.filter(needsFollowUp).length,
  }

  const openJob = jobs.find((j) => j.id === openId) || null
  const removeJob = jobs.find((j) => j.id === removeId) || null
  const sortId = prefs.sorting[0]?.id || ""
  const hiddenCount = GRID_COLUMNS.filter((c) => prefs.visibility[c.id] === false).length
  const onRemove = useCallback((id: string) => setRemoveId(id), [])

  const views: { id: View; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "grid", label: "Grid", icon: SheetIcon },
    { id: "kanban", label: "Kanban", icon: KanbanSquareIcon },
    { id: "screened", label: "Screened out", icon: ListFilterIcon, count: screened.length },
    { id: "stats", label: "Stats", icon: BarChart3Icon },
  ]

  const showTools = prefs.view === "grid" || prefs.view === "kanban"
  const visibleCols = GRID_COLUMNS.filter((c) => prefs.visibility[c.id] !== false)
  const frozenColNames = ["Company", ...visibleCols.map((c) => c.label)]
  const maxFrozenCols = frozenColNames.length
  const freezeActive = prefs.frozenRows > 0 || prefs.frozenCols !== 1

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Base header */}
      <header className="bg-brand text-brand-foreground flex h-12 shrink-0 items-center gap-3 px-3 pt-[env(safe-area-inset-top)] sm:px-4">
        <span className="text-[15px] font-semibold tracking-tight">Radar</span>
        <div className="text-brand-foreground/70 ml-auto hidden items-center gap-4 text-xs md:flex">
          <span>
            <b className="text-brand-foreground font-semibold">{summary.new}</b> new
          </span>
          <span>
            <b className="text-brand-foreground font-semibold">{summary.inPlay}</b> in progress
          </span>
          {summary.follow > 0 && (
            <span className="text-amber-300">
              <b className="font-semibold">{summary.follow}</b> to follow up
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <Button size="sm" onClick={() => setAdding(true)} className="bg-white/12 text-brand-foreground h-8 hover:bg-white/20">
            <PlusIcon /> <span className="max-sm:sr-only">Add role</span>
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-brand-foreground/70 hover:text-brand-foreground hover:bg-white/10"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-brand-foreground/70 hover:text-brand-foreground hover:bg-white/10"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOutIcon />
          </Button>
        </div>
      </header>

      {/* View tabs */}
      <nav className="bg-background no-scrollbar flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b px-2 sm:px-3" aria-label="Views">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setPref("view", v.id)}
            aria-current={prefs.view === v.id ? "page" : undefined}
            className={cn(
              "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-t-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
              prefs.view === v.id
                ? "text-foreground after:bg-primary after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
          >
            <v.icon className="size-4" />
            {v.label}
            {!!v.count && <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] tabular-nums">{v.count}</span>}
          </button>
        ))}
      </nav>

      {/* Toolbar: search and filters on the left, view tools and sort on the right */}
      {showTools && (
        <div className="bg-background flex h-11 shrink-0 items-center gap-1.5 border-b px-2 sm:px-3">
          <SearchBox jobs={jobs.filter(quick.test)} onAdd={(f) => setPref("filters", (fs) => [...fs, f])} />

          <div className="no-scrollbar ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarButton icon={FilterIcon} label={`Show: ${quick.label}`} active={quick.key !== "active"} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Show</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={prefs.filter} onValueChange={(v) => setPref("filter", v)}>
                  {QUICK_FILTERS.map((f) => (
                    <DropdownMenuRadioItem key={f.key} value={f.key} className="justify-between">
                      {f.label}
                      <span className="text-muted-foreground ml-auto text-xs tabular-nums">{counts[f.key]}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {prefs.view === "grid" && (
              <ToolbarButton
                icon={RowsIcon}
                label={prefs.group ? "Grouped by status" : "Group"}
                active={prefs.group}
                onClick={() => setPref("group", !prefs.group)}
              />
            )}

            {prefs.view === "grid" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarButton icon={PinIcon} label="Freeze" active={freezeActive} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Freeze</DropdownMenuLabel>
                  <Stepper
                    label="Rows"
                    hint={prefs.frozenRows ? `Top ${prefs.frozenRows}` : "None"}
                    value={prefs.frozenRows}
                    max={filtered.length}
                    onChange={(v) => setPref("frozenRows", v)}
                  />
                  <Stepper
                    label="Columns"
                    hint={prefs.frozenCols ? `Through ${frozenColNames[Math.min(prefs.frozenCols, maxFrozenCols) - 1]}` : "None"}
                    value={Math.min(prefs.frozenCols, maxFrozenCols)}
                    max={maxFrozenCols}
                    onChange={(v) => setPref("frozenCols", v)}
                  />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setPref("frozenRows", 0)
                      setPref("frozenCols", 1)
                    }}
                  >
                    Reset to company column only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {prefs.view === "grid" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarButton
                    icon={EyeOffIcon}
                    label={hiddenCount ? `${hiddenCount} hidden field${hiddenCount > 1 ? "s" : ""}` : "Hide fields"}
                    active={hiddenCount > 0}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Fields</DropdownMenuLabel>
                  {GRID_COLUMNS.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={prefs.visibility[c.id] !== false}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(on) => setPref("visibility", (v) => ({ ...v, [c.id]: !!on }))}
                    >
                      {c.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => { setPref("visibility", DEFAULT_HIDDEN); setPref("sizing", {}) }}>
                    Reset fields and widths
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {prefs.view === "grid" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarButton
                    icon={ArrowDownUpIcon}
                    label={sortId ? `Sorted by ${SORT_OPTIONS.find((s) => s.id === sortId)?.label || "column"}` : "Sort"}
                    active={!!sortId}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  {SORT_OPTIONS.map((s) => (
                    <DropdownMenuItem key={s.id || "smart"} onSelect={() => setPref("sorting", s.id ? [{ id: s.id, desc: s.desc }] : [])}>
                      <CheckIcon className={cn("size-4", sortId === s.id ? "opacity-100" : "opacity-0")} />
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <p className="text-muted-foreground px-2 py-1.5 text-xs">Smart order puts what needs you first, then best fit. Click any column header to sort by it.</p>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}
      {showTools && prefs.filters.length > 0 && (
        <div className="bg-background no-scrollbar flex h-10 shrink-0 items-center overflow-x-auto border-b px-2 sm:px-3">
          <FilterChips
            filters={prefs.filters}
            onRemove={(i) => setPref("filters", (fs) => fs.filter((_, k) => k !== i))}
            onClear={() => setPref("filters", [])}
          />
        </div>
      )}

      <main className="bg-background min-h-0 flex-1">
        {prefs.view === "grid" && (
          <Grid
            data={nested}
            groupByStatus={prefs.group}
            sorting={prefs.sorting}
            onSortingChange={(u) => setPref("sorting", u)}
            columnVisibility={prefs.visibility}
            onColumnVisibilityChange={(u) => setPref("visibility", u)}
            columnSizing={prefs.sizing}
            onColumnSizingChange={(u) => setPref("sizing", u)}
            frozenRows={prefs.frozenRows}
            frozenCols={prefs.frozenCols}
            onOpen={setOpenId}
            onRemove={onRemove}
          />
        )}
        {prefs.view === "kanban" && <Kanban jobs={filtered.filter((j) => !j.removed)} onOpen={setOpenId} />}
        {prefs.view === "screened" && <Screened />}
        {prefs.view === "stats" && <Stats onOpen={setOpenId} />}
      </main>

      {prefs.view === "grid" && (
        <footer className="bg-grid-head text-muted-foreground flex h-8 shrink-0 items-center border-t px-3 pb-[env(safe-area-inset-bottom)] text-xs tabular-nums">
          {filtered.length} record{filtered.length === 1 ? "" : "s"}
          {quick.key !== "all" && <span className="ml-1">· {quick.label.toLowerCase()}</span>}
          {prefs.filters.length > 0 && <span className="ml-1">· {prefs.filters.length} filter{prefs.filters.length > 1 ? "s" : ""}</span>}
        </footer>
      )}

      <RecordSheet job={openJob} onClose={() => setOpenId(null)} onRemove={(id) => setRemoveId(id)} />
      <RemoveDialog
        job={removeJob}
        onClose={() => setRemoveId(null)}
      />
      <AddDialog open={adding} onClose={() => setAdding(false)} onAdded={setOpenId} />
    </div>
  )
}

function Stepper({ label, hint, value, max, onChange }: { label: string; hint: string; value: number; max: number; onChange: (v: number) => void }) {
  const btn = "hover:bg-accent grid size-7 place-items-center rounded-md border disabled:pointer-events-none disabled:opacity-40"
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground truncate text-xs">{hint}</div>
      </div>
      <button type="button" className={btn} disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label={`Freeze one fewer ${label.toLowerCase()}`}>
        <MinusIcon className="size-3.5" />
      </button>
      <span className="w-5 text-center tabular-nums">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`Freeze one more ${label.toLowerCase()}`}>
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  )
}

export function RadarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" opacity=".12" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#7aa2ff" strokeWidth="2" opacity=".5" />
      <circle cx="16" cy="16" r="4.5" fill="none" stroke="#7aa2ff" strokeWidth="2" />
      <path d="M16 16 L24 9" stroke="#b9cdff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="21.5" cy="11.5" r="1.8" fill="#46d39a" />
    </svg>
  )
}
