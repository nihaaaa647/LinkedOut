const { z } = require("zod");

const eligibilitySchema = z.object({
  branches: z.array(z.string().trim().min(1)).default([]),
  minCgpa: z.number().min(0).max(10).default(0),
  years: z.array(z.number().int().min(1).max(6)).default([]),
});

const createInternshipSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  eligibility: eligibilitySchema,
  location: z.string().trim().min(1).max(200),
  deadline: z.coerce.date(),
  stipend: z.number().min(0).optional(),
  requiredSkills: z.array(z.string().trim().min(1)).optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
  duration: z.string().trim().max(100).optional(),
  // sourceType/status/trustScore/reviewedBy are server-assigned, never client-settable.
});

const updateInternshipSchema = createInternshipSchema.partial();

// Edit-and-approve (Section 5) needs to be able to fix a scraped listing's
// low-confidence eligibility flag as part of publishing it - not exposed on the
// general create/update schemas since admins don't set it by hand otherwise.
const approveInternshipSchema = updateInternshipSchema.extend({
  eligibilityConfident: z.boolean().optional(),
});

const listInternshipsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  location: z.string().trim().optional(),
  domain: z.string().trim().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
  minStipend: z.coerce.number().min(0).optional(),
  deadlineBefore: z.coerce.date().optional(),
});

module.exports = {
  createInternshipSchema,
  updateInternshipSchema,
  approveInternshipSchema,
  listInternshipsQuerySchema,
};
