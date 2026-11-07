"use client"

import { useEffect, useState } from "react"
import { ExternalLinkIcon, Trash2Icon, Undo2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ROUND_OUTCOMES, ROUND_TYPES, type Job } from "@/lib/types"
import { ago, fmtDate, level, safeUrl } from "@/lib/radar"
import { FitScore, StageMenu, StatusMenu, StatusPill, Thumbs } from "./cells"
import { useBoard } from "./use-board"

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-b px-5 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground mb-1 text-xs">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function Saved({ show }: { show: boolean }) {
  return (
    <span className={cn("text-xs text-emerald-600 transition-opacity dark:text-emerald-400", show ? "opacity-100" : "opacity-0")}>
      Saved
    </span>
  )
}

function useFlash() {
  const [on, setOn] = useState(false)
  return [on, () => {
    setOn(true)
    setTimeout(() => setOn(false), 1400)
  }] as const
}

export function RecordSheet({
  job,
  onClose,
  onRemove,
}: {
  job: Job | null
  onClose: () => void
  onRemove: (id: string) => void
}) {
  return (
    <Sheet open={!!job} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl [&>button:last-child]:hidden">
        {job && <Body key={job.id} job={job} onClose={onClose} onRemove={onRemove} />}
      </SheetContent>
    </Sheet>
  )
}

