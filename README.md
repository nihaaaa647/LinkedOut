# LINKEDOUT

A secure, role-based internship portal for a college placement cell: students discover
and apply for internships, admins curate the pipeline. Built to the spec in
[`Internship Opportunity Portal — PRD.md`](./Internship%20Opportunity%20Portal%20%E2%80%94%20PRD.md)
(the product is branded **LINKEDOUT**; the PRD's filename predates the name and is kept
as-is so the planning history stays intact).

Highlights beyond a plain CRUD app: an explainable, admin-tunable trust score for scraped
listings (with student-reported flags as a second signal), a multi-source scraper that
pulls real listings automatically, resume-parsed skill matching, and a skill-gap
analytics view for the placement cell.

## Stack

Node.js + Express, MongoDB + Mongoose, JWT in an HTTP-only cookie, bcrypt, multer
(resume uploads), pdf-parse (resume parsing), node-cron (scraping/notification jobs),
Socket.IO (real-time notification push), axios/cheerio + Puppeteer (scraper adapters -
see below for why both).

## Setup

```bash
npm install
cp .env.example .env   # then edit values as needed - see below
```

You need a MongoDB instance reachable at `MONGO_URI`. Any of these work:

- Local MongoDB (`mongodb://127.0.0.1:27017/internship_portal`)
- `docker run -d -p 27017:27017 mongo:7`
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (use its connection string)

```bash
npm run seed   # populates one admin, two students, a mix of listing statuses, applications
npm run dev    # starts the API with nodemon on PORT (default 5000)
```

Health check: `GET http://localhost:5000/api/health`

### Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `5000` |
| `MONGO_URI` | MongoDB connection string | *(required)* |
| `JWT_SECRET` | JWT signing secret | *(required)* |
| `JWT_EXPIRES_IN` | Token lifetime | `1h` |
| `COOKIE_SECURE` | `Secure` flag on the auth cookie | `false` (set `true` in production, HTTPS only) |
| `COOKIE_SAMESITE` | Cookie `SameSite` policy | `lax` (see note below) |
| `FRONTEND_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `NOTIFY_WINDOW_HOURS` | Deadline-reminder lookahead window | `48` |
| `NOTIFY_CRON` | Cron schedule for the notification job | `0 */6 * * *` |
| `SCRAPE_CRON` | Cron schedule for the scrape + skill-gap-snapshot jobs | `0 */6 * * *` |
| `MATCH_ALERT_THRESHOLD` | Match score (%) that triggers a match_alert for saved listings | `85` |
| `REPORT_THRESHOLD` | Distinct student reports that force a published listing back to review | `3` |
| `MAX_RESUME_SIZE_MB` | Resume upload size cap | `2` |

**`COOKIE_SAMESITE` note:** keep this `lax` if your frontend and API run on different
ports in development (e.g. a Vite dev server on `:5173` against the API on `:5000`) -
`strict` silently drops the auth cookie across that port boundary. Only use
`none` (with `COOKIE_SECURE=true`) for a genuinely cross-site production deployment, and
add CSRF-token protection on state-changing routes if you do.

### Test credentials (after `npm run seed`)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@college.edu` | `Passw0rd!123` |
| Student | `priya@college.edu` (skills: JavaScript, React, Node.js) | `Passw0rd!123` |
| Student | `rahul@college.edu` (skills: Python, SQL, Data Analysis) | `Passw0rd!123` |

There is no self-service way to create an admin account (by design - see Business Rule
7 in the PRD); admins only exist via the seed script or direct DB provisioning.

## Running the background jobs

`npm run dev` / `npm start` automatically schedules all three cron jobs on boot
(`src/jobs/scrape.job.js`, `src/jobs/notify.job.js`, `src/jobs/skillGapSnapshot.job.js`),
using `SCRAPE_CRON`/`NOTIFY_CRON` from the environment. To run one immediately instead of
waiting for its schedule (useful for a demo):

```bash
node -e "require('./src/jobs/scrape.job').runScrapeJob()"
node -e "require('./src/jobs/notify.job').runNotifyJob()"
node -e "require('./src/jobs/skillGapSnapshot.job').runSkillGapSnapshotJob()"
```

