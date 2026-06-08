/**
 * Socket.io Events Handler
 * Definisi semua event realtime
 */

/**
 * Setup socket.io events
 * @param {import('socket.io').Server} io
 */
const setupSocketEvents = (io) => {
  // Namespace untuk dashboard
  const dashboard = io.of('/dashboard');

  dashboard.on('connection', (socket) => {
    console.log(`[SOCKET.IO] Client terhubung: ${socket.id}`);

    // Join room berdasarkan unit
    socket.on('join:unit', (id_unit) => {
      socket.join(`unit:${id_unit}`);
      console.log(`[SOCKET.IO] ${socket.id} join unit:${id_unit}`);
    });

    // Join room admin
    socket.on('join:admin', () => {
      socket.join('admin');
      console.log(`[SOCKET.IO] ${socket.id} join admin room`);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET.IO] Client terputus: ${socket.id}`);
    });
  });

  return {
    /**
     * Broadcast laporan baru ke unit terkait dan admin
     * @param {object} laporan
     */
    emitLaporanBaru: (laporan) => {
      dashboard.to(`unit:${laporan.id_unit}`).emit('laporan:baru', laporan);
      dashboard.to('admin').emit('laporan:baru', laporan);
    },

    /**
     * Broadcast update status laporan
     */
    emitStatusLaporanUpdate: (laporan) => {
      dashboard.to(`unit:${laporan.id_unit}`).emit('laporan:status_update', laporan);
      dashboard.to('admin').emit('laporan:status_update', laporan);
    },

    /**
     * Broadcast permintaan bantuan baru ke admin
     */
    emitPermintaanBaru: (permintaan) => {
      dashboard.to('admin').emit('permintaan:baru', permintaan);
    },

    /**
     * Notifikasi WhatsApp status (QR, connected, dll)
     */
    emitWAStatus: (status, data = null) => {
      dashboard.to('admin').emit('wa:status', { status, data });
    },
  };
};

module.exports = { setupSocketEvents };
