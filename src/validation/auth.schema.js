const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  branch: z.string().trim().max(100).optional(),
  year: z.number().int().min(1).max(6).optional(),
  cgpa: z.number().min(0).max(10).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  // Note: "role" is deliberately not part of this schema. validate() uses .strict(),
  // so a client-supplied "role" field (or any other unknown field) fails validation
  // with 400 rather than being silently accepted - see Business Rule 7.
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

module.exports = { registerSchema, loginSchema };
