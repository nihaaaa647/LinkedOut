// Deterministic seed data (PRD Section 17): one admin, two students with different
// skill sets, a mix of published/pending/rejected internships, and applications across
// several statuses - so graders and teammates always start from the same state.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const connectDB = require("../config/db");
const User = require("../models/User");
const Internship = require("../models/Internship");
const Application = require("../models/Application");
const SkillSynonym = require("../models/SkillSynonym");
const LearningResource = require("../models/LearningResource");
const TrustScoreConfig = require("../models/TrustScoreConfig");
const SavedInternship = require("../models/SavedInternship");

const SEED_PASSWORD = "Passw0rd!123";

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Internship.deleteMany({}),
    Application.deleteMany({}),
    SkillSynonym.deleteMany({}),
    LearningResource.deleteMany({}),
    TrustScoreConfig.deleteMany({}),
    SavedInternship.deleteMany({}),
  ]);
}

async function seedSkillSynonyms() {
  await SkillSynonym.insertMany([
    { canonical: "JavaScript", aliases: ["JS"] },
    { canonical: "Node.js", aliases: ["NodeJS", "Node"] },
    { canonical: "React", aliases: ["React.js", "ReactJS"] },
    { canonical: "Python", aliases: ["Py"] },
    { canonical: "SQL", aliases: ["MySQL", "PostgreSQL"] },
    { canonical: "Docker", aliases: [] },
    { canonical: "AWS", aliases: ["Amazon Web Services"] },
    { canonical: "REST APIs", aliases: ["REST API", "RESTful APIs"] },
    { canonical: "Data Analysis", aliases: ["Data Analytics"] },
    { canonical: "MongoDB", aliases: ["Mongo"] },
  ]);
}

async function seedLearningResources() {
  await LearningResource.insertMany([
    {
      skill: "Docker",
      resources: [
        { title: "Docker for Beginners", url: "https://docs.docker.com/get-started/", type: "course" },
        { title: "Docker in 100 Seconds", url: "https://www.youtube.com/watch?v=Gjnup-PuquQ", type: "article" },
      ],
    },
    {
      skill: "AWS",
      resources: [{ title: "AWS Cloud Practitioner Essentials", url: "https://aws.amazon.com/training/", type: "course" }],
    },
    {
      skill: "SQL",
      resources: [{ title: "SQL Tutorial", url: "https://www.w3schools.com/sql/", type: "doc" }],
    },
    {
      skill: "React",
      resources: [{ title: "React Official Docs", url: "https://react.dev/learn", type: "doc" }],
    },
  ]);
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 11);

  const admin = await User.create({
    name: "Placement Cell Admin",
    email: "admin@college.edu",
    passwordHash,
    role: "admin",
  });

  const priya = await User.create({
    name: "Priya Sharma",
    email: "priya@college.edu",
    passwordHash,
    role: "user",
    branch: "CSE",
    year: 3,
    cgpa: 8.5,
    locationPreference: "Bengaluru",
    skills: ["JavaScript", "React", "Node.js", "REST APIs"],
  });

  const rahul = await User.create({
    name: "Rahul Verma",
    email: "rahul@college.edu",
    passwordHash,
    role: "user",
    branch: "IT",
    year: 4,
    cgpa: 7.2,
    locationPreference: "Remote",
    skills: ["Python", "SQL", "Data Analysis"],
  });

  return { admin, priya, rahul };
}

