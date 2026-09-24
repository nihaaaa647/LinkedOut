// Common shape every per-source scraper adapter must produce, consumed by
// ingestListing.ingestScrapedListing(). New sources plug in by adding a module here
// without touching ingestion/trust-score logic (Section 4).
function normalizeListing({
  title,
  company,
  description,
  eligibility,
  eligibilityConfident,
  location,
  deadline,
  stipend,
  requiredSkills,
  workMode,
  duration,
  sourceUrl,
}) {
  return {
    title: title?.trim(),
    company: company?.trim(),
    description: description?.trim(),
    eligibility: eligibility || { branches: [], minCgpa: 0, years: [] },
    eligibilityConfident: eligibilityConfident ?? false,
    location: location?.trim(),
    deadline: deadline ? new Date(deadline) : null,
    stipend: stipend ?? undefined,
    requiredSkills: requiredSkills || [],
    workMode: workMode || undefined,
    duration: duration || undefined,
    sourceUrl,
    scrapedAt: new Date(),
  };
}

module.exports = normalizeListing;
