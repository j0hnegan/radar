"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type ExpandedState,
  type OnChangeFn,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  AlignLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  Building2Icon,
  CalendarCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  ClockIcon,
  CornerDownRightIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  GaugeIcon,
  GlobeIcon,
  LayersIcon,
  LinkIcon,
  MapPinIcon,
  Maximize2Icon,
  SparklesIcon,
  StickyNoteIcon,
  ThumbsUpIcon,
  TypeIcon,
  Undo2Icon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Status } from "@/lib/types"
import {
  ago,
  daysSince,
  fmtDate,
  needsFollowUp,
  safeUrl,
  salaryMax,
  STATUS_ORDER,
  type JobRow,
} from "@/lib/radar"
import { FitScore, NotesCell, StageMenu, StatusMenu, StatusPill, Thumbs } from "./cells"
import { useBoard } from "./use-board"

const ROWNUM = 52

type Meta = { icon?: React.ComponentType<{ className?: string }>; sticky?: boolean; className?: string }

function Head({ icon: Icon, label }: { icon?: Meta["icon"]; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {Icon && <Icon className="text-muted-foreground size-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  )
}

function Flag({ children, tone }: { children: React.ReactNode; tone: "amber" | "blue" | "green" | "rose" }) {
  const tones = {
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  }
  return <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-medium", tones[tone])}>{children}</span>
}

function useColumns(onRemove: (id: string) => void): ColumnDef<JobRow>[] {
  const { act } = useBoard()
  return useMemo<ColumnDef<JobRow>[]>(
    () => [
      {
        id: "company",
        accessorKey: "company",
        header: () => <Head icon={Building2Icon} label="Company" />,
        size: 210,
        minSize: 120,
        meta: { sticky: true } as Meta,
        sortingFn: (a, b) => a.original.company.localeCompare(b.original.company),
        cell: ({ row }) => {
          const j = row.original
          const followDays = needsFollowUp(j) ? daysSince(j.last_activity_at || j.applied_at) : null
          return (
            <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: row.depth * 14 }}>
              {row.getCanExpand() ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-accent -ml-1 grid size-5 shrink-0 place-items-center rounded"
                  onClick={(e) => {
                    e.stopPropagation()
                    row.toggleExpanded()
                  }}
                  aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
                >
                  {row.getIsExpanded() ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
                </button>
              ) : j._child ? (
                <CornerDownRightIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
              ) : null}
              <span className="truncate font-semibold">{j.company}</span>
              {row.getCanExpand() && <Flag tone="blue">+{row.subRows.length}</Flag>}
              {j._appliedHere && <Flag tone="blue">Applied here</Flag>}
              {followDays !== null && <Flag tone="amber">Follow up</Flag>}
              {j.removed && <Flag tone="rose">Removed</Flag>}
            </div>
          )
        },
      },
      {
        id: "job_title",
        accessorKey: "job_title",
        header: () => <Head icon={TypeIcon} label="Role" />,
        size: 270,
        cell: ({ row }) => <span className="block truncate">{row.original.job_title}</span>,
      },
      {
        id: "fit_score",
        accessorFn: (j) => j.fit_score ?? -1,
        header: () => <Head icon={GaugeIcon} label="Fit" />,
        size: 110,
        sortDescFirst: true,
        cell: ({ row }) => <FitScore score={row.original.fit_score} />,
      },
      {
        id: "status",
        accessorFn: (j) => STATUS_ORDER.indexOf(j.status),
        header: () => <Head icon={CircleDotIcon} label="Status" />,
        size: 150,
        cell: ({ row }) => <StatusMenu job={row.original} />,
      },
      {
        id: "thumbs",
        accessorFn: (j) => (j.thumbs === "up" ? 1 : j.thumbs === "down" ? -1 : 0),
        header: () => <Head icon={ThumbsUpIcon} label="Taste" />,
        size: 90,
        sortDescFirst: true,
        cell: ({ row }) => <Thumbs job={row.original} />,
      },
      {
        id: "salary_range",
        accessorFn: (j) => salaryMax(j.salary_range),
        header: () => <Head icon={DollarSignIcon} label="Salary" />,
        size: 180,
        sortDescFirst: true,
        cell: ({ row }) =>
          row.original.salary_range ? (
            <span className="block truncate tabular-nums">{row.original.salary_range}</span>
          ) : (
            <span className="text-muted-foreground/60">Not listed</span>
          ),
      },
      {
        id: "location",
        accessorKey: "location",
        header: () => <Head icon={MapPinIcon} label="Location" />,
        size: 210,
        cell: ({ row }) => <span className="block truncate">{row.original.location || "—"}</span>,
      },
      {
        id: "company_stage",
        accessorKey: "company_stage",
        header: () => <Head icon={LayersIcon} label="Stage" />,
        size: 160,
        cell: ({ row }) => <StageMenu job={row.original} />,
      },
      {
        id: "one_line_about",
        accessorKey: "one_line_about",
        header: () => <Head icon={AlignLeftIcon} label="About" />,
        size: 280,
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-foreground block truncate">{row.original.one_line_about}</span>,
      },
      {
        id: "fit_reason",
        accessorKey: "fit_reason",
        header: () => <Head icon={SparklesIcon} label="Fit note" />,
        size: 320,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground block truncate" title={row.original.fit_reason}>
            {row.original.fit_reason}
          </span>
        ),
      },
      {
        id: "hiring_manager",
        accessorFn: (j) => j.hiring_manager?.name || "",
        header: () => <Head icon={UserRoundIcon} label="Hiring manager" />,
        size: 170,
        cell: ({ row }) => {
          const hm = row.original.hiring_manager || { name: "", linkedin: "" }
          const href = safeUrl(hm.linkedin)
          if (!hm.name && !href) return <span className="text-muted-foreground/50">—</span>
          return href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary inline-flex max-w-full items-center gap-1 truncate hover:underline"
            >
              <span className="truncate">{hm.name || "LinkedIn"}</span>
              <ExternalLinkIcon className="size-3 shrink-0" />
            </a>
          ) : (
            <span className="block truncate">{hm.name}</span>
          )
        },
      },
      {
        id: "applied_at",
        accessorFn: (j) => j.applied_at || "",
        header: () => <Head icon={CalendarCheckIcon} label="Applied" />,
        size: 110,
        sortDescFirst: true,
        cell: ({ row }) => <span className="tabular-nums">{fmtDate(row.original.applied_at)}</span>,
      },
      {
        id: "last_activity_at",
        accessorFn: (j) => j.last_activity_at || "",
        header: () => <Head icon={ClockIcon} label="Last activity" />,
        size: 120,
        sortDescFirst: true,
        cell: ({ row }) => <span className="text-muted-foreground">{ago(row.original.last_activity_at)}</span>,
      },
      {
        id: "source",
        accessorKey: "source",
        header: () => <Head icon={GlobeIcon} label="Source" />,
        size: 110,
        cell: ({ row }) => <span className="text-muted-foreground block truncate capitalize">{row.original.source}</span>,
      },
      {
        id: "notes",
        accessorKey: "notes",
        header: () => <Head icon={StickyNoteIcon} label="Notes" />,
        size: 260,
        enableSorting: false,
        meta: { className: "relative" } as Meta,
        cell: ({ row }) => <NotesCell job={row.original} />,
      },
      {
        id: "posting",
        accessorKey: "job_url",
        header: () => <Head icon={LinkIcon} label="Posting" />,
        size: 96,
        enableSorting: false,
        cell: ({ row }) => {
          const href = safeUrl(row.original.job_url)
          return href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              Open <ExternalLinkIcon className="size-3" />
            </a>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )
        },
      },
      {
        id: "actions",
        header: () => null,
        size: 44,
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        cell: ({ row }) => {
          const j = row.original
          return j.removed ? (
            <button
              type="button"
              title="Put back on the board"
              aria-label="Restore"
              className="text-muted-foreground hover:bg-accent hover:text-foreground grid size-7 place-items-center rounded-md"
              onClick={(e) => {
                e.stopPropagation()
                act(j.id, { action: "restore" }, (x) => ({ ...x, removed: null }))
              }}
            >
              <Undo2Icon className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              title="Remove"
              aria-label="Remove"
              className="text-muted-foreground/60 hover:bg-accent hover:text-foreground grid size-7 place-items-center rounded-md"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(j.id)
              }}
            >
              <XIcon className="size-4" />
            </button>
          )
        },
      },
    ],
    [act, onRemove]
  )
}

