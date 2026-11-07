"use client"

import { ExternalLinkIcon, InboxIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fmtDate, safeUrl } from "@/lib/radar"
import { useBoard } from "./use-board"

export function Screened() {
  const { screened, inboxCount, promote } = useBoard()
  const list = [...screened].sort((a, b) => String(b.screened_at || "").localeCompare(String(a.screened_at || "")))
  return (
    <div className="grid-scroll h-full overflow-auto">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Screened out</h2>
          <p className="text-muted-foreground text-sm">
            Roles the screener turned down, with the reason. Adding one to the board overrules it, and that override teaches
            the screener.
          </p>
          {inboxCount > 0 && (
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
              <InboxIcon className="size-4" /> {inboxCount} new role{inboxCount > 1 ? "s" : ""} waiting to be screened.
            </p>
          )}
        </div>
        {list.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center text-sm">
            Nothing screened out yet.
          </div>
        ) : (
          <div className="bg-card divide-y rounded-lg border">
            {list.map((s) => {
              const href = safeUrl(s.job_url)
              return (
                <div key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 sm:w-64">
                    <div className="truncate text-sm font-semibold">{s.company}</div>
                    <div className="text-muted-foreground truncate text-sm">{s.job_title}</div>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {s.screen_reason || <span className="text-muted-foreground">No reason given</span>}
                    {s.screened_at && <span className="text-muted-foreground"> · {fmtDate(s.screened_at)}</span>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {href && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          Posting <ExternalLinkIcon />
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => promote(s.id)}>
                      Add to board
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
