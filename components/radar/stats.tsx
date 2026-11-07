"use client"

import { cn } from "@/lib/utils"
import type { Job } from "@/lib/types"
import { daysSince, everApplied, everReplied, FOLLOW_UP_DAYS, level, needsFollowUp } from "@/lib/radar"
import { useBoard } from "./use-board"

type Group = Record<string, { applied: number; replied: number }>

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-4 shadow-xs">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground mb-4 text-xs">{sub}</p>
      {children}
    </section>
  )
}

function Bar({ name, pct, label, tone = "bg-primary" }: { name: string; pct: number; label: string; tone?: string }) {
  return (
    <div className="grid grid-cols-[96px_1fr_72px] items-center gap-3 text-sm sm:grid-cols-[120px_1fr_80px]">
      <span className="truncate capitalize">{name}</span>
      <span className="bg-muted h-2 overflow-hidden rounded-full">
        <i className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-muted-foreground text-right text-xs tabular-nums">{label}</span>
    </div>
  )
}

function RateBars({ groups }: { groups: Group }) {
  const entries = Object.entries(groups).sort((a, b) => b[1].applied - a[1].applied)
  if (!entries.length) return <p className="text-muted-foreground text-sm">Shows up once you have applications.</p>
  return (
    <div className="space-y-2.5">
      {entries.map(([k, v]) => {
        const pct = Math.round((v.replied / v.applied) * 100)
        return <Bar key={k} name={k} pct={pct} label={`${pct}% · ${v.replied}/${v.applied}`} />
      })}
    </div>
  )
}

function CountBars({ counts, tone }: { counts: Record<string, number>; tone?: string }) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  if (!entries.length) return <p className="text-muted-foreground text-sm">Nothing yet.</p>
  const max = Math.max(...entries.map((e) => e[1]))
  return (
    <div className="space-y-2.5">
      {entries.map(([k, v]) => (
        <Bar key={k} name={k} pct={Math.round((v / max) * 100)} label={String(v)} tone={tone} />
      ))}
    </div>
  )
}

export function Stats({ onOpen }: { onOpen: (id: string) => void }) {
  const { jobs } = useBoard()
  const applied = jobs.filter(everApplied)
  const replied = applied.filter(everReplied)
  const interviewing = applied.filter(
    (j) => j.status === "Interviewing" || j.rounds?.length >= 2 || j.status_history?.some((h) => h.status === "Interviewing")
  )
  const offers = applied.filter((j) => j.status === "Offer" || j.status_history?.some((h) => h.status === "Offer"))
  const rate = applied.length ? Math.round((replied.length / applied.length) * 100) : 0

  const group = (fn: (j: Job) => string) => {
    const g: Group = {}
    for (const j of applied) {
      const k = fn(j) || "Unknown"
      g[k] = g[k] || { applied: 0, replied: 0 }
      g[k].applied++
      if (everReplied(j)) g[k].replied++
    }
    return g
  }

  const reasons: Record<string, number> = {}
  for (const j of jobs) if (j.removed) reasons[j.removed.reason] = (reasons[j.removed.reason] || 0) + 1
  const follows = jobs.filter((j) => !j.removed && needsFollowUp(j))

  const kpis = [
    { label: "Reply rate", value: `${rate}%`, sub: `${replied.length} of ${applied.length}` },
    { label: "Applied", value: applied.length },
    { label: "Replies", value: replied.length },
    { label: "Interviewing", value: interviewing.length },
    { label: "Offers", value: offers.length },
  ]

  return (
    <div className="grid-scroll h-full overflow-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Stats</h2>
          <p className="text-muted-foreground text-sm">A reply means you reached a screen or further.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {kpis.map((k, i) => (
            <div key={k.label} className={cn("bg-card rounded-xl border p-4 shadow-xs", i === 0 && "col-span-2 md:col-span-1")}>
              <div className="text-muted-foreground text-xs">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {k.value}
                {k.sub && <span className="text-muted-foreground ml-1.5 text-xs font-normal">{k.sub}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Panel title="Reply rate by level" sub="From the job title.">
            <RateBars groups={group((j) => level(j.job_title))} />
          </Panel>
          <Panel title="Reply rate by company stage" sub="Set the stage on each role.">
            <RateBars groups={group((j) => j.company_stage || "Stage not set")} />
          </Panel>
          <Panel title="Reply rate by source" sub="Where the role was found.">
            <RateBars groups={group((j) => j.source || "Not recorded")} />
          </Panel>
          <Panel title="Follow-ups due" sub={`Applied with no change for ${FOLLOW_UP_DAYS}+ days.`}>
            {follows.length ? (
              <ul className="divide-y text-sm">
                {follows.map((j) => (
                  <li key={j.id}>
                    <button type="button" onClick={() => onOpen(j.id)} className="flex w-full justify-between py-2 text-left">
                      <span className="font-medium">{j.company}</span>
                      <span className="text-muted-foreground">{daysSince(j.last_activity_at || j.applied_at)} days</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Nothing waiting on a nudge.</p>
            )}
          </Panel>
          <Panel title="Why you remove roles" sub="This feeds the screener.">
            <CountBars counts={reasons} tone="bg-rose-500" />
          </Panel>
          <Panel title="Taste signals" sub="Thumbs and screen overrides the screener learns from.">
            <CountBars
              counts={{
                "Thumbs up": jobs.filter((j) => j.thumbs === "up").length,
                "Thumbs down": jobs.filter((j) => j.thumbs === "down").length,
                "Screen overrides": jobs.filter((j) => j.overridden_screen).length,
              }}
            />
          </Panel>
        </div>
      </div>
    </div>
  )
}
