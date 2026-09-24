const NodeCache = require("node-cache");
const LearningResource = require("../models/LearningResource");

// Keyed by user+internship *and* both their updatedAt timestamps, so a profile edit,
// resume re-upload, or an admin editing the listing naturally busts the cache - the
// next read just misses and recomputes, no explicit invalidation code needed (Section 6/16).
const cache = new NodeCache({ stdTTL: 3600 });

function cacheKey(user, internship) {
  return `${user._id}:${internship._id}:${user.updatedAt.getTime()}:${internship.updatedAt.getTime()}`;
}

function eligibilityMatches(user, internship) {
  const { branches, minCgpa, years } = internship.eligibility || {};
  if (branches?.length && user.branch && !branches.includes("Any") && !branches.includes(user.branch)) {
    return false;
  }
  if (minCgpa && user.cgpa !== undefined && user.cgpa < minCgpa) return false;
  if (years?.length && user.year && !years.includes(user.year)) return false;
  return true;
}

function locationMatches(user, internship) {
  if (!user.locationPreference) return false;
  if (internship.workMode === "remote") return true;
  return internship.location?.toLowerCase().includes(user.locationPreference.toLowerCase());
}

// Section 6: matchScore = skillTerm*0.7-weighted + eligibilityMatch*20 + locationMatch*10,
// with a guard so a listing with zero requiredSkills doesn't divide by zero.
async function computeMatch(user, internship) {
  const key = cacheKey(user, internship);
  const cached = cache.get(key);
  if (cached) return cached;

  const userSkills = new Set((user.skills || []).map((s) => s.toLowerCase()));
  const requiredSkills = internship.requiredSkills || [];

  const matchedSkills = requiredSkills.filter((s) => userSkills.has(s.toLowerCase()));
  const missingSkills = requiredSkills.filter((s) => !userSkills.has(s.toLowerCase()));

  const skillTerm = requiredSkills.length === 0 ? 70 : (matchedSkills.length / requiredSkills.length) * 70;
  const eligibilityTerm = eligibilityMatches(user, internship) ? 20 : 0;
  const locationTerm = locationMatches(user, internship) ? 10 : 0;

  const matchScore = Math.round(skillTerm + eligibilityTerm + locationTerm);

  const recommendedLearning = await buildRecommendedLearning(missingSkills);

  const result = { matchScore, matchedSkills, missingSkills, recommendedLearning };
  cache.set(key, result);
  return result;
}

async function buildRecommendedLearning(missingSkills) {
  if (missingSkills.length === 0) return [];
  const resources = await LearningResource.find({ skill: { $in: missingSkills } });
  const bySkill = new Map(resources.map((r) => [r.skill, r.resources]));
  return missingSkills
    .filter((skill) => bySkill.has(skill))
    .map((skill) => ({ skill, resources: bySkill.get(skill) }));
}

module.exports = { computeMatch };
