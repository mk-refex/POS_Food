import { Server } from 'socket.io';

let io = null;

/**
 * Attach Socket.IO to the HTTP server. Call once from server.js.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer) {
  if (io) return io;
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io',
  });
  io.on('connection', (socket) => {
    console.log('[Socket] client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('[Socket] client disconnected:', socket.id);
    });
  });
  return io;
}

/**
 * Get the Socket.IO instance. Must call initSocket(server) first.
 */
export function getIO() {
  return io;
}

/** Emit when a new transaction is created (billing or self-bill). */
export function emitTransactionCreated() {
  if (io) io.emit('transaction:created');
}

/** Emit when menu is updated or deleted. */
export function emitMenuUpdated() {
  if (io) io.emit('menu:updated');
}

/** Emit when master data (employees, support staff, guests) is created/updated/deleted. */
export function emitMasterUpdated() {
  if (io) io.emit('master:updated');
}
