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

module.exports = app;
