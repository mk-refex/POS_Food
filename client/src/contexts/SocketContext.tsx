import { createContext, useContext, useRef, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "../api/client";

const SocketContext = createContext<Socket | null>(null);

// Singleton socket so it survives React Strict Mode unmount/remount and route changes.
// We do not disconnect on provider unmount; connection stays alive for the app session.
let appSocket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!appSocket) {
    const url = getSocketUrl();
    appSocket = io(url, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return appSocket;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  if (socketRef.current === null) {
    socketRef.current = getSocket();
  }
  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Subscribe to a socket event; refetches when event is received. */
export function useSocketEvent(event: string, onEvent: () => void) {
  const socket = useSocket();
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;
  const stableCb = useCallback(() => {
    cbRef.current();
  }, []);
  useEffect(() => {
    if (!socket) return;
    socket.on(event, stableCb);
    return () => {
      socket.off(event, stableCb);
    };
  }, [socket, event, stableCb]);
}
