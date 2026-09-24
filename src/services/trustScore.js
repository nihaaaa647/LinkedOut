const stringSimilarity = require("string-similarity");
const TrustScoreConfig = require("../models/TrustScoreConfig");
const KnownBadPattern = require("../models/KnownBadPattern");
const { SIMILARITY_THRESHOLD: DUPLICATE_SIMILARITY_THRESHOLD } = require("./dedup");

const SUSPICIOUS_TLDS = [".tk", ".ml", ".ga", ".cf", ".xyz", ".top", ".click", ".loan"];
const FORM_BUILDER_DOMAINS = ["typeform.com", "forms.gle", "docs.google.com", "bit.ly", "tinyurl.com"];
const KNOWN_GOOD_PLATFORMS = ["internshala.com", "linkedin.com", "indeed.com", "naukri.com"];

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// Each score* function returns a value in [0, weight] - the sub-score contributed by
// that signal - so the sum across all signals lands the composite trustScore in [0, 100].

function scoreSourceDomainReputation(listing, weight) {
  const domain = domainOf(listing.sourceUrl);
  if (!domain) return weight * 0.4; // manual/unknown source URL - middling, not penalized hard
  if (KNOWN_GOOD_PLATFORMS.some((d) => domain.endsWith(d))) return weight;
  if (FORM_BUILDER_DOMAINS.some((d) => domain.endsWith(d))) return 0;
  if (SUSPICIOUS_TLDS.some((tld) => domain.endsWith(tld))) return 0;
  // A company-looking domain (has its own TLD, isn't a free/form-builder host) - decent trust.
  return weight * 0.75;
}

function scoreContactChannel(listing, weight) {
  const text = listing.description.toLowerCase();
  const hasPersonalChannel = /whatsapp|telegram|wa\.me\//.test(text);
  const domain = domainOf(listing.sourceUrl);
  const hasCompanyEmail = domain && new RegExp(`@[a-z0-9.-]*${domain.split(".")[0]}`, "i").test(text);
  if (hasPersonalChannel && !hasCompanyEmail) return 0;
  return weight;
}

function scoreDescriptionQuality(listing, weight) {
  const wordCount = listing.description.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) return weight * (wordCount / 50);
  return weight;
}

function scoreStipendRoleMismatch(listing, weight) {
  if (!listing.stipend) return weight;
  const looksEntryLevel = (listing.eligibility?.years || []).some((y) => y <= 2) || !listing.eligibility?.minCgpa;
  const UNREALISTIC_STIPEND_FOR_ENTRY_LEVEL = 150000;
  if (looksEntryLevel && listing.stipend > UNREALISTIC_STIPEND_FOR_ENTRY_LEVEL) return 0;
  return weight;
}

function scoreDeadlinePlausibility(listing, weight) {
  if (!listing.deadline) return 0;
  const daysUntilDeadline = (new Date(listing.deadline) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysUntilDeadline > 180 || daysUntilDeadline < 0) return weight * 0.3;
  return weight;
}

async function scoreDuplicateScamPattern(listing, weight) {
  const activePatterns = await KnownBadPattern.find({ retired: false, company: new RegExp(listing.company, "i") });
  if (activePatterns.length === 0) return weight;

  const target = `${listing.company} ${listing.title}`.toLowerCase();
  const best = activePatterns.reduce((max, p) => {
    const similarity = stringSimilarity.compareTwoStrings(target, `${p.company} ${p.title}`.toLowerCase());
    return Math.max(max, similarity);
  }, 0);

  return best >= DUPLICATE_SIMILARITY_THRESHOLD ? 0 : weight;
}

function detectCriticalFlags(listing, criticalKeywords) {
  const text = listing.description.toLowerCase();
  const fired = [];
  if ((criticalKeywords.paymentRequest || []).some((kw) => text.includes(kw))) {
    fired.push("payment_request_keyword");
  }
  if ((criticalKeywords.sensitiveInfoRequest || []).some((kw) => text.includes(kw))) {
    fired.push("sensitive_info_keyword");
  }
  return fired;
}

// Computes the trustScore and which signals fired, for a listing not yet scored.
// `listing` needs: company, title, description, sourceUrl, stipend, eligibility, deadline.
async function computeTrustScore(listing) {
  const config = await TrustScoreConfig.getConfig();
  const w = config.weights;

  const signalScores = {
    sourceDomainReputation: scoreSourceDomainReputation(listing, w.sourceDomainReputation),
    contactChannel: scoreContactChannel(listing, w.contactChannel),
    descriptionQuality: scoreDescriptionQuality(listing, w.descriptionQuality),
    stipendRoleMismatch: scoreStipendRoleMismatch(listing, w.stipendRoleMismatch),
    deadlinePlausibility: scoreDeadlinePlausibility(listing, w.deadlinePlausibility),
    duplicateScamPattern: await scoreDuplicateScamPattern(listing, w.duplicateScamPattern),
  };

  const trustScore = Math.round(Object.values(signalScores).reduce((sum, v) => sum + v, 0));

  const signalsFired = Object.entries(signalScores)
    .filter(([key, value]) => value < w[key]) // fired = didn't get full marks
    .map(([key]) => key);

  const criticalFlags = detectCriticalFlags(listing, config.criticalKeywords);
  signalsFired.push(...criticalFlags);

  return { trustScore, signalsFired, criticalFlag: criticalFlags.length > 0 };
}

module.exports = { computeTrustScore, DUPLICATE_SIMILARITY_THRESHOLD };
