import { io } from "socket.io-client";
import { socketUrl } from "./config";

const socket = io(socketUrl, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

export default socket;
