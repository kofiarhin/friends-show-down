require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { initSocket } = require("./socket/index");
const config = require("./config");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.allowedOrigins,
    methods: ["GET", "POST"],
  },
});

initSocket(io);

server.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
