import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const isLocal = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const url = isLocal
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    socket = io(url, {
      autoConnect: false,
      path: '/socket.io/',
    });
  }
  return socket;
}

export function resetSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
