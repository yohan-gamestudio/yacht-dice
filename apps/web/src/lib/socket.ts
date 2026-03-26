import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = typeof window !== 'undefined'
      ? (window.location.protocol + '//' + window.location.hostname + ':3001')
      : 'http://localhost:3001';
    socket = io(url, {
      autoConnect: false,
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
