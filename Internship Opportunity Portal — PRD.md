# Internship Opportunity Portal — PRD

Sep 24, 2026 

## 1. Overview & Objective

The **Internship Opportunity Portal** is a secure REST API-driven platform built for a college setting, where **students discover and apply for internships** and **administrators curate and manage the internship pipeline**.

The platform solves three linked problems that students and placement/training cells face:

1. **Discovery is fragmented** - internships are scattered across LinkedIn, Internshala, company career pages, and WhatsApp forwards, with no single trustworthy feed.
2. **Scams are common** - a meaningful share of "internship" postings circulating among students are fake, pay-to-apply, or data-harvesting schemes, and students have no easy way to vet them.
3. **Fit is unclear** - students apply broadly without knowing how well they match a role, or what skill gaps stand between them and a competitive application.

The objective of this project is to design and implement a secure, role-based REST API (Node.js + Express + MongoDB) that:

- Aggregates internship listings automatically via web scraping, supplemented by manual admin entry.
- Screens scraped listings for legitimacy using an explainable, admin-tunable trust score, backed by student-reported flags as a second signal, auto-publishing trusted ones and routing suspicious ones to an admin review queue.
- Computes a resume/skill-based match score per student per internship, with a recommended learning path to close gaps - accelerated by auto-parsing an uploaded resume, while keeping manual skill entry as the always-available primary path.
- Manages the full application lifecycle - apply, track, withdraw, notify - under proper authentication and authorization.
- Surfaces aggregate skill-gap data to the placement cell, turning individual match scores into a decision-support signal for the college, not just a per-student feature.

This PRD defines the scope, roles, features, business rules, data model, and API surface needed to build and submit the project, including the required GitHub repository, Postman collection, seed data, and demo.

## 2. Goals & Success Metrics

| Goal | Metric | Target for submission |
| --- | --- | --- |
| Centralize discovery | Internships visible in one feed, deduplicated | 100% of scraped + admin-added listings in one collection |
| Filter out scams | Suspicious listings never auto-published | 0 unverified listings visible to students without admin approval |
| Improve applicant fit | Match score + skill gap shown per application | Match score computed for every listing a user views/applies to |
| Reduce missed deadlines | Notification sent ahead of deadline | Notification triggered at a configurable window (e.g., 48h) before deadline |
| Secure, role-correct access | No cross-role or cross-user data leakage | All protected routes verified in Postman for both 2xx and 4xx cases |
| Demonstrable backend quality | Clean REST design, validation, error handling | Postman collection covers success + failure paths for every endpoint |
| Community-assisted trust | Student reports feed the review queue | A listing auto-recheck triggers after reaching the report threshold |
| Placement-cell insight | Skill-gap data available, not just per-student | Admin analytics endpoint returns an aggregate skill-gap ranking |

## 3. User Roles & Permissions

### USER (student)

- Registers with profile details used for match-scoring: skills, education/branch, year, resume (text or uploaded), certifications, past experience. Registration always creates a `"user"`-role account - any client-supplied `role` field is ignored server-side.
- Updates own profile at any time (skills, branch, year, CGPA, location preference, certifications) - changes take effect on the next match score computation.
- Uploads a resume file, and can re-upload to replace it at any time; the previous file is superseded (not retained as version history for MVP). Upload auto-suggests skills parsed from the resume, merged additively into `skills[]` - manual add/edit/remove remains available at all times and is never overridden by parsing.
- Browses internship listings with filters (location, domain, stipend, deadline, remote/on-site).
- Views full internship detail, including computed match score and recommended learning path for that listing.
- Saves/unsaves internships to a personal saved list and views that list.
- Applies to a listing (one active application per listing - no duplicates).
- Views own application history and current status of each.
- Withdraws an application while it is still in an eligible state (see Business Rules).
- Reports a live listing as suspicious (payment request, sensitive-info request, suspicious contact channel, fake company, other), feeding the trust system a signal scraping alone can't catch.
- Receives notifications ahead of application deadlines for saved/applied internships, and match-alert notifications for saved internships that cross a high match-score threshold - both in-app (polled) and pushed in real time while connected.

### ADMIN (placement cell / staff)

- Creates, updates, and closes internship listings manually.
- Reviews the queue of scraped listings flagged as "Suspicious" - including ones escalated by trust score, by a low-confidence eligibility parse, or by student reports - and approves, edits, or rejects each.
- Tunes the trust-score signal weights and reviews the score/decision log to see which signals are firing too often or too rarely.
- Manages the skill -> learning-resource mapping (`LearningResource`).
- Views the skill-gap analytics dashboard aggregated across all students and listings.
- Views all applications, filterable by internship or student.
- Updates application status (Applied -> Shortlisted / Rejected / Selected).
- Can force-revoke a specific user's active sessions (e.g. on suspected compromise).
- Cannot access another admin's account or act as a student.

### Permission matrix

