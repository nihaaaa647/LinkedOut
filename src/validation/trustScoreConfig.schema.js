const { z } = require("zod");

const updateTrustScoreConfigSchema = z.object({
  weights: z
    .object({
      sourceDomainReputation: z.number().min(0).max(100),
      contactChannel: z.number().min(0).max(100),
      descriptionQuality: z.number().min(0).max(100),
      stipendRoleMismatch: z.number().min(0).max(100),
      deadlinePlausibility: z.number().min(0).max(100),
      duplicateScamPattern: z.number().min(0).max(100),
    })
    .optional(),
  criticalKeywords: z
    .object({
      paymentRequest: z.array(z.string().trim().min(1)).optional(),
      sensitiveInfoRequest: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
  reportThreshold: z.number().int().min(1).max(50).optional(),
});

module.exports = { updateTrustScoreConfigSchema };
