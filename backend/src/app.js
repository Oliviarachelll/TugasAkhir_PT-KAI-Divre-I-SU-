/**
 * app.js - Express Application Entry Point
 * Backend: Node.js + Express + Prisma + Socket.io + Baileys
 */

require('dotenv').config();
require('express-async-errors'); // Handle async errors otomatis

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Config & Utils
const prisma = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const { sendSuccess, sendError } = require('./utils/response');

// Routes
const authRoutes = require('./routes/auth.routes');
const penggunaRoutes = require('./routes/pengguna.routes');
const unitRoutes = require('./routes/unit.routes');
const laporanRoutes = require('./routes/laporan.routes');
const { targetRouter, komoditiRouter, permintaanRouter, auditRouter } = require('./routes/misc.routes');

// Socket.io & WhatsApp
const { setupSocketEvents } = require('./whatsapp/whatsapp.events');
const whatsappService = require('./whatsapp/baileys.service');

// ============================================================
// INISIALISASI APP
// ============================================================
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Expose io ke app (bisa diakses di controller via req.app.get('io'))
app.set('io', io);

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ============================================================
// ROUTES
// ============================================================
const API_PREFIX = '/api';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/pengguna`, penggunaRoutes);
app.use(`${API_PREFIX}/unit`, unitRoutes);
app.use(`${API_PREFIX}/laporan`, laporanRoutes);
app.use(`${API_PREFIX}/target`, targetRouter);
app.use(`${API_PREFIX}/komoditi`, komoditiRouter);
app.use(`${API_PREFIX}/permintaan`, permintaanRouter);
app.use(`${API_PREFIX}/audit`, auditRouter);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendSuccess(res, {
      status: 'ok',
      database: 'connected',
      whatsapp: whatsappService.isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    }, 'Server sehat');
  } catch {
    return sendError(res, 'Database tidak terhubung', 503);
  }
});

// 404 handler
app.use((req, res) => {
  return sendError(res, `Route ${req.method} ${req.path} tidak ditemukan`, 404);
});

// Global error handler (harus paling akhir)
app.use(errorHandler);

// ============================================================
// SOCKET.IO SETUP
// ============================================================
const socketEvents = setupSocketEvents(io);

// Relay WhatsApp events ke Socket.io admin
whatsappService.on('connected', () => {
  socketEvents.emitWAStatus('connected');
});
whatsappService.on('disconnected', () => {
  socketEvents.emitWAStatus('disconnected');
});
whatsappService.on('qr', (qr) => {
  socketEvents.emitWAStatus('qr', qr);
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test koneksi database
    await prisma.$connect();
    console.log('✅ Database terhubung');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
      console.log(`📋 API tersedia di http://localhost:${PORT}/api`);
      console.log(`🔍 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    });

    // Inisialisasi WhatsApp (opsional, bisa dinonaktifkan jika belum perlu)
    if (process.env.ENABLE_WHATSAPP === 'true') {
      console.log('📱 Menginisialisasi koneksi WhatsApp...');
      whatsappService.connect().catch((err) => {
        console.error('[BAILEYS] Gagal connect:', err.message);
      });
    }
  } catch (error) {
    console.error('❌ Gagal memulai server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Menghentikan server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

module.exports = { app, io };
