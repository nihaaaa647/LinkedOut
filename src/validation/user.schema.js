const { z } = require("zod");
const { REASONS } = require("../models/ListingReport");

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  branch: z.string().trim().max(100).optional(),
  year: z.number().int().min(1).max(6).optional(),
  cgpa: z.number().min(0).max(10).optional(),
  locationPreference: z.string().trim().max(200).optional(),
  certifications: z.array(z.string().trim().min(1)).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
});

const reportListingSchema = z.object({
  reason: z.enum(REASONS),
  description: z.string().trim().max(1000).optional(),
});

module.exports = { updateProfileSchema, reportListingSchema };
