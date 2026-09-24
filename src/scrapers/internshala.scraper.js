const axios = require("axios");
const cheerio = require("cheerio");
const normalizeListing = require("./normalizeListing");
const { extractSkillsFromText } = require("../services/normalizeSkill");

const LISTING_PAGE_URL = "https://internshala.com/internships";
const SOURCE_NAME = "internshala";

// Selectors verified against the live site's rendered DOM (search results + a detail
// page) - see README for the re-verification note, since public site markup drifts
// over time and these will eventually need a refresh too. Each listing is parsed
// defensively so one malformed card doesn't abort the whole scrape.
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

function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

// Stored as a short excerpt, not the full posting - enough for match scoring and a
// preview, while the "Original posting" link is where a student reads the full listing.
const EXCERPT_LENGTH = 400;
function excerpt(text) {
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).trim()}…` : text;
}

function parseListingCard($, card) {
  const titleEl = $(card).find(".job-internship-name a.job-title-href").first();
  const title = cleanText(titleEl.text());
  const company = cleanText($(card).find(".company-name").first().text());
  const location = cleanText($(card).find(".locations").first().text()) || "Not specified";
  const stipendText = cleanText($(card).find(".stipend").first().text());
  const relativeUrl = titleEl.attr("href");
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

  const description = excerpt(cleanText($(".internship_details").first().text()));
  const deadlineText = cleanText($(".other_detail_item.apply_by .item_body").first().text());

  return { description, deadlineText };
}

function parseDeadline(deadlineText) {
  if (!deadlineText) return null;
  // Internshala renders e.g. "24 Oct' 26" - normalize the stray apostrophe before Date().
  const parsed = new Date(deadlineText.replace("'", ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Every scraped listing's description ends with a link back to the original posting
// (never just a bare "sourceUrl" field students have to know to look for) so a student
// reading it in our UI can always verify/apply on the original site.
function withSourceLink(description, sourceUrl) {
  const base = description || "See the original posting for full details.";
  return `${base}\n\nOriginal posting: ${sourceUrl}`;
}

// Returns an array of normalizeListing()-shaped objects, ready for ingestListing.
async function scrapeInternshala({ maxListings = 20 } = {}) {
  const html = await fetchListingPage();
  const $ = cheerio.load(html);

  const cards = $(".individual_internship").toArray().slice(0, maxListings);

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
          description: withSourceLink(description, parsed.sourceUrl),
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
