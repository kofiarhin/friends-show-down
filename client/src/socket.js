import { io } from "socket.io-client";
import { socketUrl } from "./config";

export const socket = io(socketUrl, {
  transports: ["websocket", "polling"],
  autoConnect: true,
});
