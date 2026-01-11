import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
  }
  return socket;
}

export function joinService(serviceId: string) {
  const s = getSocket();
  s.emit("join-service", serviceId);
}

export function leaveService(serviceId: string) {
  const s = getSocket();
  s.emit("leave-service", serviceId);
}

export function onServiceUpdate(callback: (data: any) => void) {
  const s = getSocket();
  s.on("service-updated", callback);
  return () => {
    s.off("service-updated", callback);
  };
}