export const GRID_COLUMNS: { id: string; label: string }[] = [
  { id: "job_title", label: "Role" },
  { id: "fit_score", label: "Fit" },
  { id: "status", label: "Status" },
  { id: "thumbs", label: "Taste" },
  { id: "salary_range", label: "Salary" },
  { id: "location", label: "Location" },
  { id: "company_stage", label: "Stage" },
  { id: "one_line_about", label: "About" },
  { id: "fit_reason", label: "Fit note" },
  { id: "hiring_manager", label: "Hiring manager" },
  { id: "applied_at", label: "Applied" },
  { id: "last_activity_at", label: "Last activity" },
  { id: "source", label: "Source" },
  { id: "notes", label: "Notes" },
  { id: "posting", label: "Posting" },
]

type Props = {
  data: JobRow[]
  groupByStatus: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  columnVisibility: VisibilityState
  onColumnVisibilityChange: OnChangeFn<VisibilityState>
  columnSizing: ColumnSizingState
  onColumnSizingChange: OnChangeFn<ColumnSizingState>
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}

export function Grid(p: Props) {
  const columns = useColumns(p.onRemove)
  const [expanded, setExpanded] = useState<ExpandedState>(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const table = useReactTable({
    data: p.data,
    columns,
    state: { sorting: p.sorting, columnVisibility: p.columnVisibility, columnSizing: p.columnSizing, expanded },
    onSortingChange: p.onSortingChange,
    onColumnVisibilityChange: p.onColumnVisibilityChange,
    onColumnSizingChange: p.onColumnSizingChange,
    onExpandedChange: setExpanded,
    getRowId: (r) => r.id,
    getSubRows: (r) => r.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enableSortingRemoval: true,
    defaultColumn: { minSize: 60, maxSize: 640 },
  })

  const rows = table.getRowModel().rows
  const headers = table.getHeaderGroups()[0].headers
  const visibleCols = table.getVisibleLeafColumns()
  const companyWidth = table.getColumn("company")?.getSize() ?? 210

  // Blocks keep a parent row with the roles nested under it.
  const blocks: Row<JobRow>[][] = []
  for (const r of rows) {
    if (r.depth === 0) blocks.push([r])
    else blocks[blocks.length - 1]?.push(r)
  }
  const groups: { status: Status | null; blocks: Row<JobRow>[][] }[] = p.groupByStatus
    ? STATUS_ORDER.map((s) => ({ status: s, blocks: blocks.filter((b) => b[0].original.status === s) })).filter(
        (g) => g.blocks.length
      )
    : [{ status: null, blocks }]

  const stickyCell = (sticky: boolean, left: number, z = 10) =>
    sticky ? { position: "sticky" as const, left, zIndex: z } : undefined

  let n = 0
  const renderRow = (row: Row<JobRow>) => {
    n += 1
    const j = row.original
    return (
      <tr
        key={row.id}
        onClick={() => p.onOpen(j.id)}
        className={cn("group/row h-9 cursor-pointer", j.removed && "opacity-55")}
      >
        <td
          style={{ width: ROWNUM, ...stickyCell(true, 0) }}
          className="bg-background group-hover/row:bg-grid-hover border-grid text-muted-foreground border-b text-center text-xs tabular-nums"
        >
          <span className="group-hover/row:hidden">{j._child ? "" : n}</span>
          <button
            type="button"
            className="text-primary hover:bg-accent mx-auto hidden size-6 place-items-center rounded group-hover/row:grid"
            aria-label="Open record"
            onClick={(e) => {
              e.stopPropagation()
              p.onOpen(j.id)
            }}
          >
            <Maximize2Icon className="size-3.5" />
          </button>
        </td>
        {row.getVisibleCells().map((cell) => {
          const meta = (cell.column.columnDef.meta || {}) as Meta
          return (
            <td
              key={cell.id}
              style={{ width: cell.column.getSize(), ...stickyCell(!!meta.sticky, ROWNUM) }}
              className={cn(
                "bg-background group-hover/row:bg-grid-hover border-grid overflow-hidden border-r border-b px-2 align-middle whitespace-nowrap",
                j._child && "bg-muted/30",
                meta.sticky && "shadow-[1px_0_0_var(--grid)]",
                meta.className
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="grid-scroll h-full overflow-auto overscroll-contain">
      <table
        className="border-separate border-spacing-0 text-[13px]"
        style={{ width: table.getTotalSize() + ROWNUM, tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: ROWNUM }} />
          {visibleCols.map((c) => (
            <col key={c.id} style={{ width: c.getSize() }} />
          ))}
        </colgroup>
        <thead>
          <tr className="h-8">
            <th
              style={{ width: ROWNUM, position: "sticky", top: 0, left: 0, zIndex: 30 }}
              className="bg-grid-head border-grid border-b"
            />
            {headers.map((h) => {
              const meta = (h.column.columnDef.meta || {}) as Meta
              const sorted = h.column.getIsSorted()
              return (
                <th
                  key={h.id}
                  style={{
                    width: h.getSize(),
                    position: "sticky",
                    top: 0,
                    zIndex: meta.sticky ? 30 : 20,
                    left: meta.sticky ? ROWNUM : undefined,
                  }}
                  className={cn(
                    "bg-grid-head border-grid group/th relative border-r border-b px-2 text-left text-xs font-medium text-foreground/80 select-none",
                    meta.sticky && "shadow-[1px_0_0_var(--grid)]"
                  )}
                >
                  <button
                    type="button"
                    disabled={!h.column.getCanSort()}
                    onClick={h.column.getToggleSortingHandler()}
                    className="flex w-full min-w-0 items-center gap-1 disabled:cursor-default"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {sorted === "asc" && <ArrowUpIcon className="text-primary size-3 shrink-0" />}
                    {sorted === "desc" && <ArrowDownIcon className="text-primary size-3 shrink-0" />}
                  </button>
                  {h.column.getCanResize() && (
                    <div
                      onMouseDown={h.getResizeHandler()}
                      onTouchStart={h.getResizeHandler()}
                      onDoubleClick={() => h.column.resetSize()}
                      className={cn(
                        "absolute top-0 right-0 z-10 h-full w-2 translate-x-1 cursor-col-resize touch-none",
                        "after:bg-primary after:absolute after:inset-y-1 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:opacity-0 group-hover/th:after:opacity-40",
                        h.column.getIsResizing() && "after:opacity-100!"
                      )}
                      aria-hidden
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const isCollapsed = g.status ? collapsed.has(g.status) : false
            const count = g.blocks.reduce((sum, b) => sum + b.length, 0)
            return (
              <GroupRows key={g.status || "all"}>
                {g.status && (
                  <tr className="h-10">
                    <td colSpan={visibleCols.length + 1} className="bg-muted/50 border-grid border-b p-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsed((s) => {
                            const next = new Set(s)
                            if (next.has(g.status!)) next.delete(g.status!)
                            else next.add(g.status!)
                            return next
                          })
                        }
                        className="sticky left-0 flex h-10 items-center gap-2 px-3 text-sm"
                      >
                        {isCollapsed ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                        <StatusPill status={g.status} />
                        <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
                      </button>
                    </td>
                  </tr>
                )}
                {!isCollapsed && g.blocks.map((b) => b.map(renderRow))}
              </GroupRows>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={visibleCols.length + 1} className="text-muted-foreground p-0">
                <div className="sticky left-0 w-[min(100vw,480px)] px-4 py-12 text-center">No roles in this view.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
