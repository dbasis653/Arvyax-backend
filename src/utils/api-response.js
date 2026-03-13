// Wraps all successful API responses in a consistent shape: { statusCode, data, message, success }.
// success is derived automatically — true for 2xx, false for 4xx/5xx.
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

export { ApiResponse };
