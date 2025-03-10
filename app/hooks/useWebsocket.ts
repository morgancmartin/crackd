// app/hooks/useWebSocket.js
import { User } from "@prisma/client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

export function useWebSocket(url: string, user: User) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketIo = io(url, {
      auth: {
        userId: user?.id,
      },
    });

    socketIo.on("connect", () => {
      setIsConnected(true);
    });

    socketIo.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(socketIo as any);

    return () => {
      socketIo.disconnect();
    };
  }, [url]);

  return { socket, isConnected };
}
