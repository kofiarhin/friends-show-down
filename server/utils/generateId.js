const { randomUUID } = require("crypto");

function generateId() {
  // 6-char alphanumeric from a UUID (strip hyphens, take first 6)
  return randomUUID().replace(/-/g, "").slice(0, 6);
}

module.exports = { generateId };
