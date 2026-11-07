"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { REMOVE_REASONS, STATUSES, type Job, type RemoveReason } from "@/lib/types"
import { useBoard } from "./use-board"

export function RemoveDialog({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const { act } = useBoard()
  const [reason, setReason] = useState<RemoveReason | "">("")
  const [note, setNote] = useState("")
  const close = () => {
    setReason("")
    setNote("")
    onClose()
  }
  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {job && (
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!reason) return
              const id = job.id
              const company = job.company
              const r = reason
              const n = note
              close()
              const out = await act(id, { action: "remove", reason: r, note: n }, (j) => ({
                ...j,
                removed: { reason: r, note: n, at: new Date().toISOString() },
              }))
              if (out)
                toast(`Removed ${company}`, {
                  action: { label: "Undo", onClick: () => act(id, { action: "restore" }, (j) => ({ ...j, removed: null })) },
                })
            }}
          >
            <DialogHeader>
              <DialogTitle>Remove {job.company}?</DialogTitle>
              <DialogDescription>
                {job.job_title}. Pick why, so the screener stops sending roles like it.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
              {REMOVE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-sm capitalize transition-colors",
                    reason === r ? "bg-foreground text-background border-foreground" : "hover:bg-accent"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything more? (optional)" maxLength={500} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!reason}>
                Remove
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

const EMPTY = { company: "", job_title: "", job_url: "", location: "", salary_range: "", status: "New" }

export function AddDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const { add } = useBoard()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            const job = await add({ ...f, source: "manual" })
            setBusy(false)
            if (job) {
              setF(EMPTY)
              onClose()
              toast.success(`Added ${job.company}`)
              onAdded(job.id)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a role</DialogTitle>
            <DialogDescription>For something you found yourself.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5" htmlFor="add-company">Company</Label>
              <Input id="add-company" required value={f.company} onChange={set("company")} autoFocus />
            </div>
            <div>
              <Label className="mb-1.5" htmlFor="add-title">Title</Label>
              <Input id="add-title" required value={f.job_title} onChange={set("job_title")} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5" htmlFor="add-url">Posting link</Label>
            <Input id="add-url" type="url" placeholder="https://" value={f.job_url} onChange={set("job_url")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5" htmlFor="add-loc">Location</Label>
              <Input id="add-loc" value={f.location} onChange={set("location")} />
            </div>
            <div>
              <Label className="mb-1.5" htmlFor="add-sal">Salary</Label>
              <Input id="add-sal" placeholder="$200k–$250k" value={f.salary_range} onChange={set("salary_range")} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5">Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Add role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
