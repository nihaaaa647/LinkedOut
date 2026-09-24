const Internship = require("../models/Internship");
const TrustScoreDecisionLog = require("../models/TrustScoreDecisionLog");
const { computeTrustScore } = require("./trustScore");
const { isDuplicate } = require("./dedup");
const { extractSkillsFromText, normalizeSkills } = require("./normalizeSkill");

const AUTO_PUBLISH_THRESHOLD = 70;
const AUTO_REJECT_THRESHOLD = 40;

// Section 4/5: takes a scraper's normalizeListing() output and decides whether it's
// duplicate/skipped, auto-published, sent to review, or auto-rejected. Returns null if
// the listing was a duplicate (nothing created).
async function ingestScrapedListing(rawListing) {
  const duplicate = await isDuplicate(rawListing);
  if (duplicate) return null;

  const requiredSkills = rawListing.requiredSkills?.length
    ? await normalizeSkills(rawListing.requiredSkills)
    : await extractSkillsFromText(rawListing.description);

  // A scraper adapter marks eligibilityConfident: false when it can't confidently
  // extract structured eligibility (Section 4) - defaults to true only if the adapter
  // actually produced branches/minCgpa/years, never silently assumed.
  const eligibility = rawListing.eligibility || { branches: [], minCgpa: 0, years: [] };
  const eligibilityConfident =
    rawListing.eligibilityConfident !== undefined
      ? rawListing.eligibilityConfident
      : eligibility.branches.length > 0 || eligibility.minCgpa > 0 || eligibility.years.length > 0;

  const { trustScore, signalsFired, criticalFlag } = await computeTrustScore(rawListing);

  let status;
  let adminDecision;
  if (trustScore >= AUTO_PUBLISH_THRESHOLD && !criticalFlag && eligibilityConfident) {
    status = "published";
    adminDecision = "auto_published";
  } else if (trustScore < AUTO_REJECT_THRESHOLD && !criticalFlag) {
    status = "rejected";
    adminDecision = "auto_rejected";
  } else {
    // 40-69 trustScore, OR a critical-flag keyword hit, OR low-confidence eligibility -
    // always routed to human review rather than silently published or dropped (Section 5).
    status = "pending_review";
    adminDecision = null;
  }

  const isAutoDecided = status !== "pending_review";

  const internship = await Internship.create({
    title: rawListing.title,
    company: rawListing.company,
    description: rawListing.description,
    eligibility,
    eligibilityConfident,
    location: rawListing.location,
    deadline: rawListing.deadline,
    stipend: rawListing.stipend,
    requiredSkills,
    workMode: rawListing.workMode,
    duration: rawListing.duration,
    sourceType: "scraped",
    sourceUrl: rawListing.sourceUrl,
    scrapedAt: rawListing.scrapedAt || new Date(),
    trustScore,
    status,
    reviewedBy: isAutoDecided ? null : undefined,
    reviewedAt: isAutoDecided ? new Date() : undefined,
  });

  // Only auto_published/auto_rejected are decisions made *now* - a pending_review
  // listing has no decision yet, so its log entry is written later by the admin
  // approve/reject controller instead of a placeholder here.
  if (isAutoDecided) {
    await TrustScoreDecisionLog.create({
      internshipId: internship._id,
      trustScore,
      signalsFired,
      adminDecision,
      decidedBy: null,
      decidedAt: new Date(),
    });
  }

  return internship;
}

module.exports = { ingestScrapedListing, AUTO_PUBLISH_THRESHOLD, AUTO_REJECT_THRESHOLD };
