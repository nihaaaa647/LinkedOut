const { z } = require("zod");
const { STATUSES } = require("../models/Application");

const applySchema = z.object({
  internshipId: z.string().trim().min(1),
});

const adminUpdateStatusSchema = z.object({
  status: z.enum(STATUSES.filter((s) => s !== "Withdrawn")),
});

const listApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["appliedAt", "-appliedAt", "status", "-status"]).default("-appliedAt"),
});

const adminListApplicationsQuerySchema = listApplicationsQuerySchema.extend({
  internshipId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  status: z.enum(STATUSES).optional(),
});

module.exports = {
  applySchema,
  adminUpdateStatusSchema,
  listApplicationsQuerySchema,
  adminListApplicationsQuerySchema,
};
