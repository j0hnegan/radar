# Radar

Built with Next.js, shadcn/ui and Tailwind. There is no database: the data is three JSON files in `data/`, and every change on the board is a commit to this repo, made by a small server function on Vercel.

```
Grokbot ──POST /api/ingest──▶ data/inbox.json        (never shown on the board)
                                   │
                         hourly screening run (Claude)
                                   ├──▶ data/jobs.json          (the board)
                                   └──▶ data/screened-out.json  (rejected, with the reason)
The board ──/api/update──▶ data/jobs.json  (status, rounds, notes, thumbs, removals)
```

