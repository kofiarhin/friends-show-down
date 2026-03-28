const express = require("express");
const cors = require("cors");

const app = express();

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: clientUrl }));
app.use(express.json());

app.use("/api/games", require("./routes/games"));

app.get("/api/health", (req, res) => {
  res.json({ message: "ok" });
});

module.exports = app;
