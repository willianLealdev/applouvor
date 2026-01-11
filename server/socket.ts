import { Server as SocketIOServer } from "socket.io";
import type { Server } from "http";

let io: SocketIOServer | null = null;

export function setupSocket(httpServer: Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-service", (serviceId: string) => {
      socket.join(`service:${serviceId}`);
      console.log(`Client ${socket.id} joined service:${serviceId}`);
    });

    socket.on("leave-service", (serviceId: string) => {
      socket.leave(`service:${serviceId}`);
      console.log(`Client ${socket.id} left service:${serviceId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitServiceUpdate(serviceId: string, data: any) {
  if (io) {
    io.to(`service:${serviceId}`).emit("service-updated", data);
  }
}
