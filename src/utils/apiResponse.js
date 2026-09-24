function ok(res, data, message = "OK", status = 200) {
  return res.status(status).json({ success: true, data, message });
}

function created(res, data, message = "Created") {
  return ok(res, data, message, 201);
}

class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

module.exports = { ok, created, ApiError };