function Body({ job, onClose, onRemove }: { job: Job; onClose: () => void; onRemove: (id: string) => void }) {
  const { act } = useBoard()
  const hm = job.hiring_manager || { name: "", linkedin: "" }
  const [notes, setNotes] = useState(job.notes || "")
  const [hmName, setHmName] = useState(hm.name)
  const [hmLink, setHmLink] = useState(hm.linkedin)
  const [notesSaved, flashNotes] = useFlash()
  const [hmSaved, flashHm] = useFlash()
  const [round, setRound] = useState({ type: ROUND_TYPES[0] as string, date: "", with: "", notes: "" })
  const [edit, setEdit] = useState({
    company: job.company,
    job_title: job.job_title,
    one_line_about: job.one_line_about,
    location: job.location,
    salary_range: job.salary_range,
    fit_score: job.fit_score == null ? "" : String(job.fit_score),
    fit_reason: job.fit_reason,
    source: job.source,
    job_url: job.job_url,
    company_careers_url: job.company_careers_url,
  })

  useEffect(() => setNotes(job.notes || ""), [job.notes])

  const posting = safeUrl(job.job_url)
  const careers = safeUrl(job.company_careers_url)
  const hmHref = safeUrl(hm.linkedin)
  const rounds = [...(job.rounds || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const saveHm = async () => {
    if (hmName === hm.name && hmLink === hm.linkedin) return
    const out = await act(job.id, { action: "edit", fields: { hiring_manager_name: hmName, hiring_manager_linkedin: hmLink } }, (j) => ({
      ...j,
      hiring_manager: { name: hmName, linkedin: hmLink },
    }))
    if (out) {
      flashHm()
      if (hmLink && !out.hiring_manager.linkedin) toast.error("That LinkedIn link needs to start with https://")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <SheetTitle className="text-lg leading-tight">{job.job_title}</SheetTitle>
          <SheetDescription className="mt-0.5">
            <span className="text-foreground font-medium">{job.company}</span>
            {job.one_line_about && <> · {job.one_line_about}</>}
          </SheetDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {posting && (
              <Button asChild size="xs" variant="outline">
                <a href={posting} target="_blank" rel="noopener noreferrer">
                  Posting <ExternalLinkIcon />
                </a>
              </Button>
            )}
            {careers && (
              <Button asChild size="xs" variant="outline">
                <a href={careers} target="_blank" rel="noopener noreferrer">
                  Careers <ExternalLinkIcon />
                </a>
              </Button>
            )}
            {hmHref && (
              <Button asChild size="xs" variant="outline">
                <a href={hmHref} target="_blank" rel="noopener noreferrer">
                  {hm.name || "Hiring manager"} <ExternalLinkIcon />
                </a>
              </Button>
            )}
            <Thumbs job={job} />
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
          <XIcon />
        </Button>
      </header>

      <div className="grid-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-10">
        {job.removed && (
          <div className="mx-5 mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
            Removed {fmtDate(job.removed.at)} · {job.removed.reason}
            {job.removed.note && `: ${job.removed.note}`}
          </div>
        )}

        <Section title="Fit">
          <div className="flex items-start gap-4">
            <div className="w-28 shrink-0 pt-0.5">
              <FitScore score={job.fit_score} />
            </div>
            <p className="text-sm leading-relaxed">{job.fit_reason || <span className="text-muted-foreground">No fit note yet.</span>}</p>
          </div>
          {job.overridden_screen && (
            <p className="text-muted-foreground mt-2 text-xs">
              You overruled the screen on this one{job.overridden_screen.reason && ` (it said: ${job.overridden_screen.reason})`}.
            </p>
          )}
        </Section>

        <Section title="Status">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5">Status</Label>
              <StatusMenu job={job} full />
            </div>
            <div>
              <Label className="mb-1.5" htmlFor="applied">Applied on</Label>
              <Input
                id="applied"
                type="date"
                defaultValue={(job.applied_at || "").slice(0, 10)}
                onBlur={(e) => {
                  const v = e.target.value
                  if (v !== (job.applied_at || "").slice(0, 10))
                    act(job.id, { action: "edit", fields: { applied_at: v } }, (j) => ({ ...j, applied_at: v }))
                }}
              />
            </div>
          </div>
          {job.status_history?.length > 0 && (
            <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {job.status_history.map((h, i) => (
                <li key={i} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <StatusPill status={h.status} className="h-5" />
                  {fmtDate(h.at)}
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Details">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact label="Location">{job.location || "Not listed"}</Fact>
            <Fact label="Salary">{job.salary_range || "Not listed"}</Fact>
            <Fact label="Level">{level(job.job_title)}</Fact>
            <Fact label="Company stage">
              <StageMenu job={job} />
            </Fact>
            <Fact label="Source">
              <span className="capitalize">{job.source || "Not recorded"}</span>
            </Fact>
            <Fact label="Posted">{job.posted_date ? fmtDate(job.posted_date) : "Unknown"}</Fact>
            <Fact label="Added">{fmtDate(job.added_at)}</Fact>
            <Fact label="Last activity">{ago(job.last_activity_at)}</Fact>
          </div>
        </Section>

        <Section title="Hiring manager" aside={<Saved show={hmSaved} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5" htmlFor="hm-name">Name</Label>
              <Input id="hm-name" value={hmName} placeholder="Unknown" onChange={(e) => setHmName(e.target.value)} onBlur={saveHm} />
            </div>
            <div>
              <Label className="mb-1.5" htmlFor="hm-link">LinkedIn</Label>
              <Input
                id="hm-link"
                type="url"
                value={hmLink}
                placeholder="https://linkedin.com/in/…"
                onChange={(e) => setHmLink(e.target.value)}
                onBlur={saveHm}
              />
            </div>
          </div>
        </Section>

        <Section title="Interview rounds">
          <div className="space-y-2">
            {rounds.length === 0 && (
              <p className="text-muted-foreground text-sm">No rounds yet. Adding the first one moves the role to Screen.</p>
            )}
            {rounds.map((r) => (
              <div key={r.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.type || "Round"}</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                    {r.date ? fmtDate(r.date) : "No date"}
                    {r.with && ` · ${r.with}`}
                  </span>
                  <Select
                    value={r.outcome}
                    onValueChange={(v) =>
                      act(job.id, { action: "round_update", round_id: r.id, round: { outcome: v } }, (j) => ({
                        ...j,
                        rounds: j.rounds.map((x) => (x.id === r.id ? { ...x, outcome: v as typeof x.outcome } : x)),
                      }))
                    }
                  >
                    <SelectTrigger className="h-7 w-auto text-xs" aria-label="Outcome">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUND_OUTCOMES.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete round"
                    onClick={() =>
                      act(job.id, { action: "round_delete", round_id: r.id }, (j) => ({
                        ...j,
                        rounds: j.rounds.filter((x) => x.id !== r.id),
                      }))
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                {r.notes && <p className="text-muted-foreground mt-1.5 text-sm whitespace-pre-wrap">{r.notes}</p>}
              </div>
            ))}
          </div>
          <form
            className="bg-muted/50 mt-3 space-y-3 rounded-md p-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const out = await act(job.id, { action: "round_add", round })
              if (out) {
                setRound({ type: ROUND_TYPES[0], date: "", with: "", notes: "" })
                toast.success("Round added")
              }
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Type</Label>
                <Select value={round.type} onValueChange={(v) => setRound({ ...round, type: v })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5" htmlFor="round-date">Date</Label>
                <Input
                  id="round-date"
                  type="date"
                  className="bg-background"
                  value={round.date}
                  onChange={(e) => setRound({ ...round, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5" htmlFor="round-with">With</Label>
              <Input
                id="round-with"
                className="bg-background"
                placeholder="Name and role"
                value={round.with}
                onChange={(e) => setRound({ ...round, with: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5" htmlFor="round-notes">Notes</Label>
              <Textarea
                id="round-notes"
                className="bg-background"
                placeholder="Prep, questions, how it went"
                value={round.notes}
                onChange={(e) => setRound({ ...round, notes: e.target.value })}
              />
            </div>
            <Button size="sm" type="submit">
              Add round
            </Button>
          </form>
        </Section>

        <Section title="Notes" aside={<Saved show={notesSaved} />}>
          <Textarea
            value={notes}
            placeholder="Anything worth remembering about this role"
            className="min-h-28"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={async () => {
              if (notes === (job.notes || "")) return
              if (await act(job.id, { action: "notes", notes }, (j) => ({ ...j, notes }))) flashNotes()
            }}
          />
        </Section>

        <Section title="Edit role details">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await act(job.id, { action: "edit", fields: edit })) toast.success("Details saved")
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company" value={edit.company} onChange={(v) => setEdit({ ...edit, company: v })} />
              <Field label="Title" value={edit.job_title} onChange={(v) => setEdit({ ...edit, job_title: v })} />
            </div>
            <Field label="One line about the company" value={edit.one_line_about} onChange={(v) => setEdit({ ...edit, one_line_about: v })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Location" value={edit.location} onChange={(v) => setEdit({ ...edit, location: v })} />
              <Field label="Salary" value={edit.salary_range} onChange={(v) => setEdit({ ...edit, salary_range: v })} />
              <Field label="Fit score (0-100)" type="number" value={edit.fit_score} onChange={(v) => setEdit({ ...edit, fit_score: v })} />
              <Field label="Source" value={edit.source} onChange={(v) => setEdit({ ...edit, source: v })} />
            </div>
            <Field label="Fit note" value={edit.fit_reason} onChange={(v) => setEdit({ ...edit, fit_reason: v })} />
            <Field label="Posting link" type="url" value={edit.job_url} onChange={(v) => setEdit({ ...edit, job_url: v })} />
            <Field label="Careers page" type="url" value={edit.company_careers_url} onChange={(v) => setEdit({ ...edit, company_careers_url: v })} />
            <Button size="sm" type="submit" variant="secondary">
              Save details
            </Button>
          </form>
        </Section>

        <section className="px-5 py-4">
          {job.removed ? (
            <Button size="sm" variant="outline" onClick={() => act(job.id, { action: "restore" }, (j) => ({ ...j, removed: null }))}>
              <Undo2Icon /> Put back on the board
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => onRemove(job.id)}>
              <XIcon /> Remove from board
            </Button>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} min={type === "number" ? 0 : undefined} max={type === "number" ? 100 : undefined} />
    </div>
  )
}