async function seedInternships(admin) {
  const now = new Date();
  const daysFromNow = (n) => new Date(now.getTime() + n * 86400000);

  const published1 = await Internship.create({
    title: "Frontend Development Intern",
    company: "Acme Web Co",
    description:
      "Build and ship features on our React-based customer dashboard alongside a senior engineer, " +
      "with weekly code reviews and a defined 3-month project scope.",
    eligibility: { branches: ["CSE", "IT"], minCgpa: 6, years: [3, 4] },
    eligibilityConfident: true,
    location: "Bengaluru",
    deadline: daysFromNow(20),
    stipend: 15000,
    requiredSkills: ["JavaScript", "React"],
    workMode: "hybrid",
    sourceType: "manual",
    status: "published",
    reviewedBy: admin._id,
    reviewedAt: now,
  });

  const published2 = await Internship.create({
    title: "Backend Engineering Intern",
    company: "Data Systems Ltd",
    description:
      "Work on our Node.js/MongoDB backend services, build REST APIs, and containerize services with " +
      "Docker as part of a small backend team with clear sprint deliverables.",
    eligibility: { branches: ["CSE", "IT", "ECE"], minCgpa: 6.5, years: [3, 4] },
    eligibilityConfident: true,
    location: "Remote",
    deadline: daysFromNow(15),
    stipend: 18000,
    requiredSkills: ["Node.js", "MongoDB", "Docker", "REST APIs"],
    workMode: "remote",
    sourceType: "scraped",
    sourceUrl: "https://careers.datasystems.example.com/backend-intern",
    scrapedAt: now,
    trustScore: 88,
    status: "published",
    reviewedBy: null,
    reviewedAt: now,
  });

  const published3 = await Internship.create({
    title: "Data Analyst Intern",
    company: "Insight Metrics",
    description:
      "Analyze product usage data, build dashboards, and present findings to the product team. " +
      "Work with SQL and Python daily under an experienced analytics mentor for the full term.",
    eligibility: { branches: ["IT", "CSE", "EEE"], minCgpa: 6, years: [3, 4] },
    eligibilityConfident: true,
    location: "Remote",
    deadline: daysFromNow(30),
    stipend: 10000,
    requiredSkills: ["Python", "SQL", "Data Analysis"],
    workMode: "remote",
    sourceType: "manual",
    status: "published",
    reviewedBy: admin._id,
    reviewedAt: now,
  });

  const pending = await Internship.create({
    title: "Marketing Intern",
    company: "Growth Hackers Inc",
    description:
      "Join our marketing team as an intern. Please share your bank details and Aadhaar for stipend " +
      "disbursement once selected. We offer mentorship and real project experience.",
    eligibility: { branches: ["Any"], minCgpa: 0, years: [2, 3, 4] },
    eligibilityConfident: true,
    location: "Delhi",
    deadline: daysFromNow(10),
    requiredSkills: [],
    sourceType: "scraped",
    sourceUrl: "https://careers.growthhackers.example.com/marketing-intern",
    scrapedAt: now,
    trustScore: 55,
    status: "pending_review",
    reviewedBy: null,
  });

  const rejected = await Internship.create({
    title: "Easy Work From Home",
    company: "Quick Cash Ventures",
    description: "Contact us on WhatsApp only for details.",
    eligibility: { branches: [], minCgpa: 0, years: [] },
    eligibilityConfident: false,
    location: "Anywhere",
    deadline: daysFromNow(400),
    requiredSkills: [],
    sourceType: "scraped",
    sourceUrl: "https://quickforms.example.xyz/apply-now",
    scrapedAt: now,
    trustScore: 12,
    status: "rejected",
    reviewedBy: null,
    reviewedAt: now,
  });

  const closed = await Internship.create({
    title: "Summer Research Intern",
    company: "Acme Web Co",
    description: "A completed research internship, kept for history/audit purposes.",
    eligibility: { branches: ["CSE"], minCgpa: 7, years: [4] },
    eligibilityConfident: true,
    location: "Bengaluru",
    deadline: daysFromNow(-10),
    requiredSkills: ["Python"],
    workMode: "onsite",
    sourceType: "manual",
    status: "closed",
    reviewedBy: admin._id,
    reviewedAt: now,
  });

  return { published1, published2, published3, pending, rejected, closed };
}

async function seedApplications({ priya, rahul }, { published1, published2, published3 }) {
  await Application.create({
    userId: priya._id,
    internshipId: published1._id,
    status: "Shortlisted",
    statusHistory: [
      { status: "Applied", changedBy: priya._id },
      { status: "Shortlisted", changedBy: priya._id },
    ],
  });

  await Application.create({
    userId: priya._id,
    internshipId: published2._id,
    status: "Applied",
    statusHistory: [{ status: "Applied", changedBy: priya._id }],
  });

  await Application.create({
    userId: rahul._id,
    internshipId: published3._id,
    status: "Selected",
    statusHistory: [
      { status: "Applied", changedBy: rahul._id },
      { status: "Shortlisted", changedBy: rahul._id },
      { status: "Selected", changedBy: rahul._id },
    ],
  });

  await Application.create({
    userId: rahul._id,
    internshipId: published1._id,
    status: "Withdrawn",
    isActive: false,
    withdrawnAt: new Date(),
    statusHistory: [
      { status: "Applied", changedBy: rahul._id },
      { status: "Withdrawn", changedBy: rahul._id },
    ],
  });
}

async function run() {
  await connectDB();
  console.log("Clearing existing collections...");
  await clearCollections();

  console.log("Seeding skill synonyms and learning resources...");
  await seedSkillSynonyms();
  await seedLearningResources();
  await TrustScoreConfig.getConfig();

  console.log("Seeding users...");
  const { admin, priya, rahul } = await seedUsers();

  console.log("Seeding internships...");
  const internships = await seedInternships(admin);

  console.log("Seeding applications...");
  await seedApplications({ priya, rahul }, internships);

  await SavedInternship.create({ userId: priya._id, internshipId: internships.published3._id });

  console.log("\nSeed complete. Test credentials:");
  console.log(`  Admin:   admin@college.edu / ${SEED_PASSWORD}`);
  console.log(`  Student: priya@college.edu / ${SEED_PASSWORD}  (skills: JS/React/Node)`);
  console.log(`  Student: rahul@college.edu / ${SEED_PASSWORD}  (skills: Python/SQL/Data Analysis)`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
