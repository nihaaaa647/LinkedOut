const { z } = require("zod");

const resourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url(),
  type: z.enum(["course", "article", "doc"]),
});

const createLearningResourceSchema = z.object({
  skill: z.string().trim().min(1).max(100),
  resources: z.array(resourceSchema).min(1).max(3),
});

const updateLearningResourceSchema = z.object({
  resources: z.array(resourceSchema).min(1).max(3),
});

module.exports = { createLearningResourceSchema, updateLearningResourceSchema };
