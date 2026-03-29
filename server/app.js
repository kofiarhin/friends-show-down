const express = require("express");
const cors = require("cors");
const config = require("./config");

const app = express();

app.use(cors({ origin: config.allowedOrigins }));
app.use(express.json());

app.use("/api/games", require("./routes/games"));

app.get("/api/health", (req, res) => {
  res.json({ message: "ok" });
});

app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON." });
  }

  return next(err);
});

module.exports = app;
