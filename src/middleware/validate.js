const { ApiError } = require("../utils/apiResponse");

// Validates req[part] against a Zod schema, strips unknown fields, replaces req[part] with the parsed value.
function validate(schema, part = "body") {
  return function validateMiddleware(req, res, next) {
    const result = schema.strict().safeParse(req[part]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return next(new ApiError(400, "Validation failed", errors));
    }
    req[part] = result.data;
    next();
  };
}

module.exports = validate;
