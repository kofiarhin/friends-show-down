if (!process.env.CLIENT_URL) {
  throw new Error("Missing required env var: CLIENT_URL");
}

const parsedLimit = Number.parseInt(process.env.QUESTION_TIME_LIMIT, 10);
if (!process.env.QUESTION_TIME_LIMIT || Number.isNaN(parsedLimit)) {
  throw new Error("Missing or invalid env var: QUESTION_TIME_LIMIT");
}

const allowedOrigins = process.env.CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => origin.replace(/\/+$/, ""));

if (allowedOrigins.length === 0) {
  throw new Error("Missing required env var: CLIENT_URL");
}

const parsedPort = Number.parseInt(process.env.PORT, 10);

module.exports = {
  port: Number.isNaN(parsedPort) ? 3001 : parsedPort,
  clientUrl: allowedOrigins[0],
  allowedOrigins,
  questionTimeLimit: parsedLimit,
};
