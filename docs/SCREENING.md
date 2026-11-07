# Screening run: how jobs move through the files

This is the contract for whatever screens new roles (the hourly Claude run). The board itself never reads the inbox.

## Files

| File | What it holds | Who writes |
| --- | --- | --- |
| `data/inbox.json` | Raw roles from `/api/ingest`, deduped by posting link. | `/api/ingest`; the screener removes what it has handled. |
| `data/jobs.json` | Everything on the board, including removed roles (`removed` set). | The board (`/api/update`) and the screener (adds). |
| `data/screened-out.json` | Roles the screener rejected, with `screen_reason`. | The screener (adds); the board removes one when John clicks **Add to board**. |

## One screening pass

1. `git pull` (the board commits often), read `data/inbox.json`.
2. For each inbox job: check it against the company's own posting (still open, real pay and location), then screen it against John's profile and the taste signals below.
3. Passed: append a board job (shape below) to `data/jobs.json` with `status: "New"`, a `fit_score` (0-100) and a one-line `fit_reason`.
4. Rejected: append it to `data/screened-out.json` with `screen_reason` (one line, plain words) and `screened_at`.
5. Remove every handled job from `data/inbox.json`.
6. Commit only `data/` and push. If the push is rejected, `git pull --rebase` and push again; the board may have written in between. Never force-push.

Commits that only touch `data/` don't redeploy the site.

## Taste signals to learn from (all in `data/jobs.json`)

- `thumbs`: `"up"` or `"down"` (with `thumbs_at`). A taste signal, separate from removal.
- `removed`: `{ reason, note, at }` where reason is `pay`, `company`, `role type`, `location`, `vibe` or `other`.
- `overridden_screen`: `{ reason, at }` on a role John pulled back from screened-out, with what the screener had said.
- Status progress and `rounds`: which kinds of roles actually reply.

If John has applied at a company (any job there with status Applied, Screen, Interviewing or Offer, or that reached one of them before), a new role there still goes on the board, and the board nests it under that application.

## Board job shape

```json
{
  "id": "10-char id (sha1 of the posting link)",
  "company": "",
  "job_title": "",
  "one_line_about": "",
  "location": "",
  "salary_range": "$220k–$268k + equity",
  "fit_score": 88,
  "fit_reason": "One line on why it fits and the main risk.",
  "hiring_manager": { "name": "", "linkedin": "" },
  "job_url": "https://…",
  "company_careers_url": "",
  "source": "linkedin | greenhouse | ashby | lever | indeed | manual | …",
  "posted_date": "",
  "company_stage": "" ,
  "status": "New",
  "status_history": [{ "status": "New", "at": "ISO time" }],
  "applied_at": "",
  "last_activity_at": "ISO time",
  "added_at": "ISO time",
  "rounds": [],
  "thumbs": null,
  "removed": null,
  "notes": ""
}
```

`company_stage` is one of `""`, `Seed / Series A`, `Series B-C`, `Late-stage private`, `Public`, `Frontier lab`. Statuses are `New`, `Interested`, `Applied`, `Screen`, `Interviewing`, `Offer`, `Rejected`, `Passed`.

## Screened-out job shape

The inbox job plus `id`, `screen_reason` and `screened_at` (and optionally `fit_score`).
