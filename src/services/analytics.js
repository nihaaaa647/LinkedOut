const Internship = require("../models/Internship");
const User = require("../models/User");
const SkillGapSnapshot = require("../models/SkillGapSnapshot");
const { computeMatch } = require("./matchScore");

const ELIGIBLE_MATCH_THRESHOLD = 50;

// Section 10: demand (how often a skill is required across active listings) vs supply
// (how many students already have it), plus how many otherwise-eligible/well-matched
// students are missing each skill - the actionable "what to teach next" signal.
async function computeSkillGapLive({ branch, year } = {}) {
  const userFilter = {};
  if (branch) userFilter.branch = branch;
  if (year) userFilter.year = year;

  const [internships, users] = await Promise.all([
    Internship.find({ status: "published" }),
    User.find(userFilter),
  ]);

  const demandCount = new Map();
  for (const internship of internships) {
    for (const skill of internship.requiredSkills || []) {
      demandCount.set(skill, (demandCount.get(skill) || 0) + 1);
    }
  }

  const supplyCount = new Map();
  for (const user of users) {
    for (const skill of user.skills || []) {
      supplyCount.set(skill, (supplyCount.get(skill) || 0) + 1);
    }
  }

  const missingForEligibleCount = new Map();
  for (const user of users) {
    for (const internship of internships) {
      const { matchScore, missingSkills } = await computeMatch(user, internship);
      if (matchScore < ELIGIBLE_MATCH_THRESHOLD) continue;
      for (const skill of missingSkills) {
        missingForEligibleCount.set(skill, (missingForEligibleCount.get(skill) || 0) + 1);
      }
    }
  }

  const allSkills = new Set([...demandCount.keys(), ...supplyCount.keys(), ...missingForEligibleCount.keys()]);

  return Array.from(allSkills)
    .map((skill) => ({
      skill,
      demandCount: demandCount.get(skill) || 0,
      supplyCount: supplyCount.get(skill) || 0,
      missingForEligibleCount: missingForEligibleCount.get(skill) || 0,
    }))
    .sort((a, b) => b.missingForEligibleCount - a.missingForEligibleCount);
}

async function snapshotSkillGap() {
  const rows = await computeSkillGapLive();
  const snapshotAt = new Date();
  if (rows.length > 0) {
    await SkillGapSnapshot.insertMany(rows.map((r) => ({ ...r, snapshotAt })));
  }
  return rows.length;
}

async function getLatestSnapshot() {
  const latest = await SkillGapSnapshot.findOne().sort({ snapshotAt: -1 });
  if (!latest) return [];
  return SkillGapSnapshot.find({ snapshotAt: latest.snapshotAt }).sort({ missingForEligibleCount: -1 });
}

module.exports = { computeSkillGapLive, snapshotSkillGap, getLatestSnapshot };
