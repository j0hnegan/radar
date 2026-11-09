# Radar

```
Grokbot ──POST /api/ingest──▶ data/inbox.json        (never shown on the board)
                                   │
                         hourly screening run (Claude)
                                   ├──▶ data/jobs.json          (the board)
                                   └──▶ data/screened-out.json  (rejected, with the reason)
The board ──/api/update──▶ data/jobs.json  (status, rounds, notes, thumbs, removals)
```