| Action | USER | ADMIN |
| --- | --- | --- |
| Register / login | Yes | Yes |
| Browse / view listings | Yes | Yes |
| Save / unsave internship | Yes | No |
| Apply / withdraw own application | Yes | No (not applicable) |
| View own applications | Yes | Yes (all) |
| Report a suspicious listing | Yes | No |
| Create / update / close listing | No | Yes |
| Approve / reject scraped (fishy) listing | No | Yes |
| Review community reports | No | Yes |
| Tune trust-score weights | No | Yes |
| Manage learning-resource mapping | No | Yes |
| View skill-gap analytics | No | Yes |
| Update any application's status | No | Yes |
| View match score / recommendations | Own only | N/A |

## 4. Internship Listings (Ingestion)

Listings enter the system through two paths that feed the same collection:

1. **Web scraping (automated)** - a scheduled job (cron, e.g. every 6-12h) scrapes a fixed allow-list of sources whose terms permit it: company career pages and Internshala's public listing pages are the primary MVP targets. **LinkedIn is intentionally excluded from the automated scraper** - its ToS prohibits scraping and risks IP bans mid-project. LinkedIn-sourced roles can still enter the system, just via manual admin entry (`sourceType: "manual"`) if a placement-cell staffer copies one in by hand - both ingestion paths stay available side by side.
2. **Manual admin entry** - admins add listings directly through a form-backed endpoint (`sourceType: "manual"`), always published immediately since the admin is the trust source.

