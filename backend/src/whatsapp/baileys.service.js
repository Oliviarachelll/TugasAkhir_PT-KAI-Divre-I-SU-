/**
 * Baileys WhatsApp Service
 * SCOPE: Notifikasi keluar + pengiriman token reset password
 *
 * Fungsi yang tersedia:
 *   1. kirimTokenReset(nomor, token)             → Reset password
 *   2. notifikasiLaporanDisetujui(nomor, nama, tanggal, unit)
 *   3. notifikasiLaporanDitolak(nomor, nama, tanggal, alasan)
 *   4. notifikasiPermintaanUpdate(nomor, nama, jenis, status)
 *
 * Install Baileys terpisah:
 *   npm install @whiskeysockets/baileys
 *
 * Aktifkan di .env:
 *   ENABLE_WHATSAPP=true
 */

let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers;

try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  Browsers = baileys.Browsers;
} catch {
  console.warn('[WA] @whiskeysockets/baileys belum terinstall.');
  console.warn('[WA] Jalankan: npm install @whiskeysockets/baileys');
  console.warn('[WA] Fitur WhatsApp dinonaktifkan sementara.');
}

const path = require('path');
const EventEmitter = require('events');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.sessionPath = process.env.WA_SESSION_PATH || './whatsapp-session';
    this.isConnected = false;
    this._ready = false;
    this._messageQueue = []; // antrian jika belum terhubung
  }

  /**
   * Inisialisasi koneksi WhatsApp (dipanggil saat server start)
   */
  async connect() {
    if (!makeWASocket) {
      this.emit('unavailable');
      return;
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(
        path.resolve(this.sessionPath)
      );

      this.sock = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: true,
        // Nonaktifkan fitur yang tidak diperlukan untuk efisiensi
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('[WA] 📱 Scan QR Code untuk login WhatsApp');
          this.emit('qr', qr);
        }

        if (connection === 'close') {
          this.isConnected = false;
          this._ready = false;
          this.emit('disconnected');

          const code = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = code !== DisconnectReason.loggedOut;

          console.log(`[WA] Koneksi tertutup (${code}). Reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            console.log('[WA] Mencoba reconnect dalam 5 detik...');
            setTimeout(() => this.connect(), 5000);
          } else {
            console.log('[WA] Sesi logout. Hapus folder session dan scan QR ulang.');
          }
        }

        if (connection === 'open') {
          console.log('[WA] ✅ WhatsApp terhubung!');
          this.isConnected = true;
          this._ready = true;
          this.emit('connected');

          // Kirim antrian pesan yang tertunda
          await this._flushQueue();
        }
      });
    } catch (err) {
      console.error('[WA] Gagal connect:', err.message);
      setTimeout(() => this.connect(), 10000);
    }
  }

  /**
   * Kirim pesan — dengan antrian jika belum siap
   * @param {string} nomor - Format: 628xxx (tanpa + atau spasi)
   * @param {string} teks - Isi pesan
   */
  async kirimPesan(nomor, teks) {
    if (!makeWASocket) {
      console.warn(`[WA] Baileys tidak tersedia. Pesan ke ${nomor} tidak terkirim.`);
      return false;
    }

    const nomorBersih = nomor.replace(/[^0-9]/g, '');
    const jid = `${nomorBersih}@s.whatsapp.net`;

    if (!this.isConnected || !this._ready) {
      console.warn(`[WA] Belum terhubung. Pesan ke ${nomor} dimasukkan ke antrian.`);
      this._messageQueue.push({ jid, teks });
      return false;
    }

    try {
      await this.sock.sendMessage(jid, { text: teks });
      console.log(`[WA] ✉️  Pesan terkirim ke ${nomor}`);
      return true;
    } catch (err) {
      console.error(`[WA] Gagal kirim ke ${nomor}:`, err.message);
      return false;
    }
  }

  /**
   * Kirim antrian pesan yang tertunda
   */
  async _flushQueue() {
    if (this._messageQueue.length === 0) return;

    console.log(`[WA] Mengirim ${this._messageQueue.length} pesan tertunda...`);
    while (this._messageQueue.length > 0) {
      const { jid, teks } = this._messageQueue.shift();
      try {
        await this.sock.sendMessage(jid, { text: teks });
        await new Promise((r) => setTimeout(r, 500)); // delay antar pesan
      } catch (err) {
        console.error('[WA] Gagal kirim antrian:', err.message);
      }
    }
  }

  // ============================================================
  // TEMPLATE PESAN YANG DIGUNAKAN SISTEM
  // ============================================================

  /**
   * 1. Kirim token reset password via WhatsApp
   * Dipanggil di: auth.controller.js → requestResetPassword()
   *
   * @param {string} nomor - No HP pengguna (format 628xxx)
   * @param {string} nama - Nama pengguna
   * @param {string} token - Token reset (32 karakter hex)
   */
  async kirimTokenReset(nomor, nama, token) {
    const pesan =
      `🔐 *Reset Kata Sandi - Sistem Laporan*\n\n` +
      `Halo ${nama},\n\n` +
      `Anda meminta reset kata sandi. Gunakan token berikut:\n\n` +
      `*${token}*\n\n` +
      `⏰ Token berlaku selama *1 jam*.\n` +
      `🚫 Abaikan pesan ini jika Anda tidak meminta reset kata sandi.`;

    return await this.kirimPesan(nomor, pesan);
  }

  /**
   * 2. Notifikasi laporan disetujui
   * Dipanggil saat status laporan berubah ke DISETUJUI
   *
   * @param {string} nomor - No HP pengguna
   * @param {string} nama - Nama pengguna
   * @param {string} tanggal - Tanggal laporan (format: DD/MM/YYYY)
   * @param {string} namaUnit - Nama unit
   */
  async notifikasiLaporanDisetujui(nomor, nama, tanggal, namaUnit) {
    const pesan =
      `✅ *Laporan Disetujui*\n\n` +
      `Halo ${nama},\n\n` +
      `Laporan Anda dari unit *${namaUnit}*\n` +
      `tanggal *${tanggal}* telah *DISETUJUI*.\n\n` +
      `Silakan login untuk melihat detail.`;

    return await this.kirimPesan(nomor, pesan);
  }

  /**
   * 3. Notifikasi laporan ditolak/revisi
   *
   * @param {string} nomor - No HP pengguna
   * @param {string} nama - Nama pengguna
   * @param {string} tanggal - Tanggal laporan
   * @param {string} status - 'DITOLAK' atau 'REVISI'
   */
  async notifikasiLaporanDitolak(nomor, nama, tanggal, status) {
    const emoji = status === 'DITOLAK' ? '❌' : '🔄';
    const pesan =
      `${emoji} *Laporan ${status}*\n\n` +
      `Halo ${nama},\n\n` +
      `Laporan tanggal *${tanggal}* perlu perhatian Anda.\n` +
      `Status: *${status}*\n\n` +
      `Silakan login untuk melihat catatan dari admin.`;

    return await this.kirimPesan(nomor, pesan);
  }

  /**
   * 4. Notifikasi update permintaan bantuan
   *
   * @param {string} nomor - No HP pengguna
   * @param {string} nama - Nama pengguna
   * @param {string} jenis - Jenis permintaan
   * @param {string} status - Status baru permintaan
   */
  async notifikasiPermintaanUpdate(nomor, nama, jenis, status) {
    const pesan =
      `📋 *Update Permintaan Bantuan*\n\n` +
      `Halo ${nama},\n\n` +
      `Permintaan *${jenis}* Anda\n` +
      `sekarang berstatus: *${status}*\n\n` +
      `Silakan login untuk detail.`;

    return await this.kirimPesan(nomor, pesan);
  }
}

// Singleton instance — digunakan di seluruh aplikasi
const whatsappService = new WhatsAppService();

module.exports = whatsappService;

// Standalone mode (untuk testing)
if (require.main === module) {
  require('dotenv').config();
  whatsappService.connect();
  console.log('[WA] Service berjalan dalam mode standalone');
}
