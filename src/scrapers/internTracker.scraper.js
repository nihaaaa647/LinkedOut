const axios = require("axios");
const normalizeListing = require("./normalizeListing");
const { normalizeSkills } = require("../services/normalizeSkill");

// A community-maintained, self-updating tracker (GitHub-hosted, exposed as a public JSON
// API intended for exactly this kind of consumption - RSS/JSON API/email alerts are all
// first-class in its own README) that polls thousands of employer ATS feeds (Ashby,
// Greenhouse, Workday, ...) for real software-internship postings. Structured JSON, not
// HTML - no cheerio/Puppeteer needed, and nothing here is scraped from a page not meant
// to be read this way.
const JOBS_API_URL =
  "https://zshah101.github.io/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships/api/jobs.json";
const SOURCE_NAME = "intern-tracker";

// The feed has no per-listing deadline (most of these are "open until filled" ATS
// postings) - only a `posted_at` timestamp. A fixed window from posting date is a
// documented estimate, not a scraped fact; Business Rule/Section 4 already requires a
// deadline, and this is the same kind of disclosed convention used for Unstop's "days
// left" fallback.
const ASSUMED_OPEN_WINDOW_DAYS = 45;

function buildDescription(job) {
  const parts = [`${job.title} at ${job.company}${job.location ? ` (${job.location})` : ""}.`];
  if (job.remote) parts.push("Remote-eligible.");
  if (job.salary) parts.push(`Compensation: ${job.salary}.`);
  if (job.skills?.length) parts.push(`Skills mentioned: ${job.skills.join(", ")}.`);
  parts.push(
    `Deadline shown here is an estimate (${ASSUMED_OPEN_WINDOW_DAYS} days from when this tracker first saw the ` +
      "posting) - this feed doesn't publish a fixed close date, so confirm on the original posting."
  );
  return parts.join(" ");
}

async function scrapeInternTracker({ maxListings = 30 } = {}) {
  const { data } = await axios.get(JOBS_API_URL, { timeout: 20000 });
  const jobs = Array.isArray(data) ? data : data.jobs || [];

  const results = [];
  for (const job of jobs.slice(0, maxListings)) {
    try {
      if (!job.title || !job.company || !job.url) continue;

      const postedAt = job.posted_at ? new Date(job.posted_at) : new Date();
      const deadline = new Date(postedAt.getTime() + ASSUMED_OPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const requiredSkills = job.skills?.length ? await normalizeSkills(job.skills) : [];

      results.push(
        normalizeListing({
          title: job.title,
          company: job.company,
          description: `${buildDescription(job)}\n\nOriginal posting: ${job.url}`,
          location: job.location || (job.remote ? "Remote" : "Not specified"),
          deadline,
          requiredSkills,
          workMode: job.remote ? "remote" : undefined,
          eligibilityConfident: false, // this feed doesn't state branch/CGPA/year eligibility
          sourceUrl: job.url,
        })
      );
    } catch (err) {
      console.warn(`[internTracker.scraper] skipped one listing: ${err.message}`);
    }
  }

  return results;
}

module.exports = { scrapeInternTracker, SOURCE_NAME };
