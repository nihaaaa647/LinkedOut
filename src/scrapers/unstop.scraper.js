const puppeteer = require("puppeteer");
const normalizeListing = require("./normalizeListing");
const { extractSkillsFromText } = require("../services/normalizeSkill");

const LISTING_PAGE_URL = "https://unstop.com/internships";
const SOURCE_NAME = "unstop";

// Unstop is a client-rendered app - a plain axios GET only returns the pre-hydration
// HTML shell, so (unlike Internshala) this adapter needs an actual headless browser to
// see the same DOM a real visitor does. Extraction is text-based (main-content innerText
// + regex) rather than CSS-class selectors, since a Next.js/React app's class names are
// often build-hashed and unstable - this is the same approach verified by hand against
// the live site before writing this adapter.
async function withBrowser(fn) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (compatible; InternshipPortalBot/1.0)");
  return page;
}

// Card links follow /internships/<title-slug>-<company-slug>-<id>; the nav link to the
// listing index itself ("/internships") is excluded by requiring extra path segments.
async function fetchCardLinks(page) {
  await page.goto(LISTING_PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('a[href*="/internships/"]', { timeout: 15000 }).catch(() => {});

  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/internships/"]'));
    const seen = new Set();
    const results = [];
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const segments = href.split("/").filter(Boolean);
      if (segments.length <= 1 || seen.has(href)) continue;
      seen.add(href);

      // "N days left" text, read from the card's own ancestor chain, so each link gets
      // its own real countdown instead of a page-wide fallback.
      let daysLeft = null;
      let el = a;
      for (let i = 0; i < 12 && el; i++) {
        const match = el.textContent.match(/(\d+)\s*days?\s*(left|to go)/i);
        if (match) {
          daysLeft = Number(match[1]);
          break;
        }
        el = el.parentElement;
      }
      results.push({ href, daysLeft });
    }
    return results;
  });
}

async function fetchListingDetail(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector("main", { timeout: 15000 }).catch(() => {});

  return page.evaluate(() => {
    // document.title follows "<Job Title> [in <City>] at <Company>[ | <suffix>]" - the
    // suffix varies ("| Unstop", "| Remote", ...), so strip any number of trailing
    // "| ..." segments rather than hardcoding one exact suffix string.
    let rawTitle = document.title;
    while (/\s*\|[^|]*$/.test(rawTitle)) {
      rawTitle = rawTitle.replace(/\s*\|[^|]*$/, "");
    }
    const atIndex = rawTitle.lastIndexOf(" at ");
    const title = (atIndex >= 0 ? rawTitle.slice(0, atIndex) : rawTitle).trim();
    const company = atIndex >= 0 ? rawTitle.slice(atIndex + 4).trim() || null : null;

    const mainText = (document.querySelector("main") || document.body).innerText;

    const locationMatch = mainText.match(/Location\s*\n?\s*([^\n]+)/i);
    const location = locationMatch ? locationMatch[1].trim() : null;

    const workModeMatch = mainText.match(/\b(Work from Home|In Office|Hybrid)\b/i);
    const workMode = workModeMatch ? workModeMatch[1].toLowerCase() : null;

    // "Details" appears twice: once as a tab-bar label near the very top of the page,
    // and again as the actual section heading right before the posting content - so the
    // LAST "Details" before the disclaimer footer (present on every listing page) is the
    // real content start, not the first (tab-bar) occurrence.
    const disclaimerStart = mainText.indexOf("If an employer asks you to pay");
    const detailsStart = disclaimerStart >= 0 ? mainText.lastIndexOf("Details", disclaimerStart) : mainText.lastIndexOf("Details");
    const fullText =
      detailsStart >= 0 && (disclaimerStart < 0 || disclaimerStart > detailsStart)
        ? mainText.slice(detailsStart + "Details".length, disclaimerStart >= 0 ? disclaimerStart : undefined).trim()
        : mainText.slice(0, 800).trim();

    // Stored as a short excerpt, not the full posting - enough for match scoring and a
    // preview, while the "Original posting" link (added by the caller) is where a
    // student reads the complete listing on Unstop itself.
    const EXCERPT_LENGTH = 400;
    const description = fullText.length > EXCERPT_LENGTH ? `${fullText.slice(0, EXCERPT_LENGTH).trim()}…` : fullText;

    return { title, company, location, workMode, description };
  });
}

async function scrapeUnstop({ maxListings = 20 } = {}) {
  return withBrowser(async (browser) => {
    const listPage = await newPage(browser);
    const cards = (await fetchCardLinks(listPage)).slice(0, maxListings);
    await listPage.close();

    const results = [];
    const detailPage = await newPage(browser);
    for (const card of cards) {
      try {
        const sourceUrl = new URL(card.href, LISTING_PAGE_URL).toString();
        const { title, company, location, workMode, description } = await fetchListingDetail(detailPage, sourceUrl);
        if (!title || !company) continue; // couldn't confidently parse the title/company split

        const daysLeft = card.daysLeft ?? 14; // conservative fallback for rolling postings with no visible countdown
        const deadline = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);
        const requiredSkills = await extractSkillsFromText(description);

        results.push(
          normalizeListing({
            title,
            company,
            description: `${description}\n\nOriginal posting: ${sourceUrl}`,
            location: location || "Not specified",
            deadline,
            requiredSkills,
            workMode: workMode === "work from home" ? "remote" : workMode === "hybrid" ? "hybrid" : workMode ? "onsite" : undefined,
            eligibilityConfident: false,
            sourceUrl,
          })
        );
      } catch (err) {
        console.warn(`[unstop.scraper] skipped one listing: ${err.message}`);
      }
    }
    await detailPage.close();

    return results;
  });
}

module.exports = { scrapeUnstop, SOURCE_NAME };