There are two scraper adapters, each verified against the live site:

- **`src/scrapers/internshala.scraper.js`** - plain `axios` + `cheerio`. Internshala's
  search-results and detail pages are server-rendered, so a static HTTP GET returns the
  same markup a browser would - no headless browser needed.
- **`src/scrapers/unstop.scraper.js`** - **Puppeteer**, not axios/cheerio. Unstop is a
  client-rendered app; a plain GET only returns the pre-hydration HTML shell with no
  listing data in it. This adapter launches headless Chromium, waits for the page to
  render, and extracts from the live DOM (`page.evaluate`) - the only way to actually see
  what a real visitor sees. Its extraction is text-based (main-content `innerText` +
  regex) rather than CSS-class selectors, since a Next.js/React app's class names are
  often build-hashed and unstable.

Both adapters are best-effort against markup that will drift over time - re-verify before
depending on either for a real demo/grading run. Both append a link back to the original
posting to every scraped listing's `description` (`normalizeSkill`'s downstream match
scoring and skill extraction still work fine against the excerpt + link), and both store
a short excerpt rather than the full posting - enough for match scoring and a preview,
with the "Original posting" link as where a student reads the complete listing. LinkedIn
is intentionally not scraped (its ToS prohibits it); LinkedIn-sourced roles are expected
to be entered manually by an admin instead.

Every scraped listing still goes through the same trust-scoring/dedup pipeline
(`ingestScrapedListing`, Section 5) regardless of which adapter produced it - `SOURCES` in
`scrape.job.js` is the only place that knows both exist.

## Frontend

