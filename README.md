# Radar

John's private job-search board. An Airtable-style grid and a Kanban board for every role worth a look, with status, interview rounds, notes, thumbs up/down and a remove-with-reason that teaches the screener.

Built with Next.js, shadcn/ui and Tailwind. There is no database: the data is three JSON files in `data/`, and every change on the board is a commit to this repo, made by a small server function on Vercel.

```
Grokbot ──POST /api/ingest──▶ data/inbox.json        (never shown on the board)
                                   │
                         hourly screening run (Claude)
                                   ├──▶ data/jobs.json          (the board)
                                   └──▶ data/screened-out.json  (rejected, with the reason)
The board ──/api/update──▶ data/jobs.json  (status, rounds, notes, thumbs, removals)
```

## Set it up on Vercel (about 10 minutes)

### 1. Make a GitHub key that can only touch this repo

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Token name:** `radar-board`. **Expiration:** 1 year (put a reminder to renew it).
3. **Repository access:** *Only select repositories* → `j0hnegan/radar`.
4. **Permissions → Repository permissions → Contents:** *Read and write*. Leave everything else as is.
5. Generate it and copy the token (it starts with `github_pat_`). This is `GITHUB_TOKEN`.

### 2. Pick the board password and the Grokbot key

- **`BOARD_PASSWORD`:** at least 12 characters. A long passphrase you can type on your phone is ideal.
- **`INGEST_KEY`:** a random string of at least 24 characters, only for Grokbot. In Terminal:
  ```
  openssl rand -base64 32
  ```

### 3. Import the repo into Vercel

1. Go to **vercel.com/new** and import **j0hnegan/radar**.
2. **Project name:** `radar`. Framework is detected as **Next.js**; leave the build settings alone.
3. Open **Environment Variables** and add the three secrets, for **Production** (and Preview if you want previews to work):

   | Name | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | the `github_pat_…` token from step 1 |
   | `BOARD_PASSWORD` | your password from step 2 |
   | `INGEST_KEY` | the random key from step 2 |

4. Click **Deploy**.
5. In **Settings → Git**, check the **Production Branch** is the branch you want the board to live on (`main`).

The board writes its data to the branch it was deployed from, using Vercel's built-in variables for the repo and branch (they're on by default under **Settings → Environment Variables → Automatically expose System Environment Variables**). If you turned those off, also add `GITHUB_REPO` = `j0hnegan/radar` and `GITHUB_BRANCH` = `main`.

Commits that only change `data/` don't trigger a new deployment (see `vercel.json`), so the board's own writes never cause rebuilds.

### 4. Open the board

Go to your production URL (shown on the Vercel project page, like `https://radar-xxxx.vercel.app`) and sign in with `BOARD_PASSWORD`. It stays signed in for 30 days per device. Changing `BOARD_PASSWORD` in Vercel signs every device out.

### 5. Point Grokbot at it

Give Grokbot:

- **URL:** `https://<your-production-domain>/api/ingest`
- **Header:** `Authorization: Bearer <INGEST_KEY>`
- **Body:**
  ```json
  {"jobs":[{"company":"","job_title":"","location":"","salary_range":"","posted_date":"","job_url":"","company_careers_url":"","source":"","one_line_about_company":""}]}
  ```

Test it from Terminal (replace the two placeholders):

```
curl -X POST https://<your-production-domain>/api/ingest \
  -H "Authorization: Bearer <INGEST_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"jobs":[{"company":"Test Co","job_title":"Staff Product Designer","job_url":"https://example.com/test-job","source":"manual"}]}'
```

It answers with `{"received":1,"added":1,"duplicates":0,"invalid":0}`. Duplicates (same posting link already in the inbox, on the board or screened out) are skipped. `company`, `job_title` and `job_url` are required; anything else Grokbot sends beyond the fields above is dropped. Up to 200 jobs per call.

If Grokbot gets a Vercel login page instead of JSON, turn off **Deployment Protection** for production under **Settings → Deployment Protection** (the board has its own password).

## What's on the board

- **Grid:** sticky header and company column, drag a column edge to resize it, click a header to sort. Change status, stage, thumbs and notes right in the row. **Group** groups rows by status; **Filter** switches between Active, New, In progress, Follow up, Liked, Closed, Removed and All; **Hide fields** shows or hides columns. Your view settings are remembered per device.
- **Kanban:** one column per status. Drag a card to change its status (on a phone, press and hold, then drag).
- **Record panel:** click a row or card. Fit note, links, status history, hiring manager, interview rounds (adding the first one moves the role to Screen, the second to Interviewing), notes and editable details.
- **Remove (X):** asks why (pay, company, role type, location, vibe, other, plus an optional note). Removed roles stay in the data with the reason so the screener learns from them. Undo from the toast, or from the **Removed** filter.
- **Same company:** once you've applied somewhere, any other role there sits nested under that application's row.
- **Follow up:** a role marked Applied with no change for 7+ days gets a Follow up flag.
- **Screened out:** what the screener rejected and why. **Add to board** overrules it, and the override is recorded.
- **Stats:** reply rate (reached a screen or further) by level, company stage and source, plus follow-ups due, removal reasons and taste signals.

## The data

All three files share one shape: `{ "version": 1, "updated_at": "...", "jobs": [ ... ] }`. Field-by-field details and the rules for the screening run are in [`docs/SCREENING.md`](docs/SCREENING.md). The screening profile and salary target live outside this repo on purpose.

## Run it on your Mac

```
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and sign in with `local-dev-password`. With `RADAR_LOCAL_DATA=1` (set in `.env.example`) it reads and writes the files in `data/` directly instead of GitHub, so revert them with `git checkout data/` when you're done.

## Security notes

- The three secrets live only in Vercel's environment variables, never in the code, the browser or your Mac.
- The GitHub token can only read and write this one repo's contents.
- The session cookie is `HttpOnly`, `Secure`, `SameSite=Strict` and signed; every write must be JSON, which blocks cross-site form posts.
- Wrong passwords are slowed down. Pages send `noindex` and the site has a disallow-all `robots.txt`.
