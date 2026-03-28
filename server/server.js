require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { initSocket } = require("./socket/index");

const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"],
  },
});

initSocket(io);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
