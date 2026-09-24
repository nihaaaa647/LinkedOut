const NodeCache = require("node-cache");
const SkillSynonym = require("../models/SkillSynonym");

// The skill map rarely changes at runtime, so it's cached in-process for a few minutes
// rather than hit on every profile save / listing parse / resume upload.
const cache = new NodeCache({ stdTTL: 300 });
const CACHE_KEY = "skillMap";

async function loadSkillMap() {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const docs = await SkillSynonym.find();
  const map = new Map();
  for (const doc of docs) {
    map.set(doc.canonical.toLowerCase(), doc.canonical);
    for (const alias of doc.aliases) {
      map.set(alias.toLowerCase(), doc.canonical);
    }
  }
  cache.set(CACHE_KEY, map);
  return map;
}

// Unknown skills are still allowed through (trimmed as-is) rather than rejected -
// the dictionary accelerates matching, it isn't a closed allow-list of valid skills.
async function normalizeSkill(rawSkill) {
  const map = await loadSkillMap();
  const trimmed = rawSkill.trim();
  return map.get(trimmed.toLowerCase()) || trimmed;
}

async function normalizeSkills(rawSkills) {
  const map = await loadSkillMap();
  const seen = new Set();
  const result = [];
  for (const raw of rawSkills) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const canonical = map.get(trimmed.toLowerCase()) || trimmed;
    const dedupeKey = canonical.toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      result.push(canonical);
    }
  }
  return result;
}

// Scans free text (a resume, a scraped listing description) for every dictionary
// entry (canonical name or alias) and returns the canonical skills found, for
// resume parsing (Section 6) and scraped requiredSkills extraction (Section 4).
async function extractSkillsFromText(text) {
  if (!text) return [];
  const map = await loadSkillMap();
  const lowerText = text.toLowerCase();
  const found = new Set();

  for (const [term, canonical] of map.entries()) {
    // word-boundary match so "R" doesn't match inside "React", etc.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?:$|[^a-z0-9+#])`, "i");
    if (pattern.test(` ${lowerText} `)) {
      found.add(canonical);
    }
  }

  return Array.from(found);
}

function invalidateSkillMapCache() {
  cache.del(CACHE_KEY);
}

module.exports = { normalizeSkill, normalizeSkills, extractSkillsFromText, invalidateSkillMapCache };