Every scraped listing is deduplicated before insertion using normalized-text similarity rather than an exact hash: company name and title are lowercased and stripped of punctuation, then compared via string similarity (e.g. `string-similarity`'s Dice coefficient) against existing listings from the same company with a deadline within 14 days of each other. A similarity above a configurable threshold (e.g. 0.85) is treated as a duplicate and skipped. This catches reworded reposts and minor deadline extensions that an exact `company+title+deadline` hash would miss. After dedup, each listing passes through the fake-listing screen (Section 5) which decides whether it publishes immediately or lands in the admin review queue.

**Required fields for any listing:** title, company, description, eligibility, location, deadline. Optional: stipend, skills required (array, used for matching), work mode (remote/hybrid/onsite), duration.

`eligibility` is always a **structured object** (`{ branches: [String], minCgpa: Number, years: [Number] }`), never free text - this is what the match-score formula's `eligibilityMatch` term compares against. Manual admin entry captures it directly via the form. Scraped listings run through a best-effort structured extraction; if that extraction can't confidently populate the shape, the listing is marked `eligibilityConfident: false` and is routed to the admin review queue regardless of its trust score (see Section 5), so a human fills in eligibility before it's ever shown to students.

**Scraper design notes for implementation:**

- Use `node-cron` or `agenda` for scheduling; `axios`/`cheerio` or `puppeteer` for scraping depending on whether the source renders client-side.
- Keep scraper adapters per-source (one module per site) behind a common `normalizeListing()` interface so new sources can be added without touching ingestion logic.
- Store `sourceUrl` and `scrapedAt` on every scraped listing for traceability and admin review context.

## 5. Fake / Fishy Internship Detection

Every scraped listing is scored before it can appear to students. This keeps trusted-source listings flowing automatically while catching red flags without needing a human to check everything - and a second, independent signal (student reports) catches what scraping and keywords miss.

### Trust scoring approach

Compute a `trustScore` (0-100) from a weighted rule set - deliberately simple and explainable rather than a black-box model, since it must be defensible in a demo. The weights below are **defaults**, not hardcoded constants - see "Admin-tunable weights" below.

| Signal | Weight | Logic |
| --- | --- | --- |
| Source domain reputation | High | Source is on a curated allow-list (company .com domains, known platforms) -> high score; unknown/free domain (e.g. .tk, .xyz, generic form-builder links) -> low score |
| Requests payment / "registration fee" | Critical | Keyword match ("pay", "fee", "deposit", "refundable") in description -> flags for mandatory human review |
| Asks for sensitive personal/financial info upfront | Critical | Keywords ("bank details", "Aadhaar", "OTP", "account number") before any offer stage -> flags for mandatory human review |
| Contact channel | Medium | Only a personal WhatsApp/Telegram number, no company email/domain -> lowers score |
| Description quality | Medium | Very short (<50 words), generic, no defined role/deliverables -> lowers score |
| Stipend vs role mismatch | Medium | Unusually high stipend for a listed entry-level/no-experience role -> lowers score |
| Deadline plausibility | Low | Extremely long-open or no deadline -> lowers score slightly |
| Duplicate/near-duplicate of a known scam pattern | High | Fuzzy match against a stored table of previously admin-rejected listings -> lowers score |
| Community reports | High | 3+ reports from distinct users on a currently-published listing -> forces recheck regardless of score |

### Decision thresholds

- `trustScore >= 70` **and** no critical flag **and** `eligibilityConfident !== false` -> **auto-published** immediately, `status: "published"`, `reviewedBy: "system"`.
- `40 <= trustScore < 70`, **or** any critical-flag keyword match, **or** `eligibilityConfident: false` -> **queued for admin review**, `status: "pending_review"`, visible to admins only with the score, triggered signals, and flagged phrase shown. A critical-flag hit alone never auto-rejects - a single keyword match without context (e.g. "bank details" inside a routine stipend-disbursement note) is a plausible false positive, so it forces a human look rather than silently dropping a legitimate listing.
- `trustScore < 40` with **no** critical flag -> **auto-rejected**, `status: "rejected"`, logged but never shown to students; admin can still override from an audit view.
- A **published** listing that later crosses the community-report threshold (default 3 distinct-user reports) is force-moved back to `pending_review` for an admin recheck, regardless of its original trustScore.

### Admin review queue

Admins see each pending listing with its score breakdown (which signals fired, including report count/reasons if community-flagged) and can **Approve** (-> published), **Edit & Approve** (fix a field, then publish), or **Reject** (store as a known-bad pattern for future duplicate matching). Approving a resubmission from a company that a known-bad pattern previously matched retires that pattern entry, so a one-time false rejection doesn't permanently poison future legitimate postings from the same company. This human-in-the-loop step is what the assignment calls "decide on the best way to determine" fishy listings - the trust score narrows the set needing review instead of requiring a human to vet every single scraped item.

### Community reporting

Students can flag a live listing as suspicious via `POST /api/internships/:id/report` (`reason` enum: `payment_request`, `sensitive_info_request`, `suspicious_contact`, `fake_company`, `other`, plus free-text `description`), stored in a `ListingReport` collection - a signal for things students notice after engaging with a listing (e.g. a shady interview ask) that scraping and keyword rules can't catch, without waiting for another scrape cycle.

### Admin-tunable weights & decision log

The weight table above is seeded as defaults but stored in a singleton `TrustScoreConfig` document, editable via `GET`/`PATCH /api/admin/trust-score-config` - so scoring can be adjusted as real scam patterns are observed, without a redeploy. Every scraped listing's computed score, which signals fired, and the admin's eventual decision are appended to a `TrustScoreDecisionLog` collection, giving a running record admins can review to spot signals firing too often (false positives) or too rarely (missed scams).

## 6. Resume/Skill Matching & Recommended Learning

### Skill normalization

Free-text skill names ("JS", "React.js", "ReactJS") would otherwise silently break both match scoring and the learning-resource lookup. A maintained `SkillSynonym` collection (`{ canonical, aliases[] }`) backs a `normalizeSkill()` utility, run on every skill wherever it enters the system - registration/profile edit, resume parsing, and scraped `requiredSkills[]` extraction - so comparisons and lookups always operate on canonical names.

### Match score

Each USER profile stores a `skills[]` array (self-reported at signup, editable, and merged with skills parsed from an uploaded resume - see below). Each Internship stores a `requiredSkills[]` array (from the manual form, or extracted from the scraped description via keyword extraction against the maintained skills dictionary), both normalized per above.

Match score = weighted overlap, with a guard for listings that specify no required skills:

```
skillTerm = requiredSkills.length === 0
  ? 70                                                  // nothing to match against - don't penalize
  : (matchedSkills.length / requiredSkills.length) * 70

matchScore = skillTerm
           + eligibilityMatch * 20   // branch/year/CGPA constraints satisfied (0 or 1)
           + locationPreferenceMatch * 10
```

Expressed as a percentage (0-100%), computed on demand when a user views a listing and cached for a short TTL (e.g. 1 hour). The cache key includes both the user's and the internship's `updatedAt` timestamps, so a profile edit, resume re-upload, or an admin editing a listing's `requiredSkills`/`eligibility` naturally busts the cache without any explicit invalidation logic - the next read simply misses and recomputes. It's also computed in a batch job to power a personalized "Recommended for you" feed.

### Resume parsing (auto-extract, manual stays available)

On `POST /api/users/me/resume`, after the file is stored, the server best-effort extracts text (`pdf-parse` for PDFs) and scans it against the same skills dictionary used for scraped-listing extraction. Matches not already in the user's `skills[]` are merged in automatically; the response includes an `addedSkills` list so the frontend can show what was auto-detected. Parsing is strictly additive - it never removes a skill the student entered manually, and the student can edit `skills[]` via `PATCH /api/users/me` at any time, including removing an incorrectly auto-detected one. Manual entry (at registration and via profile edit) remains the primary, always-available path; resume parsing is an accelerator on top of it, not a replacement.

### Recommended learning

For the skills in `requiredSkills[]` that are NOT in the user's `skills[]` (the gap set), return a short recommended-learning list per missing skill, e.g. `{ skill: "Docker", resources: [{title, url, type: "course"|"article"|"doc"}] }`. For the MVP, this is a **static curated mapping** (skill -> 1-3 vetted resource links) stored in its own `LearningResource` collection, keyed by canonical skill name, managed by admins via `GET`/`POST`/`PATCH`/`DELETE /api/admin/learning-resources` - simple to build and demo, and avoids depending on an external AI/content API for a course deliverable. It can be swapped for an LLM-generated recommendation later without changing the API contract.

Response shape returned alongside a listing detail:

```json
{
  "matchScore": 72,
  "matchedSkills": ["JavaScript", "REST APIs"],
  "missingSkills": ["Docker", "AWS"],
  "recommendedLearning": [
    { "skill": "Docker", "resources": [{ "title": "Docker for Beginners", "url": "...", "type": "course" }] }
  ]
}
```

## 7. Deadline & Match-Alert Notifications

Two distinct notification types, so the trigger rules don't collide:

- **`deadline_reminder`** - for every internship a user has **applied to or saved**, whose `deadline` falls within a configurable window (default 48 hours).
- **`match_alert`** - for a **saved** internship whose computed match score crosses a high threshold (default 85%, configurable) after a profile update or a listing edit - independent of deadline proximity, a "this is worth applying to" nudge rather than a countdown.

Mechanics:

- A scheduled job runs on the same cadence as the scraper (every 6-12h via `NOTIFY_CRON`, not once daily) and checks both conditions above - the tighter cadence keeps the 48h deadline window meaningfully precise instead of drifting by up to a day.
- Matching users get a `Notification` record created (`read: false`) retrievable via `GET /api/notifications`.
- A notification is created once per user per internship per type per window (deduped by a `notifiedFor` tracking field) so users aren't spammed on every job run.
- In addition to polling, a Socket.IO connection (`/notifications` namespace, joined to a `user:<id>` room after auth) pushes a `notification:new` event the moment a `Notification` document is created, for real-time delivery while the user is online; `GET /api/notifications` remains the reliable source of truth/initial load for anyone not currently connected.
- `PATCH /api/notifications/:id/read` marks a notification as read.
- Email delivery (e.g. via Nodemailer) remains a stretch goal beyond the in-app/real-time path.

## 8. Application Management, History & Status Tracking

- **Apply:** `POST /api/applications` creates an application linking `userId` + `internshipId`, initial `status: "Applied"`, `appliedAt` timestamp. Blocked if a non-withdrawn application already exists for that user+internship pair (Business Rules), or if the internship's deadline has passed, or its status is not `published`.
- **View own applications:** `GET /api/applications/me` returns the user's applications with populated internship summary (title, company, deadline) and current status, sortable by date/status.
- **Withdraw:** `PATCH /api/applications/:id/withdraw` - only allowed while status is `Applied` or `Shortlisted` (see Business Rules for what's "eligible"); sets status to `Withdrawn` and records `withdrawnAt`.
- **Status tracking:** every status transition is appended to a `statusHistory[]` array on the application (`{ status, changedAt, changedBy }`) so both the student's timeline view and admin audit trail are backed by the same record - no separate history collection needed for this scale.
- **Admin view of applications:** `GET /api/admin/applications` supports filtering by `internshipId`, `status`, or `userId`, for reviewing and updating status (`PATCH /api/admin/applications/:id/status`).

## 9. Admin Listing Management

- Create (`POST /api/admin/internships`), update (`PATCH /api/admin/internships/:id`), and close (`PATCH /api/admin/internships/:id/close`, sets `status: "closed"` so it stops accepting applications but stays visible in history) listings.
- Review queue (`GET /api/admin/internships/pending`) lists scraped listings with `status: "pending_review"`, each showing its `trustScore`, triggered signals, low-confidence-eligibility flag, and any community report count/reasons.
- Approve (`PATCH /api/admin/internships/:id/approve`), edit-and-approve (`PATCH` with a body + approve), or reject (`PATCH /api/admin/internships/:id/reject`, stores it in the known-bad pattern table for future duplicate detection).
- All admin listing actions are logged with `reviewedBy` (admin's user id) and `reviewedAt` for auditability.

## 10. Skill-Gap Analytics (Admin)

Beyond serving one student's match score, the same underlying data - `requiredSkills[]` across published listings vs. `skills[]` across registered students - is aggregated into a placement-cell-facing view via `GET /api/admin/analytics/skill-gaps` (filterable by branch/year):

- **Top missing skills**, ranked by how many students are missing them for listings they'd otherwise be well-matched to (`eligibilityMatch = 1` and overall match >= 50%).
- **Demand vs. supply per skill** - how often a skill appears in `requiredSkills[]` across active listings vs. how many students already have it in `skills[]`.
- **Trend over time**, computed by a periodic aggregation job and stored in a lightweight `SkillGapSnapshot` collection so the endpoint reads a precomputed rollup instead of scanning the full collection on every request.

This turns the portal from a pure CRUD app into a decision-support tool: the placement cell can see, concretely, that e.g. 40% of applicants are missing Docker for roles they're otherwise eligible for - a direct, demoable input into what workshops or electives to run next term.

## 11. Business Rules

1. An internship must include `title`, `company`, `description`, `eligibility` (structured), `location`, and `deadline`; a listing missing any of these fails validation and is never published (scraped or manual).
2. A user cannot submit a duplicate application for the same internship: a second `POST /api/applications` for a user+internship pair that already has a non-`Withdrawn` application returns `409 Conflict`. A user MAY re-apply after withdrawing.
3. Application status is one of exactly: `Applied`, `Shortlisted`, `Rejected`, `Selected` (plus `Withdrawn` as a user-initiated terminal state). Only admins can move `Applied -> Shortlisted / Rejected / Selected`; only the owning user can move to `Withdrawn`, and only from `Applied` or `Shortlisted` (once `Rejected` or `Selected`, the outcome is final and withdrawal is blocked).
4. Only admins can create, update, close, approve, or reject listings; only admins can change an application's evaluative status. A user attempting any admin-only action receives `403 Forbidden`.
5. A user cannot apply after an internship's `deadline` has passed, or while its status is `pending_review`, `rejected`, or `closed` - only `published` listings accept applications.
6. A user can only view/withdraw their own applications (`404`/`403` on another user's application id); an admin can view all applications but cannot apply on a student's behalf.
7. Registration always forces `role: "user"`; no client-supplied `role` field is ever honored, and there is no self-service path to an admin account - admin accounts exist only via the seed script or direct DB provisioning.
8. A scraped listing whose eligibility could not be confidently parsed into the structured shape (`eligibilityConfident: false`) never auto-publishes regardless of `trustScore` - it always lands in the admin review queue.
9. A critical-flag keyword match forces the listing into admin review; it never by itself causes an auto-reject.
10. A listing reaching the community-report threshold (default 3 distinct-user reports) is force-moved to `pending_review`, regardless of its current status or trustScore.
11. Approving a resubmission from a company previously matched to a known-bad duplicate pattern retires that pattern entry so it stops suppressing that company's future listings.

## 12. Technical Architecture

**Stack:** Node.js + Express.js (REST API), MongoDB + Mongoose (data), JWT in an HTTP-only cookie (auth), bcrypt (password hashing), `multer` (resume file upload, disk storage under `/uploads` for MVP - swappable for S3/Cloudinary later without changing the API contract), `pdf-parse` (resume text extraction), `string-similarity` (fuzzy dedup), `sanitize-html` (scraped-text sanitization), `node-cache` (in-process match-score cache), `socket.io` (real-time notification push), a lightweight frontend (React, or server-rendered EJS if time is short) to exercise the API, `node-cron`/`agenda` for scheduled jobs (scraping, deadline/match-alert notifications, skill-gap snapshot rollups).

### Suggested folder structure

```
src/
  config/          # db connection, env loader
  models/          # User, Internship, Application, Notification, LearningResource,
                    # SavedInternship, ListingReport, TrustScoreConfig, TrustScoreDecisionLog,
                    # SkillSynonym, SkillGapSnapshot
  controllers/      # request handlers per resource
  routes/           # express routers per resource
  middleware/        # auth.js (verifyToken), rbac.js (requireRole), validate.js, errorHandler.js, upload.js (multer)
  services/          # matchScore.js, trustScore.js, notifier.js, normalizeSkill.js, resumeParser.js, analytics.js
  scrapers/           # one adapter module per source + normalizeListing.js
  jobs/              # scrape.job.js, notify.job.js, skillGapSnapshot.job.js (cron entry points)
  sockets/            # notifications socket namespace/room wiring
  utils/              # asyncHandler, apiResponse helpers
  app.js
server.js
```

### Request flow

`client -> express router -> auth middleware (verify JWT cookie) -> role middleware (requireRole) -> validation middleware (e.g. Joi/Zod schema) -> controller -> service/model -> MongoDB`, with a centralized `errorHandler` middleware as the last stop, converting thrown errors into a consistent `{ success, message, errors? }` JSON shape with the correct HTTP status.

### Key environment variables

`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_SECURE` (true in production), `COOKIE_SAMESITE` (`lax` in dev, `strict`/`none` in prod per Section 14), `NOTIFY_WINDOW_HOURS`, `NOTIFY_CRON`, `SCRAPE_CRON`, `MATCH_ALERT_THRESHOLD`, `REPORT_THRESHOLD`, `MAX_RESUME_SIZE_MB`.

## 13. Data Models

### User

| Field | Type | Notes |
| --- | --- | --- |
| name | String | required |
| email | String | required, unique |
| passwordHash | String | bcrypt hash, never returned in responses |
| role | String enum | `"user"` \| `"admin"`, default `"user"`, never settable from the register request body |
| tokenVersion | Number | default 0; embedded in the JWT payload, bumped by `PATCH /api/admin/users/:id/revoke-sessions` to invalidate that user's existing tokens |
| branch, year, cgpa | String/Number | used in eligibility matching |
| skills | \[String\] | normalized canonical names; used for match score |
| resumeUrl | String | optional uploaded file reference |
| resumeOriginalName | String | original filename, for display on re-upload |
| resumeUploadedAt | Date | set on upload/re-upload, null if never uploaded |
| createdAt | Date | timestamps |

### Internship

| Field | Type | Notes |
| --- | --- | --- |
| title, company, description | String | required |
| eligibility | Object | `{ branches: [String], minCgpa: Number, years: [Number] }` - always structured |
| eligibilityConfident | Boolean | scraped listings only; `false` forces `pending_review` regardless of trustScore |
| location | String | required |
| deadline | Date | required |
| stipend | Number | optional |
| requiredSkills | \[String\] | normalized canonical names; used for match score |
| workMode | String enum | `remote` \| `hybrid` \| `onsite` |
| sourceType | String enum | `scraped` \| `manual` |
| sourceUrl, scrapedAt | String, Date | scraped listings only |
| trustScore | Number | 0-100, scraped listings only |
| reportCount | Number | default 0; denormalized count of `ListingReport` docs against this listing |
| status | String enum | `published` \| `pending_review` \| `rejected` \| `closed` |
| reviewedBy, reviewedAt | ObjectId(User), Date | admin who actioned it |

### Application

| Field | Type | Notes |
| --- | --- | --- |
| userId | ObjectId(User) | required |
| internshipId | ObjectId(Internship) | required |
| status | String enum | `Applied` \| `Shortlisted` \| `Rejected` \| `Selected` \| `Withdrawn` |
| statusHistory | \[{ status, changedAt, changedBy }\] | audit trail |
| appliedAt, withdrawnAt | Date |  |

Compound unique index on `(userId, internshipId)` where `status != "Withdrawn"` enforces the no-duplicate-application rule at the database level, not just in application code.

### SavedInternship

| Field | Type | Notes |
| --- | --- | --- |
| userId | ObjectId(User) | required |
| internshipId | ObjectId(Internship) | required |
| savedAt | Date |  |

Compound unique index on `(userId, internshipId)`.

### ListingReport

| Field | Type | Notes |
| --- | --- | --- |
| userId | ObjectId(User) | required |
| internshipId | ObjectId(Internship) | required |
| reason | String enum | `payment_request` \| `sensitive_info_request` \| `suspicious_contact` \| `fake_company` \| `other` |
| description | String | optional free text |
| createdAt | Date |  |

### Notification

| Field | Type | Notes |
| --- | --- | --- |
| userId | ObjectId(User) | required |
| internshipId | ObjectId(Internship) | required |
| type | String enum | `deadline_reminder` \| `match_alert` |
| read | Boolean | default false |
| createdAt | Date |  |

### LearningResource

| Field | Type | Notes |
| --- | --- | --- |
| skill | String | canonical skill name, unique |
| resources | \[{ title, url, type }\] | `type`: `"course"` \| `"article"` \| `"doc"` |
| updatedBy, updatedAt | ObjectId(User), Date | admin who last edited it |

### TrustScoreConfig

| Field | Type | Notes |
| --- | --- | --- |
| singleton | Boolean | always one document |
| weights | Object | current weight per signal (Section 5 table) |
| criticalKeywords | \[String\] | keyword list for the two critical signals |
| reportThreshold | Number | default 3 |
| updatedBy, updatedAt | ObjectId(User), Date |  |

### TrustScoreDecisionLog

| Field | Type | Notes |
| --- | --- | --- |
| internshipId | ObjectId(Internship) | required |
| trustScore | Number | score at time of scoring |
| signalsFired | \[String\] | which signals triggered |
| adminDecision | String enum | `approved` \| `edited_approved` \| `rejected` \| `auto_published` \| `auto_rejected` |
| decidedBy | ObjectId(User) | null for automated decisions |
| decidedAt | Date |  |

### SkillSynonym

| Field | Type | Notes |
| --- | --- | --- |
| canonical | String | unique |
| aliases | \[String\] |  |

### SkillGapSnapshot

| Field | Type | Notes |
| --- | --- | --- |
| skill | String |  |
| demandCount | Number | listings requiring it |
| supplyCount | Number | students who have it |
| missingForEligibleCount | Number | students eligible/well-matched but missing it |
| snapshotAt | Date |  |

## 14. API Endpoints

### Auth

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | /api/auth/register | Public | Create USER account (role always forced to `"user"`) |
| POST | /api/auth/login | Public | Login, sets JWT httpOnly cookie |
| POST | /api/auth/logout | Authenticated | Clears cookie |
| GET | /api/auth/me | Authenticated | Current user profile |

### User Profile

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| PATCH | /api/users/me | User | Update profile fields (skills, branch, year, cgpa, location preference, certifications) |
| POST | /api/users/me/resume | User | Upload resume; if one already exists, replaces it (re-upload); auto-suggests parsed skills |
| DELETE | /api/users/me/resume | User | Remove current resume |
| GET | /api/users/me/resume | User | Download own resume (authenticated, ownership-checked - never served from a static public directory) |
| GET | /api/users/me/saved | User | List saved internships |

`POST /api/users/me/resume` accepts `multipart/form-data`, one file field (`resume`), validated server-side for MIME type (`application/pdf`, `.doc`/`.docx`) and a max size (e.g. 2MB) before storage; rejects with `400` otherwise. On success it updates `resumeUrl`, `resumeOriginalName`, `resumeUploadedAt`, merges any newly parsed skills into `skills[]`, and returns the updated profile plus `addedSkills`.

### Internships (public browse)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | /api/internships | Public/User | List published internships, filters + pagination |
| GET | /api/internships/:id | Public/User | Detail + match score + recommended learning (match/recommendation only if authenticated) |
| POST | /api/internships/:id/save | User | Save/bookmark a listing |
| DELETE | /api/internships/:id/save | User | Unsave a listing |
| POST | /api/internships/:id/report | User | Report a listing as suspicious |

### Applications

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | /api/applications | User | Apply to an internship |
| GET | /api/applications/me | User | Own application history |
| GET | /api/applications/:id | User (own) | Single application detail |
| PATCH | /api/applications/:id/withdraw | User (own) | Withdraw if eligible |

### Notifications

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | /api/notifications | User | List own notifications (`deadline_reminder` and `match_alert`) |
| PATCH | /api/notifications/:id/read | User (own) | Mark as read |

Real-time delivery is a Socket.IO connection to the `/notifications` namespace (authenticated via the same JWT cookie, joined to room `user:<id>`), pushing a `notification:new` event alongside the polled endpoint above.

### Admin - Listings

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | /api/admin/internships | Admin | List all listings regardless of status, filterable by `status`, paginated |
| POST | /api/admin/internships | Admin | Create listing |
| PATCH | /api/admin/internships/:id | Admin | Update listing |
| PATCH | /api/admin/internships/:id/close | Admin | Close listing |
| GET | /api/admin/internships/pending | Admin | Review queue (fishy scraped + community-reported listings) |
| PATCH | /api/admin/internships/:id/approve | Admin | Approve pending listing |
| PATCH | /api/admin/internships/:id/reject | Admin | Reject pending listing |

### Admin - Applications

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | /api/admin/applications | Admin | All applications, filterable |
| PATCH | /api/admin/applications/:id/status | Admin | Update status (Shortlisted/Rejected/Selected) |

### Admin - Trust Score & Learning Resources

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | /api/admin/trust-score-config | Admin | View current signal weights, critical keywords, report threshold |
| PATCH | /api/admin/trust-score-config | Admin | Tune weights/keywords/threshold |
| GET | /api/admin/learning-resources | Admin | List skill -> resources mapping |
| POST | /api/admin/learning-resources | Admin | Add a skill's resource mapping |
| PATCH | /api/admin/learning-resources/:id | Admin | Update a skill's resources |
| DELETE | /api/admin/learning-resources/:id | Admin | Remove a skill's mapping |

### Admin - Analytics & Users

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | /api/admin/analytics/skill-gaps | Admin | Aggregate skill-gap ranking (top missing, demand vs. supply, trend) |
| PATCH | /api/admin/users/:id/revoke-sessions | Admin | Bump a user's `tokenVersion`, invalidating their existing JWTs |
| POST | /api/admin/jobs/scrape/run | Admin | Trigger the scrape job immediately instead of waiting for its cron window (demo/grading convenience) |
| POST | /api/admin/jobs/notify/run | Admin | Trigger the deadline/match-alert notification job immediately |
| POST | /api/admin/jobs/skill-gap-snapshot/run | Admin | Trigger the skill-gap snapshot rollup immediately |

Every route above returns a consistent envelope (`{ success, data, message }` on 2xx; `{ success: false, message, errors? }` on 4xx/5xx) and the standard status codes: `200` OK, `201` Created, `400` validation error, `401` not authenticated, `403` wrong role/not owner, `404` not found, `409` duplicate application, `500` server error.

## 15. Authentication & Authorization

- **Registration/login:** password hashed with `bcrypt` (cost factor \~10-12) before storage; login compares hash, then issues a JWT (`{ sub: userId, role, tokenVersion }`, short expiry e.g. 1h + a longer-lived pattern if refresh is added later) set as an **HTTP-only, `Secure` in production cookie**.
- **Cross-origin cookie note:** if the frontend and API run on different origins in development (e.g. Vite on `:5173`, Express on `:5000`), use `SameSite=Lax` so the auth cookie still gets sent - `Strict` silently drops it and breaks auth locally. Reserve `SameSite=None; Secure` for a genuinely cross-site production split, and pair it with explicit CSRF-token protection on state-changing routes, since `SameSite=None` reopens the CSRF surface the cookie strategy otherwise closes. The cookie is never returned in the JSON body, so it isn't reachable from client-side JS (mitigates XSS token theft).
- **Role assignment:** `POST /api/auth/register` strips/ignores any client-supplied `role` field - every public registration is forced to `role: "user"`. There is no endpoint to self-promote to admin; admin accounts exist only via the seed script or direct DB provisioning for this project's scope.
- **`verifyToken` middleware:** reads the cookie, verifies the JWT signature/expiry, attaches `req.user = { id, role }`, else `401`. On admin-only and account-sensitive routes it additionally compares the token's `tokenVersion` against the current DB value, so `PATCH /api/admin/users/:id/revoke-sessions` can force-invalidate a specific user's sessions without a full token-blacklist store (a deliberate lightweight tradeoff - a short JWT expiry and no revocation list elsewhere is accepted for MVP scope).
- **`requireRole(...roles)` middleware:** checks `req.user.role` against an allow-list for that route, else `403`; applied on top of `verifyToken` for every admin-only route.
- **Ownership checks:** for user-scoped resources (an application, a notification, a saved internship), the controller additionally checks `req.user.id === resource.userId`, else `403`/`404` (404 preferred to avoid confirming another user's resource exists).
- **Validation middleware:** every write endpoint validates its body against a schema (Joi or Zod) before hitting the controller, returning `400` with field-level error messages on failure.
- **Logout:** clears the cookie (`res.clearCookie`), stateless otherwise (no server-side session store needed for MVP).

## 16. Non-Functional Requirements

- **Validation:** all incoming data validated at the route boundary (schema-based); reject unknown/extra fields; sanitize free-text fields against NoSQL injection (`mongo-sanitize` or equivalent).
- **Output sanitization:** scraped free-text fields (`description`, etc.) are run through `sanitize-html` (strip tags, keep plain text) at ingestion time before storage; the frontend still treats all listing text as plain text (never raw-HTML injection) as defense in depth against stored XSS from untrusted scraped sources.
- **Centralized error handling:** a single Express error-handling middleware normalizes thrown errors (including Mongoose `ValidationError`/`CastError`) into the standard response envelope and status code - no ad hoc `try/catch` response shapes scattered across controllers.
- **Meaningful status codes:** as listed in Section 14; never `200` for a failure case.
- **Security:** `helmet` for headers, `cors` restricted to the frontend origin, rate limiting on `/api/auth/*` (`express-rate-limit`) to blunt brute-force login attempts, environment secrets never committed (`.env` + `.gitignore`).
- **File upload safety:** resume uploads restricted by MIME type and extension (`pdf`, `doc`, `docx` only), size-capped (e.g. 2MB), stored with a generated filename (never the client-supplied one) to prevent path traversal/overwrite attacks, and served only via an authenticated, ownership-checked route rather than a static public directory.
- **Cache correctness:** the match-score cache key incorporates both the user's and the internship's `updatedAt` timestamps (Section 6), so a profile edit, resume re-upload, or listing edit naturally busts stale entries without explicit invalidation code; an in-process `node-cache`/Map is sufficient for a single-instance MVP, with Redis as the swap-in if horizontally scaled later.
- **Performance:** indexes on `Internship.deadline`, `Internship.status`, `Application.(userId, internshipId)`, `SavedInternship.(userId, internshipId)`; pagination on all list endpoints (`page`/`limit` query params, with an enforced max `limit`) so listing/application collections don't return unbounded arrays.
- **Auditability:** every admin action on a listing or application status stores who/when, as specified in the data model; every trust-score decision is appended to `TrustScoreDecisionLog`.
- **Testability:** deterministic seed data (Section 17) so graders and teammates get the same starting state.

## 17. Expected Submission & Deliverables Checklist

- [ ] Working backend application (Node.js + Express + MongoDB), plus a minimal frontend that can register/login, browse/apply, and (as admin) manage listings and application statuses.
- [ ] GitHub repository with organized source code and a README covering setup, environment variables, how to run the scraper/notification jobs, and architecture overview.
- [ ] Postman collection covering every endpoint in Section 14, with at least one success (2xx) and one failure (4xx) case each - including duplicate application (409), unauthorized (401), and forbidden (403) scenarios.
- [ ] Seed script producing sample users (one admin, two students with different skill sets), a mix of published/pending/rejected internships, and a few applications in different statuses.
- [ ] Test credentials documented in the README (e.g. `admin@college.edu` / a seeded password, and one student account).
- [ ] Short technical demonstration (video or live) walking through: register/login, browsing + match score, applying, admin reviewing a fishy listing, admin updating application status, deadline notification.

## 18. Suggested Build Order

1. **Foundation:** project scaffold, MongoDB connection, User model + register/login/JWT-cookie auth + role middleware.
2. **Core CRUD:** Internship and Application models + their standard endpoints (manual admin add, browse, apply, withdraw, status update) - get the whole role-gated flow working end-to-end with manually-entered data first.
3. **Business rules & validation:** duplicate-application guard, deadline/status gating, centralized error handling, request validation on every write route.
4. **Scraping + trust scoring:** build one scraper adapter, `normalizeListing`, the `trustScore` function and review-queue endpoints.
5. **Matching + notifications:** match score calculation, recommended-learning lookup, deadline-notification cron job.
6. **Polish for submission:** seed script, Postman collection (success + failure cases), README, minimal frontend wiring, record the demo.
7. **Stretch differentiators (if time remains):** admin-tunable trust-score weights + decision log, community listing reports, resume-parsed skill suggestions, skill-gap analytics dashboard, real-time notification push via Socket.IO.

This order front-loads the graded "secure REST API + RBAC" core (Sections 3, 11, 14, 15) before the differentiators (fake-listing detection, matching, notifications, and the Section 7 stretch items), so there's always a working, gradeable submission even if time runs short on the later features.
