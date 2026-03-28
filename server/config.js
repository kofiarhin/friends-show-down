if (!process.env.CLIENT_URL) {
  throw new Error("Missing required env var: CLIENT_URL");
}

const parsedLimit = parseInt(process.env.QUESTION_TIME_LIMIT, 10);
if (!process.env.QUESTION_TIME_LIMIT || isNaN(parsedLimit)) {
  throw new Error("Missing or invalid env var: QUESTION_TIME_LIMIT");
}

const allowedOrigins = process.env.CLIENT_URL.split(",").map((o) => o.trim());

module.exports = {
  port: process.env.PORT || 3001,
  clientUrl: allowedOrigins[0],
  allowedOrigins,
  questionTimeLimit: parsedLimit,
};
