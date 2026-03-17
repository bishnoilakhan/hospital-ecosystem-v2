import { io } from "socket.io-client";

const socket = io("https://hospital-ecosystem-v2.onrender.com");

export default socket;
