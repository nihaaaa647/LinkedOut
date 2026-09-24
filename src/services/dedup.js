const stringSimilarity = require("string-similarity");
const Internship = require("../models/Internship");

// Calibrated against reworded-repost samples (e.g. "Marketing Intern" vs "Marketing
// Internship Opportunity" from the same company scores ~0.80), which sit meaningfully
// above genuinely-different-role samples from the same company (~0.60-0.65).
const SIMILARITY_THRESHOLD = 0.75;
const DEADLINE_WINDOW_DAYS = 14;

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Section 4: fuzzy-match on normalized company+title against existing listings from the
// same company with a deadline within 14 days, instead of an exact company+title+deadline
// hash - catches reworded reposts and minor deadline extensions the hash would miss.
async function isDuplicate(candidate) {
  const windowStart = new Date(candidate.deadline);
  windowStart.setDate(windowStart.getDate() - DEADLINE_WINDOW_DAYS);
  const windowEnd = new Date(candidate.deadline);
  windowEnd.setDate(windowEnd.getDate() + DEADLINE_WINDOW_DAYS);

  const sameCompanyListings = await Internship.find({
    company: new RegExp(`^${candidate.company.trim()}$`, "i"),
    deadline: { $gte: windowStart, $lte: windowEnd },
  }).select("title company");

  if (sameCompanyListings.length === 0) return false;

  const target = normalize(`${candidate.company} ${candidate.title}`);
  return sameCompanyListings.some((existing) => {
    const similarity = stringSimilarity.compareTwoStrings(target, normalize(`${existing.company} ${existing.title}`));
    return similarity >= SIMILARITY_THRESHOLD;
  });
}

module.exports = { isDuplicate, SIMILARITY_THRESHOLD };
