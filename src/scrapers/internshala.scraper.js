const axios = require("axios");
const cheerio = require("cheerio");
const normalizeListing = require("./normalizeListing");
const { extractSkillsFromText } = require("../services/normalizeSkill");

const LISTING_PAGE_URL = "https://internshala.com/internships";
const SOURCE_NAME = "internshala";

// Internshala's markup changes periodically - these selectors are a best-effort
// starting point and MUST be re-verified against the live page before relying on this
// adapter for a real demo/grading run (Section 4: scraper design notes). Each listing
// is parsed defensively so one malformed card doesn't abort the whole scrape.
async function fetchListingPage() {
  const { data: html } = await axios.get(LISTING_PAGE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; InternshipPortalBot/1.0)" },
    timeout: 15000,
  });
  return html;
}

function parseStipend(text) {
  if (!text) return undefined;
  const match = text.replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function parseListingCard($, card) {
  const title = $(card).find(".job-internship-name, .profile").first().text().trim();
  const company = $(card).find(".company-name").first().text().trim();
  const location = $(card).find(".locations, .location_link").first().text().trim() || "Not specified";
  const stipendText = $(card).find(".stipend").first().text().trim();
  const relativeUrl = $(card).find("a.job-title-href, a.view_detail_button").first().attr("href");
  const sourceUrl = relativeUrl ? new URL(relativeUrl, LISTING_PAGE_URL).toString() : undefined;

  if (!title || !company || !sourceUrl) return null; // skip cards we couldn't confidently parse

  return { title, company, location, stipendText, sourceUrl };
}

async function fetchListingDetail(sourceUrl) {
  const { data: html } = await axios.get(sourceUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; InternshipPortalBot/1.0)" },
    timeout: 15000,
  });
  const $ = cheerio.load(html);

  const description = $(".internship_details, .text-container").first().text().trim();
  const deadlineText = $(".apply_by, .other_detail_item:contains('Apply By')").first().text().trim();

  return { description, deadlineText };
}

function parseDeadline(deadlineText) {
  if (!deadlineText) return null;
  const parsed = new Date(deadlineText.replace(/apply by/i, "").trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Returns an array of normalizeListing()-shaped objects, ready for ingestListing.
async function scrapeInternshala({ maxListings = 20 } = {}) {
  const html = await fetchListingPage();
  const $ = cheerio.load(html);

  const cards = $(".individual_internship, .internship_meta")
    .toArray()
    .slice(0, maxListings);

  const results = [];
  for (const card of cards) {
    try {
      const parsed = parseListingCard($, card);
      if (!parsed) continue;

      const { description, deadlineText } = await fetchListingDetail(parsed.sourceUrl);
      const deadline = parseDeadline(deadlineText);
      if (!deadline) continue; // deadline is a required field (Section 4) - skip if unparseable

      const requiredSkills = await extractSkillsFromText(description);

      results.push(
        normalizeListing({
          title: parsed.title,
          company: parsed.company,
          description: description || `${parsed.title} at ${parsed.company}`,
          location: parsed.location,
          deadline,
          stipend: parseStipend(parsed.stipendText),
          requiredSkills,
          eligibilityConfident: false, // Internshala listings rarely state structured eligibility
          sourceUrl: parsed.sourceUrl,
        })
      );
    } catch (err) {
      console.warn(`[internshala.scraper] skipped one listing: ${err.message}`);
    }
  }

  return results;
}

module.exports = { scrapeInternshala, SOURCE_NAME };
