/**
 * Baileys WhatsApp Service (jalur utama pengiriman — migrasi dari Meta Cloud API)
 * SCOPE: Notifikasi keluar + pengiriman token reset password + pengingat kondisional
 *
 * Fungsi yang tersedia:
 *   1. kirimTokenReset(nomor, token)             → Reset password
 *   2. notifikasiLaporanDisetujui(nomor, nama, tanggal, unit)
 *   3. notifikasiLaporanDitolak(nomor, nama, tanggal, alasan)
 *   4. notifikasiPermintaanUpdate(nomor, nama, jenis, status)
 *   5. notifikasiPengingatDeadline(...)          → Pengingat unit belum lapor (H-3/H-1/H+)
 *   6. notifikasiRevisiTertunda(...)             → Pengingat laporan DITOLAK/REVISI belum diperbaiki
 *
 * Aktifkan di .env:
 *   ENABLE_WHATSAPP=true
 */

let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers;

async function loadBaileys() {
  if (makeWASocket) return true;
  try {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    Browsers = baileys.Browsers;
    return true;
  } catch (err) {
    console.warn('[WA] @whiskeysockets/baileys gagal diload:', err.message);
    return false;
  }
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
    const loaded = await loadBaileys();
    if (!loaded) {
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
          const qrcode = require('qrcode-terminal');
          qrcode.generate(qr, { small: true });
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
   * Normalisasi nomor HP ke format internasional 62xxx (satu-satunya helper resmi).
   * '0813...' -> '62813...', '62813...' tetap, karakter non-digit dibuang.
   */
  static formatNomor62(nomor) {
    if (!nomor) return '';
    let bersih = String(nomor).replace(/[^0-9]/g, '');
    if (bersih.startsWith('0')) {
      bersih = '62' + bersih.substring(1);
    }
    return bersih;
  }

  /**
   * Status koneksi untuk health-check / UI admin (tanpa membocorkan socket).
   */
  getStatus() {
    return {
      connected: this.isConnected && this._ready,
      queued: this._messageQueue.length,
    };
  }

  /**
   * Kirim pesan — dengan antrian jika belum siap
   * @param {string} nomor - Format: 628xxx (tanpa + atau spasi)
   * @param {string} teks - Isi pesan
   */
  async kirimPesan(nomor, teks) {
    const loaded = await loadBaileys();
    if (!loaded) {
      console.warn(`[WA] Baileys tidak tersedia. Pesan ke ${nomor} tidak terkirim.`);
      return false;
    }

    const nomorBersih = WhatsAppService.formatNomor62(nomor);
    if (!nomorBersih) {
      console.warn('[WA] Nomor tujuan kosong/invalid, pengiriman dibatalkan.');
      return false;
    }
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

  /**
   * 5. Pengingat deadline laporan (jalur Baileys — pengganti broadcast Meta).
   * Dipanggil di: reminder.service.js → kirimPengingatUnit() / cron 08:00
   */
  async notifikasiPengingatDeadline(nomor, nama, namaUnit, tenggat, sisaHari) {
    const urgensi = sisaHari < 0
      ? `⚠️ Sudah lewat *${Math.abs(sisaHari)} hari* dari tenggat.`
      : sisaHari === 0
        ? `⚠️ Tenggat *HARI INI*.`
        : `⏰ Sisa *${sisaHari} hari* menuju tenggat.`;
    const pesan =
      `⏰ *Pengingat Laporan - Sistem Laporan*\n\n` +
      `Halo ${nama} (${namaUnit}),\n\n` +
      `Unit Anda belum mengirim laporan periode ini.\n` +
      `Tenggat: *${tenggat}*\n` +
      `${urgensi}\n\n` +
      `Silakan login dan submit laporan sebelum tenggat.`;

    return await this.kirimPesan(nomor, pesan);
  }

  /**
   * 6. Pengingat revisi tertunda (DITOLAK/REVISI belum diperbaiki).
   * Dipanggil di: reminder.service.js → cron 16:00
   */
  async notifikasiRevisiTertunda(nomor, nama, tanggal, status, hariTertunda) {
    const emoji = status === 'DITOLAK' ? '❌' : '🔄';
    const pesan =
      `${emoji} *Pengingat Revisi Laporan*\n\n` +
      `Halo ${nama},\n\n` +
      `Laporan tanggal *${tanggal}* berstatus *${status}* ` +
      `dan belum diperbaiki selama *${hariTertunda} hari*.\n\n` +
      `Silakan login untuk melihat catatan reviewer dan ajukan ulang.`;

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
