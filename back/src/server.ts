import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { createServer } from "node:http";
import liveKitRoutes from "./routes/liveKit";
import { Server } from "socket.io";
import authRoutes from "./routes/auth";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user";

const port = process.env.PORT;
const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
const server = createServer(app);
const io = new Server(server);

app.use("/auth", authRoutes);
app.use("/liveKit", liveKitRoutes);
app.use("/user", userRoutes);

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    io.emit("message", data);
  });
});

server.listen(port, () => {
  console.log(`🚀 Server is running on port ${process.env.PORT} 🚀`);
});