A server-rendered EJS UI lives alongside the API in the same Express app (`src/views/`,
`src/routes/views/`) rather than a separate SPA - it's a genuine *client* of the REST API
(see `src/config/apiClient.js`), not a bypass around it: every page handler calls the same
`/api/...` endpoints the Postman collection does, forwarding the browser's session cookie
in and any `Set-Cookie` back out. That also sidesteps the cross-origin cookie gotcha a
separate frontend dev server would introduce (Section 15's `SameSite` note).

- **Layout** (`src/views/partials/header.ejs` / `footer.ejs`): a persistent left sidebar
  with grouped nav (Listings / Students sections for admin, role-specific links for
  students) once logged in; a plain top bar for the logged-out browse/login/register
  pages. `res.locals` (set in `middleware/viewAuth.js`) carries `currentUser`,
  `currentPath` (for nav active-states), flash messages, and a `linkify()` helper across
  every template.
- **Student pages**: browse with filters, listing detail (match score, matched/missing
  skill tags, recommended learning, apply/save/report), my applications (withdraw), profile
  (skills/branch/year/CGPA, resume upload with auto-detected-skills feedback),
  notifications (mark as read).
- **Admin pages**: manage listings (create form + status table), review queue (trust-score
  breakdown, report reasons, approve/reject), all applications (filter + inline status
  change), skill-gap analytics (branch filter).
- **Design**: plain CSS (`public/css/style.css`, no framework) - a light theme, one accent
  color, real typographic hierarchy, and tables/divided rows for list-shaped data instead
  of a card for everything. Status is shown as a small text-label chip rather than a loud
  pill badge. A handful of hand-drawn inline SVG icons in the sidebar, no icon library or
  emoji. Every `onchange`-triggered auto-submit (e.g. the admin status dropdowns) goes
  through `public/js/auto-submit.js` rather than an inline handler attribute, since
  Helmet's default CSP blocks inline event handlers.
- **`linkify()`** (`src/utils/linkify.js`): escapes untrusted scraped text and turns any
  bare URL inside it into a real `<a>` link, so a scraped listing's "Original posting:
  https://..." line (appended by the scraper adapters) renders as a clickable link on the
  detail page and in the admin review queue, not inert text.

## Architecture

```
src/
  config/      # env loading, MongoDB connection (blocks startup until indexes are built -
               # see the comment in db.js for why that matters for the duplicate-application guard)
  models/      # Mongoose schemas - one per collection in the PRD's data model (Section 13)
  controllers/ # request handlers, one file per resource
  routes/      # Express routers - auth, users, internships, applications, notifications,
               # admin/* (listings, applications, trust config, learning resources, analytics)
    views/     # EJS-frontend routers (auth, student, admin) - call the API above, don't bypass it
  middleware/  # auth (JWT verify + tokenVersion revocation), rbac, validate (Zod), upload (multer),
               # viewAuth (res.locals for the frontend), errorHandler (single source of the
               # {success,message,errors} envelope)
  services/    # matchScore, trustScore, dedup, ingestListing, normalizeSkill, resumeParser, analytics
  scrapers/    # normalizeListing() interface + one adapter per source (Internshala, Unstop)
  jobs/        # cron entry points: scrape, notify (deadline + match-alert), skill-gap snapshot
  sockets/     # Socket.IO /notifications namespace, authenticated via the same JWT cookie
  validation/  # Zod schemas per resource, enforced by middleware/validate.js
  views/       # EJS templates - partials/, student/, admin/ (see "Frontend" above)
  utils/       # asyncHandler, apiResponse, linkify
  seed/        # deterministic seed script
public/        # static assets for the frontend - css/style.css, js/auto-submit.js
```

Request flow: `router -> verifyToken -> requireRole (+ tokenVersion check on
admin/sensitive routes) -> validate(schema) -> controller -> service/model -> MongoDB`,
with a single `errorHandler` normalizing every thrown error (Mongoose validation/cast
errors, duplicate-key errors, JWT errors, Multer errors, explicit `ApiError`s) into
`{ success, message, errors? }` with the right status code.

### Notable design decisions (see the PRD for full rationale)

- **Trust score is additive and admin-tunable** (`TrustScoreConfig`), not hardcoded -
  weights can be adjusted from real scam patterns without a redeploy, and every
  auto/human decision is logged to `TrustScoreDecisionLog`.
- **Critical-flag keywords never auto-reject alone** - they force human review, since a
  single keyword match without context is a plausible false positive.
- **Scraping is per-source, not per-technique** - `normalizeListing()` is the only
  contract `scrape.job.js` and `ingestScrapedListing` care about; whether an adapter gets
  there via a plain HTTP GET (Internshala) or a headless browser (Unstop) is an
  implementation detail of that one file.
- **Dedup is fuzzy, not an exact hash** - normalized company+title compared via
  Dice-coefficient similarity, calibrated so reworded reposts (~0.75-0.90 similarity)
  are caught while genuinely different roles from the same company (~0.6-0.65) aren't.
- **Rejections aren't permanent** - approving a resubmission from a company retires that
  company's `KnownBadPattern` entries instead of poisoning them forever.
- **Match-score cache keys off `updatedAt` timestamps** on both the user and the
  internship, so a profile edit, resume re-upload, or listing edit self-invalidates the
  cache with no explicit invalidation code.
- **Resume parsing is additive, never destructive** - auto-detected skills merge into
  `skills[]`; manual add/edit/remove via `PATCH /api/users/me` always remains available
  and is never overridden by a later parse.

## Testing

There's no Jest suite in this repo; correctness is verified via the Postman collection
(success + failure cases per endpoint, per the submission checklist) plus manual runs of
the seed script and jobs above. Run `npm run seed` then exercise the flows in Postman or
against `http://localhost:5000/api`.

## Known limitations (MVP scope)

- Resume parsing only extracts text from PDFs (`pdf-parse`); `.doc`/`.docx` uploads are
  accepted but not parsed for skills - a safe, explicit fallback rather than a failure.
- Both scraper adapters' selectors/extraction heuristics need re-verification against the
  live sites before a real scrape run - public markup drifts over time, and Unstop's
  title/company split (parsed from `document.title`) is best-effort.
- Puppeteer downloads a bundled Chromium (~200MB) on `npm install` - if that's not viable
  in a given environment (offline grading, disk-constrained CI), `unstop.scraper.js` can
  be dropped from `SOURCES` in `scrape.job.js` without touching anything else; Internshala
  scraping and manual admin entry keep working either way.
