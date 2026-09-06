/** Error carrying an HTTP status so controllers can respond consistently. */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
  static badRequest(msg) { return new ApiError(400, msg); }
  static unauthorized(msg) { return new ApiError(401, msg); }
  static forbidden(msg) { return new ApiError(403, msg); }
  static notFound(msg) { return new ApiError(404, msg); }
  static conflict(msg) { return new ApiError(409, msg); }
}

module.exports = ApiError;
